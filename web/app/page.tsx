import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Approvers } from './_landing-apple/approvers';
import { CallScreen, FamilyScreen, JunkScreen, PausedScreen, Phone, SafeScreen } from './_landing-apple/phone';
import { StoryStage, type Chapter } from './_landing-apple/story';

// Inter, SIL Open Font License 1.1. The optical size axis gives display cuts at headline sizes.
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], variable: '--font-inter-ap', display: 'swap' });

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'An iPhone app that hides scam texts, labels scam calls and pauses risky payments until the family says yes. Your parent does nothing new.',
};

// Auth0 routes need a full page load, so these are plain <a> tags, not next/link.
const DASHBOARD = '/auth/login?returnTo=/dashboard';

const hero = 'text-[clamp(2.75rem,0.9rem+7.2vw,7.5rem)] leading-[0.98] font-semibold tracking-[-0.045em]';
const display = 'text-[clamp(2.5rem,1.2rem+3.6vw,4.75rem)] leading-[1.03] font-semibold tracking-[-0.035em] text-balance';
const lead = 'text-[clamp(1.375rem,1.1rem+0.9vw,1.875rem)] leading-[1.3] tracking-[-0.012em]';
const body = 'text-[clamp(1.1875rem,1.1rem+0.25vw,1.3125rem)] leading-[1.5]';
const gutter = 'px-4 sm:px-8 lg:px-[clamp(2rem,5vw,6rem)]';
const section = 'py-[clamp(6rem,3rem+8vw,11rem)]';
const ringDark = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ap-sky';
const ringLight = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ap-blue';
const pill = 'inline-flex min-h-14 items-center justify-center rounded-full bg-ap-blue px-8 text-[1.1875rem] text-white transition-[transform,background-color] duration-200 hover:bg-ap-blue-press active:scale-95';

const CHAPTERS: Chapter[] = [
  {
    id: 'texts',
    name: 'Texts',
    title: 'Scam texts never reach the inbox.',
    body: 'A small scam model runs on the iPhone itself. It reads texts from unknown senders and moves scams to Junk. The words never leave the phone.',
    label: 'The Junk folder on the parent’s phone, holding four scam texts that checkwith.us moved there.',
    screen: <JunkScreen />,
  },
  {
    id: 'calls',
    name: 'Calls',
    title: 'Scam calls say “Possible scam.”',
    body: 'Known scam numbers show a plain warning on the call screen, before anyone picks up. Your parent can let it ring.',
    label: 'An incoming call labelled Possible scam.',
    screen: <CallScreen />,
  },
  {
    id: 'payments',
    name: 'Payments',
    title: 'Risky payments wait for the family.',
    body: 'A gift card bought during a phone call pauses. The screen says so in big words, and the family gets a push with the reason.',
    label: 'The parent’s phone says Paused, your family will call you, for a $500 gift card bought during a call.',
    screen: <PausedScreen />,
  },
  {
    id: 'family',
    name: 'Family',
    title: 'The family says yes or no.',
    body: 'Over $1,000, two people must say yes, and one no stops it. No answer in time means no payment.',
    label: 'A family member’s phone asking to approve or deny a $1,250 payment to a new payee.',
    screen: <FamilyScreen />,
  },
];

const REASONS = [
  { name: 'Gift cards', text: 'Always pause, however small.' },
  { name: 'Crypto', text: 'Always pauses.' },
  { name: 'Wire transfers', text: 'Always pause.' },
  { name: 'Someone new', text: 'A payee your parent has not paid before.' },
  { name: 'Over the limit', text: 'More than the amount the family sets. It starts at $300.' },
  { name: 'Unusual for them', text: 'Three times what they usually spend on that kind of thing.' },
  { name: 'During a call', text: 'Paid while a phone call is on.' },
  { name: 'Cash, then a gift card', text: 'Cash from an ATM, then a gift card soon after.' },
];

function Wordmark() {
  return <span className="font-semibold tracking-[-0.03em]">checkwith<span className="text-ap-mute-dark">.us</span></span>;
}

