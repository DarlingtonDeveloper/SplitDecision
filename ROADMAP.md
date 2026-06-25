# SplitDecision — Build Roadmap

**Hackathon:** Cursor Hands Off, London. Build window ~3h10 (18:20–21:30 code freeze), 2-min demo.
**Team:** 2 devs, multiple AI coding agents working in parallel.
**One line:** An autonomous music manager for a producer. It handles outreach, negotiation, and catalogue admin — the producer runs everything from WhatsApp.

---

## Status snapshot (updated 2026-06-25)

Deployed to Vercel at `music-manager-agent.vercel.app`. Supabase, Wassist, and OpenAI are wired. WhatsApp approval flow tested end-to-end (tap-to-approve buttons working).

### Done
- **WhatsApp control plane** — rewritten for real Wassist API. Conversation-scoped sends, X-API-Key auth, native quick-reply buttons (Approve/Reject/Why), CTA buttons for PayPal links. HMAC-SHA256 signature verification on inbound webhook.
- **Brief parser** — LLM-backed, structured JSON output
- **CLAP matcher** — pgvector cosine search with pseudo-embedding fallback
- **Negotiation agent** — full system prompt, configurable floors, escalation rules
- **Draft approval orchestration** — OK/NO/EDIT/WHY/STATUS/PAUSE/RESUME/HELP commands, both typed and button-tap
- **Pipeline** — brief + negotiation flows wired end-to-end
- **Dashboard** — dark theme, 5xl hero counters (Agent/Approvals/Pending/Sales), Supabase realtime subscriptions, pillar color coding, live connection indicator, SplitDecision branding
- **PayPal sandbox** — order creation, capture, sales logging
- **Email layer** — Gmail API client (OAuth) with SMTP + SendGrid fallbacks. Email classifier (LLM triage: new_brief / negotiation_reply / other). Inbound pipeline: poll → dedupe → strip quoted history → classify → route. Threaded outbound with In-Reply-To headers. Email seed route for demo safety.
- **Supabase** — schema deployed with vector extension, 8 tables, realtime enabled. Email threading fields added (gmail_message_id, gmail_thread_id, last_message_id).
- **Deployment** — Vercel production with all env vars. GitHub public repo at DarlingtonDeveloper/SplitDecision.
- **Outreach scout** — Brave Search integration for real artist discovery. Multi-query contact search (management, booking, socials). GPT-4.1 for extraction. Saves contacts to CRM. Flags missing emails with warnings.
- **PayPal return/cancel pages** — capture on return, graceful cancel, WhatsApp notification on payment.
- **Env validation** — crashes on missing required vars, warns with impact on optional.
- **Webhook fix** — `normalizeInbound` fixed for real Wassist payloads (event envelope, quickReply.quickReplyId). Approval flow tested end-to-end on production.

### What's left
1. **Modal CLAP deploy + prebake** — `modal/prebake.py` now contains a real Modal/librosa/CLAP implementation, but it still needs Modal auth/deploy, beat audio input, endpoint URLs, and a production smoke test. Until `MODAL_CLAP_TEXT_URL` / `MODAL_CLAP_AUDIO_URL` are set, API routes fall back to pseudo-embeddings.
2. **Catalogue admin card** — spec calls for a "3 unregistered works" WhatsApp card. Not built.
3. **Vercel PayPal env check** — production `POST /api/paypal/create-order` returns HTTP 500. Need to set `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` in Vercel env.

---

## Architecture

