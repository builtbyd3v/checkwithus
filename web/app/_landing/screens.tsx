import type { ReactNode } from 'react';
import { HOLD_REASON_LABELS, type HoldReason } from '@/lib/rules';

// Screens from the iPhone apps, drawn in HTML at phone scale. The words match the apps' own strings
// (ios/CheckWithUs). Plain components with no hooks, so server and client components can both render them.

// One icon style: 24 grid, 2px stroke, round caps and joins.
const ICONS = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM8.5 12l2.5 2.5 4.5-5',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M10 9v6M14 9v6',
  stop: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM8.5 12h7',
  tray: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  faceid: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0',
  gift: 'M4.5 8h15A1.5 1.5 0 0 1 21 9.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-10A1.5 1.5 0 0 1 4.5 8M3 12h18M12 8v13M12 8c-2-4-6-4-5.5-1.5S12 8 12 8s5-.5 5.5-1.5S14 4 12 8',
  payee: 'M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M19 8v6M16 11h6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  freeze: 'M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 4l3 2 3-2M9 20l3-2 3 2',
  bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  chip: 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
  cloudoff: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18zM4 4l16 16',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'size-[1.25em]' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

function StatusBar() {
  return (
    <span className="absolute inset-x-[2.4em] top-[1.2em] flex items-center justify-between text-[1.05em] font-semibold">
      <span className="tabular-nums">9:41</span>
      <span className="h-[0.78em] w-[1.6em] rounded-[0.24em] border-[0.1em] border-current shadow-[inset_0_0_0_0.1em_var(--lp-screen),inset_1.1em_0_0_currentColor]" />
    </span>
  );
}

type PhoneProps = { label: string; children: ReactNode; className?: string };

/**
 * A 390 x 844 iPhone, sized in em: set the font size with `className` to scale it (1em = 16pt at 16px).
 * It is one image to assistive tech, described by `label`.
 */
export function Phone({ label, children, className = 'text-[10px]' }: PhoneProps) {
  return (
    <div data-ui role="img" aria-label={label} className={`h-[52.75em] w-[24.375em] shrink-0 rounded-[3.375em] bg-[#0d0b11] p-[0.7em] shadow-[0_0_0_0.14em_#2c2733,0_2.2em_4em_-1.6em_rgb(30_10_50/0.5)] ${className}`}>
      <div className="relative flex h-full flex-col gap-[1em] overflow-hidden rounded-[2.7em] bg-lp-screen px-[1.5em] pt-[4.6em] pb-[1.75em] text-left leading-[1.25] text-lp-ink">
        <span className="absolute top-[0.7em] left-1/2 h-[2.3em] w-[7.8em] -translate-x-1/2 rounded-full bg-black" />
        <StatusBar />
        {children}
      </div>
    </div>
  );
}

const TONES = {
  safe: 'bg-lp-ok-field text-lp-ok',
  pause: 'bg-pause-field text-pause',
  stop: 'bg-stop-field text-stop',
} as const;

function Disk({ tone, icon }: { tone: keyof typeof TONES; icon: IconName }) {
  return (
    <span className={`mt-[1em] grid size-[4.6em] shrink-0 place-items-center rounded-full ${TONES[tone]}`}>
      <Icon name={icon} className="size-[2.4em] [stroke-width:2.2]" />
    </span>
  );
}

const title = 'text-[2.125em] leading-[1.08] font-extrabold tracking-[-0.01em]';
const heading = 'text-[1.6em] leading-[1.15] font-extrabold';
const text = 'text-[1.375em] leading-[1.3]';
const small = 'text-[1em] text-lp-ink/70';
const rows = 'divide-y divide-lp-ink/12 border-t border-lp-ink/12 [&>li]:flex [&>li]:items-center [&>li]:gap-[0.6em] [&>li]:py-[0.75em] [&>li]:text-[1.1em]';

