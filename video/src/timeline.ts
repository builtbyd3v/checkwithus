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

// Judge cut (~53 s). Absolute frames. GAP segments are where the team's filmed family clips go (left half),
// while the right half keeps the older adult waiting. Pattern: routine pays, unusual waits, scam stops.
export const J45 = {
  hook: { from: 0, dur: 135 }, // $7.7B lost, scammers talk past warnings
  promise: { from: 135, dur: 105 }, // tagline + the 3-part pattern
  bill: { from: 240, dur: 105 }, // BillScene: $350 water bill pays inside the allowance
  groA: { from: 345, dur: 90 }, // GroceryScene 0-90: $420 groceries paused
  gap1: { from: 435, dur: 120 }, // CLIP J1 (4 s): family reviews, Face ID, Approve
  groB: { from: 555, dur: 50 }, // GroceryScene 90-140: approved, paid
  call: { from: 605, dur: 75 }, // CallScene 0-75: "Possible scam", answered
  atm: { from: 680, dur: 75 }, // AtmScene 0-75: $200 cash
  giftA: { from: 755, dur: 105 }, // HoldScene 0-105: gift card paused, frustrated
  gap2: { from: 860, dur: 120 }, // CLIP J2 (4 s): family Deny
  giftB: { from: 980, dur: 50 }, // HoldScene 150-200: "Stopped"
  frzA: { from: 1030, dur: 25 }, // FreezeScene 0-25
  gap3: { from: 1055, dur: 90 }, // CLIP J3 (3 s): family taps Freeze
  frzB: { from: 1145, dur: 75 }, // FreezeScene 25-100: coins to the vault
  table: { from: 1220, dur: 270 }, // "Not just ___" sponsor table
  end: { from: 1490, dur: 105 }, // tagline + pattern + logo wall
};
export const J45_DUR = 1595;
// Where the filmed clips sit in the left half (video pixels): under the sponsor bar, above the captions.
export const CAM = { x: 0, y: 100, w: 960, h: 800 };
export const SPLIT_FROM = J45.bill.from;
export const SPLIT_TO = J45.frzB.from + J45.frzB.dur;

// Local beats inside the two new scenes (frames from each scene's own start).
export const BILL = { tap: 25, paid: 50, dur: 105 };
export const GROCERY = { tap: 30, pause: 45, approve: 95, dur: 150 };
