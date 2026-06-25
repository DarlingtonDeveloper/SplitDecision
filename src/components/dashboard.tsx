"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Action } from "@/lib/types";

/* ── types ── */
interface Beat {
  id: string;
  title: string;
  bpm: number | null;
  music_key: string | null;
  mood_tags: string[] | null;
  genre: string | null;
  reference_artists: string[] | null;
  license_tiers: Record<string, number> | null;
  status: string;
  audio_url: string | null;
}

interface Draft {
  id: string;
  short_code: string;
  pillar: string;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  payment_link: string | null;
  reasoning: string | null;
  status: string;
  created_at: string;
}

interface Brief {
  id: string;
  source: string | null;
  from_contact: string | null;
  caption: string | null;
  parsed_attributes: Record<string, unknown> | null;
  matched_beat_ids: string[] | null;
  status: string;
  created_at: string;
}

interface Negotiation {
  id: string;
  counterparty: string | null;
  record_title: string | null;
  thread: { role: string; text: string; ts: string }[];
  their_terms: Record<string, string> | null;
  our_position: Record<string, string> | null;
  status: string;
  needs_human: boolean;
  created_at: string;
}

interface Contact {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
}

interface DashboardData {
  counters: {
    agentActions: number;
    producerApprovals: number;
    pendingDrafts: number;
    newBriefs: number;
    salesTotal: number;
  };
  feed: Action[];
  beats: Beat[];
  drafts: Draft[];
  briefs: Brief[];
  negotiations: Negotiation[];
  contacts: Contact[];
}

type Tab = "pipeline" | "catalogue" | "conversations" | "contacts" | "activity";

/* ── palette ── */
const PILLAR: Record<string, { dot: string; bg: string; text: string }> = {
  negotiation: { dot: "bg-violet-400", bg: "bg-violet-500/10", text: "text-violet-300" },
  outreach: { dot: "bg-blue-400", bg: "bg-blue-500/10", text: "text-blue-300" },
  catalogue: { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-300" },
};

const STATUS_COLOR: Record<string, string> = {
  pending_approval: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  sent: "bg-blue-500/15 text-blue-300",
  rejected: "bg-red-500/15 text-red-300",
  editing: "bg-purple-500/15 text-purple-300",
  new: "bg-cyan-500/15 text-cyan-300",
  matched: "bg-emerald-500/15 text-emerald-300",
  open: "bg-amber-500/15 text-amber-300",
  closed: "bg-zinc-500/15 text-zinc-400",
  available: "bg-emerald-500/15 text-emerald-300",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_COLOR[status] ?? "bg-zinc-800 text-zinc-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── main ── */
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>("pipeline");
  const [seeding, setSeeding] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      const id = setInterval(load, 3000);
      return () => clearInterval(id);
    }
    const supabase = createClient(url, key);
    const channel = supabase
      .channel("crm-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "actions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "negotiations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => load())
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    channelRef.current = channel;
    const fallback = setInterval(load, 15000);
    return () => { clearInterval(fallback); supabase.removeChannel(channel); };
  }, [load]);

  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 5000); return () => clearInterval(id); }, []);

  async function seedDemo() {
    setSeeding(true);
    try { await fetch("/api/seed/brief", { method: "POST" }); await load(); } finally { setSeeding(false); }
  }

  async function runScout() {
    setScouting(true);
    try { await fetch("/api/cron/outreach", { method: "POST" }); await load(); } finally { setScouting(false); }
  }

  const c = data?.counters;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "pipeline", label: "Pipeline", count: (data?.drafts?.length ?? 0) },
    { id: "catalogue", label: "Catalogue", count: (data?.beats?.length ?? 0) },
    { id: "conversations", label: "Conversations", count: (data?.negotiations?.length ?? 0) },
    { id: "contacts", label: "Contacts", count: (data?.contacts?.length ?? 0) },
    { id: "activity", label: "Activity", count: (data?.feed?.length ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-emerald-500/30">
      {/* ── header ── */}
      <header className="border-b border-zinc-800/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">SplitDecision</h1>
              <p className="text-[11px] text-zinc-500">Autonomous music manager</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-zinc-600"}`} />
              {connected ? "Live" : "Polling"}
            </span>
            <button onClick={runScout} disabled={scouting} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-50">
              {scouting ? "Scouting..." : "Run scout"}
            </button>
            <button onClick={seedDemo} disabled={seeding} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.97] disabled:opacity-50">
              {seeding ? "Running..." : "Seed brief"}
            </button>
          </div>
        </div>
      </header>

      {/* ── counters ── */}
      <div className="border-b border-zinc-800/40">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-zinc-800/30 sm:grid-cols-5">
          <Stat label="Agent actions" value={c?.agentActions ?? 0} color="text-violet-300" />
          <Stat label="Approvals" value={c?.producerApprovals ?? 0} color="text-amber-300" />
          <Stat label="Pending" value={c?.pendingDrafts ?? 0} color="text-blue-300" />
          <Stat label="Briefs" value={c?.newBriefs ?? 0} color="text-cyan-300" />
          <Stat label="Revenue" value={c?.salesTotal ?? 0} prefix="\u00a3" color="text-emerald-300" />
        </div>
      </div>

      {/* ── tabs ── */}
      <div className="border-b border-zinc-800/40">
        <div className="mx-auto flex max-w-[1400px] gap-0 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-xs font-medium transition ${
                tab === t.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">{t.count}</span>
              )}
              {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── content ── */}
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {error && <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}
        {tab === "pipeline" && <PipelineView drafts={data?.drafts ?? []} briefs={data?.briefs ?? []} />}
        {tab === "catalogue" && <CatalogueView beats={data?.beats ?? []} />}
        {tab === "conversations" && <ConversationsView negotiations={data?.negotiations ?? []} />}
        {tab === "contacts" && <ContactsView contacts={data?.contacts ?? []} />}
        {tab === "activity" && <ActivityView feed={data?.feed ?? []} />}
      </main>
    </div>
  );
}

