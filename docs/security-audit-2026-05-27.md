# Security Audit - 2026-05-27

Scope: `lako.services` Astro SSR site on Cloudflare Workers, public pages, `/api/contact`, `/api/register-business`, e-Faktura Studio client storage, CI/deploy pipeline, and Cloudflare edge posture.

## Research Baseline

Current baseline used for this audit:

- OWASP Top 10 2025 Release Candidate and OWASP API Security Top 10 2023: treat misconfiguration, vulnerable dependencies, insecure design, unrestricted business flows, and SSRF as first-class risks.
- Cloudflare WAF docs as of May 2026: use Managed Rules, Security Analytics, Security Events, edge rate limiting, and Managed Challenge for suspicious high-volume public flows.
- Cloudflare Turnstile docs as of May 2026: client widget alone is not protection; server-side Siteverify validation is mandatory, tokens are short-lived and single-use.
- Node.js security best practices: pin dependencies, use lockfiles, run automated vulnerability checks in CI, avoid unbounded request bodies, and keep dependency execution surface small.
- Astro Cloudflare adapter v13 docs: Wrangler `main` must use `@astrojs/cloudflare/entrypoints/server`; the adapter defaults to Cloudflare image/session bindings unless configured.

Primary links:

- https://owasp.org/www-project-top-ten/
- https://owasp.org/www-project-api-security/
- https://developers.cloudflare.com/waf/analytics/security-analytics/
- https://developers.cloudflare.com/waf/managed-rules/
- https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://nodejs.org/en/learn/getting-started/security-best-practices
- https://docs.astro.build/en/guides/integrations-guide/cloudflare/

## Executive Summary

The traffic spike is most likely automated scanning and form/API probing. The code already had useful defense-in-depth, but the weakest production controls were dependency drift, missing CI security gates, per-isolate in-memory rate limiting, unbounded JSON parsing, implicit Cloudflare adapter bindings, and client-side persistence of e-Faktura PII without explicit opt-in.

Implemented hardening in this pass:

- Upgraded and pinned runtime/build dependencies.
- Added `npm audit`, `astro check`, and Vitest gates to CI before deploy.
- Added bounded JSON parsing, content-type enforcement, and 413/415 responses for public APIs.
- Made `/api/register-business` fail closed when `REGISTRATION_SECRET` is absent.
- Removed inline `onclick` handlers from contact pages.
- Moved e-Faktura local persistence behind explicit local-device consent and added a clear-data control.
- Updated Astro 6/Cloudflare adapter config and avoided implicit `SESSION`/`IMAGES` bindings.
- Replaced removed `locals.runtime.env` access with `cloudflare:workers` env bindings.
- Removed global-scope timer usage from the in-memory rate limiter for Workers compatibility.
- Added focused API and storage tests.

## Architecture Review

### Issue A1 - In-memory rate limiting is not a reliable edge control

Problem: `src/utils/rate-limit.ts` stores counters inside the Worker isolate. Under attack, requests can hit multiple isolates and data centers, so limits are best-effort only.

Why it matters: It reduces accidental spam but does not stop distributed scanners or bursts across Cloudflare regions.

Options:

- Do nothing: low effort, high residual risk, low maintenance.
- Keep app limiter and add Cloudflare WAF rate limiting: low effort in Cloudflare, low code risk, high impact, low maintenance.
- Replace limiter with Durable Object/KV centralized limiter: medium effort, higher complexity, higher consistency, medium maintenance.

Recommendation: keep the app limiter as defense-in-depth and add Cloudflare WAF rate limiting for `/api/contact` and `/api/register-business`.

### Issue A2 - Public form flows need bot friction during active attacks

Problem: Origin/referrer checks and rate limits help, but bots can still post realistic JSON.

Why it matters: Contact and registration flows trigger email, Telegram, and downstream API work.

Options:

