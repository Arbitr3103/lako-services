# PRD - Lako Salon: web-first booking MVP

**Document:** Product Requirements Document  
**Product:** Lako Salon  
**Date:** 2026-05-27  
**Status:** Accepted MVP direction  
**Repositories:** `lako-services` marketing site, `lako-bot` backend/API/app

---

## 1. Summary

Lako Salon is a web-first booking product for salons, barbershops, beauty studios and nail salons in Serbia.

The product moves the salon booking experience away from a Telegram-only flow:

- Clients book from a normal browser without Telegram or an account.
- Salon owners manage the operational core from a web dashboard.
- `app.lako.services` hosts the product app.
- `lako.services` remains the marketing, SEO and trust layer.
- `lako-bot` remains the backend, API and database owner.

The broader product vision includes inventory, CRM, reviews, payments and reminders. Those are explicitly not part of the first production MVP.

---

## 2. Problem

Telegram is a high-friction channel for many Serbian salon clients and owners. A Telegram-only booking product limits adoption even if the underlying booking, slot and tenant model already exists.

Clients need a direct booking link from Instagram, Google Business Profile, a salon website or search results. Owners need a simple dashboard for the core information that affects booking accuracy: profile, services, masters, schedules and appointments.

---

## 3. MVP Goals

| Goal | Success signal |
|------|----------------|
| Reduce client booking friction | Clients can book through `app.lako.services` without Telegram |
| Give owners control of booking data | Owners can manage profile, services, masters, schedules and appointments |
| Prove real demand | 5-10 pilot salons and at least 50 real web bookings |
| Preserve existing product value | Existing Telegram/TMA flows keep working |

---

## 4. Users

### Client

A person in Serbia who wants to book a salon service quickly from a browser. They want to choose a salon, service, master and time, then leave name and phone. They should not need a Lako account or Telegram.

### Salon Owner

A salon owner or manager responsible for accurate service lists, prices, masters, working hours and appointment status. They need access only to their own salon data.

---

## 5. Production MVP Scope

### In MVP

Client web booking:

- Direct salon page at `https://app.lako.services/s/:slug`.
- Salon profile with address, contacts, services, prices and masters.
- Booking flow: service -> master or any master -> date/time -> name + phone -> confirmation.
- Anonymous booking without Telegram `initData`.
- Free-tier salons show profile/contact information only; premium salons allow booking.

Owner dashboard:

- Owner access through email/password plus admin-created invite/setup.
- Owner session stored in an HttpOnly Secure cookie.
- Owner can manage only owned tenants.
- Dashboard modules:
  - profile and contact data
  - services, price and duration
  - masters and service assignment
  - weekly schedules, breaks and days off
  - appointments and status changes

Platform:

- SR/EN/RU UI.
- Existing TMA booking remains supported.
- Core correctness: no double-booking for the same master/time.
- Basic owner notification for new web booking.

### Out Of MVP

- Inventory/materials tracking.
- CRM/client accounts and client booking history.
- Reviews/ratings management.
- Online payment, deposit or IPS QR payment.
- Client reminders by SMS, Viber, WhatsApp or email.
- Map/geolocation search.
- Search by available time across all salons.
- Advanced analytics dashboard.
- Self-serve public owner registration.

These items belong to later phases after pilot validation.

---

## 6. Functional Requirements

### Client App

- **FR-C1.** Public salon pages load by slug for published active salons.
- **FR-C2.** Salon detail exposes only public-safe data. Master phone numbers are not exposed publicly.
- **FR-C3.** Booking requires premium tier, active service, active master and a valid available slot.
- **FR-C4.** Client must provide name and phone. Phone is normalized for matching within a tenant.
- **FR-C5.** Booking creation must be atomic and reject conflicting concurrent requests.
- **FR-C6.** Confirmation screen shows salon, service, master, date/time and salon contact instructions for changes/cancellation.
- **FR-C7.** Existing Telegram/TMA booking endpoint keeps its current `initData` protection.

### Owner Dashboard

