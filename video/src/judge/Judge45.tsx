import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Easing, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, H, HALF } from "../theme";
import { CAM, GROCERY, HOLD_DENY_AT, J45, J45_DUR, LEFT_CLIPS, SPLIT_FROM, SPLIT_TO } from "../timeline";
import { BadgesOn, Caption } from "../ui";
import { SlideIn } from "../Story";
import { AtmScene } from "../scenes/AtmScene";
import { HoldScene } from "../scenes/HoldScene";
import { GroceryScene } from "../scenes/GroceryScene";
import { LOGO, LOGO_ON_DARK, type SponsorId } from "../logos";
import { EndCard, HookCard, PromiseCard } from "./Cards";

// ponytail: Remotion animates per frame, so styles are inline objects, not Tailwind classes.
// Rule for this cut: one new thing at a time, and 3 s+ on screen after it lands.

const BAR_H = 100;
const SCALE = (H - BAR_H) / H; // scenes shrink to sit under the sponsor bar
const logoOnDark = (id: SponsorId) => LOGO_ON_DARK[id] ?? LOGO[id];

// Key moments, absolute frames.
const CASH = J45.atm.from + 50;
const PAUSED = J45.giftA.from + 60;
const DENIED = J45.giftB.from + (HOLD_DENY_AT - J45.giftA.dur);
const APPROVED = J45.groB.from + (GROCERY.approve - 90);

// Sponsor bar: each slot lights when its sponsor acts; later frames re-pulse.
const SLOTS: { id: SponsorId; name: string; verb: string; lit: number[] }[] = [
  { id: "nessie", name: "Capital One Nessie", verb: "moves the money", lit: [CASH, APPROVED + 8] },
  { id: "tiger", name: "Tiger Data", verb: "spots the pattern", lit: [PAUSED, J45.groA.from + GROCERY.pause] },
  { id: "auth0", name: "Auth0", verb: "who can say yes", lit: [DENIED, APPROVED] },
  { id: "eyes", name: "Easy On The Eyes", verb: "nothing to learn", lit: [J45.gap2.from] },
  { id: "godaddy", name: "GoDaddy Registry", verb: "the name is the product", lit: [J45.end.from] },
];

const Slot = ({ slot }: { slot: (typeof SLOTS)[number] }) => {
  const f = useCurrentFrame() + SPLIT_FROM; // the bar's Sequence starts at SPLIT_FROM
  const { fps } = useVideoConfig();
  const on = f >= slot.lit[0];
  const last = [...slot.lit].reverse().find((l) => f >= l) ?? slot.lit[0];
  const pop = spring({ frame: f - last, fps, config: { damping: 9, mass: 0.6 } });
  const pulse = on ? 1 + 0.18 * Math.sin(Math.min(1, pop) * Math.PI) : 1;
  const src = logoOnDark(slot.id);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: on ? 1 : 0.28, filter: on ? "none" : "grayscale(1)" }}>
      <div style={{ height: 46, display: "flex", alignItems: "center", transform: `scale(${pulse})` }}>
        {src ? <Img src={staticFile(src)} style={{ height: 44, maxWidth: 300, objectFit: "contain" }} /> : <div style={{ color: C.white, fontWeight: 800, fontSize: 26 }}>{slot.name}</div>}
      </div>
      <div style={{ color: on ? C.yellow : "#8A7CA0", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>{on ? slot.verb : slot.name}</div>
    </div>
  );
};

const SponsorBar = () => {
  const f = useCurrentFrame();
  const y = interpolate(f, [0, 10], [-BAR_H, 0], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: BAR_H, transform: `translateY(${y}px)`, background: C.night, borderBottom: `3px solid ${C.purple}`, display: "flex", fontFamily: FONT }}>
      {SLOTS.map((s) => <Slot key={s.id} slot={s} />)}
    </div>
  );
};

