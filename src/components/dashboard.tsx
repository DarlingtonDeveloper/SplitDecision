"use client";

import { useCallback, useEffect, useState } from "react";
import type { Action } from "@/lib/types";

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

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
              Music Manager Agent
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              It ran the desk. I tapped approve.
            </h1>
          </div>
          <button
            onClick={seedDemo}
            disabled={seeding}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {seeding ? "Running…" : "Seed demo brief"}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
            Live audit feed
          </h2>
          {error && (
            <p className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}
          <ul className="space-y-2">
            {(data?.feed ?? []).map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed">{a.action_taken}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      a.is_autonomous
                        ? "bg-violet-500/20 text-violet-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {a.is_autonomous ? "Agent" : "Producer"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(a.ts).toLocaleTimeString()} · {a.pillar ?? "—"} ·{" "}
                  {a.trigger ?? "—"}
                  {a.draft_short_code ? ` · #${a.draft_short_code}` : ""}
                </p>
              </li>
            ))}
            {!data?.feed?.length && !error && (
              <li className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                No actions yet — seed a demo brief or wire Supabase env vars.
              </li>
            )}
          </ul>
        </section>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Counter label="Agent actions" value={c?.agentActions ?? 0} accent="violet" />
            <Counter label="Producer approvals" value={c?.producerApprovals ?? 0} accent="amber" />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Pipeline</h3>
            <StatRow label="Drafts awaiting tap" value={c?.pendingDrafts ?? 0} />
            <StatRow label="Open briefs" value={c?.newBriefs ?? 0} />
            <StatRow label="Sales (captured)" value={`£${c?.salesTotal ?? 0}`} />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs leading-relaxed text-zinc-500">
            WhatsApp control plane: every outbound waits for{" "}
            <code className="text-zinc-300">OK A#</code>. Nothing sends without a
            producer tap.
          </div>
        </aside>
      </main>
    </div>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "violet" | "amber";
}) {
  const colors =
    accent === "violet"
      ? "from-violet-500/20 to-violet-900/10 text-violet-200"
      : "from-amber-500/20 to-amber-900/10 text-amber-200";

  return (
    <div className={`rounded-xl border border-zinc-800 bg-gradient-to-br ${colors} p-4`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
