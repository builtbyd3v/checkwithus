import type { Metadata } from 'next';
import Link from 'next/link';
import { ApproveScreen, AskScreen, Icon, Logo, PausedScreen, SafeScreen, StoppedScreen, type IconName } from './_landing/screens';
import { Tryout } from './_landing/tryout';

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'An iPhone app for older adults. It hides scam texts, labels scam calls and pauses risky payments until someone in the family says yes.',
};

// Auth0 redirects need a full page load, so these are plain <a> tags, not next/link.
const DASHBOARD = '/dashboard';
const GITHUB = 'https://github.com/builtbyd3v/checkwith.us';

// The focus ring takes the text colour, so it shows on every band: yellow, purple, light and dark.
const focus = 'rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-current';
const pad = 'px-4 sm:px-10 lg:px-16 xl:px-28';
const section = `${pad} py-20 lg:py-28`;
const h2 = 'text-[clamp(2.5rem,1.4rem+4.2vw,4.25rem)] leading-none font-extrabold tracking-[-0.03em] text-balance';
const bigButton = `inline-flex min-h-16 items-center gap-3 rounded-xl px-6 text-[clamp(1.25rem,1.1rem+0.6vw,1.6rem)] font-extrabold transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none ${focus}`;

// An eye chart: each line a step smaller, as at the optician.
const CHANGES: { icon: IconName; title: string; body: string; size: string }[] = [
  { icon: 'tray', title: 'Scam texts go to Spam.', body: 'A small model on their iPhone checks texts from unknown senders. The texts never leave the phone.', size: 'text-[clamp(2.25rem,1.1rem+4.4vw,5rem)]' },
  { icon: 'phone', title: 'Scam calls say “Possible scam.”', body: 'Known scam numbers get a plain label before they pick up.', size: 'text-[clamp(1.95rem,1.05rem+3.4vw,3.9rem)]' },
  { icon: 'pause', title: 'Risky payments wait for family.', body: 'Gift cards, crypto, wires, new payees, big or unusual amounts, and payments made during a call.', size: 'text-[clamp(1.7rem,1rem+2.6vw,3rem)]' },
  { icon: 'check', title: 'Everything else works as usual.', body: 'Groceries and known bills pay like before.', size: 'text-[clamp(1.5rem,1rem+1.9vw,2.4rem)]' },
];

const STEPS = [
  { caption: 'They tap Pay.', Screen: AskScreen },
  { caption: 'It waits for family.', Screen: PausedScreen },
  { caption: 'You say no.', Screen: StoppedScreen },
];

const FAMILY = [
  { title: 'Say yes or no with Face ID.', body: 'Each paused payment appears in your family app with the amount, the payee and every reason. Over $1,000, two people must say yes.' },
  { title: 'Freeze their money.', body: 'Freeze moves their spending money to a safe account. Payments stop until you unfreeze.' },
  { title: 'Allow the routine bills.', body: 'An allowance pre-approves one payee or one category, up to a limit, until a date you pick.' },
  { title: 'See what is unusual.', body: 'A payment more than 3 times their usual for that category pauses. Their usual comes from the last 90 days.' },
  { title: 'Hear about the bank visit.', body: 'One alert when their phone is at a bank during a call. Only the bank’s name is sent.' },
  { title: 'Keep it switched on.', body: 'Only family can unpair their phone.' },
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
  ['What if nobody answers?', 'The payment is stopped. A paused payment never goes through on its own.'],
  ['Can the AI approve a payment?', 'No. A model can add a reason to pause. There is no path in the code that lets it remove one.'],
  ['Where is the iPhone app?', 'It runs on our test iPhones and is not in the App Store yet. The family dashboard on this site works today.'],
  ['Is real money moving?', 'Not yet. Payments run on Capital One’s Nessie test bank, with pretend accounts.'],
] as const;