function Button({ alt = false, icon, children }: { alt?: boolean; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`flex min-h-[2.95em] shrink-0 items-center justify-center gap-[0.4em] rounded-[0.8em] text-[1.375em] font-bold ${alt ? 'bg-lp-ink/10' : 'bg-action text-white'}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

const Grow = () => <span className="flex-1" />;

/** Their home screen on a quiet day. */
export function SafeScreen({ className }: { className?: string }) {
  return (
    <Phone className={className} label="Their iPhone: You're safe. Your family is looking out for you. Buttons: Pay a bill, Ask my family.">
      <Disk tone="safe" icon="shield" />
      <p className={title}>You&rsquo;re safe</p>
      <p className={text}>Your family is looking out for you.</p>
      <Grow />
      <Button alt>Pay a bill</Button>
      <Button icon="phone">Ask my family</Button>
    </Phone>
  );
}

const PAID = [['City Power & Light', '$86.00'], ['Sunrise Grocery', '$42.17'], ['Neighborhood Pharmacy', '$18.40']] as const;
const TABS = ['Approvals', 'Alerts', 'Money', 'Allowances', 'Settings'];

/** The family app's Approvals tab with nothing waiting. Sam is demo data. */
export function NothingWaitingScreen({ className }: { className?: string }) {
  return (
    <Phone className={className} label="The family's iPhone: Approvals. Nothing is waiting. Paid today: City Power and Light $86.00, Sunrise Grocery $42.17, Neighborhood Pharmacy $18.40.">
      <p className={heading}>Approvals</p>
      <p className={`flex items-center gap-[0.6em] rounded-[1em] p-[1em] text-[1.1em] font-bold ${TONES.safe}`}><Icon name="shield" />Nothing is waiting. Sam is safe.</p>
      <p className={small}>Paid today</p>
      <ul className={`${rows} tabular-nums`}>
        {PAID.map(([payee, amount]) => <li key={payee}>{payee}<b className="ml-auto">{amount}</b></li>)}
      </ul>
      <Grow />
      <span className="-mx-[1.5em] -mb-[1.75em] flex justify-around border-t border-lp-ink/12 px-[0.4em] pt-[0.9em] pb-[1.7em] text-[0.85em] font-semibold text-lp-ink/70">
        {TABS.map((t, i) => <span key={t} className={i === 0 ? 'text-action dark:text-lp-link' : ''}>{t}</span>)}
      </span>
    </Phone>
  );
}

/** Their screen right after a risky payment. */
export function PausedScreen({ className }: { className?: string }) {
  return (
    <Phone className={className} label="Their iPhone: Paused, waiting for family. Your money is safe. Your family will call you. Button: OK.">
      <Disk tone="pause" icon="pause" />
      <p className={title}>Paused, waiting for family</p>
      <p className={text}>Your money is safe. Your family will call you.</p>
      <Grow />
      <Button>OK</Button>
    </Phone>
  );
}

const REASON_ICONS: Partial<Record<HoldReason, IconName>> = { gift_card: 'gift', during_call: 'phone', new_payee: 'payee', over_limit: 'trend' };

/** The family app's approval screen. `reasons` are the rules' own reasons, shown with their real labels. */
export function ApproveScreen({ reasons, className }: { reasons: readonly HoldReason[]; className?: string }) {
  const labels = reasons.map((r) => HOLD_REASON_LABELS[r]);
  return (
    <Phone className={className} label={`The family's iPhone: Approve $500.00 to Gift card store? Reasons: ${labels.join('. ')}. No answer means no payment. Buttons: Deny, Approve.`}>
      <p className={small}>Approvals</p>
      <p className={heading}>Approve <span className="tabular-nums">$500.00</span> to Gift card store?</p>
      <p className={small}>Sam, today at <span className="tabular-nums">2:14 PM</span></p>
      <ul className={rows}>
        {reasons.map((r, i) => <li key={r}><Icon name={REASON_ICONS[r] ?? 'pause'} />{labels[i]}</li>)}
      </ul>
      <Grow />
      <p className={small}>Answer by <span className="tabular-nums">2:44 PM</span>. No answer means no payment.</p>
      <span className="grid grid-cols-2 gap-[0.6em] [&>span]:text-[1.2em]">
        <Button alt>Deny</Button>
        <Button icon="faceid">Approve</Button>
      </span>
    </Phone>
  );
}
