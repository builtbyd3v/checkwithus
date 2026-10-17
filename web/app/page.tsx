import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { HOLD_REASON_LABELS, HOLD_REASONS } from '@/lib/rules';
import { fraunces, hanken } from './_landing-oura/fonts';
import { PauseStory } from './_landing-oura/pause-story';
import { Phone } from './_landing-oura/phone';
import room from './_landing-oura/room-strandgade.jpg';
import sunlight from './_landing-oura/sunlight-floor.jpg';

export const metadata: Metadata = {
  title: 'checkwith.us: quiet protection from scams',
  description: 'Your parent does nothing. Scam texts and calls are caught on the phone, and risky payments wait until the family says yes.',
};

const DASHBOARD = '/auth/login?returnTo=/dashboard';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4';
const press = 'transition-[translate,scale,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.98]';
const primary = `inline-flex min-h-14 items-center justify-center rounded-full bg-cw-blue px-8 text-lg font-semibold text-white hover:bg-cw-blue-deep ${press} ${focus}`;
const wrap = 'mx-auto w-full max-w-[1320px] px-4 sm:px-8';
const h2 = 'font-cw-display font-light leading-[1.04] tracking-[-0.02em]';

const QUIET = [
  { title: 'Scam texts never reach the inbox.', body: 'Texts from strangers are checked by a model on her iPhone. They never leave the phone.' },
  { title: 'Scam calls ring as \u201cPossible scam\u201d.', body: 'Known scam numbers carry a warning before she picks up.' },
  { title: 'Risky payments wait for family.', body: 'Gift cards, crypto, someone new, large or unusual amounts, paying while on a call, and ATM cash followed by a gift card.' },
];

const TOOLS = [
  { title: 'Two yeses for big payments.', body: 'Over $1,000, two approvers must say yes. One no stops it.' },
  { title: 'Freeze.', body: 'One tap moves her spending money into a vault account.' },
  { title: 'A bank visit during a call.', body: 'You get an alert if she is at a bank while she is on a phone call.' },
  { title: 'Allowances for routine bills.', body: 'Bills you expect, under an amount you set, pay with no push to anyone.' },
];

const REVEALS = ['cw-reveal', 'cw-reveal-2', 'cw-reveal-3'];

