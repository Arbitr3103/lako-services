# Lako Bot: Viber Appointment Bot MVP

## Overview

Automated Viber bot for Serbian small businesses (barbershops, dental clinics, auto services, dry cleaners). Replaces phone-based booking with 24/7 Viber bot that integrates with Google Calendar.

**Strategy:** Concierge MVP — one golden template deployed manually for 10 test clients.

## Problem

- Small business owners in Serbia work solo — answering calls interrupts service (lost client = 30-50 EUR)
- Hiring admin costs min 1000-1200 EUR/month (brutto-2)
- No-show rate without reminders: 15-20%
- SMS reminders are expensive and ignored (Viber open rate > 90%)

## Architecture

```
lako.services (Astro/Cloudflare)    lako-bot (Fastify/178.72.130.60)
┌─────────────────────┐             ┌──────────────────────────┐
│  Landing + demo      │             │  POST /webhook/:tenantId │
│  "Try demo bot" →    │─deeplink──▶│  Viber Bot SDK           │
│  Contact form        │             │  Google Calendar API     │
│  Onboarding form     │             │  Prisma + SQLite         │
└─────────────────────┘             │  Cron (reminders/reviews)│
                                    └──────────────────────────┘
```

**Two independent services.** Site sells, bot works. Shared DB not needed on pilot — site gives Viber deeplink `viber://pa?chatURI=<tenantUri>`.

