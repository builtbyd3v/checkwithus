import { createContext, useContext, type ReactNode } from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, HALF, H } from "./theme";
import { SHOTS } from "./timeline";

// ponytail: Remotion animates per frame, so styles are inline objects, not Tailwind classes.

/** Pop-in progress 0..1 that starts at `delay` frames. */
export const usePop = (delay = 0, damping = 12) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6 } });
};

/** Left half: black until the team's footage drops in. A dim label says which clip goes here. */
export const LeftPlaceholder = () => (
  <AbsoluteFill style={{ width: HALF, background: "#000" }}>
    {SHOTS.map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.dur} layout="none">
        <div style={{ position: "absolute", left: 40, top: 40, right: 40, color: "#5B5466", fontFamily: FONT, fontSize: 24, lineHeight: 1.35 }}>
          <b style={{ color: "#8A8296" }}>{s.id}</b> {s.text}
        </div>
      </Sequence>
    ))}
  </AbsoluteFill>
);

/** Split frame: real footage left, animation right. */
export const Split = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <LeftPlaceholder />
    <AbsoluteFill style={{ left: HALF, width: HALF, height: H, overflow: "hidden" }}>{children}</AbsoluteFill>
    <div style={{ position: "absolute", left: HALF - 3, top: 0, width: 6, height: H, background: C.purple }} />
  </AbsoluteFill>
);

/** Tilted sticker label, like "PAUSED · cash, then a gift card". */
export const Sticker = ({ text, x, y, delay = 0, tilt = -6, bg = C.purple, color = C.white, size = 40 }: {
  text: string; x: number; y: number; delay?: number; tilt?: number; bg?: string; color?: string; size?: number;
}) => {
  const p = usePop(delay, 10);
  return (
    <div style={{
      position: "absolute", left: x, top: y, transform: `rotate(${tilt}deg) scale(${p})`, opacity: Math.min(1, p * 2),
      background: bg, color, fontFamily: FONT, fontWeight: 800, fontSize: size, padding: "10px 22px", borderRadius: 10,
      boxShadow: "0 8px 0 rgba(0,0,0,0.18)", whiteSpace: "nowrap", letterSpacing: 0.5,
    }}>{text}</div>
  );
};

/** The 45 s cut shows sponsors in its top bar instead, so it turns scene badges off. */
export const BadgesOn = createContext(true);

/** Sponsor badge: rounded chip with a mark, the sponsor name and what it is doing right now. */
export const Badge = ({ sponsor, doing, x, y, delay = 0, dark = false }: {
  sponsor: string; doing: string; x: number; y: number; delay?: number; dark?: boolean;
}) => {
  const p = usePop(delay, 14);
  if (!useContext(BadgesOn)) return null;
  return (
    <div style={{
      position: "absolute", left: x, top: y, transform: `translateY(${(1 - p) * 30}px)`, opacity: p,
      display: "flex", alignItems: "center", gap: 14, background: dark ? C.nightPanel : C.white,
      border: `3px solid ${C.purple}`, borderRadius: 18, padding: "12px 20px 12px 12px", fontFamily: FONT,
      boxShadow: "0 10px 30px rgba(42,18,64,0.18)",
    }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: C.purple, display: "grid", placeItems: "center", color: C.white, fontWeight: 800, fontSize: 24 }}>
        {sponsor[0]}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 24, color: dark ? C.white : C.purpleInk }}>{sponsor}</div>
        <div style={{ fontSize: 19, color: dark ? "#C9B8DD" : "#5A4B6B" }}>{doing}</div>
      </div>
    </div>
  );
};

/** Bottom caption across the full frame. The judge video has no voice, so captions carry the story. */
export const Caption = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ background: "rgba(22,12,36,0.88)", color: C.white, fontFamily: FONT, fontWeight: 700, fontSize: 44, padding: "14px 30px", borderRadius: 14, maxWidth: 1600, textAlign: "center" }}>
        {text}
      </div>
    </div>
  );
};

/** iPhone-shaped frame. Children are the screen (width x 2.16 tall). */
export const Phone = ({ x, y, width = 300, children, tilt = 0 }: {
  x: number; y: number; width?: number; children?: ReactNode; tilt?: number;
}) => {
  const h = width * 2.16;
  const b = width * 0.045;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, height: h, transform: `rotate(${tilt}deg)`, background: "#111", borderRadius: width * 0.16, padding: b, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: width * 0.13, overflow: "hidden", background: C.paper }}>
        {children}
        <div style={{ position: "absolute", top: width * 0.03, left: "50%", width: width * 0.3, height: width * 0.085, marginLeft: -width * 0.15, background: "#111", borderRadius: 99 }} />
      </div>
    </div>
  );
};

/** Placeholder for a real iOS Simulator recording, dropped in later. */
export const SimSlot = ({ label }: { label: string }) => (
  <AbsoluteFill style={{ background: "repeating-linear-gradient(45deg,#2B1D40 0 18px,#24163A 18px 36px)", display: "grid", placeItems: "center", padding: 24 }}>
    <div style={{ color: "#C9B8DD", fontFamily: FONT, fontSize: 22, textAlign: "center", lineHeight: 1.35 }}>
      <b style={{ color: C.yellow }}>SIM CLIP</b>
      <br />
      {label}
    </div>
  </AbsoluteFill>
);

/** Logo end card, full frame. */
export const Logo = ({ line }: { line: string }) => {
  const p = usePop(0, 14);
  const q = usePop(12, 16);
  return (
    <AbsoluteFill style={{ background: C.night, display: "grid", placeItems: "center", fontFamily: FONT }}>
      <div style={{ textAlign: "center", transform: `scale(${0.9 + p * 0.1})`, opacity: p }}>
        <Img src={staticFile("icon.png")} style={{ width: 160, height: 160, display: "block", margin: "0 auto 28px", borderRadius: 38, boxShadow: `0 0 80px ${C.purple}88` }} />
        <div style={{ color: C.white, fontWeight: 800, fontSize: 120, letterSpacing: -2 }}>checkwith.us</div>
        <div style={{ color: "#D9C9EC", fontSize: 46, marginTop: 10, opacity: q }}>{line}</div>
      </div>
    </AbsoluteFill>
  );
};
