// The landing page's one system: type, lanes and control states. Every section uses these.

/** Display type: Gabarito 800, tight. Sizes are set where it is used. */
export const display = 'font-heading font-extrabold leading-none tracking-[-0.025em] text-balance';
export const h3 = 'font-heading text-[1.55rem] leading-[1.15] font-extrabold tracking-[-0.015em] text-balance';

/** Two lanes side by side from lg up: yellow for the older adult on the left, lilac for the family on the right. */
export const split = 'lg:bg-[linear-gradient(90deg,var(--color-lane-them)_50%,var(--color-lane-family)_50%)]';

/** A small card that shows a piece of the family app. */
export const card = 'grid gap-2.5 rounded-2xl bg-lp-card px-5 py-4 shadow-[0_0.1em_0.3em_rgb(28_20_38/0.06),0_0.8em_2em_-1em_rgb(60_20_90/0.28)]';

// Controls. No underlined hover: tint, lift, press and an arrow that nudges. One ease, 100 to 220 ms.
const control =
  'inline-flex items-center justify-center gap-2.5 rounded-full font-bold whitespace-nowrap transition-[background-color,color,translate,scale,box-shadow] duration-200 ease-out-soft active:scale-[0.97] active:duration-100 motion-reduce:transition-colors';
const button = `group ${control} min-h-14 px-7 text-lg hover:-translate-y-px active:translate-y-0`;
export const primary = `${button} bg-action text-white shadow-[0_0.6em_1.4em_-0.5em_rgb(122_27_179/0.6)] hover:bg-action-hover hover:shadow-lift`;
/** The one yellow button, on the dark CTA band. Yellow is a fill; the text stays dark. */
export const sunButton = `${button} bg-sun text-on-sun hover:bg-[#fdd05c] hover:shadow-[0_0.6em_1.4em_-0.5em_rgb(251_192_45/0.55)]`;
export const pill = `${control} min-h-11 bg-action px-5 text-white hover:bg-action-hover hover:shadow-lift`;
export const navLink = `${control} min-h-11 px-4 hover:bg-action/10 hover:text-lp-link`;
/** A text link that keeps its resting underline; hover only changes its colour and nudges the arrow. */
export const textLink = 'group inline-flex min-h-11 items-center gap-1.5 text-lg font-bold text-lp-link underline decoration-[0.08em] underline-offset-[0.25em] transition-colors duration-200 hover:text-lp-ink';
/** The arrow inside a control slides forward on hover. */
export const nudge = 'size-[1.1em] transition-transform duration-200 ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none';
