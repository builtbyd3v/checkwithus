import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { RosaFace } from "../Rosa";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { GROCERY } from "../timeline";
import { Phone, Sticker, usePop } from "../ui";
import { CheckBurst, CheckIcon, ICON_AT, PayScreen } from "./BillScene";
import { AppShot, Bg, INK, Room, ScreenCard } from "./kit";

// Frames 60-89 ping-pong while the family decides: only looping motion (bob, "?" sway) lives there.
const { tap: TAP, pause: PAUSE, approve: APPROVE } = GROCERY;

// ponytail: copy of HoldScene's PauseIcon, which is not exported.
const PauseIcon = () => (
  <div style={{ display: "flex", gap: 12 }}>
    <div style={{ width: 18, height: 56, borderRadius: 6, background: C.ink }} />
    <div style={{ width: 18, height: 56, borderRadius: 6, background: C.ink }} />
  </div>
);

const PRODUCTS = ["#F06292", "#4FC3F7", "#81C784", "#FFB74D", "#BA68C8", "#E57373", "#4DB6AC", "#FFD54F", "#7986CB"];

/** Back wall shelves full of boxes, jars and cans. */
const Shelves = () => (
  <>
    {[0, 1, 2].map((r) => {
      const y = 232 + r * 120;
      return (
        <g key={r}>
          {Array.from({ length: 13 }, (_, i) => {
            const x = 14 + i * 72;
            const c = PRODUCTS[(i * 4 + r * 3) % PRODUCTS.length];
            const kind = (i + r) % 3;
            return kind === 0 ? (
              <rect key={i} x={x} y={y + 22} width={54} height={74} rx={5} fill={c} stroke={INK} strokeWidth={3} />
            ) : kind === 1 ? (
              <g key={i}>
                <rect x={x + 4} y={y + 46} width={46} height={50} rx={8} fill={c} stroke={INK} strokeWidth={3} />
                <rect x={x + 4} y={y + 60} width={46} height={16} fill="rgba(255,255,255,0.7)" />
              </g>
            ) : (
              <g key={i}>
                <rect x={x + 12} y={y + 30} width={30} height={66} rx={10} fill={c} stroke={INK} strokeWidth={3} />
                <rect x={x + 18} y={y + 18} width={18} height={14} rx={3} fill={INK} />
              </g>
            );
          })}
          <rect x={-10} y={y + 96} width={980} height={16} fill="#CBB2DF" stroke={INK} strokeWidth={4} />
        </g>
      );
    })}
  </>
);

