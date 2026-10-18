import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { HoldReason } from '@/lib/rules';
import { Reveal } from './_landing/reveal';
import { Tryout } from './_landing/tryout';
import { ApproveScreen, Icon, NothingWaitingScreen, PausedScreen, SafeScreen, type IconName } from './_landing/screens';
import { card, display, h3, navLink, nudge, pill, primary, split, sunButton, textLink } from './_landing/ui';

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'An iPhone app for older adults. It hides scam texts, labels scam calls and pauses risky payments until someone in the family says yes.',
};

// Auth0 redirects need a full page load, so these are plain <a> tags, not next/link.
const DASHBOARD = '/dashboard';
const GITHUB = 'https://github.com/builtbyd3v/checkwith.us';

// What the real rules give a $500 gift card at a new store, paid during a call, in the order the family sees them.
const REASONS: HoldReason[] = ['gift_card', 'new_payee', 'over_limit', 'during_call'];

/** The original app icon as a rounded tile. Decorative wherever it sits next to the name. */
function AppIcon({ className }: { className: string }) {
  return <Image src="/app-icon.png" alt="" width={256} height={256} className={`block shrink-0 rounded-[22.5%] bg-white object-cover dark:ring-1 dark:ring-white/15 ${className}`} />;
}

function Wordmark() {
  return (
    <Link href="/" className="-ml-2 flex min-h-11 items-center gap-2.5 rounded-full px-2 transition-opacity duration-200 hover:opacity-75">
      <AppIcon className="size-10" />
      <span className="font-heading text-2xl leading-none font-extrabold tracking-[-0.02em]">checkwith.us</span>
    </Link>
  );
}

const CHIP = { ok: 'bg-lp-ok-field text-lp-ok', wait: 'bg-pause-field text-pause' } as const;