**Isolation from market_core_etl:**
- Separate repo, package.json, .env
- Separate SQLite DB file (`lako-bot.db`)
- PM2 process monitoring to track memory usage
- No shared global packages

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js LTS |
| Framework | Fastify + TypeScript |
| Database | Prisma + SQLite (→ PostgreSQL later) |
| Bot SDK | viber-bot (official Viber Node.js SDK) |
| Calendar | Google Calendar API v3 |
| Hosting | 178.72.130.60 (PM2) |
| SSL | Certbot (Let's Encrypt) + Nginx reverse proxy |
| Local dev | Ngrok (Viber requires HTTPS) |
| AI | None in MVP (buttons only, AI later) |

## Database Schema

```prisma
model Tenant {
  id                 String   @id @default(cuid())
  name               String                // "Barbershop Marko"
  type               String                // barbershop | dental | auto | dryclean
  viberBotToken      String                // Viber PA token
  viberBotUri        String                // chatURI for deeplink
  googleCalendarId   String                // Master's calendar ID
  googleRefreshToken String                // OAuth2 refresh token
  workingHours       String                // JSON: {"mon":"09:00-18:00",...}
  bufferMinutes      Int      @default(10) // Break between appointments
  leadTimeMinutes    Int      @default(60) // Min time before booking
  timezone           String   @default("Europe/Belgrade")
  services           Service[]
  clients            Client[]
  appointments       Appointment[]
  createdAt          DateTime @default(now())
}

model Service {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String                // "Muska strizka"
  duration  Int                   // 30 (minutes)
  price     Int?                  // 1500 (RSD), optional
  imageUrl  String?               // For Rich Media Carousel
  appointments Appointment[]
}

model Client {
  id           String        @id @default(cuid())
  tenantId     String
  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  viberUserId  String
  name         String
  phone        String?
  birthday     DateTime?
  visits       Int           @default(0)
  lastVisit    DateTime?
  appointments Appointment[]
  createdAt    DateTime      @default(now())

  @@unique([tenantId, viberUserId])
}

model Appointment {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])
  dateTime    DateTime              // Always stored in UTC
  status      String                // pending | confirmed | cancelled | completed | noshow
  rating      Int?                  // 1-5 stars (after review)
  remindedAt  DateTime?
  reviewedAt  DateTime?
  gcalEventId String?               // Google Calendar event ID
  createdAt   DateTime @default(now())
}
```

## Viber Bot Flow

### Main Menu (Keyboard)
```
[Zakazati]  [Moji termini]  [Usluge i cene]  [Kontakt]
```

### Booking Flow
1. **Select service** → Rich Media Carousel (swipeable cards with photos)
2. **Select slot** → Keyboard with available times from Google Calendar
3. **Share phone** (new clients only) → Viber `share-phone` action (zero friction)
4. **Confirmation** → Rich card with all details
5. **Google Calendar event created** → Master sees it in phone

### Slot Algorithm (services/slots.ts)
1. Call `calendar.freebusy.query` for selected date range
2. Get tenant working hours for that day
3. Subtract busy intervals from working hours
4. Apply buffer (default 10 min between appointments)
5. Apply lead time (default 60 min from now)
6. Slice remaining time into slots matching service duration
7. Return available slots (max 6 per message, "More dates" button)

**Timezone:** All DB times in UTC. Display in `Europe/Belgrade` (CET/CEST UTC+1/+2). Google Calendar API calls with explicit timezone parameter.

### Reminder Flow (Cron: every 15 min)
1. Find appointments where `dateTime - now() ≈ 2 hours` and `remindedAt IS NULL`
2. Send Viber message: "Marko, cekamo vas danas u 14:30"
3. Buttons: [Budu!] [Prenesti] [Otkazati]
4. If cancelled:
   - Free slot in Google Calendar
   - Notify master with [Publish hot slot] button
   - Offer client to rebook

### Review Flow (Cron: 1 hour after appointment end)
1. Find completed appointments where `reviewedAt IS NULL`
2. Send: "Kako vam se svidelo? Ocenite nas!"
3. Buttons: ⭐1 ⭐2 ⭐3 ⭐4 ⭐5
4. Save rating, update `reviewedAt`

### Birthday Flow (Cron: daily at 09:00)
1. Find clients with `birthday = today`
2. Send personalized greeting
3. Optional: discount code or promo

### Master Notifications (via Viber or Telegram)
- New booking: "Nova rezervacija: Marko, strizka u 14:30"
- Cancellation: "Marko otkazao 14:30" + [Publish hot slot]
- Daily summary: morning digest of today's appointments

## Viber API Notes

- **Rich Media Carousel** for services (with images, increases avg check)
- **Keyboard** for slots and confirmations
- **share-phone ActionType** for phone number collection
- **Session windows**: Client must message first (free). Business-initiated messages (reminders) may cost money on some account types. For 10 pilot clients — not an issue. Plan for SaaS pricing model.
- **Viber requires valid SSL** — Certbot + Nginx with `X-Forwarded-Proto` header

## Project Structure

```
lako-bot/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── server.ts                  # Fastify bootstrap
│   ├── routes/
│   │   ├── webhook.ts             # POST /webhook/:tenantId
│   │   └── health.ts              # GET /health
│   ├── bot/
│   │   ├── handler.ts             # Viber event router
│   │   ├── flows/
│   │   │   ├── welcome.ts         # Greeting + main menu
│   │   │   ├── booking.ts         # Service → slots → phone → confirm
│   │   │   ├── my-appointments.ts # Client's appointments list
│   │   │   ├── services.ts        # Services carousel
│   │   │   ├── reminder.ts        # Reminder response handling
│   │   │   └── review.ts          # Star rating after visit
│   │   └── keyboards/
│   │       ├── main-menu.ts       # Main menu keyboard
│   │       ├── services.ts        # Rich Media Carousel
│   │       ├── slots.ts           # Time slot keyboard
│   │       └── confirm.ts         # Booking confirmation
│   ├── services/
│   │   ├── calendar.ts            # Google Calendar API wrapper
│   │   ├── slots.ts               # Slot calculation algorithm
│   │   ├── viber.ts               # Viber API wrapper
│   │   └── tenant.ts              # Tenant CRUD & config
│   ├── cron/
│   │   ├── reminders.ts           # Every 15 min: 2h before appointments
│   │   ├── reviews.ts             # 1h after visit: request review
│   │   └── birthdays.ts           # Daily: birthday greetings
│   ├── config/
│   │   └── index.ts               # ENV, constants
│   └── types/
│       └── index.ts               # TypeScript types
├── .env
├── ecosystem.config.js            # PM2 config
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Implementation Plan

### Phase 1: Foundation (Day 1-2)
1. Create repo `lako-bot` on GitHub
2. `npm init fastify` + TypeScript + Prisma + viber-bot SDK
3. Prisma schema + `npx prisma migrate dev`
4. Basic Fastify server: `/health` + `/webhook/:tenantId`
5. PM2 ecosystem config
6. Ngrok for local Viber testing

### Phase 2: Bot Core (Day 3-5)
7. Viber event handler (conversation_started, message, action)
8. Flow: welcome → main menu (Keyboard)
9. Flow: services (Rich Media Carousel with photos)
10. Google Calendar OAuth2 (refresh token flow)
11. `services/slots.ts` — slot algorithm (freebusy → working hours → buffer → lead time)
12. Flow: booking → show slots → share-phone (new) → confirmation
13. Google Calendar: create/delete events
14. **Timezone handling**: UTC storage, Europe/Belgrade display

### Phase 3: Reminders & Reviews (Day 6-7)
15. Cron: reminders 2 hours before (check every 15 min)
16. Flow: reminder → confirm / reschedule / cancel
17. Master notification on cancellation + [Publish hot slot] button
18. Cron: review 1 hour after visit (stars 1-5)
19. Flow: review → save rating

### Phase 4: Deploy to Server (Day 8)
20. SSH to 178.72.130.60, clone repo
21. Certbot SSL for `bot.lako.services`
22. Nginx reverse proxy with X-Forwarded-Proto header
23. `.env` with production keys
24. PM2 start
25. DNS: `bot.lako.services` → server (Cloudflare A record)
26. Register Viber demo PA, set webhook URL

### Phase 5: Landing + Demo (Day 9-10)
27. Update lako.services/small-business: "Try demo bot" → Viber deeplink
28. New section on homepage: "Try it now" with QR code
29. Offer "10 free bots" — application form
30. Demo bot pre-configured with sample barbershop data

### Phase 6: Client Onboarding (Day 11+)
31. CLI script to add new tenant (name, services, hours, Google Calendar)
32. QR code generation per tenant
33. **Starter Pack PDF**: QR code + "Zakazite lako preko Vibera" — print for door/counter
34. Monitoring: PM2 + simple dashboard (bookings, cancellations, reviews)

## Environment Variables

```
# Server
BOT_PORT=3100
BOT_HOST=0.0.0.0
NODE_ENV=production

# Viber (demo bot)
VIBER_AUTH_TOKEN=xxxxx
VIBER_BOT_NAME=Lako Demo

# Google Calendar
GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx

# App settings
BUFFER_MINUTES=10
LEAD_TIME_MINUTES=60
REMINDER_HOURS=2
TIMEZONE=Europe/Belgrade
```

## Success Metrics (after 1 month with 10 clients)

- Total bookings through bot
- No-show rate reduction (target: from 15-20% to 5%)
- Average review rating
- Time saved per business (target: 2-3 hours/day)
- Client satisfaction / NPS from 10 testers
- Real case studies for marketing

## Open Questions (non-blockers for development)

- Viber Partner Account registration process and timeline
- Google Calendar OAuth consent screen verification
- Pricing model for post-pilot SaaS (monthly subscription?)
- Multi-master support (salon with 2+ barbers) — post-MVP
- Telegram as alternative channel — post-MVP
