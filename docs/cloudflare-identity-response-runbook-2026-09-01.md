# Cloudflare identity-response runbook

## Incident signature

On 2026-09-01, SSR page responses from both the `workers.dev` hostname and
`lako.services` returned `200` but did not finish when the client requested
`Accept-Encoding: identity`. The same pages completed with `gzip` or `br`.
Static assets, redirects, `HEAD` requests, and middleware `405` responses were
not affected.

This matters because a partial `200` can evade status-only health checks while
clients wait for the final chunk indefinitely.

## Mitigation

`wrangler.toml` keeps `nodejs_compat` and adds `disable_nodejs_process_v2`.
Astro uses the presence of a Node-like global `process` to choose a Node
`AsyncIterable` rendering path. The native Cloudflare process-v2 shim can make
that detection true in Workers. Disabling process v2 keeps the compatibility
surface required by the application without selecting the affected stream
path.

This is an evidence-backed compatibility workaround, not a permanent platform
setting. Do not remove it only because a dependency was upgraded.

References:

- [Astro issue #14511](https://github.com/withastro/astro/issues/14511)
- [Cloudflare process-v2 compatibility flag](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#enable-process-v2-implementation)
- [Astro HTML streaming](https://docs.astro.build/en/guides/on-demand-rendering/#html-streaming)

## Automated deployment gate

After GitHub Actions deploys the Worker, it runs:

```sh
npm run check:identity-response -- \
  https://lako-services.bragin-arbitr.workers.dev/ \
  https://lako.services/
```

For each hostname the smoke check:

1. requests the home page with `Accept-Encoding: identity`;
2. rejects redirects and requires a direct `200` with an uncompressed
   `text/html` response;
3. reads the full body under a ten-second timeout;
4. requires a non-trivial body ending in `</html>`;
5. retries twice for bounded deploy propagation tolerance.

Any incomplete response fails the workflow. A failed deploy or smoke must stop
the release. Do not perform a manual deploy or rollback unless that separate
production action is explicitly approved.

## Manual read-only verification

Use the same script for a repeatable check. For protocol-level diagnostics,
compare identity and compressed delivery without changing Cloudflare settings:

```sh
curl --http1.1 --max-time 15 -H 'Accept-Encoding: identity' \
  -o /dev/null -sS -w '%{http_code} %{size_download} bytes\n' \
  https://lako.services/

curl --http1.1 --compressed --max-time 15 -H 'Accept-Encoding: gzip' \
  -o /dev/null -sS -w '%{http_code} %{size_download} bytes\n' \
  https://lako.services/
```

## Removal gate

Remove `disable_nodejs_process_v2` only after all of the following are true:

- the relevant Astro/Cloudflare upstream fix is confirmed in the installed
  versions;
- local Worker tests pass without the flag;
- the automatic identity smoke passes for both hostnames after a normal GitHub
  Actions deployment;
- status-only checks are not used as a substitute for full-body delivery.
