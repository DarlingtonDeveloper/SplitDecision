# Music Manager Agent

Autonomous music manager for a producer. WhatsApp is the control plane — nothing sends without a tap.

## Quick start

```bash
cp .env.example .env.local
# Fill Supabase + Wassist + LLM keys

npm install
npm run dev
```

1. Run `supabase/schema.sql` in your Supabase SQL editor
2. Optionally run `supabase/seed-beats.sql` for demo catalogue
3. Open http://localhost:3000 — hit **Seed demo brief**
4. Point Wassist webhook to `/api/webhooks/whatsapp`

## Core loop

```
ingest → reason → draft → WhatsApp → OK A# → send → log
```

## API routes

| Route | Purpose |
|---|---|
| `POST /api/webhooks/whatsapp` | Wassist inbound commands |
| `POST /api/webhooks/email` | Email brief / negotiation ingest |
| `POST /api/seed/brief` | Demo brief (scope guard) |
| `GET /api/dashboard` | Counters + audit feed |
| `POST /api/clap/embed-text` | CLAP text embedding |
| `POST /api/paypal/create-order` | Sandbox lease link |

## Hackathon demo

1. Seed brief → dashboard shows parse + match actions
2. Phone gets WhatsApp draft card with `OK A1`
3. Tap approve → email + PayPal link sent, sale logged
4. Dashboard: high agent count, gated approvals
