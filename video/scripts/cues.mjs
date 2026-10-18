// Writes player/cues.json (seconds) from src/timeline.ts (frames at 30 fps).
import { writeFileSync } from "node:fs";
import { J45, J45_DUR, CAM, SPLIT_FROM, SPLIT_TO } from "../src/timeline.ts";

const FPS = 30;
const W = 1920;
const H = 1080;
const s = (f) => +(f / FPS).toFixed(4);
const hold = (id, prompt) => ({ id, start: s(J45[id].from), end: s(J45[id].from + J45[id].dur), prompt });

const cues = {
  fps: FPS,
  duration: s(J45_DUR),
  holds: [hold("hold1", "Family: review, Face ID, tap Deny"), hold("hold2", "Family: tap Freeze")],
  camera: { start: s(SPLIT_FROM), end: s(SPLIT_TO) },
  cam: { x: CAM.x / W, y: CAM.y / H, w: CAM.w / W, h: CAM.h / H },
};

writeFileSync(new URL("../player/cues.json", import.meta.url), JSON.stringify(cues, null, 2) + "\n");
console.log(JSON.stringify(cues, null, 2));