```
            ┌─────────────────────────── INGEST ───────────────────────────┐
            │  Email poll (Gmail API)        WhatsApp inbound (Wassist)    │
            │  POST /api/email/seed          POST /api/webhooks/whatsapp   │
            └───────────────┬───────────────────────────────┬──────────────┘
                            │                               │
                     ┌──────▼───────────────────────────────▼──────┐
                     │              REASONING (the agent)          │
                     │  email classifier · brief parser            │
                     │  CLAP matcher · negotiator · outreach       │
                     └──────┬───────────────────────────────┬──────┘
                            │ writes drafts + actions       │ CLAP/librosa
                     ┌──────▼──────┐                 ┌──────▼────────┐
                     │  Supabase   │                 │     Modal     │
                     │ pgvector +  │                 │ CLAP+librosa  │
                     │ tables +    │                 │ + cron scouts │
                     │ realtime    │                 └───────────────┘
                     └──────┬──────┘
            ┌───────────────┼────────────────────────────────┐
            │               │                                │
     ┌──────▼──────┐  ┌─────▼──────┐                  ┌──────▼──────┐
     │  WhatsApp   │  │  Dashboard │                  │   Outbound  │
     │  (Wassist)  │  │ (realtime) │                  │ email+PayPal│
     │ buttons+tap │  │ hero ctrs  │                  │  on approve │
     └─────────────┘  └────────────┘                  └─────────────┘
```

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Data + vector + realtime | **Supabase** (pgvector) | catalogue, audit log, live dashboard. Sponsor. |
| Money | **PayPal** sandbox | lease payment links. Sponsor. |
| ML inference + crons | **Modal** | CLAP + librosa, scheduled scouts. Sponsor. |
| WhatsApp | **Wassist** | producer control plane. Sponsor. |
| Web / API / dashboard | **Next.js on Vercel** | webhooks, approval, send, realtime UI. |
| LLM | GPT-4o-mini (OpenAI) | parsing, negotiation, outreach drafting. |
| Audio | **librosa** (bpm/key) + **CLAP** (vibe embedding) | objective attrs + semantic match. |

---

## API routes

| Route | Status | Purpose |
|---|---|---|
| `POST /api/webhooks/whatsapp` | Done | Wassist inbound — button taps + typed commands, signature verification |
| `POST /api/webhooks/email` | Done | Inbound email — auto-classifies via LLM, routes to brief/negotiation |
| `POST /api/seed/brief` | Done | Demo brief seed — triggers full pipeline |
| `POST /api/email/seed` | Done | Demo email seed — brief or negotiation presets |
| `GET /api/dashboard` | Done | Counters + audit feed |
| `POST /api/clap/embed-text` | Done | CLAP text embedding (proxies to Modal, falls back to pseudo) |
| `POST /api/clap/embed-audio` | Done | CLAP audio embedding (proxies to Modal, falls back to pseudo) |
| `POST /api/paypal/create-order` | Done | Sandbox lease link |
| `POST /api/paypal/webhook` | Done | Capture → sales row → WhatsApp notification |
| `POST /api/cron/poll-inbox` | Done | Gmail inbox poll (needs OAuth creds) |
| `POST /api/cron/outreach` | Done | Brave Search artist scout with GPT-4.1 |

---

## Remaining work streams

### Stream A — Modal & ML (the ears)
**Owner:** Unassigned. **Goal:** Deploy real CLAP embeddings and replace pseudo-hash fallback in production.

| # | Task | File(s) | Details |
|---|---|---|---|
| A1 | Implement `modal/prebake.py` | `modal/prebake.py` | Done in code: Modal T4 app, Transformers CLAP, librosa BPM/key, batch upload/upsert path. Needs Modal deploy + real beat audio run. |
| A2 | Deploy Modal CLAP text endpoint | Modal app | Accept `{text}`, return `{embedding: float[512]}`. Wire URL into `MODAL_CLAP_TEXT_URL` env. |
| A3 | Deploy Modal CLAP audio endpoint | Modal app | Accept `{audio_url}`, return `{embedding: float[512], bpm, music_key}`. Wire URL into `MODAL_CLAP_AUDIO_URL` env. |
| A4 | Upload/prebake beat audio files | `modal/prebake.py` | Run `modal run modal/prebake.py --audio-dir ./beats`; stores URLs in `beats.audio_url` and writes real embeddings. |

**Test:** Seed a brief → matcher returns top 3 with real cosine scores > 0.5.

---

