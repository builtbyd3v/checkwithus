import type { CSSProperties, ReactNode } from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT } from "../theme";
import { usePop } from "../ui";

// Shared bits for the right-half scenes (960x1080). Floor line at y=780.
export const INK = C.purpleInk;
export const FLOOR_Y = 780;

/** Full-size SVG layer for backgrounds and props. */
export const Bg = ({ children }: { children: ReactNode }) => (
  <svg width={960} height={1080} viewBox="0 0 960 1080" style={{ position: "absolute", left: 0, top: 0 }}>{children}</svg>
);

/** Indoor wall + floor + baseboard. Use inside <Bg>. */
export const Room = () => (
  <>
    <rect width={960} height={FLOOR_Y} fill={C.wall} />
    <rect y={FLOOR_Y} width={960} height={300} fill={C.floor} />
    <rect y={FLOOR_Y - 14} width={960} height={14} fill="#E2D2EE" />
    <path d={`M0,${FLOOR_Y} H960`} stroke="#CDB9DE" strokeWidth={4} />
  </>
);

/** Speech bubble with a tail, pops in at `delay`. tailX is from the left edge; tail points down. */
export const Bubble = ({ x, y, w, delay = 0, tailX = 60, children, style }: {
  x: number; y: number; w: number; delay?: number; tailX?: number; children: ReactNode; style?: CSSProperties;
}) => {
  const p = usePop(delay, 11);
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: w, transform: `scale(${p})`, transformOrigin: `${tailX}px 110%`,
      background: C.white, border: `4px solid ${INK}`, borderRadius: 26, padding: "18px 24px", fontFamily: FONT,
      color: C.ink, boxShadow: "0 10px 0 rgba(42,18,64,0.12)", boxSizing: "border-box", ...style,
    }}>
      {children}
      <div style={{
        position: "absolute", left: tailX - 14, bottom: -17, width: 28, height: 28, background: C.white,
        borderRight: `4px solid ${INK}`, borderBottom: `4px solid ${INK}`, transform: "rotate(45deg)",
      }} />
    </div>
  );
};

/** Buzz marks around a point, visible while `on`. */
export const Buzz = ({ x, y, r = 40, on }: { x: number; y: number; r?: number; on: boolean }) => {
  const f = useCurrentFrame();
  if (!on) return null;
  const k = 1 + (f % 6) / 12;
  return (
    <g stroke={C.purple} strokeWidth={6} strokeLinecap="round" fill="none">
      <path d={`M${x - r * k},${y - 18} q-10,18 0,36`} />
      <path d={`M${x - r * k - 16},${y - 28} q-14,28 0,56`} />
      <path d={`M${x + r * k},${y - 18} q10,18 0,36`} />
      <path d={`M${x + r * k + 16},${y - 28} q14,28 0,56`} />
    </g>
  );
};

/** Big readable phone screen text block. */
export const ScreenCard = ({ bg, color, title, body, icon, inset = 16, pad = 22, bodySize = 30 }: {
  bg: string; color: string; title: string; body: string; icon?: ReactNode; inset?: number; pad?: number; bodySize?: number;
}) => (
  <div style={{
    position: "absolute", left: inset, right: inset, top: 90, bottom: 40, background: bg, borderRadius: 26, padding: `34px ${pad}px`,
    fontFamily: FONT, color, display: "flex", flexDirection: "column", gap: 22, boxSizing: "border-box",
  }}>
    {icon}
    <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.12 }}>{title}</div>
    <div style={{ fontSize: bodySize, fontWeight: 600, lineHeight: 1.25 }}>{body}</div>
  </div>
);

/** A real screenshot of the older adult app (public/app/<name>.png), with an optional finger tap on its big button. */
export const AppShot = ({ name, f, tapAt }: { name: string; f: number; tapAt?: number }) => {
  const t = tapAt === undefined ? 0 : interpolate(f, [tapAt, tapAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Img src={staticFile(`app/${name}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {t > 0 && t < 1 && (
        <div style={{
          position: "absolute", left: "50%", top: "86%", width: 90, height: 90, marginLeft: -45, marginTop: -45, borderRadius: 99,
          background: "rgba(255,255,255,0.55)", border: "3px solid rgba(42,18,64,0.35)", transform: `scale(${0.4 + t * 0.9})`, opacity: 1 - t,
        }} />
      )}
    </div>
  );
};
