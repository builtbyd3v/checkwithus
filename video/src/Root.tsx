import { Composition, Sequence } from "remotion";
import "./theme";
import { FPS, H, W } from "./theme";
import { DEVPOST_DUR, JUDGE_DUR, LOGO_DEVPOST, LOGO_JUDGE, PIPE_DUR, STORY_DUR } from "./timeline";
import { Logo } from "./ui";
import { Story } from "./Story";
import { Pipeline } from "./Pipeline";
import { Sound } from "./Sound";
import { Judge45 } from "./judge/Judge45";
import { J45_DUR } from "./timeline";

const Judge30 = () => (
  <>
    <Sequence durationInFrames={STORY_DUR}><Story /></Sequence>
    <Sequence from={STORY_DUR} durationInFrames={LOGO_JUDGE}><Logo line="Rosa does nothing. The family does the work." /></Sequence>
    <Sound cut="judge" />
  </>
);

const Devpost = () => (
  <>
    <Sequence durationInFrames={STORY_DUR}><Story /></Sequence>
    <Sequence from={STORY_DUR} durationInFrames={PIPE_DUR}><Pipeline /></Sequence>
    <Sequence from={STORY_DUR + PIPE_DUR} durationInFrames={LOGO_DEVPOST}><Logo line="Before money moves, check with the family." /></Sequence>
    <Sound cut="devpost" />
  </>
);

export const RemotionRoot = () => (
  <>
    <Composition id="Judge30" component={Judge30} durationInFrames={JUDGE_DUR} fps={FPS} width={W} height={H} />
    <Composition id="Judge45" component={Judge45} durationInFrames={J45_DUR} fps={FPS} width={W} height={H} />
    <Composition id="Devpost" component={Devpost} durationInFrames={DEVPOST_DUR} fps={FPS} width={W} height={H} />
  </>
);
