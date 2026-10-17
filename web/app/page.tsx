import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from './_landing-mercury/bits';
import { inter } from './_landing-mercury/fonts';
import { FreezeCard } from './_landing-mercury/freeze-card';
import {
  AllowanceFragment,
  BankAlertFragment,
  CallFragment,
  InboxFragment,
  PausedFragment,
  SequenceFragment,
  VoteFragment,
} from './_landing-mercury/fragments';
import { HeroStage } from './_landing-mercury/hero-stage';
import { Reveal } from './_landing-mercury/reveal';

export const metadata: Metadata = {
  title: 'checkwith.us | Scam protection the family runs',
  description:
    'Scam texts never arrive, scam calls are labeled, and risky payments wait until family says yes. Your parent does nothing new.',
};

const DASHBOARD = '/auth/login?returnTo=/dashboard';

const press = 'transition-[scale,background-color,color] duration-200 ease-[var(--ease-m)] active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-4';
const primary = `${press} inline-flex min-h-12 items-center justify-center rounded-full bg-m-indigo px-6 text-[17px] font-[480] text-white hover:bg-m-indigo-press focus-visible:outline-m-periwinkle`;
const glassDark = `${press} inline-flex min-h-12 items-center justify-center rounded-full bg-[rgba(175,178,206,0.2)] px-6 text-[17px] font-[480] text-m-on-dark hover:bg-[rgba(175,178,206,0.3)] focus-visible:outline-m-periwinkle`;
const navLink = 'rounded-full px-4 py-2 text-[17px] text-m-on-dark/85 transition-colors duration-200 hover:bg-white/8 hover:text-m-on-dark focus-visible:outline-2 focus-visible:outline-m-periwinkle';

const wrap = 'mx-auto w-full max-w-[1200px] px-4 sm:px-8';
const h2 = 'text-[32px] leading-[1.1] font-[480] tracking-[-0.01em] sm:text-[44px] lg:text-[52px]';
const lead = 'text-[18px] leading-[1.5] sm:text-[21px]';

const reasons = [
  ['Gift cards and crypto', 'Always paused, whoever is paid and however little.'],
  ['Someone new', 'A person or business they have not paid before.'],
  ['A large amount', 'Over the limit the family sets. It starts at $300.'],
  ['An unusual amount', 'Much more than they usually spend on this, from their own history.'],
  ['During a phone call', 'Scammers keep people on the line while they pay.'],
  ['Cash, then a gift card', 'ATM cash followed by a gift card within two hours.'],
] as const;
const stagger = ['[--d:0ms]', '[--d:70ms]', '[--d:140ms]', '[--d:210ms]', '[--d:280ms]', '[--d:350ms]'];

