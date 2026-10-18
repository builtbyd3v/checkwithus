// The landing page's one system: type scale, grid, rhythm and control states. Every section uses these.

/** One grid: a 90rem measure with the same gutters everywhere. */
export const wrap = 'mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-16';
/** Space between sections is always larger than any space inside one. */
export const band = 'py-24 sm:py-32 lg:py-40';

// Type: five sizes. The eye chart adds its own descending steps on purpose.
export const display = 'text-[clamp(2.25rem,0.75rem+6.4vw,6.5rem)] leading-[0.94] font-extrabold tracking-[-0.04em] text-balance';
export const h2 = 'text-[clamp(2.25rem,1.2rem+4.2vw,5rem)] leading-[0.96] font-extrabold tracking-[-0.035em] text-balance';
export const h3 = 'text-[clamp(1.5rem,1.25rem+1vw,2.125rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance';
export const lead = 'text-[clamp(1.25rem,1.05rem+0.8vw,1.75rem)] leading-[1.4] text-pretty';
export const body = 'text-[1.1875rem] leading-[1.5] sm:text-xl text-pretty';

// Radius scale: rounded-paper (the check), rounded-2xl (chips that can wrap), rounded-panel (fields),
// rounded-full (every control). Elevation: shadow-object for physical things (check, phones), shadow-lift
// for a hovered primary control, nothing else. Tokens live in globals.css.

// Controls. No underlines: tint, lift, press and an arrow that nudges. One ease, 100 to 220 ms.
const control =
  'inline-flex items-center justify-center gap-3 rounded-full font-bold whitespace-nowrap transition-[background-color,color,translate,scale,box-shadow] duration-200 ease-out-soft active:scale-[0.97] active:duration-100 motion-reduce:transition-colors';
export const primary = `group ${control} min-h-16 bg-action px-6 text-lg text-white sm:px-8 sm:text-[1.3125rem] hover:-translate-y-px hover:bg-action-hover hover:shadow-lift active:translate-y-0 active:shadow-none`;
export const secondary = `group ${control} min-h-16 bg-action/10 px-6 text-lg text-link sm:px-8 sm:text-[1.3125rem] hover:-translate-y-px hover:bg-action/16`;
export const navLink = `${control} min-h-12 px-4 text-lg text-foreground hover:bg-action/10 hover:text-link`;
/** The arrow inside a primary or secondary control slides forward on hover. */
export const nudge = 'size-[1.1em] transition-transform duration-200 ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none';
