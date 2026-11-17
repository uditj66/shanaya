# Shanaya: AI receptionist platform for salons & spas

A multi-salon SaaS. Each salon gets:

- **An AI phone receptionist** (Vapi + OpenAI) that answers calls, recommends treatments and books, reschedules or cancels appointments against live availability.
- **A website chat/voice widget** (OpenAI) that books the same way.
- **A staff dashboard** with a live day calendar per therapist, bookings, guests, call transcripts and recordings, call-back requests, services, team hours, leave and settings.

## How it works

```
Guest calls salon number ──► Vapi ──assistant-request──► /api/vapi ──► looks up which salon owns the number,
                                                                        returns that salon's live prompt + tools
                              Vapi ──tool-calls─────────► /api/vapi ──► booking engine ──► Supabase (Postgres)
                              Vapi ──end-of-call-report─► /api/vapi ──► transcript, summary, recording saved

Website visitor ──► widget.js ──► /w/[slug] ──► /api/widget/[slug] ──► OpenAI Responses API + same tools

Staff ──► /dashboard (Supabase Auth + row level security) ◄── realtime updates when the AI books
```

**Why it can be trusted with real bookings**

- Availability is computed from each therapist's shifts (including split shifts), which services they perform, existing bookings plus cleanup buffers, leave, salon closures, minimum notice and the booking window.
- **The database itself refuses double-bookings** (a Postgres exclusion constraint), even when two callers grab the same slot at the same moment. The engine then tries the next free therapist.
- Row level security means each salon's staff only ever see their own salon's data.
- Callers can only change or cancel bookings that belong to their own phone number.
- The AI hands anything sensitive (complaints, medical or skin questions, custom quotes) to staff as a call-back, or transfers the call.

## Project layout

```
supabase/migrations/        database schema, security rules (applied to the cloud project)
supabase/data/              standard Lumière catalogue + branches (loaded by npm run seed:chain)
src/lib/availability.ts     slot engine (pure, unit tested)
src/lib/booking-service.ts  book / reschedule / cancel / customers (shared by AI and staff)
src/lib/agent/              prompt, tools, OpenAI web agent, Vapi assistant builder
src/app/api/vapi            Vapi webhook (all salons)
src/app/api/widget/[slug]   public widget API
src/app/w/[slug]            widget chat page (embedded via /widget.js)
src/app/dashboard/*         staff dashboard
scripts/seed-owner.mts      creates a demo owner login
scripts/smoke-test.mts      simulates a full phone call end to end
```

## Local setup

1. Fill in `.env.local`. The Supabase URL and publishable key are already set; add:
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase dashboard → Project Settings → API Keys → Secret key
   - `OPENAI_API_KEY`: for the website widget
2. `npm install`
3. `npm run seed:owner` creates the demo owner login (saved into `.env.local`)
4. `npm run dev`, then open http://localhost:3000/login
5. `npm test` (unit tests) and `npm run smoke` (full phone-call simulation against the running app and the real database; it cleans up after itself)

## Deploy (Vercel + Supabase Cloud)

1. Push this folder to a GitHub repository and import it in Vercel.
2. In Vercel → Project → Settings → Environment Variables, add everything from `.env.local` except the `DEMO_*` lines. Set `PUBLIC_APP_URL` to your Vercel URL (for example `https://shanaya.vercel.app`).
3. Supabase → Authentication → URL Configuration: set the Site URL to the same address.
4. **Vapi:**
   - Create a **Bearer Token credential** with header `X-Vapi-Secret` (Bearer prefix off) and a long random value. Put that value in `VAPI_WEBHOOK_SECRET` and the credential's ID in `VAPI_CREDENTIAL_ID`.
   - Buy or import a phone number (Twilio, Plivo or Vonage for Indian numbers).
   - In the dashboard, open **Settings → Phone number**, paste the Vapi phone number ID and click **Connect**. This points the number at `/api/vapi`.
5. Call the number. The booking appears on the dashboard within a second.

## Onboarding a new salon client

They sign up at `/login`, create their studio, then fill in **Settings** (hours, policies, offers), **Services** and **Team & hours**. Connect a phone number and paste the widget snippet on their website. No code changes are needed.

## Next steps for v2

- WhatsApp or SMS confirmations and 24-hour reminders (cuts no-shows)
- Billing per salon (Razorpay or Stripe subscriptions plus per-minute usage)
- Invite team members (staff role) from the dashboard
- Multiple branches per owner, and Google Calendar sync
- Upstash rate limiting for the public widget API

## Shanaya's voice (identical on phone and website)

- **One source of truth:** `src/lib/agent/vapi.ts` → `buildVapiAssistant()` builds the assistant for phone calls (`/api/vapi`), the website "Talk to Shanaya" button (`/api/widget/[slug]/voice`) and the Settings preview (`/api/voice-preview`). `src/lib/agent/voice-consistency.test.ts` fails if they ever drift apart.
- **Default voice:** Vapi `Naina` (female, Indian accent, natural). Backup if that provider is down: Azure `en-IN-NeerjaNeural` (female, Indian English). Neither is ever replaced by a provider default voice.
- **Change it:** Dashboard → Settings → AI receptionist → voice picker (presets or any Vapi-library voice ID) and speaking pace. Press "▶ Talk to Shanaya" to hear exactly what callers hear.
- **Keys needed:** `VAPI_API_KEY` (private, server) and `NEXT_PUBLIC_VAPI_PUBLIC_KEY` (public, browser; restrict it to your domains in the Vapi dashboard). Booking tools during a voice call need the app reachable from the internet (`PUBLIC_APP_URL` = your Vercel URL, or a temporary tunnel when testing locally).

## The Lumière chain (standard SOP catalogue)

- `supabase/data/lumiere-catalogue.json` is the single source for every branch: 37 services in 8 categories, 8 occasion packages (bridal, Karwa Chauth, festive, honeymoon, Valentine's, New Year, Teej, weekend), 6 guest profiles, a 7-person team template and 21 branches in premium areas of 11 cities.
- `npm run seed:chain -- --admin you@example.com` creates or updates every branch from that file (safe to re-run) and makes that login the owner of all branches. Edit the JSON and re-run to change the SOP everywhere.
- Medi-facials (PRP, microneedling, carbon laser) and multi-visit programmes are **consultation-only**: Shanaya takes name, number and preferred dates and creates a call-back; the booking tools refuse to book them directly.
- Branch addresses use real premium areas but are placeholders, and phone numbers are generated (`is_placeholder = true`). Replace them with real details before going live, because Shanaya reads them out to guests.
