# Lako Salon Pilot Runbook

Date: 2026-05-27
Status: pilot-ready
Owner: Lako Services

## Goal

Run a controlled pilot with 3-5 real salons before adding CRM, inventory,
payments, reminders, maps, or client accounts.

The pilot must prove this path:

1. Admin selects and verifies a salon.
2. Owner accepts an invite on `app.lako.services`.
3. Owner configures services, masters, and schedule.
4. Admin enables booking for that salon.
5. Client creates a web booking.
6. Owner sees and updates the appointment.

## Staff Recommendation

Use a manual concierge pilot, not self-serve launch.

The current scraped salon data is good enough for discovery, but not good enough
for automated outreach. Several local files contain placeholder phone numbers
such as `+381600000000`, and many production salon records do not have verified
owner contact details. Inviting owners automatically would create noise and
possible trust damage.

Recommended path:

1. Manually verify 5 candidates.
2. Run 3 live pilots.
3. Keep the other 2 as backup.
4. Only then decide whether to build bulk onboarding.

## Tradeoffs

### Candidate Source

Problem: Google Maps/imported data has useful names, addresses, and ratings, but
owner contact fields are not reliable enough.

Options:

- Do nothing and invite from imported data.
  - Effort: low
  - Risk: high
  - Impact: fast but likely noisy
  - Maintenance: low now, high cleanup later
- Manually verify 5 salons before invite.
  - Effort: medium
  - Risk: low
  - Impact: slower but higher trust
  - Maintenance: low
- Build a re-scrape/contact enrichment pipeline now.
  - Effort: high
  - Risk: medium
  - Impact: useful later, too early now
  - Maintenance: medium

Recommendation: manually verify 5 salons first.

### Booking Activation

Problem: existing imported salons are mostly `free` and have no production
services/masters configured.

Options:

- Set `tier=premium` before owner setup.
  - Effort: low
  - Risk: medium
  - Impact: public page can expose incomplete booking
  - Maintenance: low
- Let owner configure first, then set `tier=premium`.
  - Effort: medium
  - Risk: low
  - Impact: cleaner public launch
  - Maintenance: low
- Admin pre-configures all services/masters before owner invite.
  - Effort: medium-high
  - Risk: medium
  - Impact: faster owner demo, but assumptions may be wrong
  - Maintenance: medium

Recommendation: owner configures first, admin enables premium after smoke.

### Invite Delivery

Problem: owner invite is available via internal admin API, but automatic email
delivery is not part of the MVP.

Options:

- Send invite manually by WhatsApp/email after a human conversation.
  - Effort: low
  - Risk: low
  - Impact: enough for 3-5 pilots
  - Maintenance: low
- Build transactional invite email now.
  - Effort: medium
  - Risk: low-medium
  - Impact: useful for scale, not needed for pilot
  - Maintenance: medium
- Use Telegram.
  - Effort: low
  - Risk: medium in Serbia
  - Impact: contradicts web-first insight
  - Maintenance: low

Recommendation: manual delivery for pilot; build email invites after first real
owner feedback.

## Pilot Candidate Shortlist

These are research targets, not verified contacts. Before sending an invite,
verify the current phone/email/Instagram manually.

| Priority | Production tenant id | Salon | Type | Area | Address | Why this candidate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `cmlh73e6p006zja344i2v4veh` | Kinesthetic: Medicinski i estetski pedikir Novi Sad | beauty | Novi Sad | Fruskogorska 16 A | Novi Sad, high stated rating 4.9, appointment-heavy services. |
| 2 | `cmlh7gian00b0jajblchif25r` | Studio Andelija SG | nails | Novi Sad | Kosancic Ivana 9 | Novi Sad, high stated rating 4.9, simple service menu. |
| 3 | `cmlh73e6c006pja34pic0wm13` | Madam in beauty studio | beauty | Novi Sad | Cankareva 8 | Novi Sad, beauty+nails overlap in source data, useful multi-service test. |
| 4 | `cmlh73e0i0013ja34d4xqcmtl` | Infinite Beauty | beauty | Vracar | Smiljaniceva 16 | Beauty+nails overlap, high stated rating 4.8, good dashboard test. |
| 5 | `cmlh73dyx0000ja34megxw1wl` | Solo Per Te - Salon Lepote Vracar | barbershop | Vracar | Milesevska 38 | Hair/beauty overlap, good public booking demo candidate. |

Backup candidates:

| Production tenant id | Salon | Type | Area | Address |
| --- | --- | --- | --- | --- |
| `cmlh73e25002mja34jo0o9rbo` | Avant Garde Studio | beauty | Stari Grad | Kosovska 1 |
| `cmlh73e4g0052ja34i4sdktjb` | Beauty Centar Impresivna | beauty | Novi Beograd | Omladinskih Brigada 86J, West 65 |