export default function Home() {
  return <div className={`${fraunces.variable} ${hanken.variable} w-full overflow-x-clip bg-cw-canvas font-cw-text text-cw-ink`}>
    {/* Night: the worry, and the calm ring that answers it. */}
    <section className="relative isolate overflow-hidden bg-cw-night text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-[20vw] -top-[25vw] -z-10 size-[80vw] rounded-full bg-[radial-gradient(closest-side,rgb(221_170_97/0.2),transparent)] animate-cw-drift motion-reduce:animate-none" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-[30vw] -left-[25vw] -z-10 size-[75vw] rounded-full bg-[radial-gradient(closest-side,rgb(132_150_113/0.18),transparent)] animate-cw-drift [animation-delay:-13s] motion-reduce:animate-none" />

      <header className={`${wrap} flex items-center justify-between py-6`}>
        <Link href="/" className={`rounded-sm font-cw-display text-2xl tracking-[-0.01em] ${focus} focus-visible:outline-white`}>checkwith.us</Link>
        <nav aria-label="Main" className="flex items-center gap-8 text-base">
          <a href="#pause" className={`hidden rounded-sm text-cw-mute hover:text-white md:inline ${focus} focus-visible:outline-white`}>How it works</a>
          <a href="#family" className={`hidden rounded-sm text-cw-mute hover:text-white md:inline ${focus} focus-visible:outline-white`}>For family</a>
          <a href="#privacy" className={`hidden rounded-sm text-cw-mute hover:text-white md:inline ${focus} focus-visible:outline-white`}>Privacy</a>
          <Link href={DASHBOARD} className={`inline-flex min-h-11 items-center rounded-full bg-white/10 px-5 font-semibold hover:bg-white/20 ${press} ${focus} focus-visible:outline-white`}>Sign in</Link>
        </nav>
      </header>

      <div className={`${wrap} grid items-center gap-4 pb-10 pt-10 lg:min-h-[calc(100svh-96px)] lg:grid-cols-[1.25fr_1fr] lg:gap-8 lg:pb-24 lg:pt-0`}>
        <div>
          <h1 className="font-cw-display text-[clamp(3rem,7.6vw,7.25rem)] font-light leading-[1] tracking-[-0.025em]">
            <span className="block animate-cw-enter motion-reduce:animate-none">Quiet protection</span>
            <span className="block animate-cw-enter [animation-delay:120ms] motion-reduce:animate-none">from scams.</span>
          </h1>
          <p className="mt-8 max-w-xl animate-cw-enter text-xl leading-relaxed text-cw-mute [animation-delay:260ms] motion-reduce:animate-none sm:text-2xl sm:leading-relaxed">
            Your parent does nothing. Scam texts and calls are caught on the phone, and a risky payment waits until the family says yes.
          </p>
          <div className="mt-10 flex animate-cw-enter flex-wrap items-center gap-x-8 gap-y-4 [animation-delay:380ms] motion-reduce:animate-none">
            <Link href={DASHBOARD} className={`${primary} focus-visible:outline-white`}>Open the family dashboard</Link>
            <a href="#pause" className={`rounded-sm text-lg font-semibold text-white underline decoration-white/40 underline-offset-8 hover:decoration-white ${focus} focus-visible:outline-white`}>See a pause</a>
          </div>
        </div>
        <div className="grid h-[460px] animate-cw-enter place-items-center [animation-delay:200ms] motion-reduce:animate-none sm:h-[560px] lg:h-[640px]">
          <Phone state="calm" className="scale-[0.76] sm:scale-90 lg:scale-100" />
        </div>
      </div>
    </section>

    {/* Dusk to dawn: the cream layer fades in as you scroll, carrying the dark headline with it. */}
    <section id="pause" aria-labelledby="pause-title">
      <div className="relative grid min-h-[60svh] place-items-center bg-cw-night px-4 py-24 text-center">
        <p aria-hidden="true" className={`${h2} col-start-1 row-start-1 text-[clamp(2.25rem,6vw,5.5rem)] text-white`}>She does nothing.<br />Family does the rest.</p>
        <div className="cw-dawn absolute inset-0 bg-cw-canvas" />
        <h2 id="pause-title" className={`${h2} cw-dawn-text relative col-start-1 row-start-1 text-[clamp(2.25rem,6vw,5.5rem)]`}>She does nothing.<br />Family does the rest.</h2>
      </div>
      <div className={`${wrap} pb-24 lg:pb-40`}>
        <PauseStory />
      </div>
    </section>

    {/* What happens without anyone noticing. */}
    <section id="quiet" aria-labelledby="quiet-title" className={`${wrap} pb-28 lg:pb-48`}>
      <h2 id="quiet-title" className={`${h2} cw-reveal max-w-4xl text-[clamp(2.5rem,6vw,5.25rem)]`}>Most of it, she never sees.</h2>
      <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-[7fr_5fr] lg:gap-20">
        <figure className="cw-reveal-2">
          <div className="overflow-hidden rounded-3xl">
            <Image src={room} alt="A painting of a quiet, sunlit room. A woman sits writing at a small table by a tall window." placeholder="blur" sizes="(min-width: 1024px) 55vw, 100vw" className="cw-zoom h-auto w-full" />
          </div>
          <figcaption className="mt-4 text-base text-cw-stone">Vilhelm Hammershøi, A Room in the Artist&apos;s Home in Strandgade, 1901. Public domain.</figcaption>
        </figure>
        <ul className="flex flex-col justify-center gap-12 lg:gap-16">
          {QUIET.map(({ title, body }, i) => <li key={title} className={REVEALS[i]}>
            <h3 className="font-cw-display text-[28px] font-light leading-[1.15] sm:text-[34px]">{title}</h3>
            <p className="mt-3 text-lg leading-relaxed sm:text-xl">{body}</p>
          </li>)}
        </ul>
      </div>
    </section>

    {/* The family's tools: an earth band, like a chapter break. */}
    <section id="family" aria-labelledby="family-title" className="bg-cw-forest py-24 text-cw-canvas lg:py-40">
      <div className={wrap}>
        <h2 id="family-title" className={`${h2} cw-reveal max-w-4xl text-[clamp(2.5rem,6vw,5.25rem)]`}>The family does the work.</h2>
        <p className="cw-reveal-2 mt-6 max-w-2xl text-xl leading-relaxed text-cw-sage-pale sm:text-2xl sm:leading-relaxed">Answer from your phone or the family dashboard. Set the rules once, together.</p>
        <ul className="mt-16 grid gap-x-20 gap-y-14 sm:grid-cols-2 lg:mt-24">
          {TOOLS.map(({ title, body }, i) => <li key={title} className={REVEALS[i % 2]}>
            <h3 className="font-cw-display text-[30px] font-light leading-[1.15] sm:text-[40px]">{title}</h3>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-cw-sage-pale sm:text-xl">{body}</p>
          </li>)}
        </ul>
        <div className="cw-reveal mt-20 rounded-3xl bg-cw-forest-deep p-6 sm:p-10 lg:mt-28">
          <h3 className="font-cw-display text-[30px] font-light leading-[1.15] sm:text-[40px]">Every hold, in plain words.</h3>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-cw-sage-pale sm:text-xl">No scores and no jargon. These are the reasons the family sees:</p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {HOLD_REASONS.map((r) => <li key={r} className="rounded-full bg-cw-canvas px-5 py-2.5 text-base font-semibold text-cw-forest sm:text-lg">{HOLD_REASON_LABELS[r]}</li>)}
          </ul>
        </div>
      </div>
    </section>

    {/* Night again: privacy, the light in the dark room. */}
    <section id="privacy" aria-labelledby="privacy-title" className="bg-cw-night py-24 text-white lg:py-40">
      <div className={`${wrap} grid items-center gap-14 lg:grid-cols-[1fr_0.8fr] lg:gap-24`}>
        <div>
          <h2 id="privacy-title" className={`${h2} cw-reveal text-[clamp(2.5rem,6vw,5.25rem)]`}>Her texts stay on her phone.</h2>
          <p className="cw-reveal-2 mt-8 max-w-xl text-xl leading-relaxed text-cw-mute sm:text-2xl sm:leading-relaxed">Scam checks run on the iPhone itself. No model ever moves money: fixed rules decide what pauses, and people decide what pays.</p>
          <p className="cw-reveal-3 mt-10 max-w-xl text-lg leading-relaxed text-cw-mute">Payments run on Capital One&apos;s Nessie API. Family sign-in and approvals use Auth0. Spending history lives in Tiger Data.</p>
        </div>
        <figure className="cw-reveal-2 mx-auto w-full max-w-md lg:max-w-none">
          <div className="overflow-hidden rounded-3xl">
            <Image src={sunlight} alt="A painting of a dim room where sunlight from a window falls in a bright patch on the floor." placeholder="blur" sizes="(min-width: 1024px) 40vw, 90vw" className="cw-zoom h-auto w-full" />
          </div>
          <figcaption className="mt-4 text-base text-cw-mute">Vilhelm Hammershøi, Interior, Sunlight on the Floor, 1906. Public domain.</figcaption>
        </figure>
      </div>
    </section>

    {/* Close: the one centred moment. */}
    <section aria-labelledby="close-title" className="px-4 py-28 text-center sm:px-8 lg:py-48">
      <h2 id="close-title" className={`${h2} cw-reveal mx-auto max-w-4xl text-[clamp(2.5rem,6.5vw,6rem)]`}>Be there, without hovering.</h2>
      <p className="cw-reveal-2 mx-auto mt-8 max-w-xl text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">One iPhone app serves your parent and the whole family. It is not in the App Store yet. The family dashboard is open now.</p>
      <div className="cw-reveal-3 mt-12">
        <Link href={DASHBOARD} className={`${primary} focus-visible:outline-cw-ink`}>Open the family dashboard</Link>
      </div>
    </section>

    <footer className="overflow-hidden bg-cw-night pt-20 text-cw-mute">
      <div className={wrap}>
        <p className="max-w-2xl text-base leading-relaxed">Built at SwampHacks. Paintings by Vilhelm Hammershøi, public domain, via Wikimedia Commons.</p>
        <p aria-hidden="true" className="cw-reveal mt-10 translate-y-[0.14em] whitespace-nowrap font-cw-display text-[clamp(3.5rem,21vw,18.5rem)] font-light leading-[0.9] tracking-[-0.04em] text-white">checkwith.us</p>
      </div>
    </footer>
  </div>;
}
