import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HOLD_REASON_LABELS } from '@/lib/rules';
import { PausedCheck } from './_landing/check';
import { Reveal } from './_landing/reveal';
import { ApproveScreen, AskScreen, Icon, Logo, Person, type IconName } from './_landing/screens';
import { Tryout } from './_landing/tryout';
import { band, body, display, h2, h3, lead, navLink, nudge, primary, secondary, wrap } from './_landing/ui';

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'An iPhone app for older adults. It hides scam texts, labels scam calls and pauses risky payments until someone in the family says yes.',
};

// Auth0 redirects need a full page load, so these are plain <a> tags, not next/link.
const DASHBOARD = '/dashboard';
const GITHUB = 'https://github.com/builtbyd3v/checkwith.us';

// An eye chart: each line a step smaller, as at the optician.
const CHANGES = [
  { title: 'Scam texts go to Spam.', body: 'A small model on their iPhone checks texts from unknown senders. The texts never leave the phone.', size: 'text-[clamp(2.25rem,0.9rem+5.6vw,6rem)]' },
  { title: 'Scam calls say “Possible scam.”', body: 'Known scam numbers get a plain label before they pick up.', size: 'text-[clamp(1.9rem,0.95rem+4vw,4.5rem)]' },
  { title: 'Risky payments pause.', body: 'Gift cards, crypto, wires, new payees, big or unusual amounts, and payments made during a call.', size: 'text-[clamp(1.65rem,1rem+2.8vw,3.375rem)]' },
  { title: 'Everything else works as usual.', body: 'Groceries and known bills pay like before.', size: 'text-[clamp(1.5rem,1rem+1.9vw,2.5rem)]' },
];

// What the real rules give a $500 gift card at a new store, paid during a call.
const REASONS = [HOLD_REASON_LABELS.gift_card, HOLD_REASON_LABELS.new_payee, HOLD_REASON_LABELS.over_limit, HOLD_REASON_LABELS.during_call];

const RULES = [
  ['No answer means no payment.', 'A paused payment never goes through on its own.'],
  ['Over $1,000, two must sign.', 'One no stops it.'],
  ['Code decides money.', 'AI can add a reason to pause, never remove one.'],
] as const;

const FAMILY = [
  { title: 'Freeze their money.', body: 'Freeze moves their spending money to a safe account. Payments stop until you unfreeze.' },
  { title: 'Allow the routine bills.', body: 'An allowance pre-approves one payee or one category, up to a limit, until a date you pick.' },
  { title: 'See what is unusual.', body: 'A payment more than 3 times their usual for that category pauses. Their usual comes from the last 90 days.' },
  { title: 'Hear about the bank visit.', body: 'One alert when their phone is at a bank during a call. Only the bank’s name is sent.' },
  { title: 'Keep it switched on.', body: 'Only family can unpair their phone.' },
  { title: 'Get the call for help.', body: 'They tap Ask my family, or say to Siri, “Ask my family in Check With Us.” You get an alert.' },
];

// Each figure is a fact about how the product is built, not a business statistic.
const PRIVACY = [
  ['1 MB', 'The scam model. It runs on their iPhone.'],
  ['0', 'Texts sent to us or to a cloud AI.'],
  ['0', 'Dollars an AI can move.'],
] as const;

const TECH = [
  { name: 'Capital One Nessie', body: 'Runs their test bank: accounts, bills, purchases and the Freeze transfer.' },
  { name: 'Auth0', body: 'Decides who in the family can say yes, and asks for two people over $1,000.' },
  { name: 'Tiger Data', body: 'Knows their usual spending, in about a millisecond while a payment waits.' },
  { name: 'On-device AI', body: 'A 1 MB scam model checks texts on the iPhone. Apple’s on-device model writes the note for the family.' },
  { name: 'GoDaddy Registry', body: 'Runs .us, the end of checkwith.us.' },
];

