import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { BEAT, STORY } from "../timeline";
import { Badge, Sticker, usePop } from "../ui";
import { Bg, Buzz, INK, Room } from "./kit";

const BUZZ = BEAT.textBuzz - STORY.text.from;
const JUNK = BEAT.textToJunk - STORY.text.from;
const PHONE = { x: 872, y: 590 }; // phone on the side table
const JUNK_AT = { x: 862, y: 92 }; // Junk folder icon center

/** Living room: TV, couch, side table. Shared with the freeze scene. */
export const LivingRoom = ({ f }: { f: number }) => {
  const flicker = 0.75 + Math.sin(f * 0.9) * 0.08 + Math.sin(f * 2.3) * 0.05;
  const birdY = 520 - Math.abs(Math.sin(f / 7)) * 40;
  return (
    <>
      <Room />
      <ellipse cx={560} cy={850} rx={380} ry={44} fill="#D6C3E6" />
      <ellipse cx={560} cy={850} rx={340} ry={32} fill="none" stroke="#C4ACDA" strokeWidth={4} strokeDasharray="14 12" />
      {/* framed picture + lamp glow */}
      <rect x={420} y={250} width={110} height={84} rx={8} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
      <path d="M432,322 L462,286 L482,306 L498,292 L518,322 Z" fill="#B784DE" />
      <circle cx={500} cy={276} r={9} fill={C.yellow} />
      {/* TV glow on the wall */}
      <ellipse cx={180} cy={540} rx={210} ry={170} fill="#9FD8FF" opacity={0.14 * flicker} />
      {/* TV cabinet */}
      <rect x={30} y={650} width={300} height={130} rx={12} fill="#CBB2DF" stroke={INK} strokeWidth={4} />
      <path d="M180,660 V770" stroke={INK} strokeWidth={3} />
      <circle cx={160} cy={716} r={5} fill={INK} /><circle cx={200} cy={716} r={5} fill={INK} />
      {/* TV */}
      <rect x={160} y={624} width={40} height={30} fill={INK} />
      <rect x={42} y={430} width={276} height={200} rx={16} fill={INK} />
      <rect x={56} y={444} width={248} height={172} rx={8} fill="#8FD3FF" />
      <circle cx={262} cy={480} r={18} fill={C.yellow} />
      <path d="M56,580 Q120,530 190,570 Q250,540 304,566 V616 H56 Z" fill="#7CCB8E" />
      <g transform={`translate(${130 + Math.sin(f / 11) * 40},${birdY})`}>
        <ellipse cx={0} cy={0} rx={16} ry={13} fill="#F0577A" />
        <circle cx={6} cy={-4} r={2.5} fill={INK} />
        <path d="M14,0 l9,3 l-9,3 Z" fill={C.yellow} />
      </g>
      <rect x={56} y={444} width={248} height={172} rx={8} fill="#FFFFFF" opacity={0.12 * (1 - flicker)} />
      {/* couch */}
      <rect x={392} y={510} width={396} height={180} rx={44} fill="#B784DE" stroke={INK} strokeWidth={4} />
      <rect x={380} y={646} width={420} height={78} rx={26} fill="#C79BE8" stroke={INK} strokeWidth={4} />
      <rect x={352} y={590} width={66} height={160} rx={30} fill="#B784DE" stroke={INK} strokeWidth={4} />
      <rect x={762} y={590} width={66} height={160} rx={30} fill="#B784DE" stroke={INK} strokeWidth={4} />
      <rect x={392} y={740} width={18} height={40} fill={INK} /><rect x={770} y={740} width={18} height={40} fill={INK} />
      {/* side table + tea */}
      <rect x={830} y={636} width={124} height={18} rx={6} fill="#CBB2DF" stroke={INK} strokeWidth={4} />
      <rect x={846} y={652} width={12} height={128} fill={INK} /><rect x={926} y={652} width={12} height={128} fill={INK} />
      <path d="M906,606 h34 v22 a10,10 0 0 1 -10,10 h-14 a10,10 0 0 1 -10,-10 Z" fill={C.white} stroke={INK} strokeWidth={4} />
    </>
  );
};