export default function Home() {
  return (
    <div className={`${inter.variable} w-full overflow-x-clip bg-black font-ap text-white antialiased`}>
      <header className="sticky top-0 z-40 bg-black">
        <nav aria-label="Main" className={`mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-6 ${gutter}`}>
          <a href="#top" className={`rounded-md text-[1.375rem] ${ringDark}`}><Wordmark /></a>
          <div className="flex items-center gap-2 text-[1.125rem] sm:gap-6">
            <a href="#story" className={`hidden rounded-md text-ap-mute-dark transition-colors hover:text-white md:inline ${ringDark}`}>How it works</a>
            <a href="#family-tools" className={`hidden rounded-md text-ap-mute-dark transition-colors hover:text-white md:inline ${ringDark}`}>Family</a>
            <a href="#privacy" className={`hidden rounded-md text-ap-mute-dark transition-colors hover:text-white md:inline ${ringDark}`}>Privacy</a>
            <a href={DASHBOARD} className={`inline-flex min-h-11 items-center rounded-full bg-ap-blue px-5 text-white transition-[transform,background-color] hover:bg-ap-blue-press active:scale-95 ${ringDark}`}>
              <span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Open the family dashboard</span>
            </a>
          </div>
        </nav>
      </header>

      <main id="top">
        {/* Hero: the promise, then the phone rising out of the dark. */}
        <section className={`overflow-hidden pt-[clamp(3.5rem,2rem+5vw,7rem)] text-center ${gutter}`}>
          <h1 className={`ap-in mx-auto max-w-[14ch] text-balance ${hero}`}>It checks with us first.</h1>
          <p className={`ap-in ap-delay-1 mx-auto mt-6 max-w-[38rem] text-balance text-ap-mute-dark ${lead}`}>
            Scam protection for your parent&rsquo;s iPhone. Your parent does nothing new. Your family makes the calls.
          </p>
          <div className="ap-in ap-delay-2 mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            <a href={DASHBOARD} className={`${pill} ${ringDark}`}>Open the family dashboard</a>
            <a href="#story" className={`group rounded-md text-[1.1875rem] text-ap-sky ${ringDark}`}>
              See how it works <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">&rsaquo;</span>
            </a>
          </div>
          <div className="ap-in ap-delay-3 mx-auto mt-[clamp(2.5rem,1rem+3vw,4rem)] w-[clamp(17rem,32vw,27rem)]">
            <div className="ap-lift origin-top">
              <Phone label="The parent's phone says: You're safe. Nothing needs you today.">
                <SafeScreen />
              </Phone>
            </div>
          </div>
        </section>

        {/* The story: one phone, four moments. Pinned on desktop, stacked on phones. */}
        <div id="story" className="scroll-mt-16">
          <StoryStage chapters={CHAPTERS} />
          <div className={`lg:hidden ${gutter}`}>
            {CHAPTERS.map((c) => (
              <section key={c.id} aria-labelledby={`m-${c.id}`} className="py-20">
                <h2 id={`m-${c.id}`} className={`ap-rise ${display}`}>{c.title}</h2>
                <p className={`ap-rise-2 mt-5 max-w-[34rem] ${body}`}>{c.body}</p>
                <div className="ap-rise-3 mx-auto mt-12 w-[min(17.5rem,76vw)]">
                  <Phone label={c.label}>{c.screen}</Phone>
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Reasons: every hold explains itself. */}
        <section aria-labelledby="reasons" className={`bg-white text-ap-ink ${section}`}>
          <div className={`mx-auto max-w-[90rem] ${gutter}`}>
            <h2 id="reasons" className={`ap-rise max-w-[16ch] ${display}`}>Every pause comes with a reason.</h2>
            <p className={`ap-rise-2 mt-6 max-w-[36rem] ${lead}`}>The family sees why, in plain words. Never &ldquo;the AI said so.&rdquo;</p>
            <ul className="mt-[clamp(3.5rem,2rem+4vw,6rem)] grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {REASONS.map((r) => (
                <li key={r.name} className="ap-rise">
                  <p className="text-[clamp(1.375rem,1.2rem+0.5vw,1.625rem)] leading-tight font-semibold tracking-[-0.02em]">{r.name}</p>
                  <p className={`mt-2 ${body}`}>{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The rule that matters most, as one statement. */}
        <section aria-labelledby="rule" className={`bg-ap-parch text-ap-ink ${section}`}>
          <div className={`mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end ${gutter}`}>
            <h2 id="rule" className={`ap-rise ${display}`}>AI suggests. Code decides money.</h2>
            <p className={`ap-rise-2 max-w-[34rem] ${lead}`}>
              The scam model can add a reason to pause. It can never remove one. Fixed rules make the call, and a person has the last word.
            </p>
          </div>
        </section>

        {/* Family tools: edge-to-edge tiles, each with its own piece of the app. */}
        <section id="family-tools" aria-labelledby="family-head" className="scroll-mt-16 bg-ap-parch pb-3 text-ap-ink">
          <div className={`mx-auto max-w-[90rem] pb-[clamp(3rem,2rem+3vw,5rem)] ${gutter}`}>
            <h2 id="family-head" className={`ap-rise ${display}`}>The family does the work.</h2>
          </div>
          <div className="grid gap-3 px-3 md:grid-cols-2">
            <article className="flex flex-col items-start gap-10 bg-white px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
              <div>
                <h3 className={`ap-rise ${display}`}>Two yeses over $1,000.</h3>
                <p className={`ap-rise-2 mt-4 max-w-[30rem] ${body}`}>One no stops it. Try it: answer for Sam and Priya.</p>
              </div>
              <div className="ap-rise-3 w-full"><Approvers /></div>
            </article>

            <article className="flex flex-col items-start gap-10 bg-ap-tile px-6 py-14 text-white sm:px-12 sm:py-16 lg:px-16">
              <div>
                <h3 className={`ap-rise ${display}`}>Freeze in one tap.</h3>
                <p className={`ap-rise-2 mt-4 max-w-[30rem] ${body}`}>Freeze moves the spending money into a vault account. Nothing goes out until the family unfreezes it.</p>
              </div>
              <div data-ui className="ap-rise-3 w-full max-w-[28rem] rounded-[1.5rem] bg-black p-6 sm:p-8">
                <p className="flex items-center justify-between text-[1.1875rem] font-semibold">Rosa&rsquo;s money<span className="rounded-full bg-white px-3 py-1 text-[1.125rem] text-ap-ink">Frozen</span></p>
                <dl className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-ap-tile p-4"><dt className="text-[1.125rem] text-ap-mute-dark">Spending</dt><dd className="mt-1 text-[1.75rem] font-semibold tracking-[-0.02em]">$0.00</dd></div>
                  <div className="rounded-2xl bg-ap-tile p-4"><dt className="text-[1.125rem] text-ap-mute-dark">Vault</dt><dd className="mt-1 text-[1.75rem] font-semibold tracking-[-0.02em]">$2,340.00</dd></div>
                </dl>
              </div>
            </article>

            <article className="flex flex-col items-start gap-10 bg-ap-tile px-6 py-14 text-white sm:px-12 sm:py-16 lg:px-16">
              <div>
                <h3 className={`ap-rise ${display}`}>Routine bills just pay.</h3>
                <p className={`ap-rise-2 mt-4 max-w-[30rem] ${body}`}>Set an allowance, like utility bills under $200 until Nov 30. Inside it, bills pay with no push. Outside it, the usual pause.</p>
              </div>
              <div data-ui className="ap-rise-3 w-full max-w-[28rem] rounded-[1.5rem] bg-black p-6 sm:p-8">
                <p className="text-[1.125rem] text-ap-mute-dark">Allowance</p>
                <p className="mt-1 text-[1.1875rem] font-semibold">Utility bills under $200, until Nov 30</p>
                <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-ap-tile p-4">
                  <span className="text-[1.1875rem]">City Electric</span>
                  <span className="text-[1.75rem] font-semibold tracking-[-0.02em]">$86.40</span>
                </div>
                <p className="mt-4 text-[1.125rem] text-ap-mute-dark">Paid. No push needed.</p>
              </div>
            </article>

            <article className="flex flex-col items-start gap-10 bg-white px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
              <div>
                <h3 className={`ap-rise ${display}`}>At the bank, on a call.</h3>
                <p className={`ap-rise-2 mt-4 max-w-[30rem] ${body}`}>If your parent is at a bank while a phone call is on, the family hears about it right away.</p>
              </div>
              <div data-ui className="ap-rise-3 w-full max-w-[28rem] rounded-[1.5rem] bg-ap-parch p-6 sm:p-8">
                <p className="flex justify-between text-[1.125rem] text-ap-mute"><span>checkwith.us</span><span>now</span></p>
                <p className="mt-2 text-[1.1875rem] leading-snug font-semibold">Rosa is at a bank while on a phone call.</p>
                <p className="mt-1 text-[1.1875rem] leading-snug">Call her before any cash changes hands.</p>
                <span className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-ap-blue text-[1.1875rem] font-semibold text-white">Call Rosa</span>
              </div>
            </article>
          </div>
        </section>

        {/* Privacy: the strongest promise, alone on black. */}
        <section id="privacy" aria-labelledby="privacy-head" className={`scroll-mt-16 bg-black ${section}`}>
          <div className={`mx-auto max-w-[90rem] ${gutter}`}>
            <h2 id="privacy-head" className="ap-rise max-w-[13ch] text-[clamp(2.75rem,0.9rem+6vw,6.75rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance">Their texts stay on their phone.</h2>
            <div className="mt-[clamp(3rem,2rem+3vw,5rem)] grid gap-10 lg:grid-cols-2">
              <p className={`ap-rise-2 max-w-[34rem] ${lead}`}>
                The scam check runs on the iPhone. Texts and bills are never sent to a cloud AI model. The family sees the money side: payments, pauses and the reasons.
              </p>
              <p className={`ap-rise-3 max-w-[34rem] text-ap-mute-dark ${body}`}>
                Under the hood, payments run through Capital One&rsquo;s Nessie API. Sign-in, family roles and approval pushes run on Auth0. Spending history and the cash-then-gift-card check run on Tiger Data.
              </p>
            </div>
          </div>
        </section>

        {/* One app, two roles, then the one action. */}
        <section aria-labelledby="app-head" className={`overflow-hidden bg-white text-ap-ink ${section}`}>
          <div className={`mx-auto grid max-w-[90rem] items-center gap-16 lg:grid-cols-[1fr_auto] ${gutter}`}>
            <div>
              <h2 id="app-head" className={`ap-rise max-w-[14ch] ${display}`}>One app for the whole family.</h2>
              <p className={`ap-rise-2 mt-6 max-w-[34rem] ${body}`}>
                The same iPhone app runs on your parent&rsquo;s phone and on yours. On theirs, it guards. On yours, it asks. This website is the family dashboard.
              </p>
              <p className={`ap-rise-2 mt-4 max-w-[34rem] text-ap-mute ${body}`}>The iPhone app is not in the App Store yet.</p>
              <a href={DASHBOARD} className={`ap-rise-3 mt-10 ${pill} ${ringLight}`}>Open the family dashboard</a>
            </div>
            <div className="ap-rise-2 flex items-end justify-center gap-[clamp(1rem,3vw,2.5rem)]">
              <div className="w-[clamp(9.5rem,22vw,18rem)]">
                <Phone label="Rosa's phone, showing a paused payment.">
                  <PausedScreen />
                </Phone>
                <p className="mt-4 text-center text-[1.125rem] text-ap-mute">Rosa&rsquo;s phone</p>
              </div>
              <div className="w-[clamp(9.5rem,22vw,18rem)] -translate-y-8">
                <Phone label="Sam's phone, asking to approve or deny a payment.">
                  <FamilyScreen />
                </Phone>
                <p className="mt-4 text-center text-[1.125rem] text-ap-mute">Sam&rsquo;s phone</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={`bg-ap-parch pt-[clamp(4rem,3rem+3vw,6rem)] pb-10 text-ap-ink ${gutter}`}>
        <div className="mx-auto max-w-[90rem]">
          <p aria-hidden className="text-[clamp(3.25rem,-0.2rem+15.2vw,14.5rem)] leading-[0.9] font-semibold tracking-[-0.055em]">
            checkwith<span className="text-ap-mute">.us</span>
          </p>
          <div className="mt-10 flex flex-col gap-4 text-[1.125rem] text-ap-mute sm:flex-row sm:items-center sm:justify-between">
            <p>Built at SwampHacks XII. The people and payments shown are made up.</p>
            <a href={DASHBOARD} className={`rounded-md text-ap-blue ${ringLight}`}>Open the family dashboard</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