- Do nothing: no UX impact, high abuse risk during spikes.
- Add Turnstile only when attack continues: medium effort, low UX cost, high impact.
- Add Turnstile immediately to all forms: medium effort, stronger protection, possible conversion friction.

Recommendation: enable Cloudflare WAF/Managed Challenge now; add Turnstile with server-side validation if attacks persist after edge rules.

### Issue A3 - `bot.lako.services` remains a coupled dependency

Problem: `/api/register-business` depends on `bot.lako.services` and shared-secret authentication.

Why it matters: A failure or compromise in the bot API affects registration availability and trust.

Options:

- Do nothing: low effort, unchanged risk.
- Add timeout/retry/circuit behavior in this Worker: medium effort, availability improvement.
- Audit and harden `bot.lako.services` separately: higher effort, highest risk reduction.

Recommendation: audit `bot.lako.services` next, especially auth, registration abuse, logs, and Telegram/admin approval flows.

## Code Quality Review

### Issue C1 - Request body parsing was unbounded

Problem: APIs used `request.json()` directly.

Why it matters: Large bodies can waste CPU/memory and amplify abuse.

Options:

- Do nothing: low effort, continued DoS risk.
- Add endpoint-specific body caps and content-type checks: low effort, high impact.
- Add schema validation library for all API payloads: medium effort, higher maintainability.

Recommendation: implemented body cap and content-type checks now; consider schema validation if API surface grows.

### Issue C2 - Registration secret previously failed open toward downstream API

Problem: If `REGISTRATION_SECRET` was absent, code skipped the bot API call and still returned success after notifications.

Why it matters: Operators could believe registration reached the source of truth when it did not.

Options:

- Do nothing: low effort, high correctness risk.
- Fail closed with 503: low effort, high correctness impact.
- Add health check/deploy validation for required secrets: medium effort, higher operational safety.

Recommendation: implemented fail-closed behavior; add deploy-time secret verification if deploy automation supports it.

### Issue C3 - Client PII was persisted without explicit opt-in

Problem: e-Faktura stored seller, buyer, and item data in `localStorage`.

Why it matters: Shared devices and browser profiles can retain business and customer data unexpectedly.

Options:

- Do nothing: low effort, privacy risk.
- Add explicit local-device consent and clear-data action: medium effort, strong privacy improvement.
- Move persistence server-side with auth: high effort, broader product change.

Recommendation: implemented explicit opt-in local storage plus clear-data control.

## Test Review

### Issue T1 - Security-critical API behavior had no regression tests

Problem: Origin checks, body limits, content type, secret failure, and downstream failure paths were not tested.

Why it matters: Security regressions often enter through small form/API changes.

Options:

- Do nothing: low effort, high regression risk.
- Add focused unit tests around route handlers: low effort, high impact.
- Add full e2e tests through Worker preview: medium effort, broader coverage.

Recommendation: implemented focused tests now; add preview e2e when Turnstile or more API flows are introduced.

### Issue T2 - CI did not block deploy on audit/type/test failures

Problem: GitHub Actions built and deployed without security audit, type check, or tests.

Why it matters: A vulnerable dependency or broken route could auto-deploy to production.

Options:

- Do nothing: low effort, high release risk.
- Add audit/type/test gates before build/deploy: low effort, high impact.
- Add SAST/dependency review/code scanning: medium effort, stronger supply-chain coverage.

Recommendation: implemented audit/type/test gates now; add GitHub Dependabot/dependency review next.

## Performance Review

### Issue P1 - API abuse can create external service cost and latency

Problem: Each accepted form request can fan out to Resend, Telegram, and the bot API.

Why it matters: Attackers can convert cheap HTTP requests into paid or slow downstream work.

Options:

- Do nothing: low effort, high abuse risk.
- Edge rate limit before Worker execution: low effort, high impact.
- Queue accepted submissions and process asynchronously: medium effort, better resilience, more moving parts.

Recommendation: add edge rate limiting immediately; queueing is only needed if legitimate bursts grow.

