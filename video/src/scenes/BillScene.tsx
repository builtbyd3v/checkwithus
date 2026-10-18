import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { RosaFace } from "../Rosa";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { BILL } from "../timeline";
import { Phone, Sticker, usePop } from "../ui";
import { Bg, INK, Room, ScreenCard } from "./kit";
import { LivingRoom } from "./TextScene";

// ponytail: the living room is shifted left so the couch clears the zoomed phone on the right.
const SHIFT = -260;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Phone screen before the payment: what it is, how much, a big Pay button that presses at `tap`. */
export const PayScreen = ({ f, tap, label, amount, art }: { f: number; tap: number; label: string; amount: string; art: ReactNode }) => {
  const t = interpolate(f, [tap, tap + 12], [0, 1], clamp);
  const pressing = t > 0 && t < 1;
  const push = interpolate(f, [tap, tap + 3, tap + 9], [1, 0.94, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: C.ink, padding: "90px 26px 0", boxSizing: "border-box" }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#5A4B6B" }}>{label}</div>
      <div style={{ fontSize: 96, fontWeight: 800, color: C.purpleInk, marginTop: 4 }}>{amount}</div>
      <div style={{ height: 150, borderRadius: 18, marginTop: 20, overflow: "hidden", position: "relative" }}>{art}</div>
      <div style={{
        position: "absolute", left: 22, right: 22, bottom: 60, height: 110, borderRadius: 24, background: pressing ? C.purpleDeep : C.purple,
        color: C.white, fontWeight: 800, fontSize: 46, display: "grid", placeItems: "center", overflow: "hidden", transform: `scale(${push})`,
      }}>
        Pay
        {pressing && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 99, background: "rgba(255,255,255,0.45)", transform: `scale(${1 + t * 8})`, opacity: 1 - t }} />
        )}
      </div>
    </div>
  );
};

/** Round check mark for "it went through" screens. */
export const CheckIcon = ({ ring, mark }: { ring: string; mark: string }) => (
  <div style={{ width: 64, height: 64, borderRadius: 99, background: ring, display: "grid", placeItems: "center" }}>
    <svg width={38} height={38} viewBox="0 0 38 38">
      <path d="M7,20 L15,28 L31,10" stroke={mark} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/** Rays that burst out from (x, y) at frame `at`. */
export const CheckBurst = ({ x, y, at, r = 56 }: { x: number; y: number; at: number; r?: number }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 18], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const o = 1 - p;
  return (
    <svg width={960} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {/* ponytail: rays only above and beside the icon, so they never cross the card text below it */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI * (0.9 + (i / 6) * 1.2);
        const r0 = r * 0.6 + p * r * 0.7, r1 = r0 + 24 * o + 6;
        return (
          <path key={i} d={`M${x + Math.cos(a) * r0},${y + Math.sin(a) * r0} L${x + Math.cos(a) * r1},${y + Math.sin(a) * r1}`}
            stroke={i % 2 ? C.yellow : C.green} strokeWidth={9} strokeLinecap="round" opacity={o} />
        );
      })}
    </svg>
  );
};

/** Where the screen card's icon sits, in scene pixels, for a Phone at (598, 124) width 330. */
export const ICON_AT = { x: 598 + 15 + 16 + 22 + 32, y: 124 + 15 + 90 + 34 + 32 };

const WaterArt = () => {
  const f = useCurrentFrame();
  return (
    <svg width="100%" height="100%" viewBox="0 0 278 150" preserveAspectRatio="xMidYMid slice">
      <rect width={278} height={150} fill="#4FA8E8" />
      <path d={`M0,${110 + Math.sin(f / 8) * 4} Q70,${96 + Math.sin(f / 8 + 1) * 4} 139,110 T278,108 V150 H0 Z`} fill="#7CC4F4" />
      <path d="M139,24 C139,24 108,62 108,82 a31,31 0 0 0 62,0 C170,62 139,24 139,24 Z" fill={C.white} />
      <path d="M126,84 a14,14 0 0 0 12,14" stroke="#4FA8E8" strokeWidth={5} fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const BillScene = () => {
  const f = useCurrentFrame();
  const up = usePop(8, 14);
  const paidPop = usePop(BILL.paid, 9);
  const stamp = usePop(BILL.paid + 4, 10);
  const paid = f >= BILL.paid;
  const face: RosaFace = f >= BILL.paid + 14 ? "happy" : paid ? "smile" : "calm";
  // Rosa glances at the paper bill first, then at the phone in her hands.
  const look = f < 16 ? -1 : 0;
  const screenScale = paid ? 0.9 + paidPop * 0.1 : 1;
  return (
    <AbsoluteFill>
      <Bg>
        <Room />
        <g transform={`translate(${SHIFT},0)`}>
          <LivingRoom f={f} />
        </g>
        {/* coffee table with tea and the paper bill propped up */}
        <rect x={0} y={792} width={300} height={18} rx={6} fill="#CBB2DF" stroke={INK} strokeWidth={4} />
        <rect x={20} y={808} width={12} height={62} fill={INK} /><rect x={268} y={808} width={12} height={62} fill={INK} />
        <path d="M232,760 h40 v24 a10,10 0 0 1 -10,10 h-20 a10,10 0 0 1 -10,-10 Z" fill={C.white} stroke={INK} strokeWidth={4} />
        <path d="M272,766 a9,9 0 0 1 0,16" stroke={INK} strokeWidth={4} fill="none" />
        <g transform="translate(130,720) rotate(-6)">
          <rect x={-120} y={-74} width={240} height={148} rx={6} fill={C.white} stroke={INK} strokeWidth={4} />
          <rect x={-120} y={-74} width={240} height={30} rx={6} fill="#4FA8E8" stroke={INK} strokeWidth={4} />
          <text x={-104} y={-6} fontSize={22} fontWeight={800} fill={C.ink} fontFamily={FONT}>City Water · <tspan fontSize={34} fill={C.purpleInk}>$350</tspan></text>
          <path d="M-104,22 H60 M-104,42 H30 M-104,60 H50" stroke="#D9CFE3" strokeWidth={7} strokeLinecap="round" />
          <path d="M92,24 C92,24 78,42 78,51 a14,14 0 0 0 28,0 C106,42 92,24 92,24 Z" fill="#4FA8E8" />
          {/* green check stamp once it pays */}
          {paid && (
            <g transform={`translate(88,40) scale(${stamp}) rotate(-10)`}>
              <circle r={26} fill={C.green} stroke={INK} strokeWidth={3} />
              <path d="M-12,1 L-4,10 L13,-9" stroke={C.white} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </g>
      </Bg>
      <Rosa x={590 + SHIFT} y={738} scale={1.32} sit arms="hold" face={face} look={look} />
      {/* Rosa's phone, zoomed so the screen is readable */}
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - up) * 1100}px)` }}>
        <Phone x={598} y={124} width={330}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${screenScale})` }}>
            {!paid ? (
              <PayScreen f={f} tap={BILL.tap} label="Water bill" amount="$350" art={<WaterArt />} />
            ) : (
              <ScreenCard bg="#D3EFDE" color="#1D5537" icon={<CheckIcon ring={C.green} mark={C.white} />} title="Sent." body="It did not need an OK." />
            )}
          </div>
        </Phone>
      </div>
      <CheckBurst x={ICON_AT.x} y={ICON_AT.y} at={BILL.paid} />
      <Sticker text="AUTO-PAID · inside the allowance" x={16} y={150} delay={BILL.paid + 6} tilt={-6} size={32} />
    </AbsoluteFill>
  );
};
