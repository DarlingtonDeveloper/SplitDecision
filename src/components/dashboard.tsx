"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Action } from "@/lib/types";

/* ── palette ── */
const PILLAR_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  negotiation: { bg: "bg-violet-500/15", text: "text-violet-300", dot: "bg-violet-400" },
  outreach:    { bg: "bg-blue-500/15",   text: "text-blue-300",   dot: "bg-blue-400" },
  catalogue:   { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
};

function pillarStyle(pillar: string | null) {
  return PILLAR_COLORS[pillar ?? ""] ?? { bg: "bg-zinc-500/15", text: "text-zinc-400", dot: "bg-zinc-500" };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/* ── types ── */
interface DashboardData {
  counters: {
    agentActions: number;
    producerApprovals: number;
    pendingDrafts: number;
    newBriefs: number;
    salesTotal: number;
  };
  feed: Action[];
}

/* ── main component ── */
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [seeding, setSeeding] = useState(false);
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

  /* ── supabase realtime ── */
  useEffect(() => {
    load();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      // fallback to polling if no public keys
      const id = setInterval(load, 3000);
      return () => clearInterval(id);
    }

    const supabase = createClient(url, key);
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "actions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // slow poll as fallback in case realtime hiccups
    const fallback = setInterval(load, 15000);

    return () => {
      clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [load]);

  // tick relative timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  async function seedDemo() {
    setSeeding(true);
    try {
      await fetch("/api/seed/brief", { method: "POST" });
      await load();
    } finally {
      setSeeding(false);
    }
  }

  const c = data?.counters;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-emerald-500/30">
      {/* ── header ── */}
      <header className="border-b border-zinc-800/60 px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                SplitDecision
              </h1>
              <p className="text-xs text-zinc-500">
                Autonomous music manager
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-zinc-600"}`} />
              {connected ? "Live" : "Polling"}
            </span>
            <button
              onClick={seedDemo}
              disabled={seeding}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.97] disabled:opacity-50"
            >
              {seeding ? "Running..." : "Seed demo brief"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* ── hero counters ── */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <HeroCounter
            label="Agent actions"
            value={c?.agentActions ?? 0}
            gradient="from-violet-600/20 via-violet-500/5 to-transparent"
            valueColor="text-violet-200"
            ringColor="ring-violet-500/20"
          />
          <HeroCounter
            label="Producer approvals"
            value={c?.producerApprovals ?? 0}
            gradient="from-amber-600/20 via-amber-500/5 to-transparent"
            valueColor="text-amber-200"
            ringColor="ring-amber-500/20"
          />
          <HeroCounter
            label="Pending drafts"
            value={c?.pendingDrafts ?? 0}
            gradient="from-blue-600/20 via-blue-500/5 to-transparent"
            valueColor="text-blue-200"
            ringColor="ring-blue-500/20"
          />
          <HeroCounter
            label="Sales revenue"
            value={c?.salesTotal ?? 0}
            prefix="£"
            gradient="from-emerald-600/20 via-emerald-500/5 to-transparent"
            valueColor="text-emerald-200"
            ringColor="ring-emerald-500/20"
          />
        </div>

        {/* ── two-column: feed + sidebar ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── live audit feed ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
                Live audit feed
              </h2>
              <span className="text-xs tabular-nums text-zinc-600">
                {data?.feed?.length ?? 0} actions
              </span>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              {(data?.feed ?? []).map((a, i) => {
                const ps = pillarStyle(a.pillar);
                return (
                  <div
                    key={a.id}
                    className="group rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-700/50 hover:bg-zinc-900/60"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ps.dot}`} />
                        <div>
                          <p className="text-sm leading-relaxed text-zinc-200">
                            {a.action_taken}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                            <span>{timeAgo(a.ts)}</span>
                            {a.pillar && (
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${ps.bg} ${ps.text}`}>
                                {a.pillar}
                              </span>
                            )}
                            {a.trigger && <span>· {a.trigger}</span>}
                            {a.draft_short_code && (
                              <span className="font-mono text-zinc-400">#{a.draft_short_code}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          a.is_autonomous
                            ? "bg-violet-500/15 text-violet-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {a.is_autonomous ? "Agent" : "Human"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {!data?.feed?.length && !error && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800/50 py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
                      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-500">No actions yet</p>
                  <p className="mt-1 text-xs text-zinc-600">Seed a demo brief to get started</p>
                </div>
              )}
            </div>
          </section>

          {/* ── sidebar ── */}
          <aside className="space-y-4">
            {/* pipeline stats */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5">
              <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-500">
                Pipeline
              </h3>
              <div className="space-y-3">
                <StatRow label="Open briefs" value={c?.newBriefs ?? 0} />
                <StatRow label="Drafts awaiting tap" value={c?.pendingDrafts ?? 0} highlight={Boolean(c?.pendingDrafts)} />
                <div className="border-t border-zinc-800/50" />
                <StatRow label="Total sales" value={`£${c?.salesTotal ?? 0}`} />
              </div>
            </div>

            {/* how it works */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
                How it works
              </h3>
              <div className="space-y-2 text-xs leading-relaxed text-zinc-500">
                <Step n={1} text="Brief arrives via email or WhatsApp" />
                <Step n={2} text="Agent parses, matches beats, drafts reply" />
                <Step n={3} text="Producer gets WhatsApp card with draft" />
                <Step n={4}>
                  Tap <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">OK A#</code> to approve and send
                </Step>
              </div>
            </div>

            {/* tagline */}
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-5">
              <p className="text-sm font-medium text-emerald-300">
                &ldquo;It ran the desk. I tapped approve from dinner.&rdquo;
              </p>
              <p className="mt-2 text-xs text-emerald-500/70">
                Every outbound waits for a producer tap. Nothing sends without approval.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ── hero counter ── */
function HeroCounter({
  label,
  value,
  prefix,
  gradient,
  valueColor,
  ringColor,
}: {
  label: string;
  value: number;
  prefix?: string;
  gradient: string;
  valueColor: string;
  ringColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br ${gradient} p-6 ring-1 ${ringColor}`}>
      <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 text-5xl font-bold tabular-nums tracking-tight ${valueColor}`}>
        {prefix}{value}
      </p>
    </div>
  );
}

/* ── stat row ── */
function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium tabular-nums ${highlight ? "text-amber-300" : "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}

/* ── step ── */
function Step({ n, text, children }: { n: number; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
        {n}
      </span>
      <span>{text ?? children}</span>
    </div>
  );
}