## Admin Preflight

For each candidate:

1. Open production tenant data.

```bash
curl -fsS "https://bot.lako.services/admin/tenants/<TENANT_ID>" \
  -H "X-Admin-Key: $REGISTRATION_SECRET"
```

2. Verify and update core catalog fields.

```bash
curl -fsS -X PATCH "https://bot.lako.services/admin/tenants/<TENANT_ID>" \
  -H "X-Admin-Key: $REGISTRATION_SECRET" \
  -H "Content-Type: application/json" \
  --data '{
    "ownerName": "Verified owner name",
    "ownerEmail": "owner@example.com",
    "ownerPhone": "+381...",
    "phone": "+381...",
    "website": "https://...",
    "status": "published",
    "active": true
  }'
```

3. Do not set `tier` to `premium` until the owner has configured services,
masters, and schedules.

## Invite Creation

Create the invite after the owner agrees to pilot.

```bash
curl -fsS -X POST "https://bot.lako.services/admin/tenants/<TENANT_ID>/owner-invites" \
  -H "X-Admin-Key: $REGISTRATION_SECRET" \
  -H "Content-Type: application/json" \
  --data '{
    "email": "owner@example.com",
    "role": "owner"
  }'
```

Send the returned `inviteUrl` manually. It expires according to
`OWNER_INVITE_TTL_HOURS` (currently expected default: 72 hours unless production
env overrides it).

## Owner Onboarding Script

Use this order during a 15-minute onboarding call:

1. Owner opens invite URL.
2. Owner sets password.
3. Owner lands in the dashboard.
4. Owner checks salon name, address, phone, and public description.
5. Owner adds or corrects 3-8 services.
6. Owner adds at least one master.
7. Owner assigns services to the master.
8. Owner sets weekday schedule.
9. Admin opens public salon page and confirms services are visible.
10. Admin enables booking.

Enable booking:

```bash
curl -fsS -X PATCH "https://bot.lako.services/admin/tenants/<TENANT_ID>" \
  -H "X-Admin-Key: $REGISTRATION_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"tier":"premium"}'
```

## Smoke Check Per Salon

Run this before calling the pilot active:

1. Public page returns the salon.

```bash
curl -fsS "https://bot.lako.services/api/salon/venues/<SLUG>"
```

2. Slot list returns at least one slot.

```bash
curl -fsS "https://bot.lako.services/api/salon/venues/<SLUG>/slots?serviceId=<SERVICE_ID>&date=<YYYY-MM-DD>"
```

3. Create one clearly marked test booking.

```bash
curl -fsS -X POST "https://bot.lako.services/api/salon/venues/<SLUG>/book" \
  -H "Origin: https://app.lako.services" \
  -H "Content-Type: application/json" \
  --data '{
    "serviceId": "<SERVICE_ID>",
    "masterId": "<MASTER_ID>",
    "slot": "<ISO_SLOT>",
    "name": "Lako pilot test",
    "phone": "+381600000001"
  }'
```

4. Repeat the same booking request. Expected result: HTTP 409.
5. Owner dashboard shows the appointment.
6. Owner changes appointment status.
7. Admin reviews logs for errors.

## Success Criteria

Run the pilot for 48 hours after the first real booking.

Success means:

- At least 3 owners accept invite without help after the first link.
- At least 3 salons configure services, master, and schedule.
- At least 1 real client booking is created through web.
- No cross-tenant data leak.
- No double booking for the same master/time.
- Owner can find appointments without explanation.
- Client can complete booking on mobile in under 90 seconds.

## Stop Criteria

Pause the pilot if any of these occur:

- Owner sees another salon's data.
- Booking creates duplicate appointments for the same master/time.
- Public booking exposes wrong salon information.
- Owner cannot recover from an expired invite without admin help.
- More than 2 owners fail setup at the same step.

## Daily Pilot Review

Track this manually until a real CRM/task system exists:

| Field | Values |
| --- | --- |
| Salon | Name and tenant id |
| Owner contact verified | yes/no |
| Invite sent | date/time |
| Invite accepted | yes/no |
| Services configured | yes/no |
| Master configured | yes/no |
| Schedule configured | yes/no |
| Premium enabled | yes/no |
| Test booking passed | yes/no |
| Real booking count | number |
| Owner friction | notes |
| Client friction | notes |

## Follow-Up Backlog

Do not start these before the first pilot feedback unless a blocker appears:

- Email delivery for owner invites.
- Admin UI for invite creation.
- Owner dashboard polish for first-run checklist.
- Delete/cancel appointment action in owner dashboard.
- Dedicated pilot analytics event tracking.
- Public salon search/discovery on `app.lako.services`.