- **FR-O1.** Owner account is modeled separately from `Tenant.ownerEmail`.
- **FR-O2.** `OwnerUser` can access tenants through `TenantOwner`; every owner API uses tenant-scoping.
- **FR-O3.** Owner can list their tenants and select the active salon.
- **FR-O4.** Owner can update salon profile fields needed for booking and public display.
- **FR-O5.** Owner can create, update, deactivate and reorder services.
- **FR-O6.** Owner can create, update and deactivate masters.
- **FR-O7.** Owner can assign services to masters.
- **FR-O8.** Owner can manage master weekly schedules, breaks and days off.
- **FR-O9.** Owner can list appointments by date/status/master.
- **FR-O10.** Owner can confirm, cancel, complete and mark no-show for owned-tenant appointments.

---

## 7. Architecture

### Repositories

- `lako-bot`: source of truth for database, booking logic, owner auth and APIs.
- `lako-bot/tma`: product frontend hosted at `app.lako.services`; refactored to support both web and Telegram Mini App contexts.
- `lako-services`: marketing site, SEO pages, public product copy and CTA links.

### Backend Additions

- `Tenant.slug` for stable direct salon URLs.
- `OwnerUser` for owner accounts.
- `TenantOwner` for tenant membership and tenant-scoping.
- Owner invite/setup token fields or table for first password setup.
- `Appointment.durationMinutes` and `Appointment.endsAt` snapshots for conflict checks and auditability.
- Shared booking service used by web and TMA booking paths.
- New public web salon API, separate from existing TMA-only booking protection.
- New `/api/owner/*` API surface for owner dashboard.

### Frontend App

- Keep React/Vite app under `lako-bot/tma`.
- Extract platform-specific Telegram helpers behind an adapter.
- Web routes use normal browser routing.
- Owner API client uses `credentials: "include"`.
- API errors are normalized for 400, 401, 403, 409, 429 and 500 cases.

---

## 8. Security Requirements

- Owner password hashes use Argon2.
- Owner invite/setup tokens are single-use and stored hashed.
- Owner session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
- Backend CORS allows credentials only for exact approved origins, including `https://app.lako.services` and local development.
- Mutating owner/web-booking routes enforce Origin checks.
- Every owner route verifies tenant ownership through a central scope helper.
- Public salon APIs do not expose secret tokens, owner-only data or master phone numbers.
- Web booking is rate-limited by IP and validates content length/input lengths.
- Existing `/admin/*` routes remain internal and are not used by the owner dashboard.

---

## 9. Testing Requirements

Backend:

- Owner invite/setup, login, session, logout and cookie flags.
- Tenant-scoping positive and negative cases.
- Profile, service, master, schedule and appointment status APIs.
- Anonymous web booking success.
- Free-tier booking blocked.
- Master/service/tenant mismatch rejected.
- Concurrent booking conflict produces exactly one success and one conflict.
- Existing TMA booking still works with Telegram `initData`.

Frontend:

- Public salon page loads in SR/EN/RU.
- Booking happy path.
- Slot conflict reloads available slots.
- Required name/phone validation.
- Owner login guard.
- Owner CRUD smoke flows.
- Mobile and desktop smoke checks.

Verification:

- `lako-bot`: `npm run build`, `npm test`, `npm audit --audit-level=moderate`.
- `lako-bot/tma`: `npm run build` and app tests once added.
- `lako-services`: `npm run check:types`, `npm test`, `npm run build`, `npm run check:seo`, `npm run check:security`.

---

## 10. Deployment And Operations

Deploy order:

1. Apply backend Prisma migration and deploy `lako-bot`.
2. Verify backend health, owner auth, CORS credentials and booking endpoint.
3. Deploy `app.lako.services`.
4. Update `lako.services` marketing links/copy if needed.
5. Run production smoke checks and inspect PM2/Cloudflare logs.

Required environment/config changes:

- Owner session secret or reuse a clearly named JWT secret.
- Approved frontend origin configuration.
- Email sender configuration if invites are emailed from backend.

---

## 11. Documentation Requirements

Record accepted MVP decisions, implementation notes, verification commands and deployment notes in the existing Notion `lako.services Project Database`.

Update durable repo docs after implementation:

- `lako-services` docs and project notes.
- `lako-bot` architecture notes for owner auth/API and web booking.

---

## 12. Open Questions For Later Phases

- Which paid reminder channel to add first: Viber, WhatsApp, SMS or email?
- When to introduce owner self-service signup?
- Whether inventory or CRM should be Phase 2.
- Whether to add Google Calendar export/sync after pilot validation.
- Whether direct salon links or public catalog discovery should be the primary growth loop.
