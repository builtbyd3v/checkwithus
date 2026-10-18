import type { ReactNode } from 'react';

// Screens from the iPhone apps, drawn in HTML at phone scale. The words match the apps' own strings
// (ios/CheckWithUs). Plain components with no hooks, so server and client components can both render them.

// One icon style: 24 grid, 2px stroke, round caps and joins.
const ICONS = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M10 9v6M14 9v6',
  stop: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM8.5 12h7',
  tray: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  faceid: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'size-[1.25em]' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

// The logo is two people who make a check mark: yellow is the older adult, purple is the family.
const PARENT = (
  <g fill="#FBC02D">
    <circle cx="20" cy="44" r="9.5" />
    <path d="M18 63 L42 93" stroke="#FBC02D" strokeWidth="17" />
    <circle cx="18" cy="63" r="8.5" />
  </g>
);
const FAMILY = (
  <g fill="#A62FEA">
    <circle cx="78" cy="14" r="10.5" />
    <path d="M84 37 L52 81" stroke="#A62FEA" strokeWidth="21" />
    <circle cx="84" cy="37" r="10.5" />
  </g>
);

export function Logo({ className }: { className?: string }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>{PARENT}{FAMILY}</svg>;
}

/** One half of the logo, used to mark a lane: the parent's side or the family's side. */
export function Person({ who, className }: { who: 'parent' | 'family'; className?: string }) {
  return (
    <svg viewBox={who === 'parent' ? '6 30 48 72' : '38 0 62 94'} aria-hidden="true" className={className}>
      {who === 'parent' ? PARENT : FAMILY}
    </svg>
  );
}

function StatusBar() {
  return (
    <span className="absolute inset-x-[2.4em] top-[1.15em] flex items-center justify-between">
      <span className="text-[1.05em] font-semibold tabular-nums">9:41</span>
      <svg viewBox="0 0 44 12" aria-hidden="true" className="h-[0.85em] w-[3.2em] fill-current">
        <rect x="0" y="8" width="3" height="4" rx="1" />
        <rect x="4.5" y="6" width="3" height="6" rx="1" />
        <rect x="9" y="3.5" width="3" height="8.5" rx="1" />
        <rect x="13.5" y="1" width="3" height="11" rx="1" />
        <rect x="21.5" y="1" width="18" height="10" rx="3" fill="none" stroke="currentColor" opacity="0.4" />
        <rect x="23.5" y="3" width="12" height="6" rx="1.5" />
        <rect x="40.5" y="4" width="1.6" height="4" rx="0.8" opacity="0.4" />
      </svg>
    </span>
  );
}

const sideButton = 'absolute w-[0.3em] bg-[#38333d]';

type PhoneProps = { label: string; children: ReactNode; className?: string };

/**
 * A 390 x 844 iPhone, sized in em: set the font size with `className` to scale it (1em = 16pt at 16px).
 * It is one image to assistive tech, described by `label`.
 */
export function Phone({ label, children, className = 'text-[10px]' }: PhoneProps) {
  return (
    <div data-ui role="img" aria-label={label} className={`relative h-[52.75em] w-[24.375em] shrink-0 rounded-[3.6em] bg-[#38333d] p-[0.3em] shadow-object ${className}`}>
      <span className={`${sideButton} top-[9em] -left-[0.22em] h-[2.6em] rounded-l-[0.2em]`} />
      <span className={`${sideButton} top-[13.4em] -left-[0.22em] h-[5em] rounded-l-[0.2em]`} />
      <span className={`${sideButton} top-[19.4em] -left-[0.22em] h-[5em] rounded-l-[0.2em]`} />
      <span className={`${sideButton} top-[15em] -right-[0.22em] h-[8em] rounded-r-[0.2em]`} />
      <div className="h-full rounded-[3.3em] bg-[#0b0a0d] p-[0.55em]">
        <div className="relative flex h-full flex-col gap-[1em] overflow-hidden rounded-[2.75em] bg-card px-[1.5em] pt-[4.6em] pb-[2.2em] text-left leading-[1.25] text-foreground [font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif]">
          <span className="absolute top-[0.75em] left-1/2 h-[2.3em] w-[7.8em] -translate-x-1/2 rounded-full bg-black" />
          <StatusBar />
          {children}
          <span className="absolute bottom-[0.6em] left-1/2 h-[0.35em] w-[8.5em] -translate-x-1/2 rounded-full bg-foreground/80" />
        </div>
      </div>
    </div>
  );
}

