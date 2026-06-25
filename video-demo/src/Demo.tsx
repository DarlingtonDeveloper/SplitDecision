import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/* ── Colors ── */
const BG = "#09090b";
const EMERALD = "#34d399";
const VIOLET = "#a78bfa";
const AMBER = "#fbbf24";
const BLUE = "#60a5fa";
const ZINC_100 = "#f4f4f5";
const ZINC_400 = "#a1a1aa";
const ZINC_600 = "#52525b";
const ZINC_800 = "#27272a";
const ZINC_900 = "#18181b";

/* ── Helpers ── */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const y = spring({ frame: frame - delay, fps, config: { damping: 20 } }) * 30 - 30;
  return <div style={{ opacity, transform: `translateY(${-y}px)` }}>{children}</div>;
}

function TypeWriter({ text, startFrame, charsPerFrame = 0.8 }: { text: string; startFrame: number; charsPerFrame?: number }) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const chars = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  return <span>{text.slice(0, chars)}<span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span></span>;
}

/* ── Scenes ── */

function TitleScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 15 } });
  const taglineOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={EMERALD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <span style={{ fontSize: 72, fontWeight: 700, color: ZINC_100, letterSpacing: -2 }}>SplitDecision</span>
      </div>
      <p style={{ fontSize: 24, color: ZINC_400, marginTop: 20, opacity: taglineOpacity }}>
        Autonomous music manager — WhatsApp is the control plane
      </p>
    </AbsoluteFill>
  );
}

