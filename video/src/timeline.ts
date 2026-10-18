// Every timing lives here so story, pipeline, audio and the filming script stay in sync. Frames at 30 fps.

// Story (shared by both cuts). Scene start frames, local to the Story sequence.
export const STORY = {
  text: { from: 0, dur: 150 }, // living room, scam text drops into Junk
  call: { from: 150, dur: 150 }, // "Possible scam" call, Rosa answers
  atm: { from: 300, dur: 120 }, // ATM cash
  hold: { from: 420, dur: 240 }, // gift card paused, Rosa frustrated, family denies, "Stopped"
  freeze: { from: 660, dur: 150 }, // family taps Freeze, money to the vault
};
export const STORY_DUR = 810;

// Inside the hold scene: frame (local to the scene) where the family's Deny lands on Rosa's phone.
export const HOLD_DENY_AT = 165;

// Story beats, absolute frames in the Story sequence. Animation and sound effects both key off these.
export const BEAT = {
  textBuzz: 25, // phone buzzes on the side table
  textToJunk: 80, // the scam text flies into the Junk folder
  callRing: 160, // phone rings "Possible scam"
  callAnswer: 215, // Rosa answers
  cashOut: 350, // ATM pushes out $200
  holdPause: 480, // gift card payment pauses: "Paused, waiting for family"
  rosaGrumble: 510, // Rosa gets frustrated
  familyDeny: 420 + HOLD_DENY_AT, // "Stopped. Your family said no."
  freezeTap: 690, // family taps Freeze (left side), coins fly to the vault on the right
  vaultShut: 740, // vault door shuts
};

// Left-half clips the team films. Absolute frames in the Story sequence.
export const SHOTS = [
  { id: "F1", from: 0, dur: 300, text: "Family member at a desk or coffee. Busy, unaware." },
  { id: "F2", from: 300, dur: 120, text: "Phone buzzes. Glance at it: Rosa is at a bank, on a call. Look worried." },
  { id: "F3", from: 420, dur: 240, text: "Phone buzzes. Read the hold. Frown. Face ID. Tap Deny. Exhale." },
  { id: "F4", from: 660, dur: 150, text: "Tap Freeze. Small nod or thumbs up." },
];

// "How it works" pipeline (Devpost cut only). Local to the Pipeline sequence.
export const PIPE = {
  intro: { from: 0, dur: 90 },
  phone: { from: 90, dur: 270 }, // on-device model, Message Filter, Call Directory
  tiger: { from: 360, dur: 270 }, // Tiger Data hypertable + continuous aggregates
  auth0: { from: 630, dur: 300 }, // Auth0 roles, 2 approvers, Face ID
  nessie: { from: 930, dur: 270 }, // Capital One Nessie, 10 resource types, Freeze transfer
  eyes: { from: 1200, dur: 150 }, // Easy On The Eyes
};
export const PIPE_DUR = 1350;

export const LOGO_JUDGE = 90;
export const LOGO_DEVPOST = 150;
export const JUDGE_DUR = STORY_DUR + LOGO_JUDGE;
export const DEVPOST_DUR = STORY_DUR + PIPE_DUR + LOGO_DEVPOST;

// 45 s judge cut. Absolute frames. GAP segments are where the team's filmed family clips go (left half);
// the right half keeps Rosa waiting, so the clips can be spliced in without retiming anything.
export const J45 = {
  hook: { from: 0, dur: 90 }, // $7.7B lost, scammers talk past warnings
  promise: { from: 90, dur: 75 }, // risky payments wait for family
  text: { from: 165, dur: 90 }, // TextScene, trimmed
  call: { from: 255, dur: 90 }, // CallScene, trimmed
  atm: { from: 345, dur: 90 }, // AtmScene, trimmed. Nessie lights up
  holdA: { from: 435, dur: 150 }, // HoldScene 0-150: paused, Rosa frustrated. Tiger Data + Easy On The Eyes light up
  gap1: { from: 585, dur: 150 }, // CLIP J1 (5 s): family reviews the hold, Face ID, taps Deny
  holdB: { from: 735, dur: 90 }, // HoldScene 150-240: "Stopped". Auth0 lights up
  freezeA: { from: 825, dur: 25 }, // FreezeScene 0-25
  gap2: { from: 850, dur: 90 }, // CLIP J2 (3 s): family taps Freeze
  freezeB: { from: 940, dur: 90 }, // FreezeScene 25-115: coins to the vault
  table: { from: 1030, dur: 270 }, // "Not just ___" sponsor table, rows build up
  end: { from: 1300, dur: 100 }, // logo wall + tagline
};
export const J45_DUR = 1400;
// Where the filmed clips sit in the left half (video pixels): under the sponsor bar, above the captions.
export const CAM = { x: 0, y: 100, w: 960, h: 800 };
export const SPLIT_FROM = J45.text.from;
export const SPLIT_TO = J45.freezeB.from + J45.freezeB.dur;
