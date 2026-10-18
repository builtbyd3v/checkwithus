import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HOLD_REASON_LABELS } from '@/lib/rules';
import { Guilloche, PausedCheck } from './_landing/check';
import { AskScreen, Icon, Logo, type IconName } from './_landing/screens';
import { Tryout } from './_landing/tryout';

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'An iPhone app for older adults. It hides scam texts, labels scam calls and pauses risky payments until someone in the family says yes.',
};

// Auth0 redirects need a full page load, so these are plain <a> tags, not next/link.
const DASHBOARD = '/dashboard';
const GITHUB = 'https://github.com/builtbyd3v/checkwith.us';

// The focus ring takes the text colour, so it shows on every surface in both themes.
const focus = 'rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-current';
const pad = 'px-4 sm:px-10 lg:px-16 xl:px-28';
const section = `${pad} py-20 lg:py-28`;
const h2 = 'text-[clamp(2.5rem,1.4rem+4.2vw,4.25rem)] leading-none font-extrabold tracking-[-0.03em] text-balance';
const lede = 'mt-5 max-w-[38ch] text-[clamp(1.25rem,1.1rem+0.6vw,1.5rem)] leading-snug text-muted text-pretty';
const button = `inline-flex min-h-16 items-center gap-3 rounded-xl px-6 py-3 leading-tight text-[clamp(1.2rem,1.1rem+0.5vw,1.45rem)] font-extrabold transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none ${focus}`;
const primary = `${button} bg-action text-white shadow-[0_0.6em_1.4em_-0.6em_rgb(122_27_179/0.6)] hover:bg-[#8e1fd0]`;
const ghost = `${button} shadow-[inset_0_0_0_2px_var(--brand-rule)] hover:bg-foreground/5`;

// An eye chart: each line a step smaller, as at the optician.
const CHANGES: { icon: IconName; title: string; body: string; size: string }[] = [
  { icon: 'tray', title: 'Scam texts go to Spam.', body: 'A small model on their iPhone checks texts from unknown senders. The texts never leave the phone.', size: 'text-[clamp(2.1rem,1.1rem+4vw,4.5rem)]' },
  { icon: 'phone', title: 'Scam calls say “Possible scam.”', body: 'Known scam numbers get a plain label before they pick up.', size: 'text-[clamp(1.85rem,1.05rem+3.1vw,3.5rem)]' },
  { icon: 'pause', title: 'Risky payments wait for family.', body: 'Gift cards, crypto, wires, new payees, big or unusual amounts, and payments made during a call.', size: 'text-[clamp(1.65rem,1rem+2.4vw,2.75rem)]' },
  { icon: 'check', title: 'Everything else works as usual.', body: 'Groceries and known bills pay like before.', size: 'text-[clamp(1.5rem,1rem+1.8vw,2.2rem)]' },
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

const TECH = [
  { name: 'Capital One Nessie', body: 'runs their test bank: accounts, bills, purchases and the Freeze transfer.' },
  { name: 'Auth0', body: 'decides who in the family can say yes, and asks for two people over $1,000.' },
  { name: 'Tiger Data', body: 'knows their usual spending, in about a millisecond while a payment waits.' },
  { name: 'On-device AI', body: 'a 1 MB scam model checks texts on the iPhone. Apple’s on-device model writes the note for the family.' },
  { name: 'GoDaddy Registry', body: 'runs .us, the end of checkwith.us.' },
];

const FAQ = [
  ['Does my parent have to do anything?', 'No. After setup, the app works in the background. When it needs them, the screen shows one thing in large text and one button: Ask my family.'],
  ['Does anyone read their texts?', 'No. The scam check runs on the iPhone. Texts are never sent to us or to a cloud AI model.'],
  ['Where is the iPhone app?', 'It runs on our test iPhones and is not in the App Store yet. The family dashboard on this site works today.'],
  ['Is real money moving?', 'Not yet. Payments run on Capital One’s Nessie test bank, with pretend accounts.'],
] as const;

const TONE = { safe: 'bg-safe-field', pause: 'bg-pause-field', stop: 'bg-stop-field' } as const;
const TONE_ICON = { safe: 'text-safe', pause: 'text-pause', stop: 'text-stop' } as const;

/** A status line as it shows on a phone: tinted field, coloured icon, text in the body colour for contrast. */
function Status({ tone, icon, children }: { tone: keyof typeof TONE; icon: IconName; children: ReactNode }) {
  return (
    <p className={`inline-flex items-start gap-2 rounded-xl px-4 py-3 text-left text-lg leading-snug font-bold ${TONE[tone]}`}>
      <Icon name={icon} className={`mt-0.5 size-6 ${TONE_ICON[tone]}`} />
      <span>{children}</span>
    </p>
  );
}

/** The family app's approval card, drawn in HTML. */
function ApprovalCard() {
  return (
    <div role="img" aria-label={`Your family app: Approve $500.00 to Gift card store? Reasons: ${REASONS.join('. ')}. Buttons: Deny, Approve.`} className="w-full max-w-[30rem] rounded-2xl bg-card p-5 shadow-[0_0.1em_0.3em_rgb(28_20_38/0.06),0_0.8em_2em_-1em_rgb(60_20_90/0.28)] ring-1 ring-foreground/8">
      <p className="flex justify-between text-base text-muted"><span>checkwith.us, Approvals</span><span>now</span></p>
      <p className="mt-2 text-2xl leading-tight font-extrabold">Approve $500.00 to Gift card store?</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <li key={r} className="inline-flex items-center gap-1.5 rounded-full bg-pause-field px-3 py-1.5 text-base font-bold">
            <Icon name="pause" className="size-5 text-pause" />{r}
          </li>
        ))}
      </ul>
      <p className="mt-4 grid grid-cols-2 gap-2 text-lg font-bold">
        <span className="flex min-h-12 items-center justify-center rounded-xl bg-foreground/8">Deny</span>
        <span className="flex min-h-12 items-center justify-center rounded-xl bg-action text-white">Approve</span>
      </p>
    </div>
  );
}