function BriefScene() {
  return (
    <AbsoluteFill style={{ background: BG, padding: 80 }}>
      <FadeIn>
        <p style={{ fontSize: 14, color: EMERALD, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600 }}>Step 1</p>
        <h2 style={{ fontSize: 48, color: ZINC_100, fontWeight: 700, marginTop: 10 }}>Brief arrives</h2>
      </FadeIn>
      <FadeIn delay={20}>
        <div style={{ marginTop: 40, background: ZINC_900, border: `1px solid ${ZINC_800}`, borderRadius: 16, padding: 32, maxWidth: 800 }}>
          <p style={{ fontSize: 13, color: ZINC_600, marginBottom: 8 }}>From: Sable (A&R, Polydor)</p>
          <p style={{ fontSize: 13, color: ZINC_600, marginBottom: 16 }}>Subject: Beat brief — developing artist</p>
          <p style={{ fontSize: 18, color: ZINC_400, lineHeight: 1.7 }}>
            <TypeWriter
              text='Need something dark, Utopia-era Travis Scott vibe, around 140 BPM, minor key. For a developing artist on the roster — non-exclusive lease budget ~£500.'
              startFrame={30}
              charsPerFrame={1.2}
            />
          </p>
        </div>
      </FadeIn>
      <FadeIn delay={60}>
        <div style={{ marginTop: 30, display: "flex", gap: 12 }}>
          <TagPill label="dark trap" color={VIOLET} />
          <TagPill label="atmospheric" color={VIOLET} />
          <TagPill label="~140 BPM" color={BLUE} />
          <TagPill label="minor key" color={BLUE} />
          <TagPill label="£500 lease" color={EMERALD} />
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function MatchScene() {
  return (
    <AbsoluteFill style={{ background: BG, padding: 80 }}>
      <FadeIn>
        <p style={{ fontSize: 14, color: VIOLET, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600 }}>Step 2</p>
        <h2 style={{ fontSize: 48, color: ZINC_100, fontWeight: 700, marginTop: 10 }}>Agent matches beats</h2>
      </FadeIn>
      <FadeIn delay={20}>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <BeatRow title="Midnight" bpm={140} k="F# minor" score={92} color={EMERALD} />
          <BeatRow title="Nebula" bpm={138} k="A minor" score={78} color={AMBER} />
          <BeatRow title="Afterhours" bpm={142} k="C minor" score={71} color={AMBER} />
        </div>
      </FadeIn>
      <FadeIn delay={50}>
        <p style={{ marginTop: 30, fontSize: 16, color: ZINC_400 }}>
          CLAP audio embeddings + pgvector cosine search
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
}

function WhatsAppScene() {
  return (
    <AbsoluteFill style={{ background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 500, width: "100%" }}>
        <FadeIn>
          <p style={{ fontSize: 14, color: AMBER, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600, textAlign: "center" }}>Step 3</p>
          <h2 style={{ fontSize: 48, color: ZINC_100, fontWeight: 700, textAlign: "center", marginTop: 10 }}>Producer gets WhatsApp</h2>
        </FadeIn>
        <FadeIn delay={25}>
          <div style={{ marginTop: 40, background: "#1a2e1a", borderRadius: 16, padding: 24, border: "1px solid #2d4a2d" }}>
            <p style={{ fontSize: 16, color: "#dcfce7", lineHeight: 1.7 }}>
              🎛️ DRAFT #A3 · Negotiation{"\n\n"}
              Re: "Midnight" — Sable (A&R, Polydor){"\n"}
              Top match: Midnight (92%){"\n"}
              My counter: 50% pub, 3 pts, £500 upfront{"\n\n"}
              ⚠️ Their offer is below your points floor.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <WhatsAppButton label="Approve" color="#22c55e" />
              <WhatsAppButton label="Reject" color="#ef4444" />
              <WhatsAppButton label="Why this?" color="#3b82f6" />
            </div>
          </div>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
}

function ApproveScene() {
  const frame = useCurrentFrame();
  const tapScale = frame > 20 ? spring({ frame: frame - 20, fps: 30, config: { damping: 10 } }) : 0;

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <FadeIn>
          <p style={{ fontSize: 14, color: EMERALD, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600 }}>Step 4</p>
          <h2 style={{ fontSize: 56, color: ZINC_100, fontWeight: 700, marginTop: 10 }}>One tap</h2>
        </FadeIn>
        <div style={{ marginTop: 50, transform: `scale(${0.8 + tapScale * 0.2})`, opacity: tapScale }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "#22c55e", padding: "16px 40px", borderRadius: 12, fontSize: 24, fontWeight: 600, color: "#052e16" }}>
            ✓ Approve
          </div>
        </div>
        <FadeIn delay={40}>
          <div style={{ marginTop: 40, display: "flex", gap: 20, justifyContent: "center" }}>
            <MiniStat label="Email sent" icon="✉️" />
            <MiniStat label="PayPal link" icon="💳" />
            <MiniStat label="Sale logged" icon="💰" />
            <MiniStat label="WhatsApp confirmed" icon="✅" />
          </div>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
}

function DashboardScene() {
  return (
    <AbsoluteFill style={{ background: BG, padding: 60 }}>
      <FadeIn>
        <p style={{ fontSize: 14, color: BLUE, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600 }}>Step 5</p>
        <h2 style={{ fontSize: 48, color: ZINC_100, fontWeight: 700, marginTop: 10 }}>Dashboard shows everything</h2>
      </FadeIn>
      <FadeIn delay={15}>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
          <CounterCard label="Agent actions" value="47" color={VIOLET} />
          <CounterCard label="Approvals" value="12" color={AMBER} />
          <CounterCard label="Pending" value="3" color={BLUE} />
          <CounterCard label="Revenue" value="£2,450" color={EMERALD} />
        </div>
      </FadeIn>
      <FadeIn delay={30}>
        <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <TabPreview label="Pipeline" desc="Kanban draft funnel" />
          <TabPreview label="Catalogue" desc="3 beats, priced" />
          <TabPreview label="Conversations" desc="2 active threads" />
          <TabPreview label="Contacts" desc="CRM from scouts" />
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function OutreachScene() {
  return (
    <AbsoluteFill style={{ background: BG, padding: 80 }}>
      <FadeIn>
        <p style={{ fontSize: 14, color: BLUE, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600 }}>Autonomous</p>
        <h2 style={{ fontSize: 48, color: ZINC_100, fontWeight: 700, marginTop: 10 }}>Scout finds artists</h2>
      </FadeIn>
      <FadeIn delay={20}>
        <div style={{ marginTop: 40, display: "flex", gap: 20, alignItems: "flex-start" }}>
          <FlowBox label="Beat catalogue" sub='"Midnight" — dark trap' color={VIOLET} />
          <Arrow />
          <FlowBox label="Brave Search" sub="Find matching artists" color={BLUE} />
          <Arrow />
          <FlowBox label="GPT-4.1" sub="Extract contacts" color={AMBER} />
          <Arrow />
          <FlowBox label="WhatsApp" sub="Approval card" color={EMERALD} />
        </div>
      </FadeIn>
      <FadeIn delay={50}>
        <p style={{ marginTop: 40, fontSize: 18, color: ZINC_400 }}>
          Builds a CRM of artist contacts automatically
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
}

function ClosingScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <p style={{ fontSize: 56, fontWeight: 700, color: ZINC_100, lineHeight: 1.3 }}>
          &ldquo;It ran the desk.{"\n"}I tapped approve from dinner.&rdquo;
        </p>
        <div style={{ marginTop: 40, display: "flex", gap: 16, justifyContent: "center" }}>
          <TagPill label="Supabase" color={EMERALD} />
          <TagPill label="Wassist" color={EMERALD} />
          <TagPill label="Modal" color={VIOLET} />
          <TagPill label="PayPal" color={BLUE} />
          <TagPill label="Vercel" color={ZINC_400} />
          <TagPill label="Brave" color={AMBER} />
        </div>
        <FadeIn delay={30}>
          <p style={{ marginTop: 30, fontSize: 20, color: ZINC_600 }}>
            SplitDecision — Cursor Hands Off Hackathon, London
          </p>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
}

/* ── Shared components ── */
function TagPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: "6px 14px", borderRadius: 8, background: `${color}20`, color, fontSize: 14, fontWeight: 500 }}>
      {label}
    </span>
  );
}

function BeatRow({ title, bpm, k, score, color }: { title: string; bpm: number; k: string; score: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, background: ZINC_900, border: `1px solid ${ZINC_800}`, borderRadius: 12, padding: "16px 24px" }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 20, fontWeight: 600, color: ZINC_100 }}>{title}</p>
        <p style={{ fontSize: 13, color: ZINC_600 }}>{bpm} BPM · {k}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{score}%</p>
        <p style={{ fontSize: 11, color: ZINC_600 }}>match</p>
      </div>
    </div>
  );
}