### Issue P2 - Large JSON bodies wasted resources before validation

Problem: Large bodies were parsed before field validation.

Why it matters: Attackers can force unnecessary memory/CPU consumption.

Options:

- Do nothing: low effort, continued risk.
- Reject by `Content-Length` and streaming byte cap: low effort, high impact.
- Add Cloudflare body-size WAF rule too: low effort, extra edge savings.

Recommendation: implemented application cap; add Cloudflare body-size rule for `/api/contact` and `/api/register-business`.

## Cloudflare Operational Checklist

Apply these in Cloudflare Dashboard or IaC:

1. Review Security Analytics for the spike window, grouped by path, country, ASN, user agent, WAF rule ID, and action.
2. Enable or verify Cloudflare Managed Rules and OWASP/Core ruleset in simulate/log mode first if not already tuned, then enforce.
3. Add WAF custom rules:
   - Block or challenge non-POST requests to `/api/contact` and `/api/register-business`.
   - Managed Challenge for high-risk bot score or suspicious ASN on public form endpoints.
   - Block request bodies over 8 KB for both form endpoints if plan supports body-size fields.
4. Add rate limiting rules:
   - `/api/contact`: 5 requests per IP per 5 minutes, challenge or block after threshold.
   - `/api/register-business`: 3 requests per IP per 5 minutes, challenge or block after threshold.
   - Count by IP and, if available, include JA3/JA4 or bot signals for more precise grouping.
5. Do not blanket-block GB/DE/CA/US solely from country counts. Use country only as one signal with ASN, path, method, threat score, and user-agent clusters.
6. If attacks continue after WAF/rate limiting, add Turnstile to contact and registration forms and validate tokens server-side.
7. Verify Worker secrets in production:
   - `RESEND_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `REGISTRATION_SECRET`
8. Audit `bot.lako.services` and any admin bot approval endpoints.

## Verification

Completed before deploy:

- `npm run check:security`
- `npm run check:types`
- `npm test`
- `npm run build`
- `npm run check:seo`
- Local Worker smoke for pages, CSP/security headers, and API rejection paths.

Deployment:

- Deployed Worker version: `ec017c3c-8bcf-468b-b92d-17963e1c46c3`
- Production smoke passed: home page 200 with CSP/security headers, contact API rejects missing Origin with 403, oversized JSON with 413, malformed JSON with 400, register-business rejects missing fields with 400, and contact/e-Faktura Studio load in browser.

## Residual Risks

- Application rate limiter remains per isolate; Cloudflare edge rate limiting is required for real attack resistance.
- Application rate limiter cleanup is request-driven to comply with Workers global-scope restrictions.
- Turnstile is not implemented yet; this is acceptable only if WAF/rate limiting reduce abuse.
- `bot.lako.services` was not audited in this repository.
- Production deployment requires valid Cloudflare credentials and post-deploy smoke checks.

## 2026-08-29 Addendum - HTTP Method Policy

Security monitoring identified an ordinary page request returning `200` for
`POST /`. Astro SSR page routes render independently of the endpoint method
exports used by API routes, so the application now enforces a fail-closed
method policy in middleware before canonical redirects:

- ordinary pages and assets allow `GET` and `HEAD`;
- `/api/contact` allows `POST`;
- `/api/register-business` allows `POST`;
- unsupported methods that reach project middleware return an empty
  `405 Method Not Allowed` response with an exact `Allow` header and
  `Cache-Control: no-store`.

Astro's built-in cross-origin check can reject some unsafe requests earlier
with `403 Forbidden`; both outcomes prevent page rendering. The regression
case that originally reached the page (`application/json`) now returns `405`.

Regression tests cover unsafe methods on page routes, method checks before
trailing-slash redirects, both legitimate form endpoints, exact API paths,
and behavior independent of request `Origin` and content type. Cloudflare WAF
remains defense-in-depth; the repository middleware is the canonical method
policy.
