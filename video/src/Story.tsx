import type { ComponentType, ReactNode } from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C } from "./theme";
import { BEAT, STORY } from "./timeline";
import { Caption, Split, Sticker } from "./ui";
import { TextScene } from "./scenes/TextScene";
import { CallScene } from "./scenes/CallScene";
import { AtmScene } from "./scenes/AtmScene";
import { HoldScene } from "./scenes/HoldScene";
import { FreezeScene } from "./scenes/FreezeScene";

const WIPE = 9;

/** New scene slides in from the right with a purple leading edge, over the old one. */
export const SlideIn = ({ children }: { children: ReactNode }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, WIPE], [960, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}px)`, boxShadow: x > 0 ? `-14px 0 0 ${C.purple}` : "none" }}>
      {children}
    </AbsoluteFill>
  );
};

const SCENES: [{ from: number; dur: number }, ComponentType][] = [
  [STORY.text, TextScene],
  [STORY.call, CallScene],
  [STORY.atm, AtmScene],
  [STORY.hold, HoldScene],
  [STORY.freeze, FreezeScene],
];

const CAPTIONS: [number, number, string][] = [
  [STORY.text.from, STORY.text.dur, "Scam text? Checked on Rosa's phone. It never leaves."],
  [STORY.call.from, STORY.call.dur, "\"Possible scam.\" Rosa answers anyway."],
  [STORY.atm.from, STORY.atm.dur, "The caller sends Rosa to the ATM for cash..."],
  [STORY.hold.from, BEAT.familyDeny - STORY.hold.from, "...then a gift card. Together, that's a scam."],
  [BEAT.familyDeny, STORY.freeze.from - BEAT.familyDeny, "Paused. The family decides, not the scammer."],
  [STORY.freeze.from, STORY.freeze.dur, "One tap. The balance moves to a safe vault."],
];

export const Story = () => (
  <AbsoluteFill>
    <Split>
      {SCENES.map(([w, Scene], i) => (
        <Sequence key={w.from} from={w.from} durationInFrames={w.dur + (i < SCENES.length - 1 ? WIPE : 0)}>
          {i === 0 ? <Scene /> : <SlideIn><Scene /></SlideIn>}
        </Sequence>
      ))}
    </Split>
    {/* This sticker crosses the center divider on purpose. */}
    <Sequence from={BEAT.holdPause + 8} durationInFrames={BEAT.familyDeny - BEAT.holdPause - 8}>
      <Sticker text="PAUSED · cash, then a gift card" x={760} y={168} tilt={-6} bg={C.red} />
    </Sequence>
    {CAPTIONS.map(([from, dur, text]) => (
      <Sequence key={from} from={from} durationInFrames={dur}>
        <Caption text={text} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
