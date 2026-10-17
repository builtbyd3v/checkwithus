import type { Metadata } from 'next';
import { Newsreader } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SCREENS } from './_landing/screens';
import { Stage } from './_landing/stage';
import { Tryout } from './_landing/tryout';

const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'], axes: ['opsz'] });

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'An iPhone app that hides scam texts, labels scam calls and pauses risky payments until the family says yes. The older adult does nothing new.',
};

// Auth0 routes need a full page load, so these are plain <a> tags, not next/link.
const DASHBOARD = '/auth/login?returnTo=/dashboard';

const focus = 'focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ink';
const head = 'font-display text-[clamp(2.75rem,1.2rem+4.4vw,5.5rem)] leading-[1.02] tracking-[-0.02em]';
const lead = 'text-[clamp(1.375rem,1.15rem+0.7vw,1.75rem)] leading-snug';
const body = 'text-[clamp(1.125rem,1.05rem+0.3vw,1.25rem)] leading-relaxed';
const button = `inline-flex min-h-14 items-center justify-center rounded-full px-6 text-center text-lg font-semibold transition duration-200 active:scale-[0.97] ${focus}`;

const STORY = [
  { title: 'Scam texts never arrive.', body: 'A small model on the iPhone reads texts from unknown senders and moves scams to Junk. The text never leaves the phone.' },
  { title: 'Scam calls ring as \u201cPossible scam.\u201d', body: 'Known scam numbers show a plain warning on the call screen, before anyone picks up.' },
  { title: 'Risky payments pause.', body: 'A gift card bought during a phone call waits. The screen says so in big words, and the family gets a push.' },
  { title: 'Most days, nothing happens.', body: 'Groceries and known bills pay as usual. The screen says one thing: you are safe.' },
];

const FAMILY: { title: string; body: string; panel: ReactNode }[] = [
  {
    title: 'Say yes or no from a push.',
    body: 'Each paused payment sends a push with the amount, the payee and the reason. Over $1,000, two approvers must say yes, and one no stops it. No answer means no payment.',
    panel: (
      <div className="w-[360px] rounded-[20px] bg-screen p-5">
        <p className="flex justify-between text-[15px] text-soft"><span>checkwith.us</span><span>now</span></p>
        <p className="mt-2 text-lg leading-snug font-semibold">Approve $500.00 to Gift card rack?</p>
        <p className="mt-1 text-[17px] leading-snug">Gift card purchase. Paid while on a phone call.</p>
        <p className="mt-4 grid grid-cols-2 gap-2 text-center text-[17px] font-semibold">
          <span className="rounded-full bg-panel py-2.5">Deny</span>
          <span className="rounded-full bg-sage py-2.5 text-white">Approve</span>
        </p>
      </div>
    ),
  },
  {
    title: 'Freeze in one tap.',
    body: 'Freeze moves the spending balance into a locked vault account. Nothing more can go out until a family member unfreezes it.',
    panel: (
      <div className="w-[360px] rounded-[20px] bg-screen p-5">
        <p className="flex items-center justify-between text-lg font-semibold">Spending is frozen<span className="rounded-full bg-ink px-3 py-1 text-[15px] text-paper">Frozen</span></p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-panel p-3"><dt className="text-[15px] text-soft">Spending</dt><dd className="text-[22px] font-semibold">$0.00</dd></div>
          <div className="rounded-2xl bg-panel p-3"><dt className="text-[15px] text-soft">Vault</dt><dd className="text-[22px] font-semibold">$1,240.00</dd></div>
        </dl>
      </div>
    ),
  },
  {
    title: 'Allow the routine bills.',
    body: 'Give the app a small, expiring permission, such as utility bills under $200 until November 30. Inside it, nothing pauses and nobody gets a push.',
    panel: (
      <div className="w-[360px] rounded-[20px] bg-screen p-5">
        <p className="text-[15px] text-soft">Allowance</p>
        <p className="mt-1 text-lg leading-snug font-semibold">Utility bills under $200.00</p>
        <p className="mt-1 text-[17px]">Until Nov 30</p>
        <p className="mt-4 flex items-center justify-between text-[17px]">
          <span className="text-soft">Known billers only</span>
          <span className="rounded-full bg-panel px-4 py-2 font-semibold">Revoke</span>
        </p>
      </div>
    ),
  },
  {
    title: 'Hear about the bank visit.',
    body: 'Scammers often keep a person on the phone while they take out cash. If the phone is at a bank or an ATM during a call, the family gets an alert.',
    panel: (
      <div className="w-[360px] rounded-[20px] bg-screen p-5">
        <p className="flex justify-between text-[15px] text-soft"><span>checkwith.us</span><span>now</span></p>
        <p className="mt-2 text-lg leading-snug font-semibold">Mom is at a bank branch during a phone call.</p>
        <p className="mt-4 rounded-full bg-sage py-2.5 text-center text-[17px] font-semibold text-white">Call Mom</p>
      </div>
    ),
  },
  {
    title: 'Read the reason in plain words.',
    body: 'Code picks the facts. Apple’s on-device model turns them into a short note, so the family knows what happened before they call.',
    panel: (
      <div className="w-[360px] rounded-[20px] bg-screen p-5">
        <p className="text-[15px] text-soft">Why this paused</p>
        <p className="mt-2 text-lg leading-snug">Mom tried to buy $500.00 in gift cards while on a phone call. She has not paid this store before.</p>
      </div>
    ),
  },
];

