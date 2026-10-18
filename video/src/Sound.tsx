import { Audio, interpolate, Sequence, staticFile } from "remotion";
import { BEAT, DEVPOST_DUR, JUDGE_DUR, PIPE, PIPE_DUR, STORY, STORY_DUR } from "./timeline";

// Files come from scripts/audio.sh (ElevenLabs).
const a = (name: string) => staticFile(`audio/${name}.mp3`);

const At = ({ from, name, volume }: { from: number; name: string; volume: number }) => (
  <Sequence from={from} layout="none">
    <Audio src={a(name)} volume={volume} />
  </Sequence>
);

const STORY_SFX: [number, string][] = [
  [BEAT.textBuzz, "sfx-buzz"],
  [BEAT.textToJunk, "sfx-whoosh"],
  [BEAT.callRing, "sfx-ring"],
  [BEAT.cashOut, "sfx-cash"],
  [BEAT.holdPause, "sfx-pause"],
  [BEAT.rosaGrumble, "sfx-grumble"],
  [BEAT.familyDeny, "sfx-ping"],
  [BEAT.freezeTap, "sfx-coins"],
  [BEAT.vaultShut, "sfx-clunk"],
];

// Voice lines start 8 frames into their window; the logo line starts 10 frames into the logo.
const VO: [number, string][] = [
  [STORY.text.from + 8, "vo01"],
  [STORY.call.from + 8, "vo02"],
  [STORY.atm.from + 8, "vo03"],
  [STORY.hold.from + 8, "vo04"],
  [STORY.freeze.from + 8, "vo05"],
  [STORY_DUR + PIPE.intro.from + 8, "vo06"],
  [STORY_DUR + PIPE.tiger.from + 8, "vo07"],
  [STORY_DUR + PIPE.auth0.from + 8, "vo08"],
  [STORY_DUR + PIPE.nessie.from + 8, "vo09"],
  [STORY_DUR + PIPE.eyes.from + 8, "vo10"],
  [STORY_DUR + PIPE_DUR + 10, "vo11"],
];

export const Sound = ({ cut }: { cut: "judge" | "devpost" }) => {
  const judge = cut === "judge";
  const total = judge ? JUDGE_DUR : DEVPOST_DUR;
  const level = judge ? 0.45 : 0.18; // devpost music ducked under the voice
  const sfx = judge ? 1 : 0.5;
  const logoAt = judge ? STORY_DUR : STORY_DUR + PIPE_DUR;
  const fade = (f: number) =>
    interpolate(f, [0, 15, total - 20, total], [0, level, level, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <>
      <Audio src={a(judge ? "music-judge" : "music-devpost")} volume={fade} />
      {STORY_SFX.map(([f, n]) => <At key={n} from={f} name={n} volume={sfx} />)}
      <At from={logoAt} name="sfx-chime" volume={sfx} />
      {!judge && Object.values(PIPE).map((p) => <At key={`tick${p.from}`} from={STORY_DUR + p.from} name="sfx-tick" volume={sfx} />)}
      {!judge && VO.map(([f, n]) => <At key={n} from={f} name={n} volume={1} />)}
    </>
  );
};