function Chip({ tone, icon, children }: { tone: keyof typeof CHIP; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pr-3.5 text-[0.95rem] leading-tight font-bold ${CHIP[tone]} ${icon ? 'pl-2.5' : 'pl-3.5'}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

const say = 'max-w-[13em] font-heading text-[clamp(1.5rem,1.2rem+0.9vw,1.9rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance';
const quiet = 'max-w-[21em] text-[1.15em] text-lp-soft text-pretty';
const keyPhone = 'text-[8.5px] sm:text-[10px]';

type Row = { time: string; them: ReactNode; you: ReactNode; pause?: true };

const DAY: Row[] = [
  {
    time: '2:02 PM',
    them: (
      <>
        <p className="max-w-[24rem] rounded-[1.3em_1.3em_0.3em_1.3em] bg-lp-card px-5 py-4 text-left shadow-[0_0.15em_0.5em_rgb(28_20_38/0.08)]">
          <b className="mb-0.5 block text-[0.85em] text-lp-soft">Unknown sender</b>
          Your package is on hold. Pay the $1.99 fee today at usps-redelivery.co
        </p>
        <Chip tone="ok" icon="tray">Moved to Spam on their phone</Chip>
      </>
    ),
    you: <p className={quiet}>Nothing reaches the family. Their texts never leave their phone.</p>,
  },
  {
    time: '2:09 PM',
    them: (
      <p className="grid w-[21rem] max-w-full gap-0.5 rounded-[1.4rem] bg-[#1e1b24] px-5 py-4 text-left text-white">
        <span className="text-[0.9em] text-[#d9d3e0]">Incoming call</span>
        <b className="text-2xl leading-tight">Possible scam</b>
        <span className="text-[0.9em] text-[#d9d3e0] tabular-nums">+1 (202) 555-0147</span>
      </p>
    ),
    you: <p className={quiet}>They answer anyway. Scammers are persuasive.</p>,
  },
  {
    time: '2:14 PM',
    pause: true,
    them: (
      <>
        <p className={say}>They buy a <span className="tabular-nums">$500</span> gift card while on the call.</p>
        <PausedScreen className={keyPhone} />
      </>
    ),
    you: (
      <>
        <p className={say}>The family gets the hard part.</p>
        <ApproveScreen reasons={REASONS} className={keyPhone} />
      </>
    ),
  },
  {
    time: '2:15 PM',
    them: (
      <p className="flex w-[25rem] max-w-full items-center gap-3.5 rounded-[1.6rem] bg-[#24212b] px-5 py-4 text-left text-white">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-stop-field text-stop"><Icon name="stop" /></span>
        <span>
          <b className="block text-[1.2em] leading-tight">Stopped. Your family said no.</b>
          <span className="text-[0.9em] text-[#d9d3e0]">checkwith.us, now</span>
        </span>
      </p>
    ),
    you: (
      <>
        <p className={quiet}>The family said no. Their screen already shows it.</p>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-bold text-lp-link ring-2 ring-action ring-inset"><Icon name="phone" />Call Sam</span>
      </>
    ),
  },
];

function LaneLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-bold tracking-wide text-lp-soft uppercase lg:hidden">{children}</span>;
}

const b2 = 'flex min-h-11 items-center justify-center gap-1.5 rounded-xl font-bold';
const sub = 'text-[0.9em] text-lp-soft';
const line = 'flex items-center justify-between gap-4';

// Weekly gift card spend, last 12 weeks: flat, then the spike. Heights out of 70.
const WEEKS = [12, 10, 14, 11, 13, 9, 12, 14, 10, 13, 11];

const CONTROLS = [
  {
    title: 'Say yes or no.',
    body: 'Approve with Face ID. Over $1,000, two people must say yes, and one no stops it.',
    ui: (
      <>
        <div className={line}><b>Wire to a new payee</b><b className="tabular-nums">$1,500.00</b></div>
        <span className={sub}>Lee said yes. One more answer needed.</span>
        <div className="grid grid-cols-2 gap-2.5">
          <span className={`${b2} bg-lp-ink/8`}>Deny</span>
          <span className={`${b2} bg-action text-white`}><Icon name="faceid" />Approve</span>
        </div>
      </>
    ),
  },
  {
    title: 'Freeze money now.',
    body: 'One tap moves their spending money into a safe account. Nothing leaves until you unfreeze.',
    ui: (
      <>
        <span><Chip tone="ok" icon="freeze">Frozen. Money is in the safe account.</Chip></span>
        <div className="grid grid-cols-2 gap-2.5 tabular-nums">
          {[['Spending', '$0.00'], ['Safe account', '$1,240.00']].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-lp-ink/5 px-3.5 py-2.5"><span className={`block ${sub}`}>{k}</span><b className="text-xl">{v}</b></div>
          ))}
        </div>
      </>
    ),
  },
  {
    title: 'Allow the routine bills.',
    body: 'Inside an allowance, nothing pauses and nobody gets a push.',
    ui: (
      <>
        <b>Utilities up to $400 until Nov 30</b>
        <div className={`${line} tabular-nums`}><span>City Power &amp; Light, $86.00</span><Chip tone="ok" icon="check">Paid</Chip></div>
      </>
    ),
  },
  {
    title: 'See what is unusual.',
    body: 'Every category is compared with their usual spending over 90 days.',
    ui: (
      <>
        <div className={line}><b>Gift cards</b><Chip tone="wait">About 8x their usual</Chip></div>
        <svg viewBox="0 0 240 70" preserveAspectRatio="none" aria-hidden="true" className="h-[5.5em] w-full">
          <g className="fill-lp-ink/20">
            {WEEKS.map((h, i) => <rect key={i} x={2 + i * 20} y={70 - h} width="14" height={h} />)}
          </g>
          <rect x="222" y="2" width="16" height="68" className="fill-action" />
          <path d="M0 58H240" className="fill-none stroke-lp-ink [stroke-dasharray:4_4]" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={sub}>Weekly spend, last 12 weeks. Dashed line: their usual.</span>
      </>
    ),
  },
  {
    title: 'Hear about the bank visit.',
    body: 'Scammers keep people on the phone while they take out cash.',
    ui: (
      <>
        <span className="flex items-center gap-2"><Icon name="bank" /><b>Sam is at a bank during a phone call.</b></span>
        <span className={sub}>Alert, <span className="tabular-nums">1:48 PM</span></span>
      </>
    ),
  },
];

const TECH = [
  ['Capital One Nessie', 'Their bank: accounts, bills, purchases and the Freeze transfer.'],
  ['Auth0', 'Who can say yes: roles, PKCE sign-in, two approvers over $1,000.'],
  ['Tiger Data', 'Their usual spending, answered in about a millisecond while the payment waits.'],
  ['On-device model', 'A 1 MB scam check inside the iOS Message Filter.'],
  ['GoDaddy Registry', 'The name is the promise: check with us.'],
] as const;