const FAQ = [
  ['Does my parent have to do anything?', 'No. After setup, the app works in the background. When it needs them, the screen shows one thing in large text and one button: Ask my family.'],
  ['Where is the iPhone app?', 'It runs on our test iPhones and is not in the App Store yet. The family dashboard on this site works today.'],
  ['Does anyone read the texts?', 'No. The scam check runs on the iPhone. Texts are never sent to us or to a cloud AI model.'],
  ['What makes a payment pause?', 'Gift cards, crypto and wire transfers always pause. So do new payees, amounts over the family limit ($300 unless you change it), spending far above the usual, and payments made during a phone call.'],
  ['What if nobody answers?', 'The payment stays blocked. A paused payment never goes through on its own.'],
  ['Can the AI approve a payment?', 'No. A model can add a reason to pause. There is no path in the code that lets it remove one.'],
  ['Who can approve?', 'Family members with the approver role. Viewers see the holds but cannot decide. Over $1,000, two approvers must say yes, and one no stops it.'],
  ['Can my parent still pay bills?', 'Yes. Known bills inside an allowance pay as usual, with no push to anyone.'],
  ['What does Freeze do?', 'It moves the spending balance into a vault account in one tap, so no more money can leave until the family unfreezes it.'],
  ['Is real money moving?', 'Not yet. Payments run on Capital One’s Nessie test bank, so the demo uses pretend accounts.'],
] as const;

