/**
 * Drawn scenes for the landing page. Flat shapes in the page palette, no
 * stock art. Every scene is decorative (aria-hidden); the words next to it
 * carry the meaning. The people are made up.
 */
import type { ReactNode } from 'react';

const C = {
  ink: '#222222',
  wall: '#fff4ef',
  floor: '#f6e3d6',
  rug: '#f7c9bb',
  coral: '#d23f3a',
  coralSoft: '#f4a99b',
  chair: '#2f6f8f',
  chairDark: '#265d78',
  chairLight: '#3d82a6',
  sky: '#cfe6f2',
  sun: '#ffc24b',
  leaf: '#7fae7a',
  leafDark: '#5e8c61',
  wood: '#c98b5a',
  woodDark: '#a8714a',
  skinA: '#efc29f',
  skinB: '#b97a52',
  skinC: '#7a4b2f',
  grey: '#dcd6d0',
  dark: '#2e211b',
  trousers: '#55657a',
  white: '#ffffff',
  safe: '#1d7a4e',
  safeTint: '#e3f3ea',
  paper: '#ffffff',
  line: '#ece6e1',
};

const svgBase = 'block h-full w-full font-warm';

function Svg({ viewBox, children, className = '' }: { viewBox: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true" focusable="false" className={`${svgBase} ${className}`}>
      {children}
    </svg>
  );
}

/* ---------- people ---------- */