### Stream B — Outreach & Contacts (the reach)
**Status: DONE**

- B1: Brave Search artist discovery with GPT-4.1 extraction
- B2: Contacts saved to CRM table automatically from scout discoveries
- B3: Catalogue admin card (deferred — nice-to-have)
- B4: Cron outreach wired and tested (POST /api/cron/outreach)

Tested: Scout found Roddy Ricch for "Midnight" beat, drafted personalised intro, sent WhatsApp approval card.

---

### Stream C — Payments & Hardening (the money)
**Status: DONE** (except PayPal env on Vercel)

- C1: PayPal return page — captures order, updates sale, WhatsApp notification, redirects
- C2: PayPal cancel page — graceful redirect + action log
- C3: WhatsApp approvals — fixed and tested end-to-end on production
- C4: Vercel PayPal env — still needs `PAYPAL_CLIENT_ID` + `PAYPAL_SECRET` set
- C5: Env validation — crashes on missing required, warns on optional with impact

---

### Stream D — Dashboard & Demo Polish (the face)
**Status: DONE**

All D tasks completed:
- D1: Hero counters, pillar colors, dark theme, SplitDecision branding
- D2: Supabase realtime subscriptions with fallback polling
- D3: Layout metadata updated
- D4: Seed route triggers full pipeline

---

## Env vars

All set on Vercel production. Secrets in GitHub repository secrets.

| Var | Status |
|---|---|
| `SUPABASE_URL` | Set |
| `SUPABASE_SERVICE_KEY` | Set |
| `SUPABASE_ANON_KEY` | Set |
| `NEXT_PUBLIC_SUPABASE_URL` | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set |
| `WASSIST_API_KEY` | Set |
| `WASSIST_SIGNING_SECRET` | Set |
| `WASSIST_PRODUCER_CONVERSATION_ID` | Set |
| `PRODUCER_WHATSAPP` | Set |
| `LLM_API_KEY` | Set |
| `LLM_MODEL` | Set (gpt-4o-mini) |
| `GMAIL_OAUTH_*` | Not set (need OAuth refresh token) |
| `PAYPAL_CLIENT_ID` | Not set |
| `PAYPAL_SECRET` | Not set |
| `MODAL_CLAP_TEXT_URL` | Not set (needs Modal deploy) |
| `MODAL_CLAP_AUDIO_URL` | Not set (needs Modal deploy) |

---

## Demo script (2 min)

1. **Brief arrives** — A&R email: "need something dark, Utopia-era Travis, ~140 bpm, for a developing artist."
2. **Dashboard lights up** — agent parses intent, structured attributes appear in real time.
3. **Matches land** — top 3 beats with scores + one-line "why this beat" reasoning.
4. **Phone buzzes** — WhatsApp card with Approve / Reject / Why buttons.
5. **Producer taps Approve** — one tap from across the room.
6. **Email sends** — counter-offer + PayPal lease link delivered. Sale row lands. WhatsApp confirms.
7. **Camera on dashboard** — agent actions count high, approvals gated. "Nothing sent without a tap."

**Headline:** "It ran the desk. I tapped approve from dinner."

---

## Key URLs

| What | URL |
|---|---|
| Production | `https://music-manager-agent.vercel.app` |
| GitHub | `https://github.com/DarlingtonDeveloper/SplitDecision` |
| Supabase | `https://supabase.com/dashboard/project/xtfkdiwpqljllvxdrjkv` |
| Wassist webhook | `https://music-manager-agent.vercel.app/api/webhooks/whatsapp` |
| Wassist agent number | +447700144819 |
| Producer number | +447444361435 |

---

## Scope guards

- **Two pillars deep, not three shallow.** Negotiation + outreach are the headline. Catalogue = one status card.
- **Pre-bake beats.** Never extract audio live except one optional flourish.
- **Keep the approval gate** even when auto-send is tempting. The tap is the oversight story.
- **Seed route as fallback.** If email ingest is flaky, seed a brief by hand so the demo never depends on inbound mail timing.