export default function Home() {
  return (
    <div className={`${newsreader.variable} bg-paper text-ink`}>
      {/* The split stage: the reading column scrolls, her iPhone screen stays still. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-3 lg:p-3">
        <header data-step="0" className="m-3 flex flex-col rounded-[20px] bg-panel px-5 pt-5 pb-14 sm:px-10 lg:m-0 lg:min-h-[calc(100svh-24px)] lg:items-center lg:pb-[16svh] lg:text-center">
          <nav aria-label="Main" className="flex w-full items-center justify-between gap-4 text-lg lg:grid lg:grid-cols-[1fr_auto_1fr]">
            <a href="#how" className={`hidden justify-self-start underline-offset-4 hover:underline lg:block ${focus}`}>How it works</a>
            <Link href="/" className={`font-display text-[30px] leading-none tracking-[-0.02em] ${focus}`}>checkwith.us</Link>
            <a href={DASHBOARD} className={`justify-self-end underline-offset-4 hover:underline ${focus}`}>Family sign in</a>
          </nav>
          <h1 className={`rise mt-16 max-w-[13ch] text-sage-deep lg:mt-[24svh] ${head}`}>Scams stop. Family decides.</h1>
          <p className={`rise-late mt-6 max-w-[34ch] ${lead}`}>
            An iPhone app for your parent. It hides scam texts, labels scam calls and pauses risky payments until you say yes. Your parent does nothing new.
          </p>
          <a href={DASHBOARD} className={`rise-late mt-9 self-start bg-sage text-white hover:bg-sage-deep lg:self-center ${button}`}>Open the family dashboard</a>
        </header>

        {/* Phones and small tablets get each screen inline under its block instead (below). */}
        <div className="sticky top-3 col-start-2 row-span-2 row-start-1 hidden h-[calc(100svh-24px)] self-start lg:block">
          <div className="relative h-full overflow-hidden rounded-[20px] bg-field">
            <Stage className="flex h-full items-center justify-center pb-14" />
            <p className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-between bg-paper px-6 text-lg">
              <span>On your parent&rsquo;s iPhone</span>
              <span>Texts never leave the phone</span>
            </p>
          </div>
        </div>

        <section id="how" aria-labelledby="how-heading" className="scroll-mt-4 px-5 pt-16 sm:px-10 lg:px-[10%] lg:pt-[14svh]">
          <h2 id="how-heading" className="font-display text-[clamp(1.75rem,1.5rem+0.8vw,2.25rem)] leading-tight tracking-[-0.01em]">What your parent sees</h2>
          {STORY.map((s, i) => (
            <div key={s.title} data-step={i + 1} className="flex flex-col justify-center py-12 lg:min-h-[78svh] lg:py-10 lg:last:min-h-[60svh]">
              <h3 className="rise max-w-[24ch] font-display text-[clamp(1.75rem,1.5rem+0.8vw,2.25rem)] leading-tight tracking-[-0.01em]">{s.title}</h3>
              <p className={`rise-late mt-4 max-w-[42ch] ${body}`}>{s.body}</p>
              <div aria-hidden="true" className="mt-8 flex justify-center rounded-[20px] bg-field py-5 sm:px-3 lg:hidden">{SCREENS[i + 1]}</div>
            </div>
          ))}
        </section>
      </div>

      <div className="mt-8 lg:mt-12">
        <Tryout />
      </div>

      <section id="family" aria-labelledby="family-heading" className="px-5 py-28 sm:px-10 lg:py-44 lg:pl-[18%]">
        <h2 id="family-heading" className={`rise max-w-[20ch] ${head}`}>What the family can do</h2>
        <div className="mt-16 space-y-16 lg:space-y-28">
          {FAMILY.map((f) => (
            <div key={f.title} className="grid max-w-[880px] gap-6 md:grid-cols-[420px_1fr] md:gap-10">
              <div data-ui className="rise flex min-h-[200px] items-center overflow-hidden rounded-[20px] bg-panel p-6 sm:p-8">{f.panel}</div>
              <div className="rise-late md:pt-2">
                <h3 className={`${lead} font-semibold`}>{f.title}</h3>
                <p className={`mt-3 max-w-[36ch] ${body}`}>{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" aria-labelledby="privacy-heading" className={`bg-panel px-5 py-28 sm:px-10 lg:py-44 ${body}`}>
        <div className="mx-auto max-w-[600px]">
          <h2 id="privacy-heading" className={`rise font-display ${lead}`}>A note on privacy, from the people who built it</h2>
          <div className="rise-late mt-8 space-y-6">
            <p>We made one promise before anything else: <mark className="bg-field box-decoration-clone px-1 text-ink">your parent&rsquo;s texts never leave the iPhone.</mark></p>
            <p>The scam check is a small model that runs on the phone itself. It reads a text, decides, and keeps the answer to itself. We never see the message, and neither does any cloud AI service.</p>
            <p>Money works the other way around. No model can move a dollar. Fixed rules decide which payments pause, and only a person in the family can let a paused payment through.</p>
            <p>The family sees what it needs to decide: the payment, the payee and the reason. Your parent keeps the phone they already know, with nothing new to learn.</p>
          </div>
          <p className={`mt-10 font-display italic ${lead}`}>The checkwith.us team</p>
          <p className="mt-1 text-soft">Built at SwampHacks</p>
        </div>
      </section>

      <section id="questions" aria-labelledby="questions-heading" className="px-5 py-28 sm:px-10 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-44">
        <h2 id="questions-heading" className="rise font-display text-[clamp(2.75rem,2rem+1.6vw,3.5rem)] leading-[1.02] tracking-[-0.02em] lg:col-span-3">Questions</h2>
        <div className={`rise-late mt-10 gap-14 lg:col-span-8 lg:col-start-5 lg:mt-0 lg:columns-2 ${body}`}>
          {FAQ.map(([q, a]) => (
            <p key={q} className="mb-6 break-inside-avoid">
              <strong className="font-semibold">{q}</strong> {a}
            </p>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta-heading" className="grid gap-12 bg-sage px-5 py-20 text-white sm:px-10 lg:grid-cols-12 lg:items-center lg:py-32">
        <div className="lg:col-span-6">
          <h2 id="cta-heading" className={`rise max-w-[12ch] ${head}`}>Be the one they check with.</h2>
          <p className={`rise-late mt-6 max-w-[36ch] ${body}`}>
            Sign in to see paused payments, approve or deny them, freeze spending and set allowances.
          </p>
        </div>
        <div data-ui className="rise w-full max-w-[440px] self-center rounded-[28px] bg-screen p-5 text-ink sm:p-7 shadow-[0_24px_60px_rgb(0_0_0/0.25)] lg:col-span-5 lg:col-start-8">
          <p className="font-display text-[30px] leading-none tracking-[-0.02em]">checkwith.us</p>
          <p className="mt-6 text-[22px] leading-snug font-semibold">Family dashboard</p>
          <ul className="mt-4 space-y-3 text-lg">
            <li className="flex justify-between gap-4 rounded-2xl bg-panel px-4 py-3"><span>Gift cards, during a call</span><span className="font-semibold">$500.00</span></li>
            <li className="flex justify-between gap-4 rounded-2xl bg-panel px-4 py-3"><span>Wire transfer, new payee</span><span className="font-semibold">$1,500.00</span></li>
          </ul>
          <p className="mt-3 text-lg text-soft">Sample holds. Yours appear after you sign in.</p>
          <a href={DASHBOARD} className={`mt-6 flex w-full bg-sage text-white hover:bg-sage-deep ${button}`}>Open the family dashboard</a>
        </div>
      </section>

      <footer className="grid gap-2 px-5 pt-14 pb-10 text-lg text-soft sm:px-10 lg:grid-cols-[1fr_auto_1fr] lg:items-baseline">
        <p>Scam protection the family runs</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-ink">
          <a href="#how" className={`hover:underline ${focus}`}>How it works</a>
          <a href="#try" className={`hover:underline ${focus}`}>Try a payment</a>
          <a href="#privacy" className={`hover:underline ${focus}`}>Privacy</a>
          <a href="#questions" className={`hover:underline ${focus}`}>Questions</a>
          <a href={DASHBOARD} className={`hover:underline ${focus}`}>Family sign in</a>
        </nav>
        <p className="lg:text-right">2026. Built at SwampHacks.</p>
      </footer>
    </div>
  );
}
