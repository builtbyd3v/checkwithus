import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { BEAT, STORY } from "../timeline";
import { Badge } from "../ui";
import { Bg, Bubble, INK } from "./kit";

const CASH = BEAT.cashOut - STORY.atm.from;
const SLOT = { x: 560, y: 600 };
const HAND = { x: 333, y: 720 }; // Rosa's free hand (viewer right)

const Bill = ({ dx, rot }: { dx: number; rot: number }) => (
  <g transform={`translate(${dx},0) rotate(${rot})`}>
    <rect x={-56} y={-26} width={112} height={52} rx={6} fill="#8FD6A8" stroke={C.green} strokeWidth={4} />
    <circle cx={0} cy={0} r={15} fill="#C9EED6" stroke={C.green} strokeWidth={3} />
    <text x={0} y={7} textAnchor="middle" fontSize={20} fontWeight={800} fill={C.green} fontFamily={FONT}>$</text>
  </g>
);

export const AtmScene = () => {
  const f = useCurrentFrame();
  const out = interpolate(f, [CASH, CASH + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)) });
  const take = interpolate(f, [CASH + 22, CASH + 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const bx = interpolate(take, [0, 1], [SLOT.x, HAND.x]);
  const by = interpolate(take, [0, 1], [SLOT.y - 28 + out * 62, HAND.y - 20]) - Math.sin(take * Math.PI) * 50;
  const screen = f < CASH ? "Withdraw" : "Take cash";
  const cloud = (f * 0.4) % 1100;
  return (
    <AbsoluteFill>
      <Bg>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#DCEBFA" />
            <stop offset="1" stopColor="#F1E9F7" />
          </linearGradient>
          {/* ponytail: bills are clipped at the slot until Rosa takes them */}
          <clipPath id="slot"><rect x={0} y={601} width={960} height={479} /></clipPath>
        </defs>
        <rect width={960} height={780} fill="url(#sky)" />
        <circle cx={880} cy={110} r={46} fill={C.yellow} />
        <g fill={C.white}>
          <ellipse cx={480 + cloud * 0.3} cy={110} rx={70} ry={24} />
          <ellipse cx={510 + cloud * 0.3} cy={92} rx={40} ry={24} />
        </g>
        {/* far buildings */}
        <g fill="#DCCBEA">
          <rect x={-10} y={420} width={140} height={360} />
          <rect x={120} y={470} width={110} height={310} />
          <rect x={230} y={380} width={120} height={400} />
        </g>
        <g fill="#EFE6F7">
          {[0, 1, 2, 3, 4].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={20 + c * 52} y={450 + r * 60} width={30} height={34} />))}
        </g>
        {/* bank */}
        <rect x={380} y={300} width={600} height={480} fill={C.paper} stroke={INK} strokeWidth={5} />
        <path d="M360,300 L670,190 L980,300 Z" fill="#E7DAF2" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <text x={670} y={280} textAnchor="middle" fontSize={52} fontWeight={800} fill={C.purpleInk} fontFamily={FONT} letterSpacing={6}>BANK</text>
        {[400, 820, 900].map((x) => (
          <rect key={x} x={x} y={330} width={44} height={450} fill="#F3ECF9" stroke={INK} strokeWidth={4} />
        ))}
        <rect x={700} y={560} width={100} height={220} fill="#B784DE" stroke={INK} strokeWidth={4} />
        {/* ATM */}
        <rect x={470} y={410} width={190} height={260} rx={14} fill={C.purpleDeep} stroke={INK} strokeWidth={5} />
        <rect x={492} y={432} width={146} height={96} rx={8} fill="#CFE8FF" />
        <text x={565} y={472} textAnchor="middle" fontSize={22} fontWeight={800} fill={C.purpleInk} fontFamily={FONT}>{screen}</text>
        <text x={565} y={510} textAnchor="middle" fontSize={32} fontWeight={800} fill={C.purpleInk} fontFamily={FONT}>$200</text>
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={518 + c * 34} y={540 + r * 16} width={26} height={11} rx={3} fill="#D9C9EC" />))}
        <rect x={500} y={594} width={130} height={14} rx={7} fill={INK} />
        {/* sidewalk + street */}
        <rect y={780} width={960} height={300} fill={C.floor} />
        <path d="M0,780 H960" stroke="#CDB9DE" strokeWidth={5} />
        <rect y={880} width={960} height={200} fill="#CDBFD9" />
        {/* bills: under Rosa's hand once taken */}
        {f >= CASH && take < 1 && (
          <g clipPath={take === 0 ? "url(#slot)" : undefined}><g transform={`translate(${bx},${by}) rotate(${take * -14})`}>
            <Bill dx={-10} rot={-6} /><Bill dx={0} rot={0} /><Bill dx={10} rot={6} />
          </g></g>
        )}
      </Bg>
      <Rosa x={270} y={800} scale={1.5} arms="ear" face={take >= 1 ? "worried" : f >= CASH ? "oh" : "worried"} look={1} />
      {take >= 1 && (
        <svg width={960} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          <g transform={`translate(${HAND.x + 6},${HAND.y - 26}) rotate(-24)`}>
            <Bill dx={-8} rot={-8} /><Bill dx={0} rot={0} /><Bill dx={8} rot={8} />
          </g>
          <circle cx={HAND.x} cy={HAND.y - 6} r={15} fill="#FAD4B5" stroke={INK} strokeWidth={6} />
        </svg>
      )}
      <Bubble x={40} y={190} w={300} delay={14} tailX={150}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>Caller</div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>Hurry! Cash!</div>
      </Bubble>
      <Badge sponsor="Capital One Nessie" doing="ATM withdrawal: $200" x={30} y={30} delay={CASH + 4} />
    </AbsoluteFill>
  );
};
