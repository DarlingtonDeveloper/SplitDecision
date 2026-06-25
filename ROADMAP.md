# SplitDecision — Build Roadmap

**Hackathon:** Cursor Hands Off, London. Build window ~3h10 (18:20–21:30 code freeze), 2-min demo.
**Team:** 2 devs, multiple AI coding agents working in parallel.
**One line:** An autonomous music manager for a producer. It handles outreach, negotiation, and catalogue admin — the producer runs everything from WhatsApp.

---

## Status snapshot

The v0 scaffold is deployed. Core loop works end-to-end for the brief→match→draft→approve→send flow. What follows is everything left to finish, harden, and polish — organised for parallel agent work.

### What's done
- WhatsApp control plane (Wassist send/receive, command parser, idempotency)
- Brief parser (LLM-backed, structured JSON output)
- CLAP matcher (pgvector search with fallback)
- Negotiation agent (full system prompt, configurable floors, escalation)
- Draft approval orchestration (OK/NO/EDIT/WHY/STATUS commands)
- Pipeline (brief + negotiation flows wired end-to-end)
- Dashboard (live-polling counters, action feed, seed button)
- PayPal sandbox (order creation, capture, sales logging)
- Supabase client, LLM integration, config

### What's missing or incomplete
1. **Modal CLAP prebake** — `modal/prebake.py` is a stub. No librosa or CLAP. API routes fall back to pseudo-embeddings.
2. **Outreach scout** — hardcoded placeholder artist/contact. No real discovery logic.
3. **Email (SMTP)** — only SendGrid path works. SMTP branch falls through to console.log.
4. **PayPal return/cancel pages** — pipeline references `/api/paypal/return` and `/api/paypal/cancel` but routes don't exist.
5. **Dashboard polish** — functional but basic. Needs visual refinement for demo camera.
6. **Catalogue admin card** — spec calls for a "3 unregistered works" WhatsApp card. Not implemented.
7. **Cron outreach route** — route file exists but needs the scout to be real.
8. **Error handling on webhooks** — happy path works, edge cases untested.

---

## Architecture

