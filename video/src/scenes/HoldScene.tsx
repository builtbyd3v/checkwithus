import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { RosaArms, RosaFace } from "../Rosa";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { BEAT, HOLD_DENY_AT, STORY } from "../timeline";
import { Badge, Phone, usePop } from "../ui";
import { AppShot, Bg, INK, Room, ScreenCard } from "./kit";

const PAUSE = BEAT.holdPause - STORY.hold.from;
const GRUMBLE = BEAT.rosaGrumble - STORY.hold.from;
const DENY = HOLD_DENY_AT;
const TAP = PAUSE - 14;
const SHRUG = DENY + 30;

const CARD_COLORS = ["#FF8A65", "#4FC3F7", "#81C784", "#BA68C8", "#F06292", "#FFB74D", "#7986CB", "#4DB6AC", "#E57373", "#9575CD"];

const PayScreen = ({ f }: { f: number }) => {
  const tap = interpolate(f, [TAP, TAP + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: C.ink, padding: "90px 26px 0", boxSizing: "border-box" }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: "#5A4B6B" }}>Gift card</div>
      <div style={{ fontSize: 96, fontWeight: 800, color: C.purpleInk, marginTop: 4 }}>$200</div>
      <div style={{ height: 150, borderRadius: 18, marginTop: 20, background: "linear-gradient(135deg,#FF8A65,#F06292)", display: "grid", placeItems: "center", color: C.white, fontWeight: 800, fontSize: 32 }}>GIFT CARD</div>
      <div style={{
        position: "absolute", left: 22, right: 22, bottom: 60, height: 96, borderRadius: 22, background: tap > 0 && tap < 1 ? C.purpleDeep : C.purple,
        color: C.white, fontWeight: 800, fontSize: 38, display: "grid", placeItems: "center", overflow: "hidden",
      }}>
        Pay $200
        {tap > 0 && tap < 1 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 99, background: "rgba(255,255,255,0.45)", transform: `scale(${1 + tap * 8})`, opacity: 1 - tap }} />
        )}
      </div>
    </div>
  );
};

const PauseIcon = () => (
  <div style={{ display: "flex", gap: 12 }}>
    <div style={{ width: 18, height: 56, borderRadius: 6, background: C.ink }} />
    <div style={{ width: 18, height: 56, borderRadius: 6, background: C.ink }} />
  </div>
);
const StopIcon = () => (
  <div style={{ width: 60, height: 60, borderRadius: 99, background: C.white, display: "grid", placeItems: "center" }}>
    <div style={{ width: 26, height: 26, borderRadius: 5, background: C.purple }} />
  </div>
);

export const HoldScene = () => {
  const f = useCurrentFrame();
  const up = usePop(8, 14);
  const pausePop = usePop(PAUSE, 9);
  const denyPop = usePop(DENY, 9);
  const angry = f >= GRUMBLE && f < DENY;
  const stomp = angry ? Math.abs(Math.sin((f - GRUMBLE) * 0.45)) : 0;
  const deflate = interpolate(f, [DENY, DENY + 10, SHRUG - 4, SHRUG + 4], [0, 0.12, 0.12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arms: RosaArms = angry ? "fists" : f >= SHRUG ? "shrug" : f >= DENY ? "down" : "hold";
  const face: RosaFace = angry ? "angry" : f >= SHRUG ? "smile" : f >= DENY ? "sad" : f >= PAUSE ? "oh" : "calm";
  const screenScale = f >= DENY ? 0.9 + denyPop * 0.1 : f >= PAUSE ? 0.9 + pausePop * 0.1 : 1;
  return (
    <AbsoluteFill>
      <Bg>
        <Room />
        {/* store sign + gift card rack */}
        <rect x={130} y={262} width={300} height={56} rx={10} fill={C.white} stroke={INK} strokeWidth={4} />
        <text x={280} y={302} textAnchor="middle" fontSize={32} fontWeight={800} fill={C.purpleInk} fontFamily={FONT}>GIFT CARDS</text>
        <rect x={40} y={334} width={480} height={250} rx={12} fill="#E6D6F2" stroke={INK} strokeWidth={4} />
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3, 4].map((c) => {
            const i = r * 5 + c;
            const sway = Math.sin(f / 10 + i) * (angry ? 6 : 1.5);
            const x = 66 + c * 92, y = 352 + r * 76;
            return (
              <g key={i} transform={`rotate(${sway} ${x + 34} ${y})`}>
                <path d={`M${x + 34},${y - 6} V${y + 4}`} stroke={INK} strokeWidth={3} />
                <rect x={x} y={y + 4} width={68} height={56} rx={7} fill={CARD_COLORS[i % CARD_COLORS.length]} stroke={INK} strokeWidth={3} />
                <rect x={x + 8} y={y + 14} width={36} height={8} rx={4} fill="rgba(255,255,255,0.8)" />
              </g>
            );
          }),
        )}
        {/* counter */}
        <rect x={-10} y={620} width={560} height={160} fill="#CBB2DF" stroke={INK} strokeWidth={4} />
        <rect x={-10} y={606} width={570} height={22} rx={6} fill="#B784DE" stroke={INK} strokeWidth={4} />
        <rect x={420} y={540} width={110} height={68} rx={10} fill="#7D6A96" stroke={INK} strokeWidth={4} />
        <rect x={436} y={552} width={78} height={26} rx={4} fill="#CFE8FF" />
      </Bg>
      <Rosa x={230} y={812 - stomp * 22} scale={1.45} arms={arms} face={face} look={f >= PAUSE && f < GRUMBLE ? 1 : 0}
        steam={angry} squash={deflate + (angry && stomp < 0.2 ? 0.05 : 0)} />
      {/* Rosa's phone, zoomed so the screen is readable */}
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - up) * 1100}px)` }}>
        <Phone x={556} y={40} width={384}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${screenScale})` }}>
            {/* Real app screenshots (public/app), captured from the iPhone app on main. */}
            <AppShot f={f} name={f < PAUSE ? "gift-confirm" : f < DENY ? "gift-waiting" : "gift-denied"} tapAt={f < PAUSE ? TAP : undefined} />
          </div>
        </Phone>
      </div>
      <Sequence from={PAUSE + 12} durationInFrames={DENY - PAUSE - 12} layout="none">
        <Badge sponsor="Tiger Data" doing="2-hour window: ATM cash, then gift card" x={30} y={30} />
      </Sequence>
      <Sequence from={DENY + 4} layout="none">
        <Badge sponsor="Auth0" doing="Approver said no · Face ID" x={30} y={30} />
      </Sequence>
    </AbsoluteFill>
  );
};
