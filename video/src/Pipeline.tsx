import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, FONT } from "./theme";
import { PIPE, PIPE_DUR } from "./timeline";
import { Phone, SimSlot, Sticker, usePop } from "./ui";

// "How it works": one payment through the pipeline. Diagram on top, facts bottom left, phone right.
// ponytail: one file, inline styles (Remotion idiom), fixed coordinates for a 1920x1080 frame.

type NodeKey = "phone" | "rules" | "auth0" | "nessie" | "tiger";
type SegKey = Exclude<keyof typeof PIPE, "intro">;

const BOX = 120;
const ROW = 165; // main row center y
const NODES: Record<NodeKey, { x: number; y: number; label: string }> = {
  phone: { x: 170, y: ROW, label: "Rosa's iPhone" },
  rules: { x: 540, y: ROW, label: "checkwith.us rules" },
  auth0: { x: 910, y: ROW, label: "Auth0" },
  nessie: { x: 1250, y: ROW, label: "Capital One Nessie" },
  tiger: { x: 540, y: 425, label: "Tiger Data" },
};
const LINES: [NodeKey, NodeKey][] = [["phone", "rules"], ["rules", "auth0"], ["auth0", "nessie"], ["rules", "tiger"]];

const SEGS: Record<SegKey, {
  title: string; facts: string[]; stat?: string; sim: string; app: "rosa" | "family";
  node?: NodeKey; from?: { x: number; y: number }; packet?: string;
}> = {
  phone: {
    title: "On Rosa's iPhone",
    facts: ["iOS Message Filter + Call Directory", "Our own scam model: 1 MB, 0.14 ms a text", "Texts never leave the phone", "Scam calls ring as \"Possible scam\""],
    sim: "Rosa's app: scam text in Junk, then the \"Possible scam\" call",
    app: "rosa", node: "phone", from: { x: -60, y: ROW }, packet: "TXT",
  },
  tiger: {
    title: "Tiger Data",
    facts: ["Every payment lands in a hypertable", "3 real-time continuous aggregates", "\"More than 3x usual?\" in about 1 ms, while the payment waits", "2-hour window: ATM cash, then a gift card"],
    stat: "1M rows: 13.8x faster, 3.2x smaller",
    sim: "Family app: held payment with plain reasons",
    app: "family", node: "tiger", from: NODES.rules,
  },
  auth0: {
    title: "Auth0",
    facts: ["Approver and viewer roles (RBAC)", "Over $1,000: two approvers, one no wins", "Approve needs Face ID. Freeze needs a fresh sign-in.", "Bill-pay agent: its own machine identity, one scope"],
    sim: "Family app: Approve with Face ID",
    app: "family", node: "auth0", from: NODES.rules,
  },
  nessie: {
    title: "Capital One Nessie",
    facts: ["Rosa's bank: 10 resource types, each with a job", "Merchant categories drive the rules", "Purchases and bills are real payments", "ATM withdrawals start the scam we catch", "Freeze: one transfer to the vault, exactly once"],
    sim: "Family app: Freeze. \"Frozen. Money is in the safe account.\"",
    app: "family", node: "nessie", from: NODES.auth0,
  },
  eyes: {
    title: "Easy On The Eyes",
    facts: ["No new interface for Rosa", "One action per screen, plain words", "Largest Dynamic Type and VoiceOver", "Family sees reasons, never a risk score"],
    sim: "Rosa's app at the largest text size",
    app: "rosa",
  },
};
const SEG_KEYS = Object.keys(SEGS) as SegKey[];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0..1: how "on" a segment is, with short fades at its edges. */
const on = (frame: number, k: SegKey) => {
  const { from, dur } = PIPE[k];
  return interpolate(frame, [from, from + 12, from + dur - 8, from + dur], [0, 1, 1, 0], clamp);
};

