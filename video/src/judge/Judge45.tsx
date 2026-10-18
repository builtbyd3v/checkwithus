import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Freeze, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, H, HALF } from "../theme";
import { CAM, J45, J45_DUR, SPLIT_FROM, SPLIT_TO } from "../timeline";
import { BadgesOn, Caption } from "../ui";
import { SlideIn } from "../Story";
import { TextScene } from "../scenes/TextScene";
import { CallScene } from "../scenes/CallScene";
import { AtmScene } from "../scenes/AtmScene";
import { HoldScene } from "../scenes/HoldScene";
import { FreezeScene } from "../scenes/FreezeScene";
import * as logos from "../logos";
import type { SponsorId } from "../logos";
import { EndCard, HookCard, PromiseCard, TableCard } from "./Cards";

// ponytail: Remotion animates per frame, so styles are inline objects, not Tailwind classes.

const BAR_H = 100;
const SCALE = (H - BAR_H) / H; // scenes shrink to sit under the sponsor bar

const onDark = (id: SponsorId) =>
  (logos as unknown as { LOGO_ON_DARK?: Record<SponsorId, string | null> }).LOGO_ON_DARK?.[id] ?? logos.LOGO[id];

// Sponsor bar slots, in the order they first light up. Frames are absolute in the 45 s cut.
const SLOTS: { id: SponsorId; name: string; verb: string; lit: number[] }[] = [
  { id: "godaddy", name: "GoDaddy Registry", verb: "the name", lit: [SPLIT_FROM + 6] },
  { id: "nessie", name: "Capital One Nessie", verb: "the bank", lit: [J45.atm.from + 50, J45.freezeB.from + 5] },
  { id: "tiger", name: "Tiger Data", verb: "spots the pattern", lit: [J45.holdA.from + 60] },
  { id: "eyes", name: "Easy On The Eyes", verb: "nothing to learn", lit: [J45.holdA.from + 80] },
  { id: "auth0", name: "Auth0", verb: "who says yes", lit: [J45.holdB.from + 15] },
];

const Slot = ({ slot }: { slot: (typeof SLOTS)[number] }) => {
  const f = useCurrentFrame() + SPLIT_FROM; // the bar's Sequence starts at SPLIT_FROM
  const { fps } = useVideoConfig();
  const on = f >= slot.lit[0];
  // Each lit frame gives a pop; later ones re-pulse when that sponsor acts again.
  const last = [...slot.lit].reverse().find((l) => f >= l) ?? slot.lit[0];
  const pop = spring({ frame: f - last, fps, config: { damping: 9, mass: 0.6 } });
  const pulse = on ? 1 + 0.18 * Math.sin(Math.min(1, pop) * Math.PI) : 1;
  const src = onDark(slot.id);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, opacity: on ? 1 : 0.28, filter: on ? "none" : "grayscale(1)" }}>
      <div style={{ height: 46, display: "flex", alignItems: "center", transform: `scale(${pulse})` }}>
        {src ? (
          <Img src={staticFile(src)} style={{ height: 44, maxWidth: 300, objectFit: "contain" }} />
        ) : (
          <div style={{ color: C.white, fontWeight: 800, fontSize: 26 }}>{slot.name}</div>
        )}
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

/** Left half: black until the team's clips are spliced into CAM. A dim label names the clip for each gap. */
const CLIPS: [{ from: number; dur: number }, string][] = [
  [J45.gap1, "J1 · 5 s · review the hold, Face ID, tap Deny"],
  [J45.gap2, "J2 · 3 s · tap Freeze"],
];
const LeftHalf = () => (
  <AbsoluteFill style={{ width: HALF, background: "#000" }}>
    {CLIPS.map(([seg, text]) => (
      <Sequence key={seg.from} from={seg.from - SPLIT_FROM} durationInFrames={seg.dur} layout="none">
        <div style={{ position: "absolute", left: CAM.x, top: CAM.y, width: CAM.w, height: CAM.h, display: "grid", placeItems: "center", color: "#4A4256", fontFamily: FONT, fontSize: 28, textAlign: "center" }}>
          {text}
        </div>
      </Sequence>
    ))}
  </AbsoluteFill>
);

/** Plays frames a..b of a scene back and forth, so Rosa keeps moving while the family clip runs. */
const PingPong = ({ S, a, b }: { S: ComponentType; a: number; b: number }) => {
  const n = b - a;
  const k = useCurrentFrame() % (2 * n);
  return <Freeze frame={a + (k < n ? k : 2 * n - k)}><S /></Freeze>;
};