```
            ┌─────────────────────────── INGEST ───────────────────────────┐
            │  Email poll (Gmail/IMAP, Modal cron)   WhatsApp inbound (Wassist webhook) │
            └───────────────┬───────────────────────────────┬──────────────┘
                            │                               │
                     ┌──────▼───────────────────────────────▼──────┐
                     │              REASONING (the agent)          │
                     │  brief parser · CLAP matcher · splits       │
                     │  negotiator · outreach scout                │
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
     │ notify+appr │  │  2 counters│                  │  on approve │
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
| LLM | Claude / GPT | parsing, negotiation, outreach drafting. |
| Audio | **librosa** (bpm/key) + **CLAP** (vibe embedding) | objective attrs + semantic match. |

---

## Parallel work streams

The remaining work is split into **4 independent streams** that can each be assigned to a separate agent or dev. Streams have no cross-dependencies until integration at the end.

### Stream A — Modal & ML (the ears)
**Goal:** Real CLAP embeddings replace pseudo-hashes. Beats sound-match properly.

| # | Task | File(s) | Details |
|---|---|---|---|
| A1 | Implement `modal/prebake.py` | `modal/prebake.py` | librosa `beat_track` → bpm, chroma → key. CLAP audio encoder → 512-dim embedding. Batch process 15-30 beats, upsert to Supabase `beats` table. |
| A2 | Deploy Modal CLAP text endpoint | Modal app | Accept `{text}`, return `{embedding: float[512]}`. Wire URL into `MODAL_CLAP_TEXT_URL` env. |
| A3 | Deploy Modal CLAP audio endpoint | Modal app | Accept audio file, return `{embedding: float[512]}`. Wire URL into `MODAL_CLAP_AUDIO_URL` env. |
| A4 | Upload beat audio files to Supabase Storage | Supabase dashboard / script | Store URLs in `beats.audio_url`. Needed for prebake and optional live demo. |

**Test:** Seed a brief → matcher returns top 3 with real cosine scores > 0.5, not hash fallback.

---

### Stream B — Outreach & Email (the voice)
**Goal:** The agent finds real targets and sends real emails post-approval.

| # | Task | File(s) | Details |
|---|---|---|---|
| B1 | Outreach scout — real discovery | `src/lib/agent/outreach.ts` | Replace hardcoded artist. Options: pull from a `contacts` table seeded with target profiles, or LLM-generate plausible targets from genre/mood. For demo, seed 5-10 contacts is fine. |
| B2 | Seed outreach contacts | `supabase/seed-contacts.sql` (new) | Insert demo contacts (artist name, role, email, genre notes). |
| B3 | Fix SMTP email path | `src/lib/email.ts` | Implement the SMTP branch properly (nodemailer) or remove the dead code and commit to SendGrid-only. |
| B4 | Catalogue admin card | `src/lib/agent/pipeline.ts`, `src/lib/whatsapp.ts` | Query beats missing embeddings or metadata. WhatsApp the producer: "3 beats need attention: [list]. Want me to draft metadata?" |
| B5 | Cron outreach route | `src/app/api/cron/outreach/route.ts` | Wire to real `runOutreachScout()`. Add Vercel cron config if needed. |

**Test:** Cron fires → scout picks a contact + best-fit beat → draft appears on WhatsApp → OK → email sends (SendGrid or SMTP).

---

### Stream C — Payments & Hardening (the money)
**Goal:** PayPal flow completes without dead ends. Webhooks are bulletproof.

| # | Task | File(s) | Details |
|---|---|---|---|
| C1 | PayPal return page | `src/app/api/paypal/return/route.ts` (new) | Handle redirect after buyer approves. Capture the order, write `sales` row, redirect to a "Payment received" page or back to dashboard. |
| C2 | PayPal cancel page | `src/app/api/paypal/cancel/route.ts` (new) | Handle buyer cancellation. Redirect gracefully. |
| C3 | Webhook edge cases | `src/app/api/webhooks/whatsapp/route.ts` | Test: malformed body, unknown command, duplicate message_id, empty body. Return 200 for all, log errors, never crash. |
| C4 | Email webhook hardening | `src/app/api/webhooks/email/route.ts` | Same treatment: validate payload, handle missing fields, 200-fast. |
| C5 | Env validation on startup | `src/lib/config.ts` | Warn (not crash) on missing optional keys. Crash on missing required keys (SUPABASE_URL, SUPABASE_SERVICE_KEY). |

**Test:** Full PayPal sandbox flow: draft with lease link → OK → email with link → buyer clicks → return page → `sales` row written → WhatsApp confirmation to producer.

---

### Stream D — Dashboard & Demo Polish (the face)
**Goal:** The dashboard looks great on camera. Demo flow is rehearsed and reliable.

| # | Task | File(s) | Details |
|---|---|---|---|
| D1 | Dashboard visual upgrade | `src/components/dashboard.tsx`, `src/app/globals.css` | Dark theme, large counters, clean action feed with pillar colour coding. Must read well on a phone camera from 2m away. |
| D2 | Realtime subscriptions | `src/components/dashboard.tsx` | Replace polling with Supabase realtime subscriptions on `actions`, `drafts`, `briefs` tables. Instant updates for demo. |
| D3 | Seed demo script route | `src/app/api/seed/brief/route.ts` | Ensure it creates a compelling brief that triggers the full pipeline: parse → match → negotiate → draft → WhatsApp. One button, full demo. |
| D4 | Demo rehearsal checklist | — | Walk through the 2-min script end-to-end. Note any timing issues. Ensure the dashboard is visible, WhatsApp cards render, PayPal link works. |

**Test:** Hit "Seed demo brief" → watch dashboard light up in real time → phone buzzes → tap OK → email + payment link sent → sale logged. All visible on screen within 60 seconds.

---

## Integration & deploy

After streams complete, one final pass:

1. `vercel env` — ensure all new env vars (Modal URLs, SendGrid key, etc.) are set in production.
2. `vercel --prod` — deploy.
3. Smoke test the full demo script against production.
4. Confirm Wassist webhook points to `https://split-decision.vercel.app/api/webhooks/whatsapp`.

---

## Demo script (2 min)

1. **Brief arrives** — A&R email: "need something dark, Utopia-era Travis, ~140 bpm, for a developing artist."
2. **Dashboard lights up** — agent parses intent, structured attributes appear in real time.
3. **Matches land** — top 3 beats with cosine scores + one-line "why this beat" reasoning.
4. **Phone buzzes** — WhatsApp card: counter-offer, position summary, floor flag if needed.
5. **Producer taps `OK A3`** — from across the room, one tap.
6. **Email sends** — counter-offer + PayPal lease link delivered. Sale row lands. WhatsApp confirms.
7. **Camera on dashboard** — agent actions count high, approvals gated. "Nothing sent without a tap."

**Headline:** "It ran the desk. I tapped approve from dinner."

---

## Oversight story (for judges)

The agent autonomously researches, parses, matches, negotiates, and drafts. The producer approves every outbound action with one WhatsApp tap. The audit log proves both halves.

Two counters on the dashboard:
- **Agent actions** — every autonomous step (research, parse, match, reason, draft).
- **Producer approvals** — every outbound gated behind a human tap.

This isn't "zero humans." It's the right split: AI does the work, human holds the keys.

---

## Scope guards

- **Two pillars deep, not three shallow.** Negotiation + outreach are the headline. Catalogue = one status card.
- **Pre-bake beats.** Never extract audio live except one optional flourish.
- **Confirm Wassist values early**, then never touch the adapter.
- **Keep the approval gate** even when auto-send is tempting. The tap is the oversight story.
- **Seed route as fallback.** If email ingest is flaky, seed a brief by hand so the demo never depends on inbound mail timing.