/** Mom in her armchair, holding her phone. About 160 x 210 local units. */
function Mom({ x, y, s = 1, eyes = 'open' }: { x: number; y: number; s?: number; eyes?: 'open' | 'happy' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* chair */}
      <rect x="0" y="44" width="150" height="150" rx="44" fill={C.chair} />
      <rect x="10" y="150" width="130" height="44" rx="18" fill={C.chairLight} />
      <rect x="-14" y="108" width="42" height="90" rx="21" fill={C.chairDark} />
      <rect x="122" y="108" width="42" height="90" rx="21" fill={C.chairDark} />
      <rect x="14" y="192" width="9" height="16" rx="3" fill={C.woodDark} />
      <rect x="127" y="192" width="9" height="16" rx="3" fill={C.woodDark} />
      {/* legs */}
      <rect x="44" y="140" width="62" height="34" rx="16" fill={C.trousers} />
      <rect x="48" y="160" width="19" height="48" rx="9" fill={C.trousers} />
      <rect x="83" y="160" width="19" height="48" rx="9" fill={C.trousers} />
      <ellipse cx="55" cy="210" rx="15" ry="7" fill={C.ink} />
      <ellipse cx="95" cy="210" rx="15" ry="7" fill={C.ink} />
      {/* body */}
      <rect x="68" y="70" width="14" height="14" fill={C.skinA} />
      <rect x="45" y="80" width="60" height="76" rx="26" fill={C.coral} />
      <path d="M66 82 L75 102 L84 82 Z" fill={C.white} />
      {/* arms and phone */}
      <path d="M50 96 Q42 124 66 126" stroke={C.coral} strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M100 96 Q108 124 84 126" stroke={C.coral} strokeWidth="15" strokeLinecap="round" fill="none" />
      <rect x="66" y="106" width="18" height="27" rx="4" fill={C.ink} />
      <circle cx="67" cy="124" r="7" fill={C.skinA} />
      <circle cx="83" cy="124" r="7" fill={C.skinA} />
      {/* head */}
      <circle cx="75" cy="20" r="11" fill={C.grey} />
      <circle cx="75" cy="46" r="26" fill={C.grey} />
      <circle cx="75" cy="54" r="22" fill={C.skinA} />
      <circle cx="61" cy="63" r="4.5" fill={C.coralSoft} opacity="0.7" />
      <circle cx="89" cy="63" r="4.5" fill={C.coralSoft} opacity="0.7" />
      <circle cx="67" cy="55" r="6.5" stroke={C.ink} strokeWidth="2" fill="none" />
      <circle cx="83" cy="55" r="6.5" stroke={C.ink} strokeWidth="2" fill="none" />
      <path d="M73.5 55 L76.5 55" stroke={C.ink} strokeWidth="2" />
      {eyes === 'open' ? (
        <>
          <circle cx="67" cy="56" r="1.9" fill={C.ink} />
          <circle cx="83" cy="56" r="1.9" fill={C.ink} />
        </>
      ) : (
        <>
          <path d="M64 57 Q67 54 70 57" stroke={C.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M80 57 Q83 54 86 57" stroke={C.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      )}
      <path d="M69 66 Q75 71 81 66" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Dani at a desk with a laptop, phone raised. About 200 x 170 local units. */
function Dani({ x, y, s = 1, buzz = true }: { x: number; y: number; s?: number; buzz?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* hair behind */}
      <rect x="52" y="10" width="56" height="74" rx="26" fill={C.dark} />
      <rect x="73" y="62" width="14" height="14" fill={C.skinB} />
      <rect x="46" y="72" width="68" height="80" rx="28" fill={C.chair} />
      <circle cx="80" cy="42" r="22" fill={C.skinB} />
      <path d="M58 40 Q62 18 82 20 Q100 20 103 38 Q90 30 74 34 Q64 36 58 40 Z" fill={C.dark} />
      <circle cx="72" cy="45" r="2" fill={C.ink} />
      <circle cx="88" cy="45" r="2" fill={C.ink} />
      <path d="M75 54 Q80 57 85 54" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* arm raised with phone */}
      <path d="M56 92 Q30 96 38 70" stroke={C.chair} strokeWidth="15" strokeLinecap="round" fill="none" />
      <g className={buzz ? 'cw-origin motion-safe:animate-cw-buzz' : ''}>
        <rect x="27" y="36" width="22" height="36" rx="5" fill={C.ink} />
        <rect x="30" y="40" width="16" height="25" rx="2" fill={C.coral} />
      </g>
      <circle cx="39" cy="70" r="7" fill={C.skinB} />
      {buzz && (
        <g stroke={C.coral} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M16 42 Q12 52 16 62" />
          <path d="M60 42 Q64 52 60 62" />
        </g>
      )}
      {/* desk and laptop */}
      <rect x="-10" y="138" width="210" height="14" rx="6" fill={C.wood} />
      <rect x="6" y="150" width="10" height="40" rx="3" fill={C.woodDark} />
      <rect x="174" y="150" width="10" height="40" rx="3" fill={C.woodDark} />
      <path d="M118 96 L170 96 L176 138 L112 138 Z" fill={C.grey} />
      <rect x="104" y="134" width="82" height="6" rx="3" fill={C.trousers} />
      <circle cx="144" cy="117" r="5" fill={C.white} />
      {/* mug */}
      <rect x="22" y="116" width="20" height="22" rx="5" fill={C.coralSoft} />
      <path d="M42 122 Q50 126 42 132" stroke={C.coralSoft} strokeWidth="4" fill="none" />
    </g>
  );
}

/* ---------- room pieces ---------- */

function Room({ w = 400, h = 300, floorY = 236 }: { w?: number; h?: number; floorY?: number }) {
  return (
    <>
      <rect width={w} height={h} fill={C.wall} />
      <rect y={floorY} width={w} height={h - floorY} fill={C.floor} />
    </>
  );
}

function Window({ x, y, w = 96, h = 112 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="14" fill={C.sky} />
      <circle cx={w * 0.68} cy={h * 0.32} r={w * 0.14} fill={C.sun} />
      <path d={`M0 ${h * 0.78} Q${w * 0.3} ${h * 0.6} ${w * 0.6} ${h * 0.74} T${w} ${h * 0.7} L${w} ${h} L0 ${h} Z`} fill={C.leaf} opacity="0.55" />
      <rect x={w / 2 - 3} width="6" height={h} fill={C.white} />
      <rect y={h / 2 - 3} width={w} height="6" fill={C.white} />
      <rect x="-8" y={h - 4} width={w + 16} height="10" rx="5" fill={C.white} />
    </g>
  );
}

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="cw-origin motion-safe:animate-cw-sway [animation-duration:7s]">
        <ellipse cx="22" cy="-6" rx="10" ry="30" fill={C.leafDark} transform="rotate(-24 22 -6)" />
        <ellipse cx="42" cy="-12" rx="11" ry="34" fill={C.leaf} />
        <ellipse cx="60" cy="-4" rx="10" ry="28" fill={C.leafDark} transform="rotate(26 60 -4)" />
      </g>
      <path d="M14 16 L70 16 L62 62 L22 62 Z" fill={C.wood} />
      <rect x="10" y="12" width="64" height="10" rx="5" fill={C.woodDark} />
    </g>
  );
}