const TONES = {
  safe: 'bg-safe-field text-safe',
  pause: 'bg-pause-field text-pause',
  stop: 'bg-stop-field text-stop',
} as const;

function Disk({ tone, icon }: { tone: keyof typeof TONES; icon: IconName }) {
  return (
    <span className={`mt-[1em] grid size-[4.6em] shrink-0 place-items-center rounded-full ${TONES[tone]}`}>
      <Icon name={icon} className="size-[2.4em]" />
    </span>
  );
}

const title = 'text-[2.125em] leading-[1.08] font-extrabold tracking-[-0.01em]';
const text = 'text-[1.375em] leading-[1.3]';

function Button({ alt = false, icon, children }: { alt?: boolean; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`flex min-h-[2.95em] shrink-0 items-center justify-center gap-[0.4em] rounded-[0.8em] text-[1.375em] font-bold ${alt ? 'bg-foreground/10' : 'bg-action text-white'}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

const Grow = () => <span className="flex-1" />;

export function AskScreen({ className }: { className?: string }) {
  return (
    <Phone className={className} label="Their iPhone: Pay $500 to Gift card store? You are on a phone call. We will ask your family first. Buttons: Yes, pay. No, go back.">
      <Disk tone="pause" icon="phone" />
      <p className={title}>Pay $500 to Gift card store?</p>
      <p className={text}>You are on a phone call. We will ask your family first.</p>
      <Grow />
      <Button>Yes, pay</Button>
      <Button alt>No, go back</Button>
    </Phone>
  );
}

/** The family app's approval screen. `reasons` are the rules' own labels. */
export function ApproveScreen({ reasons, className }: { reasons: readonly string[]; className?: string }) {
  return (
    <Phone className={className} label={`Your iPhone: Approve $500.00 to Gift card store? Reasons: ${reasons.join('. ')}. No answer means no payment. Buttons: Deny, Approve.`}>
      <p className="mt-[0.4em] text-[1.25em] font-semibold text-muted">Approvals</p>
      <p className={title}>Approve <span className="tabular-nums">$500.00</span> to Gift card store?</p>
      <p className="text-[1.25em] text-muted">From your parent, <span className="tabular-nums">2:14 PM</span></p>
      <ul className="grid gap-[0.5em]">
        {reasons.map((r) => (
          <li key={r} className="flex items-center gap-[0.5em] rounded-[0.8em] bg-pause-field px-[0.8em] py-[0.55em] text-[1.25em] leading-tight font-semibold">
            <Icon name="pause" className="size-[1.2em] text-pause" />
            {r}
          </li>
        ))}
      </ul>
      <Grow />
      <p className="text-center text-[1.2em] text-muted">No answer means no payment.</p>
      <span className="grid grid-cols-2 gap-[0.6em]">
        <Button alt>Deny</Button>
        <Button icon="faceid">Approve</Button>
      </span>
    </Phone>
  );
}

type PaymentScreenProps = { held: boolean; amount: string; payee: string; className?: string };

/** Their screen right after a payment in the "Try a payment" widget: paused for the family, or paid. */
export function PaymentScreen({ held, amount, payee, className }: PaymentScreenProps) {
  const head = held ? 'Paused, waiting for family' : 'Paid';
  const detail = held ? 'Your money is safe. Your family will call you.' : 'Sent. It did not need an OK.';
  return (
    <Phone className={className} label={`Their iPhone: ${head}. ${detail} ${amount} to ${payee}.`}>
      <Disk tone={held ? 'pause' : 'safe'} icon={held ? 'pause' : 'check'} />
      <p className={title}>{head}</p>
      <p className={text}>{detail}</p>
      <p className="rounded-[1em] bg-foreground/6 px-[1em] py-[0.9em] text-[1.25em] leading-snug">
        <b className="block text-[1.4em] tabular-nums">{amount}</b>
        to {payee}
      </p>
      <Grow />
      {held ? <Button icon="phone">Ask my family</Button> : <Button alt>OK</Button>}
    </Phone>
  );
}