export default function Home() {
  return (
    <div className={`${inter.variable} m-landing flex-1 bg-m-canvas font-m text-[18px] text-m-ink antialiased`}>
      <Reveal />

      {/* Night: nav and hero */}
      <div className="overflow-hidden bg-m-night text-m-on-dark">
        <header className={`${wrap} flex h-18 items-center justify-between gap-4`}>
          <Link href="/" className="rounded-md text-[21px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-m-periwinkle">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="hidden items-center md:flex">
            <a className={navLink} href="#how">How it works</a>
            <a className={navLink} href="#freeze">Freeze</a>
            <a className={navLink} href="#privacy">Privacy</a>
          </nav>
          <Link href={DASHBOARD} className={`${press} inline-flex min-h-11 items-center rounded-full bg-m-indigo px-5 text-[17px] font-[480] text-white hover:bg-m-indigo-press focus-visible:outline-m-periwinkle`}>
            <span className="sm:hidden">Dashboard</span>
            <span className="hidden sm:inline">Open the family dashboard</span>
          </Link>
        </header>

        <section className={`${wrap} pt-12 pb-20 sm:pt-20 lg:pb-28`}>
          <div className="mx-auto max-w-[900px] text-center">
            <h1 className="m-in text-[38px] leading-[1.05] font-[480] tracking-[-0.015em] text-balance sm:text-[60px] lg:text-[76px]">
              Money waits until family says yes.
            </h1>
            <p className="m-in mx-auto mt-6 max-w-[640px] text-[18px] leading-[1.5] text-m-fog [animation-delay:120ms] sm:text-[21px]">
              checkwith.us guards an older parent&rsquo;s iPhone. Scam texts never arrive, scam calls ring as &ldquo;Possible scam,&rdquo; and risky payments pause until someone in the family approves.
            </p>
            <div className="m-in mt-9 flex flex-col justify-center gap-3 [animation-delay:220ms] sm:flex-row">
              <Link href={DASHBOARD} className={primary}>Open the family dashboard</Link>
              <a href="#how" className={glassDark}>See what your parent sees</a>
            </div>
          </div>
          <HeroStage />
        </section>
      </div>

      {/* Light: the parent does nothing */}
      <section id="how" className="scroll-mt-4 py-24 sm:py-32">
        <div className={wrap}>
          <div className="max-w-[760px]">
            <h2 data-reveal className={h2}>Your parent does nothing new.</h2>
            <p data-reveal className={`${lead} mt-5 [--d:90ms]`}>
              Protection runs on the iPhone they already use. There is nothing to learn and nothing to press. The family uses the same app on their own iPhones.
            </p>
          </div>

          <div className="mt-16 space-y-6 sm:mt-20">
            <Row
              title="Scam texts never reach the inbox."
              body="A scam check runs on the phone itself and keeps scam texts out of sight. The texts never leave the phone and are never sent to a cloud AI."
              picture={<InboxFragment />}
            />
            <Row
              flip
              title="Scam calls ring as “Possible scam.”"
              body="Known scam numbers carry a warning on the incoming call screen, so the warning comes before the hello."
              picture={<CallFragment />}
            />
            <Row
              title="Risky payments wait for family."
              body="The payment pauses and the screen says so in plain words. One big button calls the family. If nobody answers in time, the money stays put."
              picture={<PausedFragment />}
            />
          </div>
        </div>
      </section>

      {/* Lavender field: the reasons */}
      <section className="bg-m-lavender py-24 sm:py-32">
        <div className={`${wrap} grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-20`}>
          <div>
            <h2 data-reveal className={h2}>Every hold says why.</h2>
            <p data-reveal className={`${lead} mt-5 max-w-[520px] [--d:90ms]`}>
              The family sees the same reasons the rules used, in plain words anyone can check. &ldquo;The AI said so&rdquo; is never one of them.
            </p>
            <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {reasons.map(([term, detail], i) => (
                <div key={term} data-reveal className={stagger[i]}>
                  <dt className="text-[21px] font-[500]">{term}</dt>
                  <dd className="mt-1.5 text-[18px] leading-[1.5] text-m-ink-2">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div data-reveal="scale" className="self-center [--d:150ms]">
            <SequenceFragment />
          </div>
        </div>
      </section>

      {/* Light: two people decide */}
      <section className="py-24 sm:py-32">
        <div className={wrap}>
          <div className="mx-auto max-w-[960px] text-center">
            <h2 data-reveal className={h2}>Over $1,000, two people decide.</h2>
            <p data-reveal className={`${lead} mx-auto mt-5 max-w-[720px] [--d:90ms]`}>
              Large payments need two yes answers. One no stops it. Approvers decide, viewers stay informed, and the family chooses who is which.
            </p>
          </div>
          <div data-reveal="scale" className="mx-auto mt-14 max-w-[560px] [--d:180ms]">
            <VoteFragment />
          </div>
        </div>
      </section>

      {/* Night: Freeze, the one thing to try */}
      <section id="freeze" className="scroll-mt-4 bg-m-night py-24 text-m-on-dark sm:py-32">
        <div className={`${wrap} grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20`}>
          <div>
            <h2 data-reveal className={h2}>Freeze puts money out of reach.</h2>
            <p data-reveal className={`${lead} mt-5 max-w-[520px] text-m-fog [--d:90ms]`}>
              When a scam is happening right now, one tap moves the spending balance into a separate vault account. A scammer cannot rush money that is not there.
            </p>
            <p data-reveal className="mt-6 max-w-[520px] text-[18px] leading-[1.5] text-m-fog [--d:160ms]">
              Try it on the card. These are sample balances.
            </p>
          </div>
          <div data-reveal="scale" className="[--d:120ms]">
            <FreezeCard />
          </div>
        </div>
      </section>

      {/* Light: quiet when nothing is wrong */}
      <section className="py-24 sm:py-32">
        <div className={wrap}>
          <h2 data-reveal className={`${h2} max-w-[760px]`}>Quiet when nothing is wrong.</h2>
          <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div data-reveal className="rounded-[24px] bg-m-lavender p-6 sm:p-10 [--d:80ms]">
              <h3 className="text-[28px] leading-tight font-[480]">Routine bills pay on their own.</h3>
              <p className="mt-3 max-w-[520px] text-[18px] leading-[1.5] text-m-ink-2">
                An allowance names a payee or a kind of bill, a limit, and an end date. Inside it, nobody gets a push.
              </p>
              <div className="mt-8 max-w-[480px]"><AllowanceFragment /></div>
            </div>
            <div data-reveal className="flex flex-col rounded-[24px] bg-m-lavender p-6 sm:p-10 [--d:180ms]">
              <h3 className="text-[28px] leading-tight font-[480]">An alert when it matters.</h3>
              <p className="mt-3 text-[18px] leading-[1.5] text-m-ink-2">
                If the phone is at a bank while a call is going on, the family hears about it, before any cash leaves.
              </p>
              <div className="mt-8 lg:mt-auto lg:pt-8"><BankAlertFragment /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Night: privacy, close, footer */}
      <div className="bg-m-night text-m-on-dark">
        <section id="privacy" className={`${wrap} scroll-mt-4 grid gap-10 pt-24 sm:pt-32 lg:grid-cols-2 lg:gap-20`}>
          <h2 data-reveal className={`${h2} self-start`}>Their texts stay on their phone.</h2>
          <div className="space-y-5 text-[18px] leading-[1.55] text-m-fog">
            <p data-reveal className="[--d:90ms]">The scam check runs on the iPhone. Messages and bills are never sent to a cloud AI model.</p>
            <p data-reveal className="[--d:160ms]">Money rules are fixed code. The AI can add a reason to pause a payment. It can never remove one, and it never moves money.</p>
            <p data-reveal className="[--d:230ms]">Accounts and transfers run on Capital One&rsquo;s Nessie API. Sign-in and family approvals run on Auth0. Spending history lives in Tiger Data.</p>
          </div>
        </section>

        <section className={`${wrap} py-24 sm:py-32`}>
          <div data-reveal className="rounded-[28px] bg-m-night-raised px-6 py-14 text-center sm:px-12 sm:py-20">
            <h2 className={h2}>Bring the family in.</h2>
            <p className={`${lead} mx-auto mt-5 max-w-[560px] text-m-fog`}>
              Sign in, see what is held, and decide together. The iPhone app is in testing and not in the App Store yet.
            </p>
            <Link href={DASHBOARD} className={`${primary} mt-9`}>Open the family dashboard</Link>
          </div>
        </section>

        <footer className={`${wrap} pb-10`}>
          <p aria-hidden className="text-[clamp(2.5rem,13.4vw,10.5rem)] leading-[1.05] font-[480] tracking-[-0.035em]">
            <Wordmark />
          </p>
          <div className="mt-10 flex flex-col gap-3 text-[17px] text-m-fog sm:flex-row sm:justify-between">
            <p>Built at SwampHacks XII. Every person, business and balance on this page is a made-up example.</p>
            <Link href={DASHBOARD} className="rounded-sm underline-offset-4 hover:text-m-on-dark hover:underline focus-visible:outline-2 focus-visible:outline-m-periwinkle">Family dashboard</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

type RowProps = { title: string; body: string; picture: ReactNode; flip?: boolean };

function Row({ title, body, picture, flip = false }: RowProps) {
  return (
    <div className="grid items-center gap-8 rounded-[28px] bg-m-mist p-6 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
      <div className={flip ? 'lg:order-2' : ''}>
        <h3 data-reveal className="text-[28px] leading-[1.15] font-[480] tracking-[-0.005em]">{title}</h3>
        <p data-reveal className="mt-4 max-w-[480px] text-[18px] leading-[1.55] text-m-ink-2 sm:text-[18px] [--d:80ms]">{body}</p>
      </div>
      <div data-reveal="scale" className={`mx-auto w-full max-w-[460px] [--d:160ms] ${flip ? 'lg:order-1' : ''}`}>{picture}</div>
    </div>
  );
}
