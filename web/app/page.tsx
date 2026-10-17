import type { Metadata } from 'next';
import Link from 'next/link';
import { HOLD_REASON_LABELS } from '@/lib/rules';
import { AllowanceArt, BankArt, FreezeArt, HeroArt, LineIcon, Mark, PrivacyArt, type IconName } from './_landing-airbnb/art';
import { DayStory } from './_landing-airbnb/day-story';
import { FamilyVote } from './_landing-airbnb/family-vote';
import { figtree } from './_landing-airbnb/font';

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description: 'Your parent does nothing different. Scam texts stay out, scam calls get a warning, and risky payments wait until the family says yes.',
};

const DASHBOARD = '/auth/login?returnTo=/dashboard';

const focus = 'focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-cw-ink';
const container = 'mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10';
// The one shadow tier, only on notes that float over the picture.
const floatShadow = 'shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_6px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.1)]'; // taste-skill-ignore

const PAUSES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'gift', title: 'Gift cards', text: 'Any gift card purchase, of any size.' },
  { icon: 'coin', title: 'Crypto', text: 'Any crypto purchase.' },
  { icon: 'person', title: 'New payees', text: 'Someone she has not paid before.' },
  { icon: 'stack', title: 'Large amounts', text: 'Anything over the limit you set. It starts at $300.' },
  { icon: 'spike', title: 'Unusual amounts', text: 'Much more than she usually spends on this kind of thing.' },
  { icon: 'call', title: 'Paying during a call', text: 'A payment started while she is on the phone.' },
  { icon: 'atm', title: 'ATM cash, then a gift card', text: 'Cash out, then a gift card soon after. A common scam script.' },
  { icon: 'wire', title: 'Wire transfers', text: 'Any wire transfer.' },
];

