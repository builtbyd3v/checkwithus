import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Rosa } from "../Rosa";
import { C, FONT } from "../theme";
import { BEAT, STORY } from "../timeline";
import { Badge, Phone, usePop } from "../ui";
import { Bg, Bubble, INK, Room } from "./kit";

const RING = BEAT.callRing - STORY.call.from;
const ANSWER = BEAT.callAnswer - STORY.call.from;

const Round = ({ bg, label, icon, pulse = 0 }: { bg: string; label: string; icon: "x" | "phone"; pulse?: number }) => (
  <div style={{ textAlign: "center", color: C.white, fontSize: 20, fontWeight: 700 }}>
    <div style={{
      width: 84, height: 84, borderRadius: 99, background: bg, display: "grid", placeItems: "center", margin: "0 auto 8px",
      boxShadow: pulse > 0 ? `0 0 0 ${pulse * 18}px rgba(47,143,91,${0.5 * (1 - pulse)})` : "none",
    }}>
      <svg width={40} height={40} viewBox="0 0 40 40">
        {icon === "x" ? (
          <path d="M10,10 L30,30 M30,10 L10,30" stroke={C.white} strokeWidth={6} strokeLinecap="round" />
        ) : (
          <path d="M8,10 q0,-4 4,-4 h4 l3,8 l-4,3 q3,7 10,10 l3,-4 l8,3 v4 q0,4 -4,4 q-24,0 -24,-24 Z" fill={C.white} />
        )}
      </svg>
    </div>
    {label}
  </div>
);

const CallScreen = ({ f }: { f: number }) => {
  const answered = f >= ANSWER;
  const secs = Math.max(0, Math.floor((f - ANSWER) / 30));
  const pulse = !answered && f > RING ? ((f - RING) % 24) / 24 : 0;
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#3A2156 0%,#160C24 100%)", fontFamily: FONT, color: C.white, textAlign: "center" }}>
      <div style={{ marginTop: 70, fontSize: 22, color: "#C9B8DD" }}>{answered ? `0:0${secs}` : "Incoming call"}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 18, background: C.red, borderRadius: 99, padding: "8px 18px", fontSize: 22, fontWeight: 800 }}>
        <span style={{ width: 26, height: 26, borderRadius: 99, background: C.white, color: C.red, display: "grid", placeItems: "center", fontSize: 20 }}>!</span>
        Warning
      </div>
      <div style={{ fontSize: 50, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>Possible scam</div>
      <div style={{ fontSize: 24, color: "#C9B8DD", marginTop: 10 }}>+1 (305) 555-0142</div>
      {answered && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, height: 120, marginTop: 40 }}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ width: 14, borderRadius: 7, background: "#CDB6F0", height: 20 + Math.abs(Math.sin(f / 3 + i * 1.1)) * 80 }} />
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, display: "flex", justifyContent: answered ? "center" : "space-around", padding: "0 20px" }}>
        {answered ? <Round bg={C.red} label="End" icon="x" /> : (
          <>
            <Round bg={C.red} label="Decline" icon="x" />
            <Round bg={C.green} label="Accept" icon="phone" pulse={pulse} />
          </>
        )}
      </div>
    </div>
  );
};

export const CallScene = () => {
  const f = useCurrentFrame();
  const ringing = f >= RING && f < ANSWER;
  const shake = ringing ? Math.sin(f * 2.2) * 3 * (Math.floor((f - RING) / 12) % 2 === 0 ? 1 : 0.2) : 0;
  const up = usePop(RING - 8, 13);
  const answered = f >= ANSWER;
  const face = f < RING + 8 ? "calm" : !answered ? "oh" : f < ANSWER + 12 ? "calm" : "worried";
  return (
    <AbsoluteFill>
      <Bg>
        <Room />
        {/* window */}
        <rect x={80} y={130} width={300} height={220} rx={10} fill="#DCEBFA" stroke={INK} strokeWidth={5} />
        <path d="M230,130 V350 M80,240 H380" stroke={INK} strokeWidth={5} />
        <circle cx={150} cy={190} r={22} fill={C.yellow} />
        <ellipse cx={310} cy={290} rx={44} ry={16} fill={C.white} />
        {/* plant */}
        <path d="M470,640 q-30,-80 10,-130 M480,640 q30,-90 60,-110 M476,640 q-60,-40 -70,-90" stroke="#2F8F5B" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d="M440,640 h80 l-10,140 h-60 Z" fill="#B784DE" stroke={INK} strokeWidth={4} />
        {ringing && (
          <g stroke={C.purple} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.9}>
            {[0, 1, 2].map((i) => {
              const r = 30 + (((f - RING) * 4 + i * 30) % 90);
              return <path key={i} d={`M${560 - r * 0.2},${180 - r} a${r},${r} 0 0 0 0,${r * 2}`} opacity={1 - r / 120} />;
            })}
          </g>
        )}
      </Bg>
      <Rosa x={270} y={820} scale={1.6} arms={answered ? "ear" : "down"} face={face} look={answered ? 0 : 1} />
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - up) * 1100}px) rotate(${shake}deg)`, transformOrigin: "745px 480px" }}>
        <Phone x={590} y={120} width={320}>
          <CallScreen f={f} />
        </Phone>
      </div>
      {answered && (
        <Bubble x={40} y={150} w={520} delay={ANSWER + 10} tailX={470}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>Caller</div>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2 }}>This is your bank. Your money is at risk. Buy gift cards now!</div>
        </Bubble>
      )}
      <Badge sponsor="iOS Call Directory" doing="Known scam numbers labeled" x={30} y={30} delay={RING + 18} />
    </AbsoluteFill>
  );
};
