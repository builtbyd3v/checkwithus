import { continueRender, delayRender, staticFile } from "remotion";

// Brand: purple = family and main actions. Yellow = the older adult, fill only, never text.
export const C = {
  purple: "#A62FEA",
  purpleDeep: "#6B1BA3",
  purpleInk: "#2A1240",
  yellow: "#FBC02D",
  yellowSoft: "#FFE59A",
  ink: "#1F1B24",
  paper: "#FBF8F3",
  wall: "#F1E9F7",
  floor: "#E3D6EC",
  red: "#D6453D",
  green: "#2F8F5B",
  night: "#160C24",
  nightPanel: "#24163A",
  line: "#3A2A55",
  white: "#FFFFFF",
};

// "CW Digits" swaps in plain digits: Atkinson's slashed zero turns "Auth0" into "AuthØ".
export const FONT = "'CW Digits', 'Atkinson Hyperlegible Next', Arial, sans-serif";

// The tagline that opens and closes the judge video. One place to change it.
export const TAGLINE = "Before money moves, check with us.";

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const HALF = W / 2;

const wait = delayRender("font");
const faces = ["400", "700", "800"].map(
  (weight) => new FontFace("Atkinson Hyperlegible Next", `url('${staticFile(`fonts/atkinson-${weight}.woff2`)}') format('woff2')`, { weight }),
);
const digits = [
  new FontFace("CW Digits", "local('Helvetica Neue'), local('Arial')", { unicodeRange: "U+0030-0039", weight: "400" }),
  new FontFace("CW Digits", "local('Helvetica Neue Bold'), local('Arial Bold')", { unicodeRange: "U+0030-0039", weight: "700 800" }),
];
Promise.all([...faces, ...digits].map((f) => f.load()))
  .then((loaded) => {
    loaded.forEach((f) => document.fonts.add(f));
    continueRender(wait);
  })
  .catch(() => continueRender(wait));