function WhatsAppButton({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 8, background: `${color}20`, color, fontSize: 14, fontWeight: 600 }}>
      {label}
    </div>
  );
}

function MiniStat({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: ZINC_900, border: `1px solid ${ZINC_800}`, borderRadius: 10, padding: "12px 20px" }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 14, color: ZINC_400 }}>{label}</span>
    </div>
  );
}

function CounterCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: ZINC_900, border: `1px solid ${ZINC_800}`, borderRadius: 12, padding: 20 }}>
      <p style={{ fontSize: 11, color: ZINC_600, textTransform: "uppercase", letterSpacing: 2 }}>{label}</p>
      <p style={{ fontSize: 36, fontWeight: 700, color, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function TabPreview({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ background: ZINC_900, border: `1px solid ${ZINC_800}`, borderRadius: 10, padding: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: ZINC_100 }}>{label}</p>
      <p style={{ fontSize: 12, color: ZINC_600, marginTop: 4 }}>{desc}</p>
    </div>
  );
}

function FlowBox({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div style={{ background: ZINC_900, border: `1px solid ${color}30`, borderRadius: 12, padding: "20px 24px", minWidth: 180 }}>
      <p style={{ fontSize: 16, fontWeight: 600, color }}>{label}</p>
      <p style={{ fontSize: 12, color: ZINC_600, marginTop: 4 }}>{sub}</p>
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ display: "flex", alignItems: "center", color: ZINC_600, fontSize: 24 }}>→</div>
  );
}

/* ── Main composition ── */
export const SplitDecisionDemo: React.FC = () => {
  const fps = 30;
  // 2 minutes = 3600 frames. 8 scenes.
  const sceneDuration = Math.floor(3600 / 8); // ~450 frames = 15s each

  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Sequence from={0} durationInFrames={sceneDuration}><TitleScene /></Sequence>
      <Sequence from={sceneDuration} durationInFrames={sceneDuration}><BriefScene /></Sequence>
      <Sequence from={sceneDuration * 2} durationInFrames={sceneDuration}><MatchScene /></Sequence>
      <Sequence from={sceneDuration * 3} durationInFrames={sceneDuration}><WhatsAppScene /></Sequence>
      <Sequence from={sceneDuration * 4} durationInFrames={sceneDuration}><ApproveScene /></Sequence>
      <Sequence from={sceneDuration * 5} durationInFrames={sceneDuration}><OutreachScene /></Sequence>
      <Sequence from={sceneDuration * 6} durationInFrames={sceneDuration}><DashboardScene /></Sequence>
      <Sequence from={sceneDuration * 7} durationInFrames={sceneDuration}><ClosingScene /></Sequence>
    </AbsoluteFill>
  );
};