function DashboardButton({ tone = 'coral', className = '' }: { tone?: 'coral' | 'white'; className?: string }) {
  const colors = tone === 'coral' ? 'bg-cw-coral text-white hover:bg-cw-coral-deep' : 'bg-white text-cw-ink hover:bg-cw-blush';
  return (
    <Link
      href={DASHBOARD}
      className={`group inline-flex min-h-14 items-center gap-3 rounded-full px-7 text-lg font-semibold transition-[transform,background-color] duration-200 active:scale-[0.97] ${colors} ${focus} ${className}`}
    >
      Open the family dashboard
      <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

function Check({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className={`${figtree.variable} w-full flex-1 bg-white font-warm text-cw-ink`}>
      <a href="#main" className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 ${focus}`}>
        Skip to content
      </a>

      <header className={`${container} flex h-20 items-center justify-between gap-6`}>
        <Link href="/" className={`flex items-center gap-2 rounded-lg text-2xl font-bold tracking-[-0.02em] ${focus}`}>
          <Mark className="h-8 w-8" />
          checkwith.us
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {[
            ['#day', 'A day with Mom'],
            ['#pauses', 'What pauses'],
            ['#tools', 'Family tools'],
            ['#privacy', 'Privacy'],
          ].map(([href, label]) => (
            <a key={href} href={href} className={`rounded-md text-lg font-semibold text-cw-body underline-offset-8 hover:text-cw-ink hover:underline ${focus}`}>
              {label}
            </a>
          ))}
        </nav>
        <Link
          href={DASHBOARD}
          className={`inline-flex min-h-12 items-center rounded-full bg-cw-ink px-5 text-base font-semibold text-white transition-[transform,background-color] duration-200 hover:bg-black active:scale-[0.97] ${focus}`}
        >
          Family sign in
        </Link>
      </header>

      <main id="main">
        {/* Hero */}
        <section className={`${container} grid items-center gap-10 pb-12 pt-6 lg:grid-cols-12 lg:gap-12 lg:pb-16 lg:pt-10`}>
          <div className="lg:col-span-6">
            <h1 className="motion-safe:animate-cw-in text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-cw-ink sm:text-[56px] lg:text-[68px]">
              Mom does nothing. Family checks first.
            </h1>
            <p className="motion-safe:animate-cw-in mt-6 max-w-[34rem] text-xl leading-[1.55] text-cw-body [animation-delay:120ms] ">
              checkwith.us guards your parent’s iPhone. Scam texts stay out, scam calls get a warning, and risky payments wait
              until the family says yes.
            </p>
            <div className="motion-safe:animate-cw-in mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 [animation-delay:240ms]">
              <DashboardButton />
              <a href="#day" className={`rounded-md text-lg font-semibold text-cw-ink underline underline-offset-[6px] hover:text-cw-coral-deep ${focus}`}>
                See a day with Mom
              </a>
            </div>
          </div>
          <div className="relative lg:col-span-6">
            <div className="motion-safe:animate-cw-in aspect-[56/50] overflow-hidden rounded-[32px] [animation-delay:150ms]">
              <HeroArt />
            </div>
            {/* Floating notes: what the family sees during her day. */}
            <div className="pointer-events-none absolute inset-0">
              <div className="motion-safe:animate-cw-pop absolute left-3 top-4 [animation-delay:700ms] sm:left-6 sm:top-6">
                <div className={`motion-safe:animate-cw-float flex items-center gap-3 rounded-full bg-white py-2 pl-2 pr-5 ${floatShadow}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cw-coral text-white">
                    <LineIcon name="gift" className="h-5 w-5" />
                  </span>
                  <span className="text-base font-semibold">$500 gift card paused</span>
                </div>
              </div>
              <div className="motion-safe:animate-cw-pop absolute bottom-4 right-3 [animation-delay:1300ms] sm:bottom-6 sm:right-6">
                <div className={`motion-safe:animate-cw-float flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 [animation-delay:1.5s] ${floatShadow}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cw-safe text-white">
                    <Check className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold">Dani said no</span>
                    <span className="block text-base text-cw-body">Mom is safe</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three protections as one rounded strip. */}
        <section aria-label="What checkwith.us does" className={`${container} pb-24 lg:pb-32`}>
          <ul className="grid gap-2 rounded-[32px] bg-cw-soft p-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center md:rounded-full">
            {[
              ['Texts', 'Scam texts never reach the inbox'],
              ['Calls', 'Scam calls ring as “Possible scam”'],
              ['Payments', 'Risky ones wait for a family yes'],
            ].map(([label, text]) => (
              <li key={label} className="cw-reveal rounded-[24px] bg-white px-6 py-4 md:rounded-full">
                <span className="block text-base font-semibold text-cw-coral-deep">{label}</span>
                <span className="block text-lg font-semibold leading-snug text-cw-ink">{text}</span>
              </li>
            ))}
            <li className="hidden md:block" aria-hidden="true">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cw-coral text-white">
                <Check className="h-7 w-7" />
              </span>
            </li>
          </ul>
        </section>

        {/* A day in her life */}
        <section id="day" aria-labelledby="day-title" className="scroll-mt-6 pb-24 lg:pb-16">
          <div className={container}>
            <div className="max-w-[46rem]">
              <h2 id="day-title" className="cw-reveal text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
                One Tuesday with Mom
              </h2>
              <p className="cw-reveal-2 mt-5 text-xl leading-[1.55] text-cw-body">
                Nothing here asks Mom to learn anything new. Follow her day and see who does the work.
              </p>
            </div>
            <div className="mt-10 lg:mt-4">
              <DayStory />
            </div>
          </div>
        </section>

        {/* What pauses */}
        <section id="pauses" aria-labelledby="pauses-title" className="scroll-mt-6 bg-cw-soft py-24 lg:py-32">
          <div className={`${container} grid gap-14 lg:grid-cols-12 lg:gap-16`}>
            <div className="lg:col-span-7">
              <h2 id="pauses-title" className="cw-reveal text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
                What makes a payment pause
              </h2>
              <p className="cw-reveal-2 mt-5 max-w-[40rem] text-xl leading-[1.55] text-cw-body">
                Fixed rules decide, not a model. The scam check on her phone can add a pause. It can never remove one.
              </p>
              <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {PAUSES.map((p) => (
                  <li key={p.title} className="cw-reveal flex gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-cw-ink">
                      <LineIcon name={p.icon} className="h-7 w-7" />
                    </span>
                    <span>
                      <span className="block text-xl font-semibold text-cw-ink">{p.title}</span>
                      <span className="mt-1 block text-lg leading-[1.5] text-cw-body">{p.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-10">
                <figure className="cw-reveal rounded-[24px] bg-white p-6 sm:p-8">
                  <figcaption className="text-2xl font-semibold tracking-[-0.01em]">The reason, in plain words</figcaption>
                  <p className="mt-2 text-lg leading-[1.5] text-cw-body">
                    Every pause tells the family why. No scores, no jargon. This is what Dani saw at 10:05.
                  </p>
                  <div data-ui className="mt-6 rounded-[20px] bg-cw-warm p-5">
                    <div className="flex items-center gap-2 text-base font-semibold text-cw-coral-deep">
                      <Mark className="h-6 w-6" /> checkwith.us
                    </div>
                    <p className="mt-3 text-2xl font-semibold leading-tight">Mom wants to pay $500 in gift cards</p>
                    <p className="mt-4 text-base font-semibold text-cw-body">Why it paused</p>
                    <ul className="mt-2 space-y-2">
                      {[HOLD_REASON_LABELS.gift_card, HOLD_REASON_LABELS.during_call].map((r) => (
                        <li key={r} className="flex items-center gap-3 text-lg">
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-cw-coral" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <div aria-hidden="true" className="mt-6 grid grid-cols-2 gap-3">
                      <span className="flex min-h-12 items-center justify-center rounded-full bg-cw-coral text-lg font-semibold text-white">No, stop it</span>
                      <span className="flex min-h-12 items-center justify-center rounded-full bg-white text-lg font-semibold">Yes, pay</span>
                    </div>
                  </div>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* Two yeses over $1,000 */}
        <section aria-labelledby="vote-title" className="bg-cw-warm py-24 lg:py-32">
          <div className={`${container} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
            <div className="lg:col-span-5">
              <p aria-hidden="true" className="cw-reveal text-[120px] font-bold leading-[0.9] tracking-[-0.05em] text-cw-coral sm:text-[160px]">
                2 yes
              </p>
              <h2 id="vote-title" className="cw-reveal-2 mt-6 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
                Over $1,000, two of you must say yes.
              </h2>
              <p className="cw-reveal-3 mt-5 max-w-[30rem] text-xl leading-[1.55] text-cw-body">
                One no stops it. Try it: answer for the family. Mom is paying a roofing company she has never paid before.
              </p>
            </div>
            <div className="cw-reveal-2 lg:col-span-7">
              <FamilyVote reasons={[HOLD_REASON_LABELS.new_payee, HOLD_REASON_LABELS.over_limit]} />
            </div>
          </div>
        </section>

        {/* Family tools */}
        <section id="tools" aria-labelledby="tools-title" className="scroll-mt-6 py-24 lg:py-32">
          <div className={container}>
            <h2 id="tools-title" className="cw-reveal max-w-[60rem] text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
              Tools for the family, not chores for Mom
            </h2>
            <div className="mt-12 grid gap-6 lg:grid-cols-12">
              <article className="cw-reveal grid items-center overflow-hidden rounded-[32px] bg-[#cfe6f2] lg:col-span-12 lg:grid-cols-12">
                <div className="aspect-[52/30] lg:col-span-7">
                  <FreezeArt />
                </div>
                <div className="p-6 sm:p-10 lg:col-span-5 lg:pl-4">
                  <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]">Freeze sends her money to the vault.</h3>
                  <p className="mt-4 max-w-[36rem] text-lg leading-[1.6] text-cw-body sm:text-xl">
                    One tap from the family moves her spending balance into a separate vault account. Use it when something feels
                    wrong and you cannot reach her. A scammer finds nothing to take.
                  </p>
                </div>
              </article>
              <article className="cw-reveal-2 grid items-center overflow-hidden rounded-[32px] bg-[#fde7e1] sm:grid-cols-[2fr_3fr] lg:col-span-6">
                <div className="order-last aspect-[316/176] sm:order-none">
                  <BankArt />
                </div>
                <div className="p-6 sm:py-8 sm:pl-2 sm:pr-8">
                  <h3 className="text-2xl font-semibold leading-tight tracking-[-0.01em]">An alert when she is at a bank during a call.</h3>
                  <p className="mt-3 text-lg leading-[1.6] text-cw-body">
                    If her phone is on a call while she is at a bank or ATM, the family hears about it right away and can call her.
                  </p>
                </div>
              </article>
              <article className="cw-reveal-3 grid items-center overflow-hidden rounded-[32px] bg-cw-safe-tint sm:grid-cols-[2fr_3fr] lg:col-span-6">
                <div className="aspect-[276/188]">
                  <AllowanceArt />
                </div>
                <div className="p-6 sm:py-8 sm:pl-2 sm:pr-8">
                  <h3 className="text-2xl font-semibold leading-tight tracking-[-0.01em]">Allowances for routine bills.</h3>
                  <p className="mt-3 text-lg leading-[1.6] text-cw-body">
                    Set a limit, like utility bills under $200 until November 30. Bills inside it pay with no push to anyone.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-6 bg-cw-soft py-24 lg:py-32">
          <div className={`${container} grid items-center gap-12 lg:grid-cols-12 lg:gap-16`}>
            <div className="cw-reveal mx-auto w-full max-w-[420px] lg:col-span-5">
              <PrivacyArt />
            </div>
            <div className="lg:col-span-7">
              <h2 id="privacy-title" className="cw-reveal text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
                Her texts never leave her phone.
              </h2>
              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                <div className="cw-reveal-2">
                  <h3 className="text-xl font-semibold">The scam check runs on her iPhone.</h3>
                  <p className="mt-2 text-lg leading-[1.6] text-cw-body">Her messages and bills are never sent to a cloud AI model.</p>
                </div>
                <div className="cw-reveal-2">
                  <h3 className="text-xl font-semibold">AI suggests. Code decides money.</h3>
                  <p className="mt-2 text-lg leading-[1.6] text-cw-body">
                    Fixed rules hold a payment. A held payment goes through only when the family says yes.
                  </p>
                </div>
              </div>
              <p className="cw-reveal-3 mt-10 max-w-[40rem] text-lg leading-[1.6] text-cw-body">
                Built on Capital One’s Nessie API for accounts and transfers, Auth0 for family sign in and approvals, and Tiger
                Data for spending history.
              </p>
            </div>
          </div>
        </section>

        {/* Close */}
        <section aria-labelledby="close-title" className="bg-cw-coral py-24 text-white lg:py-32">
          <div className={`${container} grid items-end gap-10 lg:grid-cols-12`}>
            <div className="lg:col-span-8">
              <h2 id="close-title" className="cw-reveal text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
                One iPhone app, for Mom and for you.
              </h2>
              <p className="cw-reveal-2 mt-6 max-w-[40rem] text-xl leading-[1.55]">
                Her phone runs the protection. Your phone gets the questions. The website is where the family signs in to see
                holds, set limits, and press Freeze. The iPhone app is in testing and not in the App Store yet.
              </p>
            </div>
            <div className="cw-reveal-3 lg:col-span-4 lg:justify-self-end">
              <DashboardButton tone="white" />
            </div>
          </div>
        </section>
      </main>

      <footer className={`${container} pb-10 pt-16`}>
        <p aria-hidden="true" className="text-[clamp(56px,15vw,212px)] font-bold leading-[0.9] tracking-[-0.05em] text-cw-ink">
          checkwith.us
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-lg text-cw-body">
          <p>Made at SwampHacks XII. The people on this page are made up.</p>
          <Link href={DASHBOARD} className={`rounded-md font-semibold text-cw-ink underline underline-offset-4 hover:text-cw-coral-deep ${focus}`}>
            Family dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
