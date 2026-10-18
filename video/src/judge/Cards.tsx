import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, TAGLINE } from "../theme";
import * as logos from "../logos";
import type { SponsorId } from "../logos";
import { usePop } from "../ui";

// Four full-frame cards of the 45 s judge cut. Each animates from its own local frame 0.
// ponytail: inline styles (Remotion idiom), fixed coordinates for a 1920x1080 frame.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type LogoMap = Partial<Record<SponsorId, string | null>>;
const isLogoMap = (v: unknown): v is LogoMap => typeof v === "object" && v !== null;
// ponytail: LOGO_ON_DARK may not exist yet; read it by name so this typechecks either way.
const onDarkRaw: unknown = "LOGO_ON_DARK" in logos ? (logos as Record<string, unknown>).LOGO_ON_DARK : null;
const ON_DARK: LogoMap = isLogoMap(onDarkRaw) ? onDarkRaw : {};
const darkLogo = (id: SponsorId): string | null => ON_DARK[id] ?? logos.LOGO[id] ?? null;

const NAME: Record<SponsorId, string> = {
  nessie: "Capital One Nessie",
  auth0: "Auth0",
  tiger: "Tiger Data",
  eyes: "Easy On The Eyes",
  godaddy: "GoDaddy",
};

/** Real logo when the file exists, else the sponsor name in a rounded chip. */
const SponsorMark = ({ id, w, h }: { id: SponsorId; w: number; h: number }) => {
  const src = darkLogo(id);
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? (
        <Img src={staticFile(src)} style={{ maxWidth: w, maxHeight: h, objectFit: "contain" }} />
      ) : (
        <div style={{
          background: C.nightPanel, border: `3px solid ${C.purple}`, borderRadius: 999, padding: "12px 24px",
          color: C.white, fontFamily: FONT, fontWeight: 800, fontSize: 28, whiteSpace: "nowrap",
        }}>{NAME[id]}</div>
      )}
    </div>
  );
};

const Icon = ({ size }: { size: number }) => (
  <Img src={staticFile("icon.png")} style={{ width: size, height: size, borderRadius: size * 0.23, boxShadow: `0 0 60px ${C.purple}66` }} />
);

// 1. Hook: the loss, then why warnings fail.
export const HookCard = () => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [4, 40], [0, 7.7], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sub = usePop(18, 16);
  const line = usePop(50, 11);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: FONT, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ color: C.yellow, fontWeight: 800, fontSize: 240, lineHeight: 1, letterSpacing: -4, fontVariantNumeric: "tabular-nums" }}>
        ${v.toFixed(1)} billion
      </div>
      <div style={{ color: C.white, fontWeight: 700, fontSize: 64, marginTop: 28, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        lost to fraud by people 60+ in 2025
      </div>
      <div style={{ color: "#9C8BB3", fontSize: 28, marginTop: 18, opacity: sub }}>FBI IC3 2025 Annual Report</div>
      <div style={{
        marginTop: 80, background: C.purple, color: C.white, fontWeight: 800, fontSize: 72, padding: "18px 40px", borderRadius: 18,
        opacity: Math.min(1, line * 2), transform: `scale(${0.8 + line * 0.2}) rotate(-1.5deg)`,
      }}>
        Scammers talk them past every warning.
      </div>
    </AbsoluteFill>
  );
};

// 2. Promise: what checkwith.us does, in three short chips.
const CHIPS = ["Routine bills pay.", "Unusual waits for family.", "Scams stop."];