/** Shopping cart piled high with groceries. Basket top left at (x, y). */
const Cart = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x},${y})`}>
    {/* groceries piled above the basket rim */}
    <rect x={14} y={-104} width={52} height={118} rx={5} fill="#FFB74D" stroke={INK} strokeWidth={4} />
    <circle cx={40} cy={-66} r={15} fill={C.yellow} stroke={INK} strokeWidth={3} />
    <ellipse cx={128} cy={-58} rx={70} ry={17} transform="rotate(-28 128 -58)" fill="#E9B86A" stroke={INK} strokeWidth={4} />
    <path d="M96,-50 l10,-12 M120,-64 l10,-12 M144,-78 l10,-12" stroke="#B8823A" strokeWidth={4} strokeLinecap="round" />
    <path d="M70,-78 h34 v16 l10,14 v62 h-54 v-62 l10,-14 Z" fill={C.white} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <rect x={60} y={-30} width={54} height={18} fill="#4FC3F7" />
    <circle cx={150} cy={-14} r={30} fill="#7CCB8E" stroke={INK} strokeWidth={4} />
    <path d="M134,-20 q16,-14 32,0 M140,-4 q10,-10 22,0" stroke="#4E9E62" strokeWidth={4} fill="none" strokeLinecap="round" />
    <circle cx={42} cy={-4} r={19} fill="#E57373" stroke={INK} strokeWidth={4} />
    <circle cx={80} cy={-2} r={19} fill="#E57373" stroke={INK} strokeWidth={4} />
    <path d="M96,6 q26,-50 66,-38 q-28,8 -42,44 Z" fill="#FFD54F" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    {/* basket */}
    <path d="M0,0 H190 L172,104 H22 Z" fill="#E9DAF5" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    <path d="M44,0 L52,104 M88,0 L90,104 M132,0 L128,104 M6,34 H184 M12,70 H178" stroke="#A58CC0" strokeWidth={4} />
    <path d="M190,0 L204,-34 H230" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22,104 L30,150 H176 M100,104 V150" stroke={INK} strokeWidth={5} fill="none" strokeLinejoin="round" />
    <circle cx={40} cy={160} r={12} fill={INK} /><circle cx={166} cy={160} r={12} fill={INK} />
  </g>
);

const BagArt = () => (
  <svg width="100%" height="100%" viewBox="0 0 278 150" preserveAspectRatio="xMidYMid slice">
    <rect width={278} height={150} fill="#7CCB8E" />
    <path d="M118,40 l-8,-22 M150,36 l10,-20" stroke="#4E9E62" strokeWidth={8} strokeLinecap="round" />
    <circle cx={110} cy={52} r={20} fill="#E57373" />
    <rect x={136} y={22} width={26} height={44} rx={4} fill={C.white} />
    <path d="M92,58 H186 L176,134 H102 Z" fill="#E9B86A" />
    <path d="M118,78 a21,21 0 0 0 42,0" stroke="#B8823A" strokeWidth={6} fill="none" strokeLinecap="round" />
  </svg>
);

export const GroceryScene = () => {
  const f = useCurrentFrame();
  const up = usePop(8, 14);
  const pausePop = usePop(PAUSE, 9);
  const approvePop = usePop(APPROVE, 9);
  const ask = usePop(PAUSE + 2, 12);
  const hop = usePop(APPROVE + 2, 7);
  const paused = f >= PAUSE && f < APPROVE;
  const approved = f >= APPROVE;
  const face: RosaFace = approved ? "happy" : f >= PAUSE && f < PAUSE + 13 ? "oh" : "calm";
  const screenScale = approved ? 0.9 + approvePop * 0.1 : paused ? 0.9 + pausePop * 0.1 : 1;
  const jump = approved ? Math.sin(Math.min(1, hop) * Math.PI) * 26 : 0;
  // gentle idle sway for the "?" while Rosa waits; loops cleanly in either direction
  const qy = Math.sin(f / 8) * 7;
  const qr = Math.sin(f / 11) * 8;
  return (
    <AbsoluteFill>
      <Bg>
        <Room />
        <Shelves />
        {/* checkout: belt counter and register */}
        <rect x={-10} y={620} width={580} height={160} fill="#CBB2DF" stroke={INK} strokeWidth={4} />
        <rect x={-10} y={606} width={590} height={22} rx={6} fill="#6E5A8A" stroke={INK} strokeWidth={4} />
        <path d="M20,617 H560" stroke="#8C78A8" strokeWidth={4} strokeDasharray="18 14" />
        <rect x={470} y={560} width={24} height={48} fill={INK} />
        <rect x={420} y={500} width={130} height={70} rx={10} fill="#7D6A96" stroke={INK} strokeWidth={4} />
        <rect x={434} y={512} width={102} height={34} rx={4} fill="#CFE8FF" />
        <text x={485} y={539} textAnchor="middle" fontSize={26} fontWeight={800} fill={C.purpleInk} fontFamily={FONT}>$420</text>
        <Cart x={6} y={640} />
      </Bg>
      <Rosa x={330} y={812 - jump} scale={1.45} arms="hold" face={face} look={paused ? 1 : 0} heart={approved} squash={approved && hop < 0.25 ? 0.05 : 0} />
      {paused && (
        <div style={{
          position: "absolute", left: 432, top: 300 + qy, width: 70, height: 70, transform: `scale(${ask}) rotate(${qr}deg)`,
          borderRadius: 99, background: C.white, border: `4px solid ${INK}`, display: "grid", placeItems: "center",
          fontFamily: FONT, fontWeight: 800, fontSize: 48, color: C.purple, boxShadow: "0 6px 0 rgba(42,18,64,0.12)",
        }}>?</div>
      )}
      {/* Rosa's phone, zoomed so the screen is readable */}
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - up) * 1100}px)` }}>
        <Phone x={556} y={40} width={384}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${screenScale})` }}>
            {/* Real app screenshots (public/app), captured from the iPhone app on main. */}
            <AppShot f={f} name={f < PAUSE ? "grocery-confirm" : !approved ? "grocery-waiting" : f < APPROVE + 40 ? "grocery-approved" : "grocery-paid"} tapAt={f < PAUSE ? TAP : undefined} />
          </div>
        </Phone>
      </div>
      <CheckBurst x={ICON_AT.x} y={ICON_AT.y} at={APPROVE} />
      {!approved && <Sticker text="PAUSED · much more than usual" x={28} y={150} delay={PAUSE + 8} tilt={-6} bg={C.red} size={36} />}
      <Sticker text="APPROVED · paid" x={60} y={150} delay={APPROVE + 8} tilt={-6} bg={C.green} size={40} />
    </AbsoluteFill>
  );
};