function SideTable({ x, y, steam = true }: { x: number; y: number; steam?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="30" width="64" height="10" rx="5" fill={C.wood} />
      <rect x="10" y="40" width="7" height="44" rx="3" fill={C.woodDark} />
      <rect x="47" y="40" width="7" height="44" rx="3" fill={C.woodDark} />
      <rect x="20" y="10" width="22" height="20" rx="6" fill={C.white} />
      <path d="M42 14 Q51 19 42 25" stroke={C.white} strokeWidth="4" fill="none" />
      {steam && (
        <g stroke="#b9aea6" strokeWidth="3" strokeLinecap="round" fill="none">
          <path className="motion-safe:animate-cw-steam" d="M26 4 Q22 -4 27 -12" />
          <path className="motion-safe:animate-cw-steam [animation-delay:1.1s]" d="M35 4 Q31 -4 36 -12" />
        </g>
      )}
    </g>
  );
}

function Cat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="cw-origin motion-safe:animate-cw-sway" d="M58 20 Q86 18 82 -10" stroke="#e39b5a" strokeWidth="9" strokeLinecap="round" fill="none" />
      <ellipse cx="38" cy="22" rx="30" ry="16" fill="#e8a465" />
      <circle cx="10" cy="10" r="14" fill="#e8a465" />
      <path d="M-1 2 L2 -12 L10 -2 Z" fill="#e8a465" />
      <path d="M12 -3 L20 -13 L22 2 Z" fill="#e8a465" />
      <path d="M3 10 Q6 8 9 10" stroke={C.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M13 10 Q16 8 19 10" stroke={C.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <rect x="20" y="30" width="10" height="9" rx="4" fill="#e8a465" />
      <rect x="44" y="30" width="10" height="9" rx="4" fill="#e8a465" />
    </g>
  );
}

/** A large phone with a white screen. Children draw in screen units (0..w-16 by 0..h-16). */
function Phone({ x, y, w = 128, h = 232, children }: { x: number; y: number; w?: number; h?: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="24" fill={C.ink} />
      <g transform="translate(8 8)">
        <rect width={w - 16} height={h - 16} rx="17" fill={C.paper} />
        <rect x={(w - 16) / 2 - 16} y="7" width="32" height="8" rx="4" fill={C.ink} />
        {children}
      </g>
    </g>
  );
}

/* ---------- hero ---------- */

export function HeroArt() {
  return (
    <Svg viewBox="0 0 560 500">
      <Room w={560} h={500} floorY={378} />
      <Window x={60} y={70} w={130} h={150} />
      <Plant x={440} y={318} s={1.15} />
      <ellipse cx="290" cy="440" rx="200" ry="30" fill={C.rug} />
      <SideTable x={96} y={300} />
      <Mom x={196} y={178} s={1.22} />
      <Cat x={70} y={414} />
      {/* framed photo of the family on the wall */}
      <g transform="translate(330 80)">
        <rect width="108" height="84" rx="12" fill={C.white} />
        <rect x="8" y="8" width="92" height="68" rx="7" fill={C.sky} />
        <circle cx="36" cy="40" r="11" fill={C.skinB} />
        <rect x="23" y="52" width="26" height="24" rx="10" fill={C.chair} />
        <circle cx="54" cy="36" r="12" fill={C.skinA} />
        <circle cx="54" cy="30" r="9" fill={C.grey} />
        <circle cx="54" cy="39" r="9" fill={C.skinA} />
        <rect x="40" y="50" width="28" height="26" rx="10" fill={C.coral} />
        <circle cx="74" cy="42" r="10" fill={C.skinC} />
        <rect x="62" y="53" width="24" height="23" rx="9" fill={C.leafDark} />
      </g>
    </Svg>
  );
}

/* ---------- day scenes ---------- */

