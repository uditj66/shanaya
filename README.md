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

- **Managed in the Vapi dashboard:** one saved assistant (`VAPI_ASSISTANT_ID`) serves every branch on phone and website. Edit her voice, model, greeting and personality in Vapi and click **Publish**. Keep the `{{knowledge}}` line in the prompt; `{{agent_name}}` and `{{brand_name}}` come from each branch's Settings.
- **What the app sends per call** (`vapiCallConfig()` in `src/lib/agent/vapi.ts`): live knowledge, names, and a **signed** branch id (`salon_sig`), so nobody can point tools at another branch. Never add a per-call `server` override: Vapi then drops the webhook secret and every tool call fails as "unauthorised" (a test guards this).
- **After changing tools or server settings:** run `npm run vapi:assistant -- sync-tools --url https://shanaya-self.vercel.app` (keeps your Vapi edits). `reset-prompt` restores the built-in persona and greeting. Then refresh the Vapi dashboard, and use **Publish ▾ → Discard Changes** if it still shows an old draft.
- **Privacy:** on the website (no caller ID) Shanaya only shares bookings or visit history with a booking reference plus mobile number.

## The Lumière chain (standard SOP catalogue)

- `supabase/data/lumiere-catalogue.json` is the single source for every branch: 37 services in 8 categories, 8 occasion packages (bridal, Karwa Chauth, festive, honeymoon, Valentine's, New Year, Teej, weekend), 6 guest profiles, a 7-person team template and 21 branches in premium areas of 11 cities.
- `npm run seed:chain -- --admin you@example.com` creates or updates every branch from that file (safe to re-run) and makes that login the owner of all branches. Edit the JSON and re-run to change the SOP everywhere.
- Medi-facials (PRP, microneedling, carbon laser) and multi-visit programmes are **consultation-only**: Shanaya takes name, number and preferred dates and creates a call-back; the booking tools refuse to book them directly.
- Branch addresses use real premium areas but are placeholders, and phone numbers are generated (`is_placeholder = true`). Replace them with real details before going live, because Shanaya reads them out to guests.