type Row = { time: string; them: ReactNode; you: ReactNode; key?: boolean };

const say = 'text-[clamp(1.5rem,1.2rem+1.1vw,2rem)] leading-tight font-extrabold tracking-[-0.02em] text-balance';
const quiet = 'max-w-[24ch] text-xl leading-snug text-muted';

const DAY: Row[] = [
  {
    time: '2:02 PM',
    them: (
      <>
        <p className="max-w-[24em] rounded-[1.3em_1.3em_0.3em_1.3em] bg-card px-5 py-4 text-left text-lg leading-snug shadow-[0_0.15em_0.5em_rgb(28_20_38/0.08)]">
          <b className="block text-base text-muted">Unknown sender</b>
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
      <p className="grid w-[18rem] max-w-full gap-0.5 rounded-2xl bg-[#1e1b24] px-5 py-4 text-left text-white">
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
        <p className={say}>They buy a $500 gift card while on the call.</p>
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

const laneLabel = 'text-lg font-extrabold lg:hidden';

export default function Home() {
  return (
    <div className="flex-1 bg-background font-print text-lg text-foreground selection:bg-sun selection:text-on-sun sm:text-xl">
      <a href="#main" className="sr-only z-10 rounded-md bg-foreground px-4 py-3 font-bold text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      <header className="bg-lane-family pb-16 lg:pb-24">
        <nav aria-label="Main" className={`${pad} flex min-h-24 items-center justify-between gap-4 lg:min-h-28`}>
          <Link href="/" className={`flex min-h-11 items-center gap-3 ${focus}`}>
            <Logo className="size-11" />
            <span className="text-xl font-extrabold tracking-[-0.01em] sm:text-2xl">checkwith.us</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#how" className={`hidden min-h-11 items-center text-xl font-bold underline-offset-[0.25em] hover:underline md:inline-flex ${focus}`}>How it works</a>
            <a href="#try" className={`hidden min-h-11 items-center text-xl font-bold underline-offset-[0.25em] hover:underline md:inline-flex ${focus}`}>Try it</a>
            <a href={DASHBOARD} className={`inline-flex min-h-12 items-center px-1 text-lg font-bold whitespace-nowrap text-link underline decoration-2 underline-offset-[0.25em] sm:text-xl ${focus}`}>Family sign in</a>
          </div>
        </nav>

        <div className={`${pad} grid items-center gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:pt-10`}>
          <div>
            <h1 className="max-w-[11em] text-[clamp(2.75rem,1.4rem+5vw,5.25rem)] leading-[0.98] font-extrabold tracking-[-0.035em] text-balance">Risky payments need a second signature.</h1>
            <p className="mt-6 max-w-[24em] text-[clamp(1.35rem,1.15rem+0.9vw,1.85rem)] leading-[1.3] font-bold text-pretty">
              checkwith.us pauses gift cards, wires and strange payments on your parent&rsquo;s iPhone until someone in the family signs too. Your parent does nothing new.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href={DASHBOARD} className={primary}>Open the family dashboard <Icon name="arrow" className="size-[1.1em]" /></a>
              <a href="#try" className={ghost}>Try a payment</a>
            </div>
          </div>
          <PausedCheck className="justify-self-center text-[8px] sm:text-[11px] lg:text-[9px] xl:text-[14px]" />
        </div>
      </header>

      <main id="main">
        <section id="how" aria-labelledby="changes-heading" className={`${section} scroll-mt-4`}>
          <h2 id="changes-heading" className={`max-w-[13em] ${h2}`}>Four things change. Your parent learns none of them.</h2>
          <ol className="mt-12">
            {CHANGES.map((c) => (
              <li key={c.title} className="border-t-2 border-foreground/15 pt-5 pb-6">
                <h3 className={`flex items-start gap-[0.3em] leading-[1.05] font-extrabold tracking-[-0.025em] text-balance ${c.size}`}>
                  <Icon name={c.icon} className="mt-[0.06em] size-[0.95em] [stroke-width:2.4]" />
                  {c.title}
                </h3>
                <p className="mt-2 max-w-[40ch] text-xl leading-snug text-muted sm:text-2xl">{c.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="signatures-heading" className={`${section} bg-surface`}>
          <h2 id="signatures-heading" className={`max-w-[13em] ${h2}`}>One payment. Two signatures.</h2>
          <p className={lede}>A risky payment needs your parent&rsquo;s tap and the family&rsquo;s yes. Your parent keeps the phone they know. You take the hard decision.</p>
          <div className="mt-12 grid overflow-hidden rounded-2xl bg-card shadow-[0_0.2em_0.5em_rgb(30_10_50/0.06),0_2em_3.5em_-2em_rgb(60_20_100/0.3)] lg:grid-cols-[minmax(0,26rem)_1fr]">
            <div className="grid justify-items-center gap-6 border-b-2 border-dashed border-rule bg-lane-them p-6 sm:p-10 lg:border-r-2 lg:border-b-0">
              <div className="justify-self-start">
                <h3 className="text-[clamp(1.6rem,1.3rem+1vw,2rem)] leading-tight font-extrabold">Signature 1: their tap</h3>
                <p className="mt-1 text-xl text-muted">The same Pay screen as always.</p>
              </div>
              <AskScreen className="text-[9px] sm:text-[10px]" />
            </div>
            <div className="grid content-start gap-8 p-6 sm:p-10">
              <div>
                <h3 className="text-[clamp(1.6rem,1.3rem+1vw,2rem)] leading-tight font-extrabold">Signature 2: your yes</h3>
                <p className="mt-1 text-xl text-muted">Every reason in plain words, then Face ID.</p>
              </div>
              <ApprovalCard />
              <dl className="max-w-[34rem]">
                {RULES.map(([t, d]) => (
                  <div key={t} className="border-t-2 border-foreground/12 py-4">
                    <dt className="text-xl font-extrabold">{t}</dt>
                    <dd className="mt-1 text-xl text-muted">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="day-heading" className="py-20 lg:bg-[linear-gradient(90deg,var(--brand-lane-them)_50%,var(--brand-lane-family)_50%)] lg:py-28">
          <div className={`${pad} lg:text-center`}>
            <h2 id="day-heading" className={`max-w-[14em] lg:mx-auto ${h2}`}>One Tuesday afternoon, from both sides</h2>
            <p className={`${lede} lg:mx-auto`}>Each row is the same minute. On the left, your parent&rsquo;s phone. On the right, yours.</p>
          </div>
          <div className={`${pad} mt-12 hidden grid-cols-[1fr_8rem_1fr] text-xl font-extrabold lg:grid`} aria-hidden="true">
            <span className="text-right">Their side</span>
            <span />
            <span>Your side</span>
          </div>
          <ol className={`${pad} relative mt-10 space-y-8 lg:mt-4 lg:space-y-0`}>
            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-0.5 -translate-x-1/2 bg-foreground/12 lg:block" />
            {DAY.map((r) => (
              <li key={r.time} className={`grid gap-3 lg:grid-cols-[1fr_8rem_1fr] lg:items-center lg:gap-0 ${r.key ? 'lg:py-14' : 'lg:py-9'}`}>
                <span className={`relative justify-self-start rounded-full border-2 px-4 py-1.5 text-lg font-extrabold tabular-nums lg:order-2 lg:justify-self-center ${r.key ? 'border-action bg-action text-white' : 'border-foreground/15 bg-background'}`}>
                  <span className="sr-only">At </span>{r.time}
                </span>
                <div className="flex flex-col items-start gap-4 rounded-2xl bg-lane-them p-5 lg:order-1 lg:items-end lg:rounded-none lg:bg-transparent lg:p-0 lg:pr-10 lg:text-right">
                  <p className={laneLabel}>Their side</p>
                  {r.them}
                </div>
                <div className="flex flex-col items-start gap-4 rounded-2xl bg-lane-family p-5 lg:order-3 lg:rounded-none lg:bg-transparent lg:p-0 lg:pl-10">
                  <p className={laneLabel}>Your side</p>
                  {r.you}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Tryout />

        <section aria-labelledby="family-heading" className={`${section} bg-lane-family`}>
          <h2 id="family-heading" className={`max-w-[13em] ${h2}`}>Everything else is on your side.</h2>
          <ul className="mt-12 grid gap-x-16 md:grid-cols-2">
            {FAMILY.map((f) => (
              <li key={f.title} className="border-t-2 border-rule py-5">
                <h3 className="text-[clamp(1.5rem,1.25rem+0.9vw,1.9rem)] leading-tight font-extrabold tracking-[-0.015em] text-balance">{f.title}</h3>
                <p className="mt-2 max-w-[40ch] text-xl leading-snug text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="privacy" aria-labelledby="privacy-heading" className={`${section} scroll-mt-4`}>
          <h2 id="privacy-heading" className="max-w-[9em] text-[clamp(2.75rem,1.4rem+5.4vw,6rem)] leading-none font-extrabold tracking-[-0.03em] text-balance">
            Scam checks stay <mark className="box-decoration-clone bg-sun px-[0.1em] text-on-sun">on their phone.</mark>
          </h2>
          <p className="mt-8 max-w-[30ch] text-[clamp(1.4rem,1.15rem+1vw,1.9rem)] leading-[1.35] text-pretty">
            Their texts are never sent to us or to a cloud AI. Money works the other way: no AI can move a dollar. Fixed rules pause a payment, and only family can say yes.
          </p>
        </section>

        <section aria-labelledby="tech-heading" className={`${section} bg-surface`}>
          <h2 id="tech-heading" className={h2}>Built with</h2>
          <dl className="mt-10 grid gap-x-16 md:grid-cols-2">
            {TECH.map((t) => (
              <div key={t.name} className="border-t-2 border-foreground/15 py-5">
                <dt className="text-[clamp(1.5rem,1.3rem+0.8vw,1.9rem)] font-extrabold">{t.name}</dt>
                <dd className="mt-1 text-xl leading-snug text-muted">{t.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="questions" aria-labelledby="questions-heading" className={`${section} scroll-mt-4`}>
          <h2 id="questions-heading" className={h2}>Questions</h2>
          <dl className="mt-10 grid gap-x-16 md:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="border-t-2 border-foreground/15 py-5">
                <dt className="text-2xl leading-tight font-extrabold">{q}</dt>
                <dd className="mt-2 text-xl leading-snug text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="cta-heading" className={`${pad} pb-20 lg:pb-28`}>
          <div className="relative overflow-hidden rounded-2xl bg-lane-family px-6 py-12 sm:px-12 lg:grid lg:grid-cols-[1fr_18rem] lg:items-end lg:gap-16 lg:px-16 lg:py-16">
            <Guilloche />
            <div className="relative">
              <h2 id="cta-heading" className="max-w-[9em] text-[clamp(2.75rem,1.4rem+5.4vw,6rem)] leading-none font-extrabold tracking-[-0.03em] text-balance">Be the second signature.</h2>
              <p className="mt-6 max-w-[26ch] text-[clamp(1.35rem,1.15rem+0.9vw,1.85rem)] leading-snug font-bold">Sign in to approve, deny, freeze and set allowances.</p>
              <a href={DASHBOARD} className={`mt-9 ${primary}`}>Open the family dashboard <Icon name="arrow" className="size-[1.1em]" /></a>
            </div>
            <p aria-hidden="true" className="relative mt-12 hidden border-t-2 border-rule pt-2 text-base font-bold tracking-[0.07em] text-muted uppercase lg:block">Family</p>
          </div>
        </section>
      </main>

      <footer className={`${pad} flex flex-col gap-4 pb-10 text-muted lg:flex-row lg:items-center lg:justify-between`}>
        <p>2026. Built at SwampHacks. Payments run on a test bank, so no real money moves.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1 font-bold text-foreground">
          <a href="#privacy" className={`inline-flex min-h-11 items-center ${focus}`}>Privacy</a>
          <a href="#questions" className={`inline-flex min-h-11 items-center ${focus}`}>Questions</a>
          <a href={DASHBOARD} className={`inline-flex min-h-11 items-center ${focus}`}>Family dashboard</a>
          <a href={GITHUB} className={`inline-flex min-h-11 items-center ${focus}`}>GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
