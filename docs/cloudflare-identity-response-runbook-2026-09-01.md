# Cloudflare HTML delivery runbook

## Incident signature

On 2026-09-01, SSR page responses from both the `workers.dev` hostname and
`lako.services` returned `200` but did not finish when the client requested
`Accept-Encoding: identity`. The same pages completed with `gzip` or `br`.
Static assets, redirects, `HEAD` requests, and middleware `405` responses were
not affected.

This matters because a partial `200` can evade status-only health checks while
clients and crawlers wait for the final chunk indefinitely.

## Delivery architecture

Marketing pages are prerendered with Astro `output: 'static'` and served by
Cloudflare Static Assets. Only these endpoints remain on demand:

- `POST /api/contact`
- `POST /api/register-business`

`wrangler.toml` explicitly keeps `run_worker_first = false`. Do not change it
without rechecking page methods: worker-first routing can send `POST` requests
to generated page rendering instead of returning `405`.

Static pages bypass Astro middleware. Their shared security headers are defined
in `public/_headers`, and every non-root page has an explicit permanent `308`
rule in `public/_redirects`. Dynamic API responses continue through
`src/middleware.ts`.

## Pre-deployment gate

Before every deployment, verify in Cloudflare that **Always Use HTTPS** is
enabled for the `lako.services` zone. This is required because asset-first
static HTML does not use the middleware HTTP-to-HTTPS redirect.

The deploy workflow checks the observable invariant before deployment with
`npm run check:production-edge`: HTTP must redirect permanently to HTTPS and the
HTTPS homepage must return the expected security headers. Recheck the dashboard
setting manually when the gate fails; the public response cannot identify which
Cloudflare feature produced the redirect.

If the setting is disabled, stop. Enabling it is a separate production security
change and requires explicit approval. Do not substitute a redirect rule in the
generated Worker without reviewing page methods and asset routing again.

Also run the local checks and Worker preview described below. A passing build
alone does not prove Static Assets headers, redirects, or method handling.

## Automated deployment gate

After GitHub Actions deploys the Worker, it runs the full-body identity smoke
against these paths on both `workers.dev` and `lako.services`:

- `/`
- `/small-business/`
- `/en/small-business/`
- `/efaktura/`

For each URL the smoke check:

1. sends `Accept-Encoding: identity`;
2. rejects redirects and requires a direct uncompressed `200 text/html`;
3. reads the entire body under a ten-second timeout;
4. requires a non-trivial body ending in `</html>`;
5. retries twice for bounded deploy propagation tolerance.

The post-deploy SEO check verifies all sitemap URLs, canonical/hreflang,
robots policy, internal links, security headers, all page redirects, and both
API routes with harmless negative POST requests. The production edge check is
then repeated against the custom domain. Any failed deploy or smoke stops the
release. Manual deploy or rollback remains a separate production action.

## Local verification

Run the standard checks first:

```sh
npm test
npm run check:types
npm run build
npm run check:seo
npm run check:security
npm run check:production-edge
```

Start the local Worker, then run runtime SEO and identity checks against its
actual port:

```sh
npx wrangler dev --port 8787
SEO_BASE_URL=http://127.0.0.1:8787 npm run check:seo
npm run check:identity-response -- \
  http://127.0.0.1:8787/ \
  http://127.0.0.1:8787/small-business/ \
  http://127.0.0.1:8787/en/small-business/ \
  http://127.0.0.1:8787/efaktura/
```

Expected routing behavior:

- every marketing page returns complete HTML for an identity request;
- every non-root page URL without a trailing slash returns `308` to the slash URL;
- `POST` to a canonical marketing-page URL returns `405`;
- `POST` to a non-slash marketing-page URL first receives the same method-preserving
  `308`, and the canonical target then rejects the preserved `POST` with `405`;
- `GET /api/contact` returns `405` with `Allow: POST`;
- valid POST requests still reach the two on-demand endpoints;
- static pages and API responses both include the required security headers.

## Compatibility flag and rollback

Keep `disable_nodejs_process_v2` alongside `nodejs_compat`. Static delivery
removes the known marketing-page stream from the request path, but the Worker
still serves on-demand API responses. Remove the flag only after the relevant
Astro/Cloudflare fix is confirmed and local plus production gates pass without
it.

If production delivery regresses, stop further changes and use the previous
known-good deployment as the rollback target. Reverting the rendering commit,
deploying it, or changing Cloudflare settings are production actions and each
requires explicit approval.

References:

- [Astro on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Cloudflare Static Assets headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Cloudflare Static Assets redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)
- [Cloudflare Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)
- [Astro issue #14511](https://github.com/withastro/astro/issues/14511)