/* ── stat counter ── */
function Stat({ label, value, prefix, color }: { label: string; value: number; prefix?: string; color: string }) {
  return (
    <div className="bg-[#09090b] px-6 py-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${color}`}>{prefix}{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PIPELINE VIEW — sales funnel / inbox
   ══════════════════════════════════════════════════════════════════════════════ */
function PipelineView({ drafts, briefs }: { drafts: Draft[]; briefs: Brief[] }) {
  const columns: { id: string; label: string; color: string; items: Draft[] }[] = [
    { id: "pending_approval", label: "Awaiting approval", color: "border-amber-500/30", items: drafts.filter(d => d.status === "pending_approval") },
    { id: "editing", label: "Editing", color: "border-purple-500/30", items: drafts.filter(d => d.status === "editing") },
    { id: "sent", label: "Sent", color: "border-blue-500/30", items: drafts.filter(d => d.status === "sent" || d.status === "approved") },
    { id: "rejected", label: "Rejected", color: "border-red-500/30", items: drafts.filter(d => d.status === "rejected") },
  ];

  return (
    <div className="space-y-6">
      {/* Briefs section */}
      {briefs.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">Inbound briefs</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {briefs.map((b) => (
              <div key={b.id} className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-200">{b.from_contact ?? "Unknown"}</p>
                  <StatusBadge status={b.status} />
                </div>
                {b.caption && <p className="mt-2 text-xs leading-relaxed text-zinc-400">{b.caption}</p>}
                <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-600">
                  <span>{b.source ?? "—"}</span>
                  <span>·</span>
                  <span>{timeAgo(b.created_at)}</span>
                  {b.matched_beat_ids?.length ? <span>· {b.matched_beat_ids.length} matches</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">Drafts pipeline</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col) => (
            <div key={col.id} className={`rounded-xl border ${col.color} bg-zinc-900/20 p-3`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{col.label}</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] tabular-nums text-zinc-500">{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map((d) => (
                  <DraftCard key={d.id} draft={d} />
                ))}
                {!col.items.length && (
                  <p className="py-6 text-center text-xs text-zinc-700">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const [expanded, setExpanded] = useState(false);
  const ps = PILLAR[draft.pillar] ?? PILLAR.negotiation;

  return (
    <div
      className="cursor-pointer rounded-lg border border-zinc-800/50 bg-zinc-900/60 p-3 transition hover:border-zinc-700/50"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${ps.dot}`} />
          <span className="font-mono text-xs text-zinc-300">#{draft.short_code}</span>
        </div>
        <span className={`rounded-md px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${ps.bg} ${ps.text}`}>{draft.pillar}</span>
      </div>
      <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{draft.subject ?? draft.body?.slice(0, 80) ?? "—"}</p>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-600">
        {draft.to_address && <span className="truncate">{draft.to_address}</span>}
        <span>{timeAgo(draft.created_at)}</span>
      </div>
      {expanded && draft.body && (
        <div className="mt-3 border-t border-zinc-800/50 pt-3">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{draft.body}</p>
          {draft.reasoning && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] text-zinc-600 hover:text-zinc-400">Reasoning</summary>
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-500">{draft.reasoning}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CATALOGUE VIEW — beats library
   ══════════════════════════════════════════════════════════════════════════════ */
function CatalogueView({ beats }: { beats: Beat[] }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_90px_1fr_120px_80px] gap-4 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
        <span>Title</span><span>BPM</span><span>Key</span><span>Mood / Genre</span><span>Pricing</span><span>Status</span>
      </div>
      {beats.map((b) => (
        <div key={b.id} className="grid grid-cols-[1fr_80px_90px_1fr_120px_80px] items-center gap-4 rounded-xl border border-zinc-800/40 bg-zinc-900/30 px-4 py-3 transition hover:border-zinc-700/50 hover:bg-zinc-900/50">
          <div>
            <p className="text-sm font-medium text-zinc-200">{b.title}</p>
            {b.reference_artists?.length ? (
              <p className="mt-0.5 text-[11px] text-zinc-500">cf. {b.reference_artists.join(", ")}</p>
            ) : null}
          </div>
          <span className="font-mono text-sm text-zinc-300">{b.bpm ?? "—"}</span>
          <span className="text-sm text-zinc-300">{b.music_key ?? "—"}</span>
          <div className="flex flex-wrap gap-1">
            {b.genre && <Tag label={b.genre} color="bg-violet-500/15 text-violet-300" />}
            {(b.mood_tags ?? []).slice(0, 3).map((t) => <Tag key={t} label={t} color="bg-zinc-800 text-zinc-400" />)}
          </div>
          <div className="text-xs text-zinc-400">
            {b.license_tiers ? (
              <div className="space-y-0.5">
                {Object.entries(b.license_tiers).map(([tier, price]) => (
                  <div key={tier} className="flex justify-between">
                    <span className="capitalize">{tier}</span>
                    <span className="font-mono text-zinc-300">{"\u00a3"}{price}</span>
                  </div>
                ))}
              </div>
            ) : "—"}
          </div>
          <StatusBadge status={b.status} />
        </div>
      ))}
      {!beats.length && <EmptyState text="No beats in catalogue" />}
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${color}`}>{label}</span>;
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONVERSATIONS VIEW — negotiation threads
   ══════════════════════════════════════════════════════════════════════════════ */
function ConversationsView({ negotiations }: { negotiations: Negotiation[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = negotiations.find((n) => n.id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]" style={{ minHeight: "60vh" }}>
      {/* List */}
      <div className="space-y-1 overflow-y-auto rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-2">
        {negotiations.map((n) => (
          <button
            key={n.id}
            onClick={() => setSelected(n.id)}
            className={`w-full rounded-lg p-3 text-left transition ${
              selected === n.id ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-200 truncate">{n.counterparty ?? "Unknown"}</p>
              <StatusBadge status={n.status} />
            </div>
            <p className="mt-1 text-xs text-zinc-500 truncate">{n.record_title ?? "—"}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600">
              <span>{timeAgo(n.created_at)}</span>
              {n.needs_human && <span className="text-amber-400">Needs review</span>}
              <span>{Array.isArray(n.thread) ? n.thread.length : 0} messages</span>
            </div>
          </button>
        ))}
        {!negotiations.length && <EmptyState text="No conversations yet" />}
      </div>

      {/* Thread detail */}
      <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-5">
        {active ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">{active.counterparty}</h3>
                <p className="text-sm text-zinc-500">{active.record_title}</p>
              </div>
              <div className="flex items-center gap-2">
                {active.needs_human && <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">NEEDS REVIEW</span>}
                <StatusBadge status={active.status} />
              </div>
            </div>

            {/* Terms comparison */}
            {(active.their_terms || active.our_position) && (
              <div className="grid grid-cols-2 gap-3">
                {active.their_terms && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-red-400">Their terms</p>
                    {Object.entries(active.their_terms).filter(([,v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs"><span className="text-zinc-500 capitalize">{k}</span><span className="text-zinc-300">{v}</span></div>
                    ))}
                  </div>
                )}
                {active.our_position && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-emerald-400">Our position</p>
                    {Object.entries(active.our_position).filter(([,v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs"><span className="text-zinc-500 capitalize">{k}</span><span className="text-zinc-300">{v}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Thread messages */}
            <div className="space-y-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Thread</p>
              {(Array.isArray(active.thread) ? active.thread : []).map((msg, i) => (
                <div key={i} className={`rounded-lg p-3 ${msg.role === "them" ? "border border-zinc-800/50 bg-zinc-900/60" : "border border-emerald-500/10 bg-emerald-500/5"}`}>
                  <div className="mb-1 flex items-center gap-2 text-[10px]">
                    <span className={msg.role === "them" ? "font-medium text-zinc-300" : "font-medium text-emerald-400"}>
                      {msg.role === "them" ? active.counterparty : "Agent"}
                    </span>
                    <span className="text-zinc-600">{msg.ts ? timeAgo(msg.ts) : ""}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{msg.text}</p>
                </div>
              ))}
              {(!active.thread || !Array.isArray(active.thread) || !active.thread.length) && (
                <p className="text-xs text-zinc-600">No messages in thread</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-600">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONTACTS VIEW — CRM
   ══════════════════════════════════════════════════════════════════════════════ */
function ContactsView({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_100px_1fr_1fr] gap-4 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
        <span>Name</span><span>Role</span><span>Email</span><span>Notes</span>
      </div>
      {contacts.map((c) => (
        <div key={c.id} className="grid grid-cols-[1fr_100px_1fr_1fr] items-center gap-4 rounded-xl border border-zinc-800/40 bg-zinc-900/30 px-4 py-3">
          <p className="text-sm font-medium text-zinc-200">{c.name ?? "—"}</p>
          <span className={`rounded-md px-1.5 py-0.5 text-center text-[10px] ${c.role === "artist" ? "bg-violet-500/15 text-violet-300" : c.role === "anr" ? "bg-blue-500/15 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
            {c.role ?? "—"}
          </span>
          <p className="text-xs text-zinc-400 truncate">{c.email ?? <span className="text-zinc-600">No email</span>}</p>
          <p className="text-xs text-zinc-500 truncate">{c.notes ?? "—"}</p>
        </div>
      ))}
      {!contacts.length && <EmptyState text="No contacts discovered yet. Run the scout to find artists." />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ACTIVITY VIEW — audit feed
   ══════════════════════════════════════════════════════════════════════════════ */
function ActivityView({ feed }: { feed: Action[] }) {
  return (
    <div className="space-y-2">
      {feed.map((a) => {
        const ps = PILLAR[a.pillar ?? ""] ?? { dot: "bg-zinc-500", bg: "bg-zinc-800", text: "text-zinc-400" };
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30 px-4 py-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ps.dot}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-200">{a.action_taken}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                <span>{timeAgo(a.ts)}</span>
                {a.pillar && <Tag label={a.pillar} color={`${ps.bg} ${ps.text}`} />}
                {a.trigger && <span>{a.trigger}</span>}
                {a.draft_short_code && <span className="font-mono text-zinc-400">#{a.draft_short_code}</span>}
              </div>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${a.is_autonomous ? "bg-violet-500/10 text-violet-300" : "bg-amber-500/10 text-amber-300"}`}>
              {a.is_autonomous ? "Agent" : "Human"}
            </span>
          </div>
        );
      })}
      {!feed.length && <EmptyState text="No activity yet" />}
    </div>
  );
}

/* ── empty state ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800/50 py-16 text-center">
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
}