export default function Home() {
  return (
    <div className="flex-1 bg-background font-print text-lg text-foreground selection:bg-sun selection:text-on-sun sm:text-xl">
      <a href="#main" className="sr-only z-10 rounded-md bg-foreground px-4 py-3 font-bold text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to content</a>

      <header className="bg-hero pb-16 text-on-hero lg:pb-24">
        <nav aria-label="Main" className={`${pad} flex min-h-24 items-center justify-between gap-4 lg:min-h-28`}>
          <Link href="/" className={`flex min-h-11 items-center gap-3 ${focus}`}>
            <Logo className="size-11 rounded-xl bg-[#16121c] p-1.5" />
            <span className="text-xl font-extrabold tracking-[-0.01em] sm:text-2xl">checkwith.us</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#changes" className={`hidden min-h-11 items-center text-xl font-bold underline-offset-[0.25em] hover:underline md:inline-flex ${focus}`}>How it works</a>
            <a href="#try" className={`hidden min-h-11 items-center text-xl font-bold underline-offset-[0.25em] hover:underline md:inline-flex ${focus}`}>Try it</a>
            <a href={DASHBOARD} className={`inline-flex min-h-12 items-center rounded-xl px-4 text-lg font-bold whitespace-nowrap shadow-[inset_0_0_0_2px_currentColor] sm:text-xl ${focus}`}>Family sign in</a>
          </div>
        </nav>

        <div className={`${pad} grid items-center gap-12 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-10`}>
          <div>
            <h1 className="text-[clamp(3.75rem,1.4rem+10vw,9.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance">You&rsquo;re safe.</h1>
            <p className="mt-6 max-w-[17em] text-[clamp(1.5rem,1.2rem+1.3vw,2.15rem)] leading-[1.22] font-bold text-pretty">
              Most days, that is all your parent reads. Your family checks every risky payment for them.
            </p>
            <a href={DASHBOARD} className={`mt-9 bg-hero-button text-on-hero-button hover:opacity-90 ${bigButton}`}>
              Open the family dashboard <Icon name="arrow" className="size-[1.1em]" />
            </a>
          </div>
          <SafeScreen className="justify-self-center text-[10px] sm:text-[11px] lg:text-[11.5px]" />
        </div>
      </header>

      <main id="main">
        <section id="changes" aria-labelledby="changes-heading" className={`${section} scroll-mt-4`}>
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

        <section aria-labelledby="pause-heading" className={`${section} bg-surface`}>
          <h2 id="pause-heading" className={`max-w-[13em] ${h2}`}>The pause, one screen at a time.</h2>
          <ol className="mt-12 grid justify-items-center gap-14 md:grid-cols-3 md:gap-6">
            {STEPS.map(({ caption, Screen }, i) => (
              <li key={caption} className="grid justify-items-center gap-6">
                <Screen className="text-[10px] md:text-[7.4px] lg:text-[8.6px] xl:text-[10px]" />
                <p className="flex items-center gap-3 text-2xl font-extrabold lg:text-[1.65rem]">
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-foreground text-xl text-background">{i + 1}</span>
                  {caption}
                </p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-14 max-w-[44ch] text-center text-xl leading-snug sm:text-2xl">
            Something feels wrong? They tap <b>Ask my family</b>, or say to Siri, &ldquo;Ask my family in Check With Us.&rdquo; You get an alert and call them.
          </p>
        </section>

        <Tryout />

        <section aria-labelledby="family-heading" className={`${section} bg-band text-white`}>
          <h2 id="family-heading" className={`max-w-[13em] ${h2}`}>You get the hard part.</h2>
          <div className="mt-12 grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
            <ul>
              {FAMILY.map((f) => (
                <li key={f.title} className="border-t-2 border-white/30 py-5">
                  <h3 className="text-[clamp(1.6rem,1.3rem+1vw,2rem)] leading-tight font-extrabold tracking-[-0.015em] text-balance">{f.title}</h3>
                  <p className="mt-2 max-w-[44ch] text-xl leading-snug text-[#eaddf5] sm:text-[1.35rem]">{f.body}</p>
                </li>
              ))}
            </ul>
            <ApproveScreen className="justify-self-center text-[10px] sm:text-[11px] lg:sticky lg:top-8 lg:text-[10.5px]" />
          </div>
        </section>

        <section id="privacy" aria-labelledby="privacy-heading" className={`${section} scroll-mt-4`}>
          <h2 id="privacy-heading" className="max-w-[9em] text-[clamp(2.75rem,1.2rem+6vw,6.6rem)] leading-none font-extrabold tracking-[-0.03em] text-balance">
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

        <section aria-labelledby="cta-heading" className={`${section} bg-hero text-on-hero lg:py-32`}>
          <h2 id="cta-heading" className="max-w-[9em] text-[clamp(2.75rem,1.2rem+6vw,6.6rem)] leading-none font-extrabold tracking-[-0.03em] text-balance">Be the one they check with.</h2>
          <p className="mt-6 max-w-[24ch] text-[clamp(1.4rem,1.15rem+1vw,1.9rem)] leading-snug font-bold">Sign in to approve, deny, freeze and set allowances.</p>
          <a href={DASHBOARD} className={`mt-9 bg-hero-button text-on-hero-button hover:opacity-90 ${bigButton}`}>
            Open the family dashboard <Icon name="arrow" className="size-[1.1em]" />
          </a>
        </section>
      </main>

      <footer className={`${pad} flex flex-col gap-4 py-10 text-muted lg:flex-row lg:items-center lg:justify-between`}>
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