export function TextScene() {
  return (
    <Svg viewBox="0 0 400 300">
      <Room />
      <Window x={26} y={34} w={80} h={96} />
      <SideTable x={24} y={156} />
      <Mom x={96} y={64} s={0.98} />
      <Phone x={256} y={36}>
        <text x="14" y="38" fontSize="14" fontWeight="700" fill={C.ink}>Messages</text>
        <rect x="10" y="50" width="92" height="38" rx="10" fill="#f2f2f2" />
        <text x="18" y="66" fontSize="10" fontWeight="700" fill={C.ink}>Dani</text>
        <text x="18" y="80" fontSize="9.5" fill={C.ink}>Lunch on Sunday?</text>
        <rect x="10" y="94" width="92" height="38" rx="10" fill="#f2f2f2" />
        <text x="18" y="110" fontSize="10" fontWeight="700" fill={C.ink}>Pharmacy</text>
        <text x="18" y="124" fontSize="9.5" fill={C.ink}>Your refill is ready</text>
        <g className="cw-origin motion-safe:animate-cw-pop [animation-delay:400ms]">
          <rect x="10" y="150" width="92" height="44" rx="12" fill="#fde7e3" />
          <text x="18" y="168" fontSize="10" fontWeight="700" fill={C.coral}>Junk</text>
          <text x="18" y="183" fontSize="9" fill={C.ink}>1 scam text kept out</text>
        </g>
      </Phone>
    </Svg>
  );
}

export function CallScene() {
  return (
    <Svg viewBox="0 0 400 300">
      <Room />
      <Window x={26} y={34} w={80} h={96} />
      <Mom x={96} y={64} s={0.98} />
      <g transform="translate(320 150)">
        <circle r="78" fill="none" stroke={C.coral} strokeWidth="3" className="cw-origin motion-safe:animate-cw-ring" />
        <circle r="78" fill="none" stroke={C.coral} strokeWidth="3" className="cw-origin motion-safe:animate-cw-ring [animation-delay:1s]" />
      </g>
      <g className="cw-origin motion-safe:animate-cw-buzz">
        <Phone x={256} y={36}>
          <rect width="112" height="216" rx="17" fill="#3a2a28" />
          <rect x="40" y="7" width="32" height="8" rx="4" fill={C.ink} />
          <text x="56" y="62" fontSize="10" fill="#f7d7cf" textAnchor="middle">Incoming call</text>
          <text x="56" y="86" fontSize="16" fontWeight="700" fill={C.white} textAnchor="middle">Possible</text>
          <text x="56" y="105" fontSize="16" fontWeight="700" fill={C.white} textAnchor="middle">scam</text>
          <text x="56" y="126" fontSize="9.5" fill="#f7d7cf" textAnchor="middle">(555) 014-2277</text>
          <circle cx="30" cy="180" r="15" fill={C.coral} />
          <path d="M23 180 L37 180" stroke={C.white} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="82" cy="180" r="15" fill="#3b8a5c" />
          <path d="M76 180 L80 184 L88 175" stroke={C.white} strokeWidth="3" strokeLinecap="round" fill="none" />
        </Phone>
      </g>
    </Svg>
  );
}

export function PauseScene() {
  return (
    <Svg viewBox="0 0 400 300">
      <Room />
      <Window x={26} y={34} w={80} h={96} />
      <Mom x={96} y={64} s={0.98} />
      <Phone x={256} y={36}>
        <g className="cw-origin motion-safe:animate-cw-beat">
          <circle cx="56" cy="62" r="24" fill={C.coral} />
          <rect x="47" y="51" width="6" height="22" rx="2" fill={C.white} />
          <rect x="59" y="51" width="6" height="22" rx="2" fill={C.white} />
        </g>
        <text x="56" y="112" fontSize="17" fontWeight="700" fill={C.ink} textAnchor="middle">Paused</text>
        <text x="56" y="130" fontSize="10" fill={C.ink} textAnchor="middle">Your family</text>
        <text x="56" y="143" fontSize="10" fill={C.ink} textAnchor="middle">will call you.</text>
        <rect x="12" y="166" width="88" height="34" rx="17" fill={C.coral} />
        <text x="56" y="187" fontSize="10.5" fontWeight="700" fill={C.white} textAnchor="middle">Ask my family</text>
      </Phone>
    </Svg>
  );
}

