import type { ReactElement } from "react";
import { useCurrentFrame } from "remotion";
import { C } from "./theme";

// Rosa: chibi older adult. One SVG, front view. Yellow cardigan = the older adult in our brand.
// ponytail: fixed geometry in a 200x280 box, feet at y=272. Scenes place her by her feet.

export type RosaArms = "down" | "ear" | "hold" | "fists" | "shrug";
export type RosaFace = "calm" | "smile" | "happy" | "oh" | "worried" | "angry" | "sad";

const INK = C.purpleInk;
const SKIN = "#FAD4B5";
const HAIR = "#D9D3E2";
const KNIT = "#D99A12";
const MOUTH = "#8A2C3E";

type Props = {
  x: number; y: number; scale?: number;
  sit?: boolean; arms?: RosaArms; face?: RosaFace;
  look?: number; // -1 left .. 1 right
  steam?: boolean; heart?: boolean; squash?: number;
};

const Limb = ({ d }: { d: string }) => (
  <>
    <path d={d} stroke={INK} strokeWidth={25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} stroke={C.yellow} strokeWidth={17} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>
);
const Hand = ({ x, y, r = 10 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill={SKIN} stroke={INK} strokeWidth={4} />
);
const MiniPhone = ({ x, y, w = 20, h = 38 }: { x: number; y: number; w?: number; h?: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={5} fill={INK} />
    <rect x={x + 3} y={y + 4} width={w - 6} height={h - 8} rx={3} fill="#CDB6F0" />
  </g>
);

const Arms = ({ arms, f }: { arms: RosaArms; f: number }) => {
  if (arms === "ear")
    return (
      <>
        <MiniPhone x={26} y={90} />
        <Limb d="M68,168 Q30,172 44,128" />
        <Hand x={44} y={122} />
        <Limb d="M132,168 Q144,192 142,214" />
        <Hand x={142} y={218} />
      </>
    );
  if (arms === "hold")
    return (
      <>
        <Limb d="M68,168 Q64,198 88,204" />
        <Limb d="M132,168 Q136,198 112,204" />
        <MiniPhone x={85} y={170} w={30} h={46} />
        <Hand x={88} y={206} />
        <Hand x={112} y={206} />
      </>
    );
  if (arms === "fists") {
    const s = Math.sin(f * 1.3) * 5;
    return (
      <>
        <Limb d={`M68,168 Q34,166 ${40 + s},${122}`} />
        <Hand x={40 + s} y={114} r={13} />
        <Limb d={`M132,168 Q166,166 ${160 - s},${122}`} />
        <Hand x={160 - s} y={114} r={13} />
      </>
    );
  }
  if (arms === "shrug")
    return (
      <>
        <Limb d="M68,168 Q52,206 26,188" />
        <Hand x={22} y={184} />
        <Limb d="M132,168 Q148,206 174,188" />
        <Hand x={178} y={184} />
      </>
    );
  return (
    <>
      <Limb d="M68,168 Q56,192 58,214" />
      <Hand x={58} y={218} />
      <Limb d="M132,168 Q144,192 142,214" />
      <Hand x={142} y={218} />
    </>
  );
};

const Face = ({ face, look, blink }: { face: RosaFace; look: number; blink: boolean }) => {
  const ex = look * 5;
  const happyEyes = face === "happy";
  const brows: Record<RosaFace, string | null> = {
    calm: null, smile: null, happy: null,
    oh: "M64,80 Q76,72 88,78 M112,78 Q124,72 136,80",
    worried: "M64,86 L88,78 M112,78 L136,86",
    sad: "M64,86 L88,79 M112,79 L136,86",
    angry: "M64,76 L90,88 M110,88 L136,76",
  };
  const mouths: Record<RosaFace, ReactElement> = {
    calm: <path d="M93,133 Q100,139 107,133" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />,
    smile: <path d="M90,130 Q100,146 110,130 Z" fill={MOUTH} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />,
    happy: <path d="M88,129 Q100,148 112,129 Z" fill={MOUTH} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />,
    oh: <ellipse cx={100} cy={136} rx={6} ry={8} fill={MOUTH} stroke={INK} strokeWidth={3.5} />,
    worried: <path d="M89,138 Q94.5,131 100,137 Q105.5,143 111,136" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />,
    sad: <path d="M90,139 Q100,129 110,139" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />,
    angry: <path d="M86,138 L93,132 L100,138 L107,132 L114,138" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  };
  const brow = brows[face];
  return (
    <g>
      <ellipse cx={58} cy={126} rx={11} ry={7} fill={face === "angry" ? "#F06A7A" : "#F59AAA"} opacity={0.8} />
      <ellipse cx={142} cy={126} rx={11} ry={7} fill={face === "angry" ? "#F06A7A" : "#F59AAA"} opacity={0.8} />
      {happyEyes ? (
        <path d="M71,109 Q78,100 85,109 M115,109 Q122,100 129,109" stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      ) : blink ? (
        <path d="M72,106 L84,106 M116,106 L128,106" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      ) : (
        <>
          <circle cx={78 + ex} cy={106} r={6} fill={INK} />
          <circle cx={122 + ex} cy={106} r={6} fill={INK} />
          <circle cx={80 + ex} cy={104} r={1.8} fill={C.white} />
          <circle cx={124 + ex} cy={104} r={1.8} fill={C.white} />
        </>
      )}
      <circle cx={78} cy={105} r={17} fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={4} />
      <circle cx={122} cy={105} r={17} fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={4} />
      <path d="M95,103 Q100,99 105,103" stroke={INK} strokeWidth={4} fill="none" />
      {brow && <path d={brow} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" />}
      {mouths[face]}
    </g>
  );
};

const Steam = ({ f }: { f: number }) => (
  <g>
    {[0, 1, 2, 3].map((i) => {
      const p = ((f * 2.2 + i * 15) % 60) / 60;
      const side = i % 2 === 0 ? -1 : 1;
      return (
        <circle key={i} cx={100 + side * (52 + p * 30)} cy={30 - p * 80} r={11 + p * 14}
          fill="#FFFFFF" stroke="#8E7BA8" strokeWidth={4} opacity={Math.min(1, (1 - p) * 1.6)} />
      );
    })}
  </g>
);

const Grumble = ({ f }: { f: number }) => {
  const j = Math.sin(f * 1.7) * 3;
  return (
    <g transform={`translate(${j},${-Math.abs(j)}) rotate(8 200 -20)`}>
      <path d="M150,-48 h96 a14,14 0 0 1 14,14 v34 a14,14 0 0 1 -14,14 h-62 l-18,16 l2,-16 h-18 a14,14 0 0 1 -14,-14 v-34 a14,14 0 0 1 14,-14 z"
        fill={C.white} stroke={INK} strokeWidth={4} />
      <text x={198} y={-6} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={34} fill={C.red}>#@!</text>
    </g>
  );
};

const Heart = ({ f }: { f: number }) => {
  const p = (f % 50) / 50;
  return (
    <path transform={`translate(${158 + Math.sin(f / 6) * 4},${20 - p * 30}) scale(${0.9 + Math.sin(f / 5) * 0.08})`}
      d="M0,6 C0,-6 20,-6 20,7 C20,18 4,26 0,32 C-4,26 -20,18 -20,7 C-20,-6 0,-6 0,6 Z"
      fill="#F0577A" stroke={INK} strokeWidth={3.5} opacity={1 - p * 0.5} />
  );
};

export const Rosa = ({ x, y, scale = 1.4, sit = false, arms = "down", face = "calm", look = 0, steam = false, heart = false, squash = 0 }: Props) => {
  const f = useCurrentFrame();
  const blink = f % 96 > 92;
  const bob = Math.sin(f / 9) * 1.6;
  // ponytail: squash shrinks the upper body toward the feet (deflate, stomp landings).
  const sq = 1 - squash;
  return (
    <svg viewBox="-60 -60 320 340" width={320 * scale} height={340 * scale}
      style={{ position: "absolute", left: x - 160 * scale, top: y - 332 * scale, overflow: "visible" }}>
      <ellipse cx={100} cy={274} rx={56} ry={8} fill="rgba(42,18,64,0.16)" />
      {/* legs */}
      {sit ? (
        <g>
          <rect x={64} y={214} width={72} height={30} rx={14} fill="#6E5A8A" stroke={INK} strokeWidth={4} />
          <rect x={76} y={238} width={18} height={22} fill="#6E5A8A" stroke={INK} strokeWidth={4} />
          <rect x={106} y={238} width={18} height={22} fill="#6E5A8A" stroke={INK} strokeWidth={4} />
        </g>
      ) : (
        <g>
          <rect x={78} y={224} width={18} height={38} fill="#6E5A8A" stroke={INK} strokeWidth={4} />
          <rect x={104} y={224} width={18} height={38} fill="#6E5A8A" stroke={INK} strokeWidth={4} />
        </g>
      )}
      <rect x={70} y={256} width={30} height={16} rx={8} fill="#4A2E5E" stroke={INK} strokeWidth={4} />
      <rect x={100} y={256} width={30} height={16} rx={8} fill="#4A2E5E" stroke={INK} strokeWidth={4} />
      <g transform={`translate(0,${bob}) translate(100,232) scale(${1 + squash * 0.4},${sq}) translate(-100,-232)`}>
        {/* bun, behind the head */}
        <circle cx={100} cy={30} r={25} fill={HAIR} stroke={INK} strokeWidth={4} />
        <path d="M78,16 L124,4" stroke={C.purple} strokeWidth={5} strokeLinecap="round" />
        <circle cx={124} cy={4} r={5} fill={C.purple} />
        <circle cx={40} cy={104} r={14} fill={HAIR} stroke={INK} strokeWidth={4} />
        <circle cx={160} cy={104} r={14} fill={HAIR} stroke={INK} strokeWidth={4} />
        {/* cardigan */}
        <rect x={62} y={146} width={76} height={86} rx={24} fill={C.yellow} stroke={INK} strokeWidth={4} />
        <path d="M84,148 L100,174 L116,148 Z" fill={C.paper} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M100,174 L100,230" stroke={KNIT} strokeWidth={3} />
        <circle cx={108} cy={190} r={3.4} fill={KNIT} />
        <circle cx={108} cy={208} r={3.4} fill={KNIT} />
        <path d="M68,220 H132" stroke={KNIT} strokeWidth={3} strokeLinecap="round" />
        {/* head */}
        <circle cx={100} cy={96} r={62} fill={SKIN} stroke={INK} strokeWidth={4} />
        <Face face={face} look={look} blink={blink} />
        <path d="M38,100 C34,42 68,30 100,30 C132,30 166,42 162,100 C156,80 144,68 126,64 C112,76 88,78 74,64 C58,70 44,80 38,100 Z"
          fill={HAIR} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d="M70,46 Q88,38 104,40" stroke={C.white} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
        <Arms arms={arms} f={f} />
        {steam && <Steam f={f} />}
        {steam && <Grumble f={f} />}
        {heart && <Heart f={f} />}
      </g>
    </svg>
  );
};