export const TextScene = () => {
  const f = useCurrentFrame();
  const buzzing = f >= BUZZ && f < BUZZ + 26;
  const shake = buzzing ? Math.sin(f * 3.1) * 6 : 0;
  const lit = f >= BUZZ && f < JUNK + 20;
  const show = usePop(BUZZ + 6, 11);
  const fly = interpolate(f, [JUNK, JUNK + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const junkPop = usePop(JUNK - 14, 12);
  const gulp = usePop(JUNK + 16, 8);
  const junkScale = junkPop * (f > JUNK + 16 ? 1 + 0.25 * Math.sin(Math.min(1, gulp) * Math.PI) : 1);
  // bubble rest box
  const BX = 390, BY = 150, BW = 548;
  const cx = BX + BW / 2, cy = BY + 80;
  const tx = interpolate(fly, [0, 1], [0, JUNK_AT.x - cx]);
  const ty = interpolate(fly, [0, 1], [0, JUNK_AT.y - cy]) - Math.sin(fly * Math.PI) * 60;
  const popcorn = f % 40 < 6 ? -10 : 0;
  return (
    <AbsoluteFill>
      <Bg>
        <LivingRoom f={f} />
        {/* phone on the table */}
        <g transform={`translate(${PHONE.x + shake},${PHONE.y}) rotate(${-8 + shake})`}>
          <rect x={-20} y={-38} width={40} height={76} rx={8} fill={INK} />
          <rect x={-16} y={-32} width={32} height={64} rx={5} fill={lit ? "#E9D8FF" : "#3A2A55"} />
          {lit && <rect x={-12} y={-20} width={24} height={14} rx={4} fill={C.purple} />}
        </g>
        <Buzz x={PHONE.x} y={PHONE.y} r={34} on={buzzing} />
      </Bg>
      <Rosa x={590} y={738} scale={1.32} sit look={-1} face="calm" />
      {/* popcorn bowl on Rosa's lap */}
      <svg width={140} height={90} viewBox="0 0 140 90" style={{ position: "absolute", left: 520, top: 610 }}>
        <circle cx={46} cy={32 + popcorn} r={13} fill="#FFF6DE" stroke={INK} strokeWidth={3} />
        <circle cx={70} cy={24} r={14} fill="#FFF6DE" stroke={INK} strokeWidth={3} />
        <circle cx={94} cy={32} r={13} fill="#FFF6DE" stroke={INK} strokeWidth={3} />
        <path d="M24,40 H116 L104,82 H36 Z" fill={C.white} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d="M50,40 L56,82 M78,40 L80,82" stroke={C.red} strokeWidth={8} />
      </svg>
      {/* Junk folder */}
      <div style={{
        position: "absolute", left: JUNK_AT.x - 62, top: JUNK_AT.y - 54, width: 124, height: 108, transform: `scale(${junkScale})`,
        fontFamily: FONT, textAlign: "center",
      }}>
        <svg width={124} height={78} viewBox="0 0 124 78">
          <path d="M6,12 a6,6 0 0 1 6,-6 h34 l10,10 h56 a6,6 0 0 1 6,6 v50 a6,6 0 0 1 -6,6 h-100 a6,6 0 0 1 -6,-6 Z" fill="#7D6A96" stroke={INK} strokeWidth={4} />
          <path d="M6,28 h112 v44 a6,6 0 0 1 -6,6 h-100 a6,6 0 0 1 -6,-6 Z" fill="#9C88B6" stroke={INK} strokeWidth={4} />
          {f > JUNK + 16 && <circle cx={108} cy={14} r={13} fill={C.red} stroke={INK} strokeWidth={3} />}
          {f > JUNK + 16 && <text x={108} y={20} textAnchor="middle" fontSize={18} fontWeight={800} fill={C.white} fontFamily={FONT}>1</text>}
        </svg>
        <div style={{ fontWeight: 800, fontSize: 26, color: INK }}>Junk</div>
      </div>
      {/* scam text bubble */}
      {fly < 1 && (
        <div style={{
          position: "absolute", left: BX, top: BY, width: BW, fontFamily: FONT, transformOrigin: "88% 140%",
          transform: `translate(${tx}px,${ty}px) scale(${show * (1 - fly * 0.9)}) rotate(${fly * 30}deg)`,
          background: C.white, border: `4px solid ${INK}`, borderRadius: 26, padding: "18px 24px", boxSizing: "border-box",
          boxShadow: "0 10px 0 rgba(42,18,64,0.12)",
        }}>
          <div style={{ fontSize: 22, color: "#6A5A7C", fontWeight: 700 }}>Text message</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, marginTop: 4 }}>FL Toll Services</div>
          <div style={{ fontSize: 28, color: C.ink, lineHeight: 1.25, marginTop: 4 }}>
            Unpaid toll $6.89. Pay today: <span style={{ color: C.red, textDecoration: "underline", whiteSpace: "nowrap" }}>fl-toll-pay.example</span>
          </div>
          <div style={{
            position: "absolute", left: 466, bottom: -17, width: 28, height: 28, background: C.white,
            borderRight: `4px solid ${INK}`, borderBottom: `4px solid ${INK}`, transform: "rotate(45deg)",
          }} />
        </div>
      )}
      <Sticker text="SCAM TEXT → JUNK" x={430} y={226} delay={JUNK + 18} tilt={-6} size={40} />
      <Badge sponsor="On-device AI" doing="1 MB model in iOS Message Filter" x={30} y={30} delay={JUNK + 6} />
    </AbsoluteFill>
  );
};