const Icon = ({ kind, size }: { kind: NodeKey; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={C.white} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    {kind === "phone" && (<><rect x={14} y={4} width={20} height={40} rx={4} /><path d="M21 38H27" /></>)}
    {kind === "rules" && (<><path d="M24 4L40 10V22C40 33 33 40 24 44C15 40 8 33 8 22V10Z" /><path d="M17 24L22 29L31 19" /></>)}
    {kind === "auth0" && (<><circle cx={15} cy={24} r={8} /><path d="M23 24H42M36 24V31M42 24V30" /></>)}
    {kind === "nessie" && (<><path d="M6 17L24 7L42 17Z" /><path d="M12 21V36M20 21V36M28 21V36M36 21V36M6 41H42" /></>)}
    {kind === "tiger" && (<><ellipse cx={24} cy={11} rx={14} ry={5} /><path d="M10 11V37C10 40 16 42 24 42C32 42 38 40 38 37V11" /><path d="M10 24C10 27 16 29 24 29C32 29 38 27 38 24" /></>)}
  </svg>
);

const Node = ({ k, active, dim, delay }: { k: NodeKey; active: number; dim: number; delay: number }) => {
  const n = NODES[k];
  const p = usePop(delay, 12);
  const size = k === "tiger" ? 100 : BOX;
  const s = p * (1 + 0.16 * active);
  const side = k === "tiger"; // ponytail: Tiger hangs below the rules node, so its label sits to the right
  const o = Math.max(dim, 0.35 + 0.65 * active); // dim the content, keep backgrounds solid so lines stay hidden behind
  return (
    <div style={{ position: "absolute", left: n.x - size / 2, top: n.y - size / 2, width: size, opacity: Math.min(1, p * 2) }}>
      <div style={{
        width: size, height: size, borderRadius: size * 0.24, display: "grid", placeItems: "center", transform: `scale(${s})`,
        background: active > 0.5 ? C.purple : C.nightPanel, border: `3px solid ${active > 0.5 ? "#D79BFF" : C.line}`,
        boxShadow: `0 0 ${70 * active}px ${C.purple}`,
      }}>
        <div style={{ opacity: o, display: "grid" }}><Icon kind={k} size={size * 0.55} /></div>
      </div>
      <div style={{
        position: "absolute", whiteSpace: "nowrap", fontFamily: FONT, fontWeight: 800, fontSize: 30, color: `rgba(255,255,255,${o})`,
        background: C.night, padding: "2px 10px", borderRadius: 8,
        ...(side ? { left: size + 18, top: size / 2 - 22 } : { left: size / 2, top: size + 14, transform: "translateX(-50%)" }),
      }}>{n.label}</div>
    </div>
  );
};

const Packet = ({ frame }: { frame: number }) => {
  const k = SEG_KEYS.find((s) => frame >= PIPE[s].from && frame < PIPE[s].from + PIPE[s].dur);
  if (!k) return null;
  const seg = SEGS[k];
  if (!seg.node || !seg.from) return null;
  const to = NODES[seg.node];
  const t = (frame - PIPE[k].from - 8) % 90; // one trip every 3 s
  if (t < 0 || t > 48) return null;
  const e = interpolate(t, [0, 40], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const x = seg.from.x + (to.x - seg.from.x) * e;
  const y = seg.from.y + (to.y - seg.from.y) * e;
  const o = interpolate(t, [0, 6, 38, 48], [0, 1, 1, 0], clamp);
  return (
    <div style={{
      position: "absolute", left: x - 38, top: y - 26, width: 76, height: 52, borderRadius: 12, background: C.yellow, opacity: o,
      transform: `scale(${1 - 0.4 * interpolate(t, [36, 48], [0, 1], clamp)})`, boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      display: "grid", placeItems: "center", fontFamily: FONT, fontWeight: 800, fontSize: seg.packet ? 24 : 32, color: C.purpleInk,
    }}>{seg.packet ?? "$"}</div>
  );
};

const Lines = ({ frame, hot }: { frame: number; hot?: [NodeKey, NodeKey] }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
    {LINES.map(([a, b], i) => {
      const A = NODES[a];
      const B = NODES[b];
      const p = interpolate(frame, [10 + i * 10, 40 + i * 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
      const isHot = hot && hot[0] === a && hot[1] === b;
      return (
        <line key={i} x1={A.x} y1={A.y} x2={A.x + (B.x - A.x) * p} y2={A.y + (B.y - A.y) * p}
          stroke={isHot ? "#C77DFF" : "#5E4C82"} strokeWidth={isHot ? 6 : 5} strokeLinecap="round"
          strokeDasharray="1 16" strokeDashoffset={-frame * 1.2} />
      );
    })}
  </svg>
);

const Facts = ({ k }: { k: SegKey }) => {
  const seg = SEGS[k];
  const { dur } = PIPE[k];
  const t = usePop(0, 14);
  const step = Math.min(42, (dur - 80) / (seg.facts.length + (seg.stat ? 1 : 0)));
  return (
    <div style={{
      position: "absolute", left: 60, top: 530, width: 1340, height: 500, background: C.nightPanel, borderRadius: 28,
      border: `2px solid ${C.line}`, padding: "34px 48px", boxSizing: "border-box", fontFamily: FONT,
    }}>
      <div style={{ fontSize: 72, fontWeight: 800, color: C.white, letterSpacing: -1, marginBottom: 18, opacity: t, transform: `translateX(${(1 - t) * -30}px)` }}>
        {seg.title}
        <div style={{ width: 120 * t, height: 8, borderRadius: 4, background: C.yellow, marginTop: 6 }} />
      </div>
      {seg.facts.map((f, i) => <Fact key={f} text={f} delay={18 + i * step} />)}
      {seg.stat && <Stat text={seg.stat} delay={18 + seg.facts.length * step} />}
    </div>
  );
};

const Fact = ({ text, delay }: { text: string; delay: number }) => {
  const p = usePop(delay, 16);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 38, color: C.white, lineHeight: 1.2, marginTop: 14, opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      <div style={{ width: 16, height: 16, borderRadius: 8, background: C.purple, boxShadow: `0 0 0 5px ${C.purple}44`, flexShrink: 0 }} />
      {text}
    </div>
  );
};

const Stat = ({ text, delay }: { text: string; delay: number }) => {
  const p = usePop(delay, 10);
  return (
    <div style={{
      position: "absolute", right: 40, top: 40, transform: `rotate(-3deg) scale(${p})`, opacity: Math.min(1, p * 2),
      background: C.night, border: `3px solid ${C.yellow}`, color: C.yellow, fontWeight: 800, fontSize: 40, padding: "12px 22px", borderRadius: 14,
    }}>{text}</div>
  );
};

const AppTag = ({ app }: { app: "rosa" | "family" }) => {
  const p = usePop(0, 14);
  const rosa = app === "rosa";
  return (
    <div style={{
      position: "absolute", left: 1670, top: 205, transform: `translateX(-50%) scale(${p})`, whiteSpace: "nowrap",
      background: rosa ? C.yellow : C.purple, color: rosa ? C.purpleInk : C.white, fontFamily: FONT, fontWeight: 800, fontSize: 32,
      padding: "8px 24px", borderRadius: 99,
    }}>{rosa ? "Rosa's app" : "Family app"}</div>
  );
};

const PhoneIn = () => {
  const p = usePop(0, 14);
  return <div style={{ position: "absolute", inset: 0, opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}><PhoneScreen /></div>;
};

const PhoneScreen = () => {
  const frame = useCurrentFrame() + PIPE.phone.from;
  const k = SEG_KEYS.find((s) => frame < PIPE[s].from + PIPE[s].dur) ?? "eyes";
  return <Phone x={1500} y={275} width={340}><SimSlot label={SEGS[k].sim} /></Phone>;
};

export const Pipeline = () => {
  const frame = useCurrentFrame();
  const act = (n: NodeKey) => SEG_KEYS.reduce((m, k) => (SEGS[k].node === n ? Math.max(m, on(frame, k)) : m), 0);
  const dim = interpolate(frame, [PIPE.phone.from, PIPE.phone.from + 12], [1, 0.35], clamp);
  const cur = SEG_KEYS.find((s) => frame >= PIPE[s].from && frame < PIPE[s].from + PIPE[s].dur);
  const hot: Record<SegKey, [NodeKey, NodeKey] | undefined> = {
    phone: undefined, tiger: ["rules", "tiger"], auth0: ["rules", "auth0"], nessie: ["auth0", "nessie"], eyes: undefined,
  };
  const tag = interpolate(frame, [20, 40], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 30% 20%, #241238 0%, ${C.night} 70%)`, fontFamily: FONT }}>
      <Lines frame={frame} hot={cur ? hot[cur] : undefined} />
      {/* Feed from the left edge into Rosa's iPhone */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={0} y1={ROW} x2={NODES.phone.x * interpolate(frame, [0, 20], [0, 1], clamp)} y2={ROW}
          stroke={cur === "phone" ? "#C77DFF" : "#5E4C82"} strokeWidth={5} strokeLinecap="round" strokeDasharray="1 16" strokeDashoffset={-frame * 1.2} />
      </svg>
      {(Object.keys(NODES) as NodeKey[]).map((k, i) => (
        <Node key={k} k={k} active={act(k)} dim={dim} delay={4 + i * 8} />
      ))}
      <div style={{
        position: "absolute", left: NODES.rules.x, top: 290, transform: "translateX(-50%)", opacity: tag, whiteSpace: "nowrap",
        background: C.nightPanel, border: `2px solid ${C.yellow}`, color: C.yellow, fontWeight: 700, fontSize: 24, padding: "4px 14px", borderRadius: 99,
      }}>AI suggests. Code decides money.</div>
      <Packet frame={frame} />

      <Sequence durationInFrames={PIPE.intro.dur + 10} layout="none">
        <Sticker text="HOW IT WORKS" x={520} y={660} delay={12} tilt={-6} size={110} />
      </Sequence>
      {SEG_KEYS.map((k) => (
        <Sequence key={k} from={PIPE[k].from} durationInFrames={PIPE[k].dur} layout="none">
          <Facts k={k} />
          <AppTag app={SEGS[k].app} />
        </Sequence>
      ))}
      <Sequence from={PIPE.phone.from} durationInFrames={PIPE_DUR - PIPE.phone.from} layout="none">
        <PhoneIn />
      </Sequence>
    </AbsoluteFill>
  );
};