export const PromiseCard = () => {
  const head = usePop(0, 14);
  const line = usePop(8, 14);
  return (
    <AbsoluteFill style={{ background: C.paper, fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: head, transform: `scale(${0.9 + head * 0.1})` }}>
        <Icon size={140} />
        <div style={{ color: C.purpleInk, fontWeight: 800, fontSize: 110, letterSpacing: -2 }}>checkwith.us</div>
      </div>
      <div style={{ color: C.ink, fontWeight: 700, fontSize: 76, marginTop: 44, opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>
        {TAGLINE}
      </div>
      <div style={{ display: "flex", gap: 28, marginTop: 80 }}>
        {CHIPS.map((t, i) => <PromiseChip key={t} text={t} delay={24 + i * 12} strong={i === CHIPS.length - 1} />)}
      </div>
    </AbsoluteFill>
  );
};

const PromiseChip = ({ text, delay, strong }: { text: string; delay: number; strong: boolean }) => {
  const p = usePop(delay, 10);
  return (
    <div style={{
      background: strong ? C.purple : C.white, color: strong ? C.white : C.purpleInk, border: `4px solid ${C.purple}`,
      borderRadius: 999, padding: "16px 36px", fontWeight: 800, fontSize: 48, whiteSpace: "nowrap",
      opacity: Math.min(1, p * 2), transform: `scale(${p})`, boxShadow: "0 8px 0 rgba(42,18,64,0.12)",
    }}>{text}</div>
  );
};

// 3. "Not just ___": one row per sponsor; the strike-through is the reveal.
const ROWS: { id: SponsorId; not: string; does: string }[] = [
  { id: "nessie", not: "Not just balances", does: "Real purchases, bills, ATM cash and a vault\u00a0transfer" },
  { id: "auth0", not: "Not just login", does: "Decides who can say yes: roles, 2\u00a0approvers,\u00a0Face\u00a0ID" },
  { id: "tiger", not: "Not just storage", does: "Spots unusual spending in 1 ms, while the\u00a0payment\u00a0waits" },
  { id: "eyes", not: "Not just pretty", does: "Nothing new to learn: one action per\u00a0screen" },
  { id: "godaddy", not: "Not just a URL", does: "checkwith.us: the name says what it\u00a0does" },
];
const ROW_START = 24;
const ROW_GAP = 45;
// ponytail: \u00a0 keeps the last words of a long line together so rows wrap at a natural pause.

const Row = ({ id, not, does, start }: { id: SponsorId; not: string; does: string; start: number }) => {
  const frame = useCurrentFrame();
  const enter = usePop(start, 14);
  const strike = interpolate(frame, [start + 10, start + 20], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const reveal = usePop(start + 20, 13);
  const hot = interpolate(frame, [start, start + 8, start + ROW_GAP, start + ROW_GAP + 10], [0, 1, 1, 0], clamp);
  return (
    <div style={{
      display: "flex", alignItems: "center", height: 150, padding: "0 32px", borderRadius: 24,
      background: `rgba(166,47,234,${0.16 * hot})`, opacity: enter, transform: `translateX(${(1 - enter) * -60}px)`,
    }}>
      <SponsorMark id={id} w={290} h={72} />
      <div style={{ width: 380, marginLeft: 44, flexShrink: 0 }}>
        <span style={{ position: "relative", display: "inline-block", color: "#C4B8D6", fontWeight: 700, fontSize: 42, whiteSpace: "nowrap" }}>
          {not}
          <span style={{
            position: "absolute", left: -6, right: -6, top: "54%", height: 5, marginTop: -2, borderRadius: 3,
            background: C.yellow, transform: `scaleX(${strike})`, transformOrigin: "left center",
          }} />
        </span>
      </div>
      <div style={{
        flex: 1, color: C.white, fontWeight: 800, fontSize: 48, lineHeight: 1.12,
        opacity: Math.min(1, reveal * 1.5), transform: `translateX(${(1 - reveal) * 40}px)`,
      }}>{does}</div>
    </div>
  );
};

export const TableCard = () => {
  const title = usePop(0, 14);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: FONT, padding: "56px 80px 0" }}>
      <div style={{ color: C.white, fontWeight: 800, fontSize: 80, letterSpacing: -1, opacity: title, transform: `translateY(${(1 - title) * -20}px)` }}>
        Every sponsor does <span style={{ color: C.yellow }}>real work</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 40 }}>
        {ROWS.map((r, i) => <Row key={r.id} {...r} start={ROW_START + i * ROW_GAP} />)}
      </div>
    </AbsoluteFill>
  );
};

// 4. End: brand, the promise, and the logo wall with one word each.
const WALL: { id: SponsorId; word: string }[] = [
  { id: "nessie", word: "moves the money" },
  { id: "auth0", word: "who can say yes" },
  { id: "tiger", word: "spots the unusual" },
  { id: "eyes", word: "nothing to learn" },
  { id: "godaddy", word: "the name" },
];

const WallItem = ({ id, word, delay }: { id: SponsorId; word: string; delay: number }) => {
  const p = usePop(delay, 13);
  return (
    <div style={{ width: 320, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <SponsorMark id={id} w={300} h={76} />
      <div style={{ color: "#D9C9EC", fontSize: 32, fontWeight: 700 }}>{word}</div>
    </div>
  );
};

export const EndCard = () => {
  const head = usePop(0, 14);
  const line = usePop(10, 16);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40, opacity: head, transform: `scale(${0.9 + head * 0.1})` }}>
        <Icon size={150} />
        <div style={{ color: C.white, fontWeight: 800, fontSize: 140, letterSpacing: -3 }}>checkwith.us</div>
      </div>
      <div style={{ color: C.yellow, fontWeight: 800, fontSize: 64, marginTop: 36, opacity: line }}>{TAGLINE}</div>
      <div style={{ display: "flex", gap: 24, marginTop: 110 }}>
        {WALL.map((w, i) => <WallItem key={w.id} {...w} delay={24 + i * 6} />)}
      </div>
    </AbsoluteFill>
  );
};
