# Cloudflare WAF Runbook - lako.services

Goal: reduce the current attack spike before requests reach the Worker, while avoiding country-wide blocks that can break legitimate traffic.

Use Cloudflare Dashboard for zone `lako.services`.

## 1. Verify Managed Rules

Path: `Security` -> `WAF` -> `Managed rules`.

Enable or verify:

- Cloudflare Managed Ruleset
- Cloudflare OWASP Core Ruleset

Recommended rollout:

1. If rules are already active, leave them active.
2. If they are not active, start in log/simulate mode briefly if the dashboard offers it.
3. Move obvious scanner categories to block or managed challenge.

Tradeoff: Managed rules catch broad scanner traffic quickly, but can false-positive on unusual payloads. For this site, public forms are simple JSON, so the false-positive risk is low.

## 2. Block Wrong Methods On Public API Forms

Path: `Security` -> `WAF` -> `Custom rules` -> `Create rule`.

Rule name: `Block non-POST form API requests`

Expression:

```txt
(http.request.uri.path in {"/api/contact" "/api/register-business"} and http.request.method ne "POST")
```

Action: `Block`

Tradeoff: This is strict, but correct. These endpoints only support POST.

## 3. Add Edge Rate Limits

Path: `Security` -> `WAF` -> `Rate limiting rules` -> `Create rule`.

### Contact Form

Rule name: `Rate limit contact form`

Expression:

```txt
(http.request.uri.path eq "/api/contact" and http.request.method eq "POST")
```

Settings:

- Characteristics: IP address
- Period: 5 minutes
- Threshold: 5 requests
- Action: `Managed Challenge`
- If abuse continues: change action to `Block`

### Business Registration

Rule name: `Rate limit business registration`

Expression:

```txt
(http.request.uri.path eq "/api/register-business" and http.request.method eq "POST")
```

Settings:

- Characteristics: IP address
- Period: 5 minutes
- Threshold: 3 requests
- Action: `Managed Challenge`
- If abuse continues: change action to `Block`

Tradeoff: Managed Challenge preserves legitimate users better than hard block. If the attack is high-volume and clearly automated, block is acceptable for these two endpoints.

## 4. Optional Body Size Rule

Use this only if your Cloudflare plan exposes request body size in WAF expressions.

Rule name: `Block oversized form API bodies`

Expression:

```txt
(http.request.uri.path in {"/api/contact" "/api/register-business"} and http.request.body.size gt 8192)
```

Action: `Block`

Tradeoff: The app already rejects over 8 KB. Doing it at the edge saves Worker CPU. If the field is unavailable, skip this rule.

## 5. Optional Bot Score Challenge

Use this only if Bot Management / bot score fields are available on the plan.

Rule name: `Challenge low-score form API bots`

Expression:

```txt
(http.request.uri.path in {"/api/contact" "/api/register-business"} and cf.bot_management.score lt 30)
```

Action: `Managed Challenge`

Tradeoff: Good for noisy automated attacks, but bot-score features may not be available on all plans. Do not use this if the dashboard rejects the field.

## 6. Do Not Blanket-Block Countries

Do not block GB, DE, CA, US, or other countries only because they appear high in analytics. These can include legitimate users, VPN exits, crawlers, and Cloudflare egress patterns.

Prefer filters by:

- path
- method
- ASN
- user-agent cluster
- bot score
- WAF rule match
- threat score
- request rate

## 7. Verify After Changes

Path: `Security` -> `Security Analytics` and `Security` -> `Events`.

Check for the last 30-60 minutes:

- requests to `/api/contact`
- requests to `/api/register-business`
- action distribution: allow, managed challenge, block
- top ASN
- top user agents
- top countries
- any legitimate POSTs blocked or challenged repeatedly

Expected result:

- Worker request count for public API forms drops.
- 403/blocked/challenged events increase at the edge.
- Normal page views stay unaffected.

## 8. Rollback

If legitimate users report blocked forms:

1. Change rate limit action from `Block` to `Managed Challenge`.
2. Raise thresholds temporarily:
   - `/api/contact`: 10 per 5 minutes
   - `/api/register-business`: 6 per 5 minutes
3. Disable only the last added custom rule, not all WAF managed rules.
4. Re-check Security Events for the exact rule causing false positives.