export function BuzzScene() {
  return (
    <Svg viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#eef5f9" />
      <rect y="250" width="400" height="50" fill="#e1ecf2" />
      <rect x="30" y="34" width="70" height="88" rx="10" fill={C.white} />
      <rect x="40" y="46" width="50" height="8" rx="4" fill={C.sky} />
      <rect x="40" y="62" width="34" height="8" rx="4" fill={C.sky} />
      <Dani x={10} y={92} s={1} />
      <g className="cw-origin motion-safe:animate-cw-pop [animation-delay:300ms]">
        <rect x="214" y="44" width="168" height="176" rx="20" fill={C.white} />
        <text x="230" y="72" fontSize="11" fontWeight="700" fill={C.coral}>checkwith.us</text>
        <text x="230" y="96" fontSize="14" fontWeight="700" fill={C.ink}>Mom wants to pay</text>
        <text x="230" y="116" fontSize="14" fontWeight="700" fill={C.ink}>$500 in gift cards</text>
        <text x="230" y="140" fontSize="10.5" fill={C.ink}>Why it paused:</text>
        <text x="230" y="156" fontSize="10.5" fill={C.ink}>Gift card purchase.</text>
        <text x="230" y="171" fontSize="10.5" fill={C.ink}>Paid while on a phone call.</text>
        <rect x="230" y="184" width="64" height="26" rx="13" fill={C.coral} />
        <text x="262" y="201" fontSize="11" fontWeight="700" fill={C.white} textAnchor="middle">No</text>
        <rect x="302" y="184" width="64" height="26" rx="13" fill="#f2f2f2" />
        <text x="334" y="201" fontSize="11" fontWeight="700" fill={C.ink} textAnchor="middle">Yes</text>
      </g>
    </Svg>
  );
}

export function SafeScene() {
  return (
    <Svg viewBox="0 0 400 300">
      <Room />
      <Window x={160} y={30} w={80} h={84} />
      <Mom x={34} y={70} s={0.94} eyes="happy" />
      <g transform="translate(250 112) scale(0.66)">
        <Dani x={0} y={0} buzz={false} />
      </g>
      <g transform="translate(200 150)">
        <g className="cw-origin motion-safe:animate-cw-beat">
          <path d="M0 14 C-22 0 -22 -20 -8 -20 C-3 -20 0 -16 0 -12 C0 -16 3 -20 8 -20 C22 -20 22 0 0 14 Z" fill={C.coral} />
        </g>
      </g>
      <g className="cw-origin motion-safe:animate-cw-pop [animation-delay:300ms]">
        <rect x="128" y="196" width="150" height="46" rx="23" fill={C.white} />
        <circle cx="152" cy="219" r="13" fill={C.safe} />
        <path d="M146 219 L150 223 L158 214" stroke={C.white} strokeWidth="3" strokeLinecap="round" fill="none" />
        <text x="174" y="224" fontSize="14" fontWeight="700" fill={C.ink}>You&apos;re safe</text>
      </g>
    </Svg>
  );
}

export function BillScene() {
  return (
    <Svg viewBox="0 0 400 300">
      <Room />
      <Window x={26} y={34} w={80} h={96} />
      <SideTable x={24} y={156} />
      <Mom x={96} y={64} s={0.98} eyes="happy" />
      <g className="cw-origin motion-safe:animate-cw-pop [animation-delay:300ms]">
        <rect x="252" y="56" width="132" height="168" rx="16" fill={C.white} />
        <text x="268" y="84" fontSize="11" fill={C.ink}>Electric bill</text>
        <text x="268" y="112" fontSize="22" fontWeight="700" fill={C.ink}>$96.40</text>
        <rect x="268" y="128" width="72" height="24" rx="12" fill="#e3f3ea" />
        <text x="304" y="144" fontSize="11" fontWeight="700" fill={C.safe} textAnchor="middle">Paid</text>
        <text x="268" y="176" fontSize="9.5" fill={C.ink}>Inside the family&apos;s</text>
        <text x="268" y="190" fontSize="9.5" fill={C.ink}>$200 allowance.</text>
        <text x="268" y="204" fontSize="9.5" fill={C.ink}>No one was asked.</text>
      </g>
    </Svg>
  );
}

/* ---------- family tools ---------- */

