import type { ReactNode } from 'react';

// Screens from the iPhone app, drawn in HTML at phone scale. The words match the app's own strings
// (ios/CheckWithUs). Plain components with no hooks, so server and client components can both render them.

const ICONS = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M10 9v6M14 9v6',
  stop: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM8.5 12h7',
  tray: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'size-[1.25em]' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <circle cx="20" cy="44" r="9.5" fill="#FBC02D" />
      <path d="M18 63 L42 93" stroke="#FBC02D" strokeWidth="17" />
      <circle cx="18" cy="63" r="8.5" fill="#FBC02D" />
      <circle cx="78" cy="14" r="10.5" fill="#A62FEA" />
      <path d="M84 37 L52 81" stroke="#A62FEA" strokeWidth="21" />
      <circle cx="84" cy="37" r="10.5" fill="#A62FEA" />
    </svg>
  );
}

type PhoneProps = { label: string; children: ReactNode; className?: string };

/**
 * A 390 x 844 iPhone, sized in em: set the font size with `className` to scale it (1em = 16pt at 16px).
 * It is one image to assistive tech, described by `label`.
 */
export function Phone({ label, children, className = 'text-[10px]' }: PhoneProps) {
  return (
    <div role="img" aria-label={label} className={`relative h-[52.75em] w-[24.375em] shrink-0 rounded-[3.375em] bg-[#0d0b11] p-[0.7em] shadow-[0_0_0_0.14em_#2c2733,0_2.2em_4em_-1.6em_rgb(30_10_50/0.5)] ${className}`}>
      <div className="relative flex h-full flex-col gap-[1em] overflow-hidden rounded-[2.7em] bg-card px-[1.5em] pt-[4.6em] pb-[1.75em] text-left leading-[1.25] text-foreground [font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif]">
        <span className="absolute top-[0.7em] left-1/2 h-[2.3em] w-[7.8em] -translate-x-1/2 rounded-[1.2em] bg-black" />
        <span className="absolute top-[1.2em] left-[2.4em] text-[1.05em] font-semibold tabular-nums">9:41</span>
        {children}
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
const body = 'text-[1.375em] leading-[1.3]';

function Button({ alt = false, icon, children }: { alt?: boolean; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`flex min-h-[2.95em] shrink-0 items-center justify-center gap-[0.4em] rounded-[0.8em] text-[1.375em] font-bold ${alt ? 'bg-foreground/10' : 'bg-action text-white'}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

const Grow = () => <span className="flex-1" />;
const AskButton = () => <Button icon="phone">Ask my family</Button>;

export function AskScreen({ className }: { className?: string }) {
  return (
    <Phone className={className} label="Their iPhone: Pay $500 to Gift card store? You are on a phone call. We will ask your family first. Buttons: Yes, pay. No, go back.">
      <Disk tone="pause" icon="phone" />
      <p className={title}>Pay $500 to Gift card store?</p>
      <p className={body}>You are on a phone call. We will ask your family first.</p>
      <Grow />
      <Button>Yes, pay</Button>
      <Button alt>No, go back</Button>
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
      <p className={body}>{detail}</p>
      <p className="rounded-[1em] bg-foreground/6 px-[1em] py-[0.9em] text-[1.25em] leading-snug">
        <b className="block text-[1.4em] tabular-nums">{amount}</b>
        to {payee}
      </p>
      <Grow />
      {held ? <AskButton /> : <Button alt>OK</Button>}
    </Phone>
  );
}
