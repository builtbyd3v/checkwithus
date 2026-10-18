import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { BEAT, STORY } from "../timeline";
import { Badge, Phone, usePop } from "../ui";
import { Bg, INK, Room, ScreenCard } from "./kit";

const TAP = BEAT.freezeTap - STORY.freeze.from;
const SHUT = BEAT.vaultShut - STORY.freeze.from;
const EYES = 760 - STORY.freeze.from;
const FROM = { x: 165, y: 668 }; // Rosa's phone
const HOLE = { x: 740, y: 600, r: 118 };
const COINS = 10;

const LockIcon = () => (
  <svg width={60} height={64} viewBox="0 0 60 64">
    <path d="M16,28 V18 a14,14 0 0 1 28,0 V28" stroke={C.white} strokeWidth={7} fill="none" />
    <rect x={6} y={28} width={48} height={34} rx={8} fill={C.white} />
    <circle cx={30} cy={44} r={5} fill={C.green} />
  </svg>
);

export const FreezeScene = () => {
  const f = useCurrentFrame();
  const door = interpolate(f, [SHUT - 8, SHUT], [0.12, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
  const flash = f < SHUT ? 0 : interpolate(f, [SHUT, SHUT + 14], [1, 0], { extrapolateRight: "clamp" });
  const wheel = interpolate(f, [SHUT + 2, SHUT + 16], [0, 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const thud = f >= SHUT && f < SHUT + 6 ? Math.sin((f - SHUT) * 3) * 4 : 0;
  const landed = Array.from({ length: COINS }, (_, i) => f > TAP + 2 + i * 2.5 + 20).filter(Boolean).length;
  const phoneUp = usePop(SHUT + 4, 13);
  const done = f >= SHUT;
  return (
    <AbsoluteFill style={{ background: C.wall, transform: `translateY(${thud}px)` }}>
      <Bg>
        <Room />
        <rect x={50} y={140} width={210} height={200} rx={10} fill="#DCEBFA" stroke={INK} strokeWidth={5} />
        <path d="M155,140 V340 M50,240 H260" stroke={INK} strokeWidth={5} />
        <circle cx={100} cy={190} r={20} fill={C.yellow} />
        {/* vault */}
        <rect x={570} y={396} width={350} height={384} rx={26} fill="#B9AACB" stroke={INK} strokeWidth={5} />
        <rect x={590} y={770} width={50} height={14} fill={INK} /><rect x={850} y={770} width={50} height={14} fill={INK} />
        <circle cx={HOLE.x} cy={HOLE.y} r={HOLE.r} fill="#3A2A55" stroke={INK} strokeWidth={5} />
        {/* coin pile inside, grows as coins land */}
        {Array.from({ length: landed }, (_, i) => (
          <ellipse key={i} cx={HOLE.x - 50 + (i % 5) * 25} cy={HOLE.y + 84 - Math.floor(i / 5) * 12} rx={16} ry={8} fill={C.yellow} stroke="#B9860F" strokeWidth={3} />
        ))}
        {/* door: swings shut on its right-side hinge */}
        <g transform={`translate(880,0) scale(${door},1) translate(-880,0)`}>
          <circle cx={HOLE.x} cy={HOLE.y} r={HOLE.r + 10} fill="#D6CCE2" stroke={INK} strokeWidth={5} />
          <circle cx={HOLE.x} cy={HOLE.y} r={HOLE.r - 22} fill="none" stroke="#B9AACB" strokeWidth={6} />
          <g transform={`rotate(${wheel} ${HOLE.x} ${HOLE.y})`} stroke={INK} strokeWidth={9} strokeLinecap="round">
            <path d={`M${HOLE.x - 46},${HOLE.y} H${HOLE.x + 46} M${HOLE.x},${HOLE.y - 46} V${HOLE.y + 46}`} />
            <circle cx={HOLE.x} cy={HOLE.y} r={14} fill={C.purple} strokeWidth={5} />
          </g>
        </g>
        <rect x={866} y={500} width={22} height={40} rx={6} fill="#8E7BA8" stroke={INK} strokeWidth={4} />
        <rect x={866} y={656} width={22} height={40} rx={6} fill="#8E7BA8" stroke={INK} strokeWidth={4} />
        {/* click flash */}
        {flash > 0 && (
          <g stroke={C.purple} strokeWidth={8} strokeLinecap="round" opacity={flash}>
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2;
              const r1 = HOLE.r + 26 + (1 - flash) * 20, r2 = r1 + 30;
              return <path key={i} d={`M${HOLE.x + Math.cos(a) * r1},${HOLE.y + Math.sin(a) * r1} L${HOLE.x + Math.cos(a) * r2},${HOLE.y + Math.sin(a) * r2}`} />;
            })}
          </g>
        )}
        {flash > 0 && <circle cx={HOLE.x} cy={HOLE.y} r={HOLE.r + 10} fill={C.white} opacity={flash * 0.7} />}
      </Bg>
      <Rosa x={165} y={800} scale={1.45} arms={done ? "down" : "hold"} face={done ? "happy" : f >= TAP ? "oh" : "calm"} look={f >= TAP && !done ? 1 : 0} heart={f >= SHUT + 10} />
      {/* coins fly over Rosa, so a second layer */}
      <Bg>
        {/* flying coins */}
        {Array.from({ length: COINS }, (_, i) => {
          const t = interpolate(f, [TAP + 2 + i * 2.5, TAP + 22 + i * 2.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (t <= 0 || t >= 1) return null;
          const x = interpolate(Easing.out(Easing.cubic)(t), [0, 1], [FROM.x, HOLE.x - 30 + (i % 3) * 30]); // fast sideways first, so coins clear Rosa's face
          const y = interpolate(t, [0, 1], [FROM.y, HOLE.y + 40]) - Math.sin(t * Math.PI) * 300;
          return (
            <g key={i} transform={`translate(${x},${y}) scale(${Math.abs(Math.cos(t * 9)) * 0.7 + 0.3},1)`}>
              <circle r={24} fill={C.yellow} stroke="#B9860F" strokeWidth={4} />
              <text y={9} textAnchor="middle" fontSize={26} fontWeight={800} fill="#7A5608" fontFamily={FONT}>$</text>
            </g>
          );
        })}
      </Bg>
      {done && (
        <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - phoneUp) * 1100}px)` }}>
          <Phone x={282} y={100} width={250}>
            <ScreenCard bg={C.green} color={C.white} icon={<LockIcon />} title="Frozen." body="Money is in the safe account." inset={10} pad={16} bodySize={27} />
          </Phone>
        </div>
      )}
      <Badge sponsor="Capital One Nessie" doing="Transfer to vault · runs exactly once" x={542} y={30} delay={TAP + 6} />
      <Badge sponsor="Easy On The Eyes" doing="Plain words. Largest text." x={542} y={140} delay={EYES} />
    </AbsoluteFill>
  );
};
