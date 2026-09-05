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
`npm run check:production-edge -- --allow-cloudflare-challenge`: HTTP must
redirect permanently to HTTPS and the HTTPS homepage must return the expected
security headers. The only non-200 response the workflow can classify without
failing is an exact Cloudflare Challenge Page response carrying
`cf-mitigated: challenge` on `lako.services`.

GitHub-hosted runners can be challenged by Bot Fight Mode. On 2026-09-04, the
pre-deployment request was identified in Cloudflare Security Events as `HEAD /`,
user agent `node`, ASN Microsoft, with action `Managed Challenge`. Bot Fight
Mode cannot be bypassed by a custom WAF skip rule. Do not disable it or broadly
allow runner IP ranges to make CI green. A classified challenge means the
custom-domain part of the gate is **incomplete**, not passed.

If the setting is disabled, stop. Enabling it is a separate production security
change and requires explicit approval. Do not substitute a redirect rule in the
generated Worker without reviewing page methods and asset routing again.

Also run the local checks and Worker preview described below. A passing build
alone does not prove Static Assets headers, redirects, or method handling.

## Automated deployment gate

After GitHub Actions deploys the Worker, it runs the strict full-body identity
smoke against these paths on `workers.dev`:

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

It also attempts the same paths on `lako.services`. A complete response must
pass every strict assertion. An exact `cf-mitigated: challenge` response is a
non-`200` failure and stops the workflow, just like any other incomplete
custom-domain response. It is not downgraded to a GitHub warning and a manual
request from another network is not a substitute for this blocking release
gate.

The post-deploy SEO check verifies all sitemap URLs, canonical/hreflang,
robots policy, internal links, security headers, all page redirects, and both
API routes with harmless negative POST requests on `workers.dev`. The
production edge check is then repeated against the custom domain without
challenge classification. A green workflow therefore includes direct,
successful custom-domain identity and edge checks from the CI runner; a
Cloudflare challenge cannot make either post-deploy gate green. Manual deploy
or rollback remains a separate production action.

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

## Match the edge probe to the delivery request

The HTTPS edge header check uses GET and the same diagnostic headers as the full-body
identity smoke (`Accept: text/html`, `Accept-Encoding: identity`, and
`User-Agent: lako-identity-response-smoke/1.0`). On 2026-09-05, deployment run
33949129007 twice passed all eight strict full-body GET checks but failed its
separate HEAD request with HTTP 403. Different request signatures can receive
different edge treatment; this observation does not identify a particular
Cloudflare rule as the cause.

The edge probe checks the delivered GET representation, then cancels its body.
The separate identity gate still reads and validates the entire body. Ordinary
HTTP 403, unexpected redirects and missing security headers fail immediately.
This does not certify HEAD delivery for every client or grant a WAF exception.

## Bounded retries for confirmed challenges

Run 33949750476 demonstrated that matching GET signatures alone was insufficient:
the custom-domain root returned 403, then complete HTML on its second identity
attempt, then 403 to the separate edge probe. The identity gate already had a
three-attempt budget; the edge probe had one. This establishes intermittent
delivery to that runner, not which Cloudflare rule caused it.

The strict HTTPS edge probe now makes at most three attempts, retrying only
HTTP 403 with `cf-mitigated: challenge` on the fixed production URL. It releases
each response body before a two-second retry delay and gives each new request
a fresh timeout. Ordinary 403, other HTTP errors, redirects, network errors and
missing security headers are not retried. A third challenge still fails the job;
success always requires a direct 200 with every expected security header. The
eight separate full-body checks remain mandatory and unchanged.

Challenge diagnostics include attempt number and a format-validated Cloudflare
Ray ID; missing or malformed IDs become `unavailable`, never raw log input.
Use the final Ray ID and run timestamp for Security Events investigation if
the budget is exhausted. Do not loop deployment reruns or add a WAF bypass.
The explicit pre-deploy classification flag retains its one-attempt behavior;
no post-deploy command receives that flag.

Cloudflare documents the challenge response marker in
[Detect a Challenge Page response](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/).

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
- [Detect a Cloudflare Challenge Page](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)
- [Cloudflare security feature interoperability](https://developers.cloudflare.com/waf/feature-interoperability/)
- [Astro issue #14511](https://github.com/withastro/astro/issues/14511)