const heroText = `${display} text-[clamp(2.75rem,0.9rem+3.7vw,4.25rem)]`;
const heroPhone = 'text-[8.5px] sm:text-[10px] lg:text-[11px]';
const who = 'flex items-center gap-2 px-4 py-5 font-bold text-lp-soft sm:px-8 lg:px-[10%] lg:py-7';
const h2 = `${display} text-[clamp(2rem,1rem+3.2vw,3.75rem)]`;
const pad = 'px-4 sm:px-8';

export default function Home() {
  return (
    <div className="lp flex-1 bg-lp-bg text-[1.0625rem] leading-normal text-lp-ink selection:bg-sun selection:text-on-sun lg:text-lg">
      <Reveal />
      <a href="#main" className="sr-only z-10 rounded-full bg-lp-ink px-5 py-3 font-bold text-lp-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      <header className={`bg-lane-them ${split}`}>
        <nav aria-label="Main" className={`flex h-20 items-center justify-between gap-4 ${pad} lg:grid lg:h-24 lg:grid-cols-2 lg:px-0 lg:*:px-16`}>
          <div><Wordmark /></div>
          <div className="flex items-center justify-end gap-1 font-semibold">
            <a href="#how" className={`max-md:hidden ${navLink}`}>How it works</a>
            <a href="#privacy" className={`max-md:hidden ${navLink}`}>Privacy</a>
            <a href={DASHBOARD} className={`ml-2 ${pill}`}><span className="max-sm:hidden">Family sign in</span><span className="sm:hidden">Sign in</span></a>
          </div>
        </nav>

        {/* Two lanes. On a phone they stack: their lane, the icon at the seam, then the family's lane. */}
        <div className="relative grid lg:grid-cols-2 lg:pb-20">
          <h1 className="contents">
            <span className={`order-1 bg-lane-them ${pad} pt-6 lg:order-none lg:px-[10%] lg:pt-10 motion-safe:animate-rise ${heroText}`}>Your loved one does nothing new.</span>
            <span className={`order-5 bg-lane-family ${pad} pt-20 lg:order-none lg:px-[10%] lg:pt-10 motion-safe:animate-rise motion-safe:[animation-delay:120ms] ${heroText}`}>Their family does the work.</span>
          </h1>
          <p className={`order-2 bg-lane-them lg:order-none ${who}`}><Icon name="phone" />On their iPhone</p>
          <p className={`order-6 bg-lane-family lg:order-none ${who}`}><Icon name="shield" />On the family&rsquo;s iPhone</p>
          <div className="order-3 flex justify-center bg-lane-them pb-20 lg:order-none lg:pb-0 motion-safe:animate-rise motion-safe:[animation-delay:200ms]"><SafeScreen className={heroPhone} /></div>
          <div className="order-7 flex justify-center bg-lane-family pb-16 lg:order-none lg:pb-0 motion-safe:animate-rise motion-safe:[animation-delay:280ms]"><NothingWaitingScreen className={heroPhone} /></div>
          <div className="relative z-10 order-4 -my-12 justify-self-center lg:absolute lg:bottom-[18.5rem] lg:left-1/2 lg:my-0 lg:-translate-x-1/2 motion-safe:animate-rise motion-safe:[animation-delay:400ms]">
            <AppIcon className="size-24 shadow-[0_16px_40px_-16px_rgb(60_20_90/0.35)] lg:size-36" />
          </div>
        </div>
      </header>

      <main id="main">
        <section aria-label="What it is" className={`mx-auto max-w-[60rem] ${pad} py-20 text-center lg:py-28`}>
          <p className="text-[clamp(1.375rem,1.05rem+1.1vw,1.9rem)] leading-[1.35] text-pretty">
            checkwith.us is an iPhone app for an older parent. It hides scam texts, labels scam calls, and pauses risky payments until someone in the family says yes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            <a href={DASHBOARD} className={primary}>Open the family dashboard</a>
            <a href="#pause" className={textLink}>See a payment pause <Icon name="arrow" className={nudge} /></a>
          </div>
        </section>

        <section id="how" aria-labelledby="day-heading" className={`scroll-mt-4 py-20 lg:pt-28 lg:pb-24 ${split}`}>
          <div className={`${pad} mb-12 text-center lg:mb-14 lg:px-32`}>
            <h2 id="day-heading" data-reveal className={h2}>One Tuesday afternoon, from both sides</h2>
            <p data-reveal className="mt-3 text-xl text-lp-soft delay-75">Each row is the same minute. Yellow is their phone. Lilac is the family&rsquo;s.</p>
          </div>
          {/* The seam between the lanes is the timeline. Rows are positioned so their fields paint over it. */}
          <ol className={`relative grid grid-cols-[minmax(0,1fr)] gap-6 ${pad} lg:gap-0 lg:px-0 lg:before:absolute lg:before:inset-y-0 lg:before:left-1/2 lg:before:-ml-px lg:before:w-0.5 lg:before:bg-lp-line`}>
            {DAY.map((r) => (
              <li
                key={r.time}
                id={r.pause ? 'pause' : undefined}
                data-reveal
                className={`relative grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] lg:items-center lg:gap-0 ${r.pause ? 'scroll-mt-8 lg:bg-[linear-gradient(90deg,transparent_4%,var(--lp-key-them)_4%_50%,var(--lp-key-family)_50%_96%,transparent_96%)] lg:py-12' : 'lg:py-9'}`}
              >
                <span className={`justify-self-start rounded-full border-2 px-3.5 py-1 text-[0.95rem] font-bold whitespace-nowrap tabular-nums lg:order-2 lg:justify-self-center ${r.pause ? 'border-action bg-action text-white' : 'border-lp-line bg-lp-bg'}`}>
                  <span className="sr-only">At </span>{r.time}
                </span>
                <div className="flex flex-col items-start gap-4 rounded-3xl bg-lane-them p-6 lg:order-1 lg:items-end lg:rounded-none lg:bg-transparent lg:p-0 lg:pl-16 lg:text-right">
                  <LaneLabel>Their phone</LaneLabel>
                  {r.them}
                </div>
                <div className="flex flex-col items-start gap-4 rounded-3xl bg-lane-family p-6 lg:order-3 lg:rounded-none lg:bg-transparent lg:p-0 lg:pr-16">
                  <LaneLabel>The family&rsquo;s phone</LaneLabel>
                  {r.you}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Tryout />

        <section aria-label="Controls" className="grid lg:grid-cols-[minmax(0,30rem)_1fr]">
          <div className={`bg-lane-them ${pad} py-20 lg:px-14 lg:py-28`}>
            <h2 data-reveal className={`${display} text-[clamp(2rem,1.2rem+2.4vw,3.25rem)]`}>Their side stays this simple.</h2>
            <p data-reveal className="mt-4 text-xl text-lp-soft delay-75">One big button, for when something feels wrong. That is the whole job.</p>
            <span data-reveal className="mt-7 flex min-h-[4.5rem] items-center justify-center gap-2 rounded-xl bg-action text-[1.6rem] font-extrabold text-white delay-150">
              <Icon name="phone" />Ask my family
            </span>
          </div>
          <div className={`bg-lane-family ${pad} py-20 lg:px-16 lg:py-28`}>
            <h2 data-reveal className={`${display} text-[clamp(2rem,1.2rem+2.4vw,3.25rem)]`}>Everything else is on the family side.</h2>
            <ul className="mt-10">
              {CONTROLS.map((c) => (
                <li key={c.title} data-reveal className="grid gap-5 border-t border-lp-line py-7 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-center xl:gap-10">
                  <div>
                    <h3 className={h3}>{c.title}</h3>
                    <p className="mt-1.5 max-w-[26em] text-lp-soft">{c.body}</p>
                  </div>
                  <div className={card}>{c.ui}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="privacy" aria-label="Privacy" className="grid scroll-mt-4 lg:grid-cols-2">
          <div className={`bg-lane-them ${pad} py-20 lg:px-20 lg:py-32`}>
            <h2 data-reveal className={`max-w-[8em] ${display} text-[clamp(2.5rem,1rem+4vw,4.75rem)]`}>Scam checks stay on their phone.</h2>
            <p data-reveal className="mt-5 max-w-[24em] text-xl delay-75">A 1 MB model inside their iPhone reads texts from unknown senders. It decides on the phone and keeps the text to itself.</p>
            <div data-reveal className="mt-9 delay-150">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                <span className="inline-flex items-center gap-2 rounded-xl bg-lp-card px-4 py-2.5"><Icon name="tray" />Text arrives</span>
                <Icon name="arrow" />
                <span className="inline-flex items-center gap-2 rounded-xl bg-lp-card px-4 py-2.5"><Icon name="chip" />Checked on their iPhone</span>
                <Icon name="arrow" />
                <span className="inline-flex items-center gap-2 rounded-xl bg-lp-card px-4 py-2.5">Spam</span>
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-2.5 font-bold text-lp-soft">
                Never sent to
                <s className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 ring-2 ring-lp-line ring-inset"><Icon name="cloudoff" />a cloud AI</s>
              </p>
            </div>
          </div>
          <div className={`bg-lane-family ${pad} py-20 lg:px-20 lg:py-32`}>
            <div data-reveal>
              <h3 className={h3}>What the family sees</h3>
              <ul className="mt-3 text-xl">
                {['The amount and the payee', 'Every reason, in plain words'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 border-t border-lp-line py-2.5"><Icon name="check" className="size-[1.25em] text-lp-ok" />{t}</li>
                ))}
              </ul>
              <h3 className={`mt-10 ${h3}`}>What the family never sees</h3>
              <ul className="mt-3 text-xl">
                {['Their texts', 'Who they talk to'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 border-t border-lp-line py-2.5"><Icon name="x" className="size-[1.25em] text-stop" />{t}</li>
                ))}
              </ul>
            </div>
            <p data-reveal className="mt-10 font-heading text-[1.6rem] leading-[1.2] font-extrabold text-lp-link text-balance delay-75">AI suggests. Code decides money. No model can approve a payment.</p>
          </div>
        </section>

        <section aria-labelledby="tech-heading" className={`${pad} py-20 lg:px-16 lg:py-24`}>
          <h2 id="tech-heading" data-reveal className={`text-center ${display} text-[clamp(1.875rem,1.2rem+1.8vw,2.625rem)]`}>What runs underneath</h2>
          <ul className="mx-auto mt-10 grid max-w-[90rem] gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-5 lg:gap-0">
            {TECH.map(([name, body]) => (
              <li key={name} data-reveal className="border-t border-lp-line pt-5 lg:border-t-0 lg:border-l lg:px-6 lg:pt-0 lg:first:border-l-0">
                <b className="block font-heading text-[1.3rem] leading-[1.2] font-extrabold">{name}</b>
                <span className="mt-2 block text-lp-soft">{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cta-heading" className={`bg-lp-cta ${pad} py-24 text-center text-white lg:py-32`}>
          <div data-reveal>
            <AppIcon className="mx-auto mb-7 size-28" />
            <h2 id="cta-heading" className={`${display} text-[clamp(2.5rem,1rem+4.4vw,5.25rem)]`}>Be the one they check with.</h2>
            <p className="mx-auto mt-5 max-w-[30em] text-xl text-[#e4dcec]">Sign in to see paused payments, approve or deny them, freeze money and set allowances.</p>
            <a href={DASHBOARD} className={`mt-9 ${sunButton}`}>Open the family dashboard <Icon name="arrow" className={nudge} /></a>
          </div>
        </section>
      </main>

      <footer className={`grid items-center gap-x-8 gap-y-5 ${pad} pt-10 pb-9 text-lp-soft lg:grid-cols-[auto_1fr_auto] lg:px-16`}>
        <div className="text-lp-ink"><Wordmark /></div>
        <nav aria-label="Footer" className="-mx-4 flex flex-wrap font-semibold text-lp-ink lg:mx-0 lg:justify-center">
          <a href="#how" className={navLink}>How it works</a>
          <a href="#privacy" className={navLink}>Privacy</a>
          <a href={GITHUB} className={navLink}>GitHub</a>
          <a href={DASHBOARD} className={navLink}>Family sign in</a>
        </nav>
        <span>2026. Built at SwampHacks.</span>
        <p className="border-t border-lp-line pt-5 lg:col-span-3">Names on the phone screens are made up. Payments run on Capital One&rsquo;s Nessie test bank, so no real money moves.</p>
      </footer>
    </div>
  );
}