const FAQ = [
  ['Does my parent have to do anything?', 'No. After setup, the app works in the background. When it needs them, the screen shows one thing in large text and one button: Ask my family.'],
  ['Does anyone read their texts?', 'No. The scam check runs on the iPhone. Texts are never sent to us or to a cloud AI model.'],
  ['Where is the iPhone app?', 'It runs on our test iPhones and is not in the App Store yet. The family dashboard on this site works today.'],
  ['Is real money moving?', 'Not yet. Payments run on Capital One’s Nessie test bank, with pretend accounts.'],
] as const;

const TONE = { safe: 'bg-safe-field text-safe', pause: 'bg-pause-field text-pause', stop: 'bg-stop-field text-stop' } as const;

/** A status line as it shows on a phone: tinted field, coloured icon, text in the body colour for contrast. */
function Status({ tone, icon, children }: { tone: keyof typeof TONE; icon: IconName; children: ReactNode }) {
  return (
    <p className="inline-flex items-start gap-2.5 rounded-2xl bg-card px-4 py-3 text-left text-lg leading-snug font-bold">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${TONE[tone]}`}><Icon name={icon} className="size-5" /></span>
      <span className="pt-0.5">{children}</span>
    </p>
  );
}

type Row = { time: string; them: ReactNode; you: ReactNode; key?: boolean };

const say = 'text-[clamp(1.5rem,1.2rem+1.1vw,2.125rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance';
const quiet = `max-w-[26ch] ${body}`;

const DAY: Row[] = [
  {
    time: '2:02 PM',
    them: (
      <>
        <p data-ui className="max-w-[22em] rounded-[1.4em_1.4em_1.4em_0.35em] bg-[#e9e9eb] px-5 py-3.5 text-left text-lg leading-snug text-[#1c1c1e] [font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] dark:bg-[#2c2c2e] dark:text-white">
          <b className="block text-base font-semibold opacity-70">Unknown sender</b>
          Your package is on hold. Pay the $1.99 fee today at usps-redelivery.co
        </p>
        <Status tone="safe" icon="tray">Moved to Spam on their phone</Status>
      </>
    ),
    you: <p className={quiet}>Nothing reaches you. Their texts never leave their phone.</p>,
  },
  {
    time: '2:09 PM',
    them: (
      <p data-ui className="grid w-[19rem] max-w-full gap-0.5 rounded-[1.6rem] bg-[#1c1a21] px-6 py-4 text-left text-white [font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif]">
        <span className="text-base text-[#d9d3e0]">Incoming call</span>
        <b className="text-2xl leading-tight">Possible scam</b>
        <span className="text-base text-[#d9d3e0] tabular-nums">+1 (202) 555-0147</span>
      </p>
    ),
    you: <p className={quiet}>They answer anyway. Scammers are persuasive.</p>,
  },
  {
    time: '2:14 PM',
    key: true,
    them: (
      <>
        <p className={say}>They buy a <span className="tabular-nums">$500</span> gift card while on the call.</p>
        <Status tone="pause" icon="pause">Paused, waiting for family. Your money is safe.</Status>
      </>
    ),
    you: (
      <>
        <p className={say}>You get the hard part.</p>
        <p className={quiet}>The paused payment appears in your family app with the amount, the payee and every reason.</p>
      </>
    ),
  },
  {
    time: '2:15 PM',
    them: <Status tone="stop" icon="stop">Stopped. Your family said no.</Status>,
    you: <p className={quiet}>You said no with Face ID. Their screen already shows it. Then you call them.</p>,
  },
];

function Lane({ who }: { who: 'parent' | 'family' }) {
  return (
    <span className="inline-flex items-center gap-2 text-xl font-extrabold">
      <Person who={who} className="h-7 w-auto" />
      {who === 'parent' ? 'Their side' : 'Your side'}
    </span>
  );
}

export default function Home() {
  return (
    <div className={`lp flex-1 bg-background font-print text-foreground selection:bg-sun selection:text-on-sun ${body}`}>
      <Reveal />
      <a href="#main" className="sr-only z-10 rounded-full bg-foreground px-5 py-3 font-bold text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      <header className="bg-lane-family">
        <nav aria-label="Main" className={`${wrap} flex min-h-24 items-center justify-between gap-4 lg:min-h-28`}>
          <Link href="/" className="-ml-2 flex min-h-12 items-center gap-2.5 rounded-full px-2 transition-colors duration-200 hover:text-link">
            <Logo className="size-10" />
            <span className="text-[1.375rem] font-extrabold tracking-[-0.02em]">checkwith.us</span>
          </Link>
          <div className="flex items-center gap-1">
            <a href="#how" className={`max-md:hidden ${navLink}`}>How it works</a>
            <a href="#try" className={`max-md:hidden ${navLink}`}>Try it</a>
            <a href="#questions" className={`max-lg:hidden ${navLink}`}>Questions</a>
            <a href={DASHBOARD} className={`ml-2 ${navLink} bg-action/10 px-5 text-link hover:bg-action/16`}><span className="max-sm:hidden">Family sign in</span><span className="sm:hidden">Sign in</span></a>
          </div>
        </nav>

        <div className={`${wrap} pt-10 pb-20 lg:pt-14 lg:pb-32`}>
          <h1 className={`max-w-[10em] motion-safe:animate-rise ${display}`}>Risky payments wait for family.</h1>
          <div className="mt-10 grid items-end gap-14 lg:mt-14 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-10">
            <div className="xl:pb-8">
              <p className={`max-w-[26em] motion-safe:animate-rise motion-safe:[animation-delay:120ms] ${lead}`}>
                checkwith.us pauses gift cards, wires and strange payments on your parent&rsquo;s iPhone until someone in the family signs too. Your parent does nothing new.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:200ms]">
                <a href={DASHBOARD} className={primary}>Open the dashboard <Icon name="arrow" className={nudge} /></a>
                <a href="#try" className={secondary}>Try a payment</a>
              </div>
            </div>
            <PausedCheck className="max-w-[52rem] xl:justify-self-end motion-safe:animate-rise motion-safe:[animation-delay:250ms]" />
          </div>
        </div>
      </header>

      <main id="main">
        <section id="how" aria-labelledby="changes-heading" className={`${wrap} ${band} scroll-mt-4`}>
          <h2 id="changes-heading" data-reveal className={h2}>Four things change.</h2>
          <p data-reveal className={`mt-6 text-muted delay-75 ${lead}`}>Your parent learns none of them.</p>
          <ol className="mt-16 space-y-14 lg:mt-24 lg:space-y-16">
            {CHANGES.map((c) => (
              <li key={c.title} data-reveal className="grid gap-4 lg:grid-cols-12 lg:items-baseline lg:gap-10">
                <h3 className={`leading-[1.02] font-extrabold tracking-[-0.035em] text-balance lg:col-span-8 ${c.size}`}>{c.title}</h3>
                <p className="max-w-[34ch] text-muted lg:col-span-4">{c.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="signatures-heading" className={`${wrap} pb-24 sm:pb-32 lg:pb-40`}>
          <h2 id="signatures-heading" data-reveal className={h2}>One payment. Two signatures.</h2>
          <p data-reveal className={`mt-6 max-w-[34ch] text-muted delay-75 ${lead}`}>A risky payment needs your parent&rsquo;s tap and the family&rsquo;s yes. Your parent keeps the phone they know. You take the hard decision.</p>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-20">
            <div data-reveal className="grid justify-items-center gap-10 rounded-panel bg-lane-them px-6 pt-8 pb-10 sm:px-10 lg:px-14 lg:pt-12 lg:pb-14">
              <div className="justify-self-stretch">
                <Lane who="parent" />
                <h3 className={`mt-4 ${h3}`}>Their tap.</h3>
                <p className="mt-2 text-muted">The same Pay screen as always.</p>
              </div>
              <AskScreen className="text-[9px] sm:text-[10px] xl:text-[12.5px]" />
            </div>
            <div data-reveal className="grid justify-items-center gap-10 rounded-panel bg-lane-family px-6 pt-8 pb-10 delay-100 sm:px-10 lg:px-14 lg:pt-12 lg:pb-14">
              <div className="justify-self-stretch">
                <Lane who="family" />
                <h3 className={`mt-4 ${h3}`}>Your yes.</h3>
                <p className="mt-2 text-muted">Every reason in plain words, then Face ID.</p>
              </div>
              <ApproveScreen reasons={REASONS} className="text-[9px] sm:text-[10px] xl:text-[12.5px]" />
            </div>
          </div>
          <dl className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-3">
            {RULES.map(([t, d], i) => (
              <div key={t} data-reveal className={['', 'delay-75', 'delay-150'][i]}>
                <dt className={h3}>{t}</dt>
                <dd className="mt-3 max-w-[30ch] text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="day-heading" className="lg:bg-lane-family">
          <div className={`${wrap} pb-14 lg:pt-32 lg:pb-20`}>
            <h2 id="day-heading" data-reveal className={h2}>One Tuesday afternoon.</h2>
            <p data-reveal className={`mt-6 max-w-[34ch] text-muted delay-75 ${lead}`}>Each row is the same minute: what happens on your parent&rsquo;s phone, and what happens on yours.</p>
          </div>
          <div className="relative">
            {/* Two lanes as two flat fields: their side warm, your side lilac. The seam is the timeline. */}
            <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-lane-them lg:block" />
            <div className={`relative ${wrap} pb-24 sm:pb-32 lg:py-20`}>
              <div className="hidden grid-cols-[1fr_9rem_1fr] lg:grid" aria-hidden="true">
                <span className="justify-self-end pr-12"><Lane who="parent" /></span>
                <span />
                <span className="pl-12"><Lane who="family" /></span>
              </div>
              <ol className="space-y-6 lg:mt-6 lg:space-y-0">
                {DAY.map((r) => (
                  <li key={r.time} data-reveal className={`grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[1fr_9rem_1fr] lg:items-center lg:gap-0 ${r.key ? 'lg:py-14' : 'lg:py-8'}`}>
                    <span className={`justify-self-start rounded-full px-5 py-2 text-lg font-extrabold tabular-nums lg:order-2 lg:justify-self-center ${r.key ? 'bg-action text-white' : 'bg-background'}`}>
                      <span className="sr-only">At </span>{r.time}
                    </span>
                    <div className="flex flex-col items-start gap-4 rounded-panel bg-lane-them p-6 lg:order-1 lg:items-end lg:rounded-none lg:bg-transparent lg:p-0 lg:pr-12 lg:text-right">
                      <span className="lg:hidden"><Lane who="parent" /></span>
                      {r.them}
                    </div>
                    <div className="flex flex-col items-start gap-4 rounded-panel bg-lane-family p-6 lg:order-3 lg:rounded-none lg:bg-transparent lg:p-0 lg:pl-12">
                      <span className="lg:hidden"><Lane who="family" /></span>
                      {r.you}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <Tryout />

        <section aria-labelledby="family-heading" className="bg-lane-family">
          <div className={`${wrap} ${band}`}>
            <h2 id="family-heading" data-reveal className={h2}>You hold the controls.</h2>
            <p data-reveal className={`mt-6 max-w-[30ch] text-muted delay-75 ${lead}`}>Their phone stays simple. Everything else is on your side.</p>
            <ul className="mt-16 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-y-16">
              {FAMILY.map((f, i) => (
                <li key={f.title} data-reveal className={['', 'delay-75', 'delay-150'][i % 3]}>
                  <h3 className={h3}>{f.title}</h3>
                  <p className="mt-3 max-w-[34ch] text-muted">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="privacy" aria-labelledby="privacy-heading" className="scroll-mt-4 bg-lane-them">
          <div className={`${wrap} ${band}`}>
            <h2 id="privacy-heading" data-reveal className={`max-w-[11em] ${display}`}>Scam checks stay on their phone.</h2>
            <p data-reveal className={`mt-8 max-w-[34ch] delay-75 ${lead}`}>The scam check runs on the iPhone itself. Money works the other way: fixed rules pause a payment, and only family can say yes.</p>
            <dl className="mt-16 grid gap-10 sm:grid-cols-3 lg:mt-24">
              {PRIVACY.map(([n, d], i) => (
                <div key={d} data-reveal className={['', 'delay-75', 'delay-150'][i]}>
                  <dt className="text-[clamp(3.5rem,2.5rem+4vw,6.5rem)] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{n}</dt>
                  <dd className="mt-4 max-w-[24ch]">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="tech-heading" className={`${wrap} ${band}`}>
          <h2 id="tech-heading" data-reveal className={h2}>Built with</h2>
          <dl className="mt-14 space-y-10 lg:mt-20 lg:space-y-12">
            {TECH.map((t) => (
              <div key={t.name} data-reveal className="grid gap-2 lg:grid-cols-12 lg:items-baseline lg:gap-10">
                <dt className={`lg:col-span-5 ${h3}`}>{t.name}</dt>
                <dd className="max-w-[44ch] text-muted lg:col-span-7">{t.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="questions" aria-labelledby="questions-heading" className="scroll-mt-4 bg-surface">
          <div className={`${wrap} ${band} grid gap-12 lg:grid-cols-12 lg:gap-10`}>
            <h2 id="questions-heading" data-reveal className={`lg:col-span-4 ${h2}`}>Questions</h2>
            <dl className="space-y-12 lg:col-span-8">
              {FAQ.map(([q, a]) => (
                <div key={q} data-reveal>
                  <dt className={h3}>{q}</dt>
                  <dd className="mt-3 max-w-[44ch] text-muted">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className={`${wrap} ${band}`}>
          <div className="grid items-end gap-12 rounded-panel bg-lane-family px-6 py-14 sm:px-12 lg:grid-cols-12 lg:gap-10 lg:px-20 lg:py-24">
            <div className="lg:col-span-8">
              <h2 id="cta-heading" data-reveal className={display}>Be the second signature.</h2>
              <p data-reveal className={`mt-6 max-w-[26ch] delay-75 ${lead}`}>Sign in to approve, deny, freeze and set allowances.</p>
              {/* The empty family line from the check, now with your action on it. */}
              <div data-reveal className="mt-12 max-w-[36rem] delay-150">
                <div className="flex items-end gap-4 border-b-[3px] border-foreground/25 pb-4">
                  <span aria-hidden="true" className="pb-3 text-3xl leading-none font-bold text-muted max-sm:hidden">&times;</span>
                  <a href={DASHBOARD} className={primary}>Open the dashboard <Icon name="arrow" className={nudge} /></a>
                </div>
                <p className="mt-2 text-lg text-muted" aria-hidden="true">Family</p>
              </div>
            </div>
            <Logo className="hidden size-64 justify-self-end lg:col-span-4 lg:block xl:size-80" />
          </div>
        </section>
      </main>

      <footer className={`${wrap} pb-10`}>
        <p aria-hidden="true" className="flex items-center gap-[0.2em] text-[clamp(3rem,0.25rem+11vw,11.5rem)] leading-none font-extrabold tracking-[-0.045em]">
          <Logo className="size-[0.85em] shrink-0" />checkwith.us
        </p>
        <div className="mt-10 flex flex-col gap-4 text-muted lg:flex-row lg:items-center lg:justify-between">
          <p className="text-lg">2026. Built at SwampHacks. Payments run on a test bank, so no real money moves.</p>
          <nav aria-label="Footer" className="-mx-4 flex flex-wrap">
            <a href="#privacy" className={navLink}>Privacy</a>
            <a href="#questions" className={navLink}>Questions</a>
            <a href={DASHBOARD} className={navLink}>Family dashboard</a>
            <a href={GITHUB} className={navLink}>GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
