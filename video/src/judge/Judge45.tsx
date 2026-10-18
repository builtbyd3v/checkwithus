import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Freeze, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, H, HALF } from "../theme";
import { BILL, CAM, GROCERY, HOLD_DENY_AT, J45, J45_DUR, SPLIT_FROM, SPLIT_TO } from "../timeline";
import { BadgesOn, Caption } from "../ui";
import { SlideIn } from "../Story";
import { BillScene } from "../scenes/BillScene";
import { GroceryScene } from "../scenes/GroceryScene";
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

// Sponsor bar slots, in the order they first light up. Frames are absolute; later frames re-pulse.
const PAID = J45.bill.from + BILL.paid;
const APPROVED = J45.groB.from + (GROCERY.approve - J45.groA.dur);
const DENIED = J45.giftB.from + (HOLD_DENY_AT - 150);
const SLOTS: { id: SponsorId; name: string; verb: string; lit: number[] }[] = [
  { id: "godaddy", name: "GoDaddy Registry", verb: "the name", lit: [SPLIT_FROM + 6] },
  { id: "nessie", name: "Capital One Nessie", verb: "moves the money", lit: [PAID, APPROVED + 8, J45.atm.from + 50, J45.frzB.from + 5] },
  { id: "tiger", name: "Tiger Data", verb: "spots the unusual", lit: [J45.groA.from + GROCERY.pause, J45.giftA.from + 60] },
  { id: "eyes", name: "Easy On The Eyes", verb: "nothing to learn", lit: [J45.groA.from + GROCERY.pause + 20, J45.giftA.from + 75] },
  { id: "auth0", name: "Auth0", verb: "who can say yes", lit: [APPROVED, DENIED] },
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
  [J45.gap1, "J1 · 4 s · groceries: Face ID, tap Approve"],
  [J45.gap2, "J2 · 4 s · gift card: tap Deny"],
  [J45.gap3, "J3 · 3 s · tap Freeze"],
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

// Captions span the gap and the result after it, so each one stays up long enough to read.
const CAPTIONS: [number, number, string][] = [
  [J45.bill.from, J45.bill.dur, "$350 water bill. Inside the allowance. It just pays."],
  [J45.groA.from, J45.groA.dur, "$420 of groceries. Far above normal. Paused."],
  [J45.gap1.from, J45.gap1.dur + J45.groB.dur, "The family checks it. Face ID. Approve. It pays."],
  [J45.call.from, J45.call.dur, "A scam call. Labeled \"Possible scam.\" Answered anyway."],
  [J45.atm.from, J45.atm.dur, "The caller says: get cash..."],
  [J45.giftA.from, J45.giftA.dur, "...then a $200 gift card. A scam pattern. Paused."],
  [J45.gap2.from, J45.gap2.dur + J45.giftB.dur, "The family says no. The money never moves."],
  [J45.frzA.from, J45.frzA.dur + J45.gap3.dur, "One more tap: Freeze."],
  [J45.frzB.from, J45.frzB.dur, "The balance moves to a safe vault."],
];

const sfx = (name: string) => staticFile(`audio/${name}.mp3`);
const SFX: [number, string][] = [
  [J45.bill.from + BILL.tap, "sfx-tick"],
  [PAID, "sfx-ping"],
  [J45.groA.from + GROCERY.tap, "sfx-tick"],
  [J45.groA.from + GROCERY.pause, "sfx-pause"],
  [J45.gap1.from, "sfx-buzz"], // the family phone buzzes as clip J1 starts
  [APPROVED, "sfx-ping"],
  [J45.call.from + 10, "sfx-ring"],
  [J45.atm.from + 50, "sfx-cash"],
  [J45.giftA.from + 60, "sfx-pause"],
  [J45.giftA.from + 90, "sfx-grumble"],
  [J45.gap2.from, "sfx-buzz"],
  [DENIED, "sfx-ping"],
  [J45.frzA.from + 5, "sfx-buzz"],
  [J45.frzB.from + 5, "sfx-coins"],
  [J45.frzB.from + 55, "sfx-clunk"],
  [J45.table.from, "sfx-whoosh"],
  [J45.end.from, "sfx-chime"],
];

// Numbered chapters make the pattern stick: routine pays, unusual waits, scam stops.
const CHAPTERS: [number, number, string, string, string][] = [
  [J45.bill.from, J45.bill.dur, "1", "ROUTINE", "pays itself"],
  [J45.groA.from, J45.groB.from + J45.groB.dur - J45.groA.from, "2", "UNUSUAL", "family approves"],
  [J45.call.from, J45.giftB.from + J45.giftB.dur - J45.call.from, "3", "SCAM", "family stops it"],
  [J45.frzA.from, SPLIT_TO - J45.frzA.from, "+", "FREEZE", "one tap"],
];
const Chapter = ({ n, title, sub }: { n: string; title: string; sub: string }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 12, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", left: HALF, top: BAR_H + 18, transform: `translateX(-50%) scale(${p})`, display: "flex", alignItems: "center", gap: 14, background: C.white, border: `4px solid ${C.purple}`, borderRadius: 999, padding: "8px 26px 8px 8px", fontFamily: FONT, boxShadow: "0 8px 24px rgba(42,18,64,0.25)" }}>
      <div style={{ width: 52, height: 52, borderRadius: 99, background: C.purple, color: C.white, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 30 }}>{n}</div>
      <div style={{ color: C.purpleInk, fontWeight: 800, fontSize: 34, letterSpacing: 1 }}>{title}</div>
      <div style={{ color: "#5A4B6B", fontWeight: 700, fontSize: 28 }}>{sub}</div>
    </div>
  );
};

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
        <Scene C={BillScene} from={J45.bill.from} dur={J45.bill.dur} />
        <Scene C={GroceryScene} from={J45.groA.from} dur={J45.groA.dur} slide />
        <Scene C={GroceryScene} from={J45.gap1.from} dur={J45.gap1.dur} loop={[60, 89]} />
        <Scene C={GroceryScene} from={J45.groB.from} dur={J45.groB.dur} skip={J45.groA.dur} />
        <Scene C={CallScene} from={J45.call.from} dur={J45.call.dur} slide />
        <Scene C={AtmScene} from={J45.atm.from} dur={J45.atm.dur} slide />
        <Scene C={HoldScene} from={J45.giftA.from} dur={J45.giftA.dur} slide />
        <Scene C={HoldScene} from={J45.gap2.from} dur={J45.gap2.dur} loop={[75, 104]} />
        <Scene C={HoldScene} from={J45.giftB.from} dur={J45.giftB.dur} skip={150} />
        <Scene C={FreezeScene} from={J45.frzA.from} dur={J45.frzA.dur} slide />
        <Scene C={FreezeScene} from={J45.gap3.from} dur={J45.gap3.dur} loop={[0, J45.frzA.dur - 1]} />
        <Scene C={FreezeScene} from={J45.frzB.from} dur={J45.frzB.dur} skip={J45.frzA.dur} />
      </BadgesOn.Provider>
    </AbsoluteFill>
    <Sequence from={SPLIT_FROM} durationInFrames={SPLIT_TO - SPLIT_FROM}>
      <div style={{ position: "absolute", left: HALF - 3, top: BAR_H, width: 6, height: H - BAR_H, background: C.purple }} />
      <SponsorBar />
    </Sequence>

    {CHAPTERS.map(([from, dur, n, title, sub]) => (
      <Sequence key={title} from={from} durationInFrames={dur}><Chapter n={n} title={title} sub={sub} /></Sequence>
    ))}
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