/** Right half: an existing story scene, shrunk to sit under the bar. `skip` starts the scene that many frames in. */
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

const CAPTIONS: [number, number, string][] = [
  [J45.text.from, J45.text.dur, "Scam text: sent to Junk. Checked on the phone, never uploaded."],
  [J45.call.from, J45.call.dur, "Scam call: labeled \"Possible scam.\" Rosa answers anyway."],
  [J45.atm.from, J45.atm.dur, "The caller sends Rosa to the ATM for cash."],
  [J45.holdA.from, J45.holdA.dur, "Then a gift card. Cash, then a gift card: a scam. Paused."],
  [J45.gap1.from, J45.gap1.dur, "The family gets the alert. Reviews it. Face ID. Deny."],
  [J45.holdB.from, J45.holdB.dur, "The family said no. Rosa's money never moved."],
  [J45.gap2.from, J45.gap2.dur, "Then the family taps Freeze."],
  [J45.freezeB.from, J45.freezeB.dur, "One tap: Rosa's balance moves to a vault."],
];

const sfx = (name: string) => staticFile(`audio/${name}.mp3`);
const SFX: [number, string][] = [
  [J45.text.from + 25, "sfx-buzz"],
  [J45.text.from + 80, "sfx-whoosh"],
  [J45.call.from + 10, "sfx-ring"],
  [J45.atm.from + 50, "sfx-cash"],
  [J45.holdA.from + 60, "sfx-pause"],
  [J45.holdA.from + 90, "sfx-grumble"],
  [J45.gap1.from, "sfx-buzz"], // the family phone buzzes as clip J1 starts
  [J45.holdB.from + 15, "sfx-ping"],
  [J45.freezeA.from + 5, "sfx-buzz"],
  [J45.freezeB.from + 5, "sfx-coins"],
  [J45.freezeB.from + 55, "sfx-clunk"],
  [J45.table.from, "sfx-whoosh"],
  [J45.end.from, "sfx-chime"],
];

export const Judge45 = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Sequence durationInFrames={J45.hook.dur}><HookCard /></Sequence>
    <Sequence from={J45.promise.from} durationInFrames={J45.promise.dur}><PromiseCard /></Sequence>

    <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM}>
      <LeftHalf />
    </Sequence>
    <AbsoluteFill style={{ left: HALF, width: HALF, top: BAR_H, height: H - BAR_H, overflow: "hidden" }}>
      <BadgesOn.Provider value={false}>
        <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM} layout="none">
          <AbsoluteFill style={{ background: `linear-gradient(${C.wall} 0 ${780 * SCALE}px, ${C.floor} ${780 * SCALE}px)` }} />
        </Sequence>
        <Scene C={TextScene} from={J45.text.from} dur={J45.text.dur} />
        <Scene C={CallScene} from={J45.call.from} dur={J45.call.dur} slide />
        <Scene C={AtmScene} from={J45.atm.from} dur={J45.atm.dur} slide />
        <Scene C={HoldScene} from={J45.holdA.from} dur={J45.holdA.dur} slide />
        <Scene C={HoldScene} from={J45.gap1.from} dur={J45.gap1.dur} loop={[J45.holdA.dur - 30, J45.holdA.dur - 1]} />
        <Scene C={HoldScene} from={J45.holdB.from} dur={J45.holdB.dur} skip={J45.holdA.dur} />
        <Scene C={FreezeScene} from={J45.freezeA.from} dur={J45.freezeA.dur} slide />
        <Scene C={FreezeScene} from={J45.gap2.from} dur={J45.gap2.dur} loop={[0, J45.freezeA.dur - 1]} />
        <Scene C={FreezeScene} from={J45.freezeB.from} dur={J45.freezeB.dur} skip={J45.freezeA.dur} />
      </BadgesOn.Provider>
    </AbsoluteFill>
    <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM}>
      <div style={{ position: "absolute", left: HALF - 3, top: BAR_H, width: 6, height: H - BAR_H, background: C.purple }} />
      <SponsorBar />
    </Sequence>

    {CAPTIONS.map(([from, dur, text]) => (
      <Sequence key={from} from={from} durationInFrames={dur}><Caption text={text} /></Sequence>
    ))}

    <Sequence from={J45.table.from} durationInFrames={J45.table.dur}><TableCard /></Sequence>
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