export function FreezeArt() {
  return (
    <Svg viewBox="0 0 520 300">
      <rect width="520" height="300" fill={C.sky} />
      <rect x="36" y="238" width="460" height="18" rx="9" fill="#bcd9e8" />
      {/* spending jar */}
      <g transform="translate(70 96)">
        <rect x="0" y="16" width="120" height="132" rx="30" fill={C.white} />
        <rect x="14" y="0" width="92" height="24" rx="12" fill={C.coralSoft} />
        <circle cx="60" cy="120" r="14" fill={C.sun} opacity="0.5" />
        <text x="60" y="80" fontSize="15" fontWeight="700" fill={C.ink} textAnchor="middle">Spending</text>
        <text x="60" y="100" fontSize="13" fill={C.ink} textAnchor="middle">$0.00</text>
      </g>
      {/* vault */}
      <g transform="translate(320 70)">
        <rect width="150" height="174" rx="28" fill={C.chair} />
        <rect x="14" y="14" width="122" height="146" rx="20" fill={C.chairLight} />
        <circle cx="75" cy="78" r="34" fill={C.chair} />
        <circle cx="75" cy="78" r="12" fill={C.sun} />
        <rect x="71" y="40" width="8" height="18" rx="4" fill={C.sun} />
        <rect x="71" y="98" width="8" height="18" rx="4" fill={C.sun} />
        <rect x="37" y="74" width="18" height="8" rx="4" fill={C.sun} />
        <rect x="95" y="74" width="18" height="8" rx="4" fill={C.sun} />
        <text x="75" y="142" fontSize="15" fontWeight="700" fill={C.white} textAnchor="middle">Vault</text>
      </g>
      {/* coins in flight */}
      {[0, 0.9, 1.8].map((d) => (
        <g key={d} transform="translate(196 150)">
          <g className={`motion-safe:animate-cw-coin ${d === 0 ? '' : d < 1 ? '[animation-delay:0.9s]' : '[animation-delay:1.8s]'}`}>
            <circle r="14" fill={C.sun} />
            <circle r="8" fill="none" stroke="#e0a32e" strokeWidth="3" />
          </g>
        </g>
      ))}
    </Svg>
  );
}

export function BankArt() {
  return (
    <Svg viewBox="20 26 316 176">
      <rect width="360" height="220" fill="#fde7e1" />
      <g transform="translate(40 46)">
        <path d="M0 40 L80 0 L160 40 Z" fill={C.coral} />
        <rect x="10" y="40" width="140" height="10" fill={C.coralSoft} />
        {[20, 55, 90, 125].map((cx) => (
          <rect key={cx} x={cx} y="56" width="16" height="70" rx="6" fill={C.white} />
        ))}
        <rect x="0" y="126" width="160" height="16" rx="6" fill={C.coralSoft} />
      </g>
      <g transform="translate(254 112)">
        <circle r="46" fill="none" stroke={C.coral} strokeWidth="3" className="cw-origin motion-safe:animate-cw-ring" />
        <g className="cw-origin motion-safe:animate-cw-buzz">
          <rect x="-24" y="-42" width="48" height="84" rx="10" fill={C.ink} />
          <rect x="-19" y="-36" width="38" height="68" rx="6" fill={C.white} />
          <path d="M-9 -6 Q-9 10 7 14 L11 9 L4 4 L0 7 Q-4 3 -4 -2 L-1 -6 L-6 -13 Z" fill={C.coral} />
        </g>
      </g>
    </Svg>
  );
}

export function AllowanceArt() {
  return (
    <Svg viewBox="44 20 276 188">
      <rect width="360" height="220" fill={C.safeTint} />
      <g transform="translate(64 34)">
        <rect width="150" height="160" rx="16" fill={C.white} />
        <text x="18" y="34" fontSize="13" fill={C.ink}>Water bill</text>
        <text x="18" y="64" fontSize="24" fontWeight="700" fill={C.ink}>$42.15</text>
        <rect x="18" y="84" width="114" height="10" rx="5" fill="#eeeeee" />
        <rect x="18" y="84" width="26" height="10" rx="5" fill={C.safe} />
        <text x="18" y="118" fontSize="11" fill={C.ink}>Allowance: under $200</text>
        <text x="18" y="136" fontSize="11" fill={C.ink}>Ends Nov 30</text>
      </g>
      <g transform="translate(250 92)">
        <g className="cw-origin motion-safe:animate-cw-beat">
          <circle r="30" fill={C.safe} />
          <path d="M-12 0 L-3 9 L13 -9" stroke={C.white} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </g>
    </Svg>
  );
}