/** Left half: the team's over-the-shoulder clips of the family phone, back to back in CAM. */
const LeftHalf = () => (
  <AbsoluteFill style={{ width: HALF, background: "#000" }}>
    {LEFT_CLIPS.map((c) => (
      <Sequence key={c.src} from={c.from - SPLIT_FROM} durationInFrames={c.dur} layout="none">
        <OffthreadVideo src={staticFile(c.src)} muted style={{ position: "absolute", left: CAM.x, top: CAM.y, width: CAM.w, height: CAM.h, objectFit: "cover" }} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

/** Plays frames a..b of a scene back and forth, so the character keeps moving while a clip runs. */
const PingPong = ({ S, a, b }: { S: ComponentType; a: number; b: number }) => {
  const n = b - a;
  const k = useCurrentFrame() % (2 * n);
  return <Freeze frame={a + (k < n ? k : 2 * n - k)}><S /></Freeze>;
};

/** Right half: a story scene, shrunk to sit under the bar. `skip` starts the scene that many frames in. */
const Scene = ({ C: S, from, dur, skip = 0, loop, slide = false }: {
  C: ComponentType; from: number; dur: number; skip?: number; loop?: [number, number]; slide?: boolean;
}) => {
  const inner = loop ? <PingPong S={S} a={loop[0]} b={loop[1]} /> : <Sequence from={-skip} layout="none"><S /></Sequence>;
  const body = (
    <AbsoluteFill style={{ width: HALF, height: H, transform: `scale(${SCALE})`, transformOrigin: "top center" }}>
      <AbsoluteFill>{inner}</AbsoluteFill>
    </AbsoluteFill>
  );
  return <Sequence from={from} durationInFrames={dur}>{slide ? <SlideIn>{body}</SlideIn> : body}</Sequence>;
};

/** Big sponsor callout in the bottom band: logo, a struck-out "Not just X", then what we really do with it. */
const Callout = ({ id, not, does }: { id: SponsorId; not: string; does: string }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });
  const strike = interpolate(f, [8, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const reveal = spring({ frame: f - 16, fps, config: { damping: 13 } });
  const src = logoOnDark(id);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, background: "rgba(22,12,36,0.94)", border: `4px solid ${C.purple}`, borderRadius: 24, padding: "20px 40px", fontFamily: FONT, boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
        {src && <Img src={staticFile(src)} style={{ height: 64, maxWidth: 300, objectFit: "contain" }} />}
        <div>
          <span style={{ position: "relative", display: "inline-block", color: "#C4B8D6", fontWeight: 700, fontSize: 32 }}>
            {not}
            <span style={{ position: "absolute", left: -4, right: -4, top: "54%", height: 4, marginTop: -2, borderRadius: 2, background: C.yellow, transform: `scaleX(${strike})`, transformOrigin: "left center" }} />
          </span>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 46, marginTop: 4, opacity: Math.min(1, reveal * 1.5), transform: `translateX(${(1 - reveal) * 30}px)` }}>{does}</div>
        </div>
      </div>
    </div>
  );
};

// Bottom band, one item at a time: a short caption sets up the beat, then the sponsor callout explains it.
const CAPTIONS: [number, number, string][] = [
  [J45.atm.from, 60, "A scammer on the phone: \"Get cash.\""],
  [J45.giftA.from, 60, "\"Now buy a $200 gift card.\""],
  [J45.groA.from, J45.groA.dur, "Legit, but unusual: $420 of groceries."],
  [J45.groB.from, J45.groB.dur, "Approved in one tap. It pays."],
];
const CALLOUTS: [number, number, SponsorId, string, string][] = [
  [J45.atm.from + 60, J45.atm.dur - 60, "nessie", "Not just balances", "Real ATM cash, purchases and bills"],
  [J45.giftA.from + 60, J45.giftA.dur - 60 + J45.gap1.dur, "tiger", "Not just storage", "Catches cash, then a gift card, in 1 ms"],
  [DENIED, J45.giftB.from + J45.giftB.dur - DENIED, "auth0", "Not just login", "Only approvers can say yes, with Face ID"],
  [J45.gap2.from, J45.gap2.dur, "eyes", "Not just pretty", "One plain screen. Nothing new to learn."],
];

const sfx = (name: string) => staticFile(`audio/${name}.mp3`);
const SFX: [number, string][] = [
  [CASH, "sfx-cash"],
  [PAUSED, "sfx-pause"],
  [J45.giftA.from + 90, "sfx-grumble"],
  [J45.gap1.from, "sfx-buzz"], // the family phone buzzes as clip J1 starts
  [DENIED, "sfx-ping"],
  [J45.groA.from + GROCERY.tap, "sfx-tick"],
  [J45.groA.from + GROCERY.pause, "sfx-pause"],
  [J45.gap2.from, "sfx-buzz"],
  [APPROVED, "sfx-ping"],
  [J45.end.from, "sfx-chime"],
];

export const Judge45 = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Sequence durationInFrames={J45.hook.dur}><HookCard /></Sequence>
    <Sequence from={J45.promise.from} durationInFrames={J45.promise.dur}><PromiseCard /></Sequence>

    <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM}><LeftHalf /></Sequence>
    <AbsoluteFill style={{ left: HALF, width: HALF, top: BAR_H, height: H - BAR_H, overflow: "hidden" }}>
      <BadgesOn.Provider value={false}>
        <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM} layout="none">
          <AbsoluteFill style={{ background: `linear-gradient(${C.wall} 0 ${780 * SCALE}px, ${C.floor} ${780 * SCALE}px)` }} />
        </Sequence>
        <Scene C={AtmScene} from={J45.atm.from} dur={120} />
        <Scene C={AtmScene} from={J45.atm.from + 120} dur={J45.atm.dur - 120} loop={[90, 119]} />
        <Scene C={HoldScene} from={J45.giftA.from} dur={J45.giftA.dur} slide />
        <Scene C={HoldScene} from={J45.gap1.from} dur={J45.gap1.dur} loop={[J45.giftA.dur - 30, J45.giftA.dur - 1]} />
        <Scene C={HoldScene} from={J45.giftB.from} dur={J45.giftB.dur} skip={J45.giftA.dur} />
        <Scene C={GroceryScene} from={J45.groA.from} dur={90} slide />
        <Scene C={GroceryScene} from={J45.groA.from + 90} dur={J45.groA.dur - 90 + J45.gap2.dur} loop={[60, 89]} />
        <Scene C={GroceryScene} from={J45.groB.from} dur={J45.groB.dur} skip={90} />
      </BadgesOn.Provider>
    </AbsoluteFill>
    <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM}>
      <div style={{ position: "absolute", left: HALF - 3, top: BAR_H, width: 6, height: H - BAR_H, background: C.purple }} />
      <SponsorBar />
    </Sequence>

    {CAPTIONS.map(([from, dur, text]) => (
      <Sequence key={from} from={from} durationInFrames={dur}><Caption text={text} /></Sequence>
    ))}
    {CALLOUTS.map(([from, dur, id, not, does]) => (
      <Sequence key={id} from={from} durationInFrames={dur}><Callout id={id} not={not} does={does} /></Sequence>
    ))}

    <Sequence from={J45.end.from} durationInFrames={J45.end.dur}><EndCard /></Sequence>

    <Audio
      src={sfx("music-j45")}
      volume={(f) => 0.45 * interpolate(f, [0, 15, J45_DUR - 30, J45_DUR], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
    {SFX.map(([from, name]) => (
      <Sequence key={`${from}-${name}`} from={from} layout="none"><Audio src={sfx(name)} /></Sequence>
    ))}
  </AbsoluteFill>
);