export function PrivacyArt() {
  return (
    <Svg viewBox="0 0 420 420">
      <circle cx="210" cy="210" r="196" fill={C.sky} />
      <g transform="translate(140 70)">
        <rect width="140" height="260" rx="28" fill={C.ink} />
        <rect x="9" y="9" width="122" height="242" rx="20" fill={C.white} />
        <rect x="54" y="18" width="32" height="8" rx="4" fill={C.ink} />
        {/* a small house on the screen: the data stays home */}
        <g transform="translate(30 80)">
          <path d="M0 40 L40 4 L80 40 Z" fill={C.coral} />
          <rect x="10" y="38" width="60" height="50" rx="6" fill={C.coralSoft} />
          <rect x="32" y="58" width="16" height="30" rx="4" fill={C.white} />
        </g>
        <text x="70" y="200" fontSize="14" fontWeight="700" fill={C.ink} textAnchor="middle">Checked here.</text>
        <text x="70" y="218" fontSize="14" fontWeight="700" fill={C.ink} textAnchor="middle">Stays here.</text>
      </g>
      <g className="motion-safe:animate-cw-float">
        <g transform="translate(300 120)">
          <rect x="-34" y="-26" width="68" height="52" rx="16" fill={C.white} />
          <rect x="-12" y="-6" width="24" height="18" rx="4" fill={C.ink} />
          <path d="M-7 -6 L-7 -12 Q0 -20 7 -12 L7 -6" stroke={C.ink} strokeWidth="4" fill="none" />
        </g>
      </g>
    </Svg>
  );
}

/* ---------- avatars for the family vote ---------- */

const avatarLooks = {
  dani: { bg: '#dcedf6', skin: C.skinB, hair: C.dark, shirt: C.chair, long: true },
  sam: { bg: '#e3f3ea', skin: C.skinC, hair: '#1c1512', shirt: C.leafDark, long: false },
  ana: { bg: '#ffe4dc', skin: C.skinA, hair: '#8a4b2a', shirt: C.coral, long: true },
} as const;

export type AvatarName = keyof typeof avatarLooks;

export function Avatar({ name, className = '' }: { name: AvatarName; className?: string }) {
  const a = avatarLooks[name];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="32" fill={a.bg} />
      {a.long && <rect x="16" y="14" width="32" height="38" rx="15" fill={a.hair} />}
      <rect x="14" y="44" width="36" height="30" rx="14" fill={a.shirt} />
      <circle cx="32" cy="30" r="13" fill={a.skin} />
      <path d="M19 28 Q21 14 33 15 Q45 16 45 28 Q38 21 27 23 Q22 24 19 28 Z" fill={a.hair} />
      <circle cx="27.5" cy="31" r="1.6" fill={C.ink} />
      <circle cx="36.5" cy="31" r="1.6" fill={C.ink} />
      <path d="M28.5 36 Q32 38.5 35.5 36" stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- small line icons for the pause list ---------- */

const iconPaths: Record<string, ReactNode> = {
  gift: (
    <>
      <rect x="4" y="11" width="24" height="17" rx="3" />
      <rect x="2" y="7" width="28" height="6" rx="2" />
      <path d="M16 7v21M16 7c-2-5-8-5-8-1s8 1 8 1zm0 0c2-5 8-5 8-1s-8 1-8 1z" />
    </>
  ),
  coin: (
    <>
      <circle cx="16" cy="16" r="12" />
      <path d="M13 10h5a3 3 0 010 6h-5m0 0h6a3 3 0 010 6h-6m0-12v12m2-14v2m0 12v2" />
    </>
  ),
  person: (
    <>
      <circle cx="13" cy="11" r="5" />
      <path d="M3 27c0-6 4-9 10-9s10 3 10 9M25 9v8m-4-4h8" />
    </>
  ),
  stack: (
    <>
      <rect x="3" y="8" width="26" height="16" rx="3" />
      <circle cx="16" cy="16" r="3.5" />
      <path d="M7 28h18" />
    </>
  ),
  spike: <path d="M3 24l7-6 5 4 6-12 3 5 5-2M3 28h26" />,
  call: <path d="M8 4l4 0 2 7-3 2c1 3 4 6 7 7l2-3 7 2v4c0 2-2 4-4 4C14 27 5 18 4 8c0-2 2-4 4-4z" />,
  atm: (
    <>
      <rect x="3" y="4" width="16" height="12" rx="2" />
      <path d="M7 16v6h8v-6M21 20h8M26 17l3 3-3 3" />
      <rect x="12" y="22" width="16" height="7" rx="2" />
    </>
  ),
  wire: <path d="M4 10h20m-5-5l5 5-5 5M28 22H8m5-5l-5 5 5 5" />,
};

export type IconName = keyof typeof iconPaths;

export function LineIcon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path d="M16 3C8.8 3 3 8.4 3 15c0 3.7 1.8 7 4.7 9.2L7 29l5.2-2.6c1.2.3 2.5.6 3.8.6 7.2 0 13-5.4 13-12S23.2 3 16 3z" fill={C.coral} />
      <path d="M10.5 15.5l3.8 3.8 7.5-8" stroke={C.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
