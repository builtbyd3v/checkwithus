import { AppMark, Dot } from './bits';

/**
 * The hero's product picture: a held payment arrives on the family's phone, Maya taps Deny,
 * and Rosa's screen turns safe. Plays once with CSS only. Reduced motion shows the end state.
 */
export function HeroStage() {
  return (
    <div
      role="img"
      aria-label="A gift card payment of $500 is paused. Maya, her daughter, taps Deny, and Rosa's phone shows that she is safe."
      className="m-lift relative mx-auto mt-14 grid max-w-[1080px] gap-5 lg:mt-16 lg:grid-cols-[1fr_440px_1fr] lg:items-start lg:gap-8"
    >
      {/* Soft light behind the cards: the brief's one deliberate glow. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -bottom-10 -z-10 overflow-hidden">
        <div className="m-drift absolute top-0 left-1/2 h-[520px] w-[860px] max-w-none -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(82,102,235,0.42),rgba(82,102,235,0.12)_55%,transparent)]" /> {/* taste-skill-ignore */}
      </div>

      {/* Rosa's phone. Desktop only; the phone story is told again below. */}
      <div aria-hidden className="m-in hidden [animation-delay:700ms] lg:mt-28 lg:block">
        <div className="rounded-[28px] bg-m-night-raised p-6 text-m-on-dark">
          <p className="text-[15px] text-m-fog">Rosa&rsquo;s iPhone</p>
          <div className="mt-5 grid">
            <div className="m-out col-start-1 row-start-1 [animation-delay:3800ms]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#3a3122] px-3 py-1 text-[15px] text-[#f3d08a]"><Dot className="bg-[#f3d08a]" />Paused</span>
              <p className="mt-4 text-[28px] leading-tight font-[480]">Your family will call.</p>
              <span className="mt-6 block rounded-full bg-m-indigo py-3 text-center text-[17px] font-[480]">Ask my family</span>
            </div>
            <div className="m-swap col-start-1 row-start-1 [animation-delay:3900ms]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#1f3a2c] px-3 py-1 text-[15px] text-[#9fe0bb]"><Dot className="bg-[#9fe0bb]" />Safe</span>
              <p className="mt-4 text-[28px] leading-tight font-[480]">You&rsquo;re safe.</p>
              <p className="mt-3 text-[17px] leading-snug text-m-fog">Maya stopped a gift card payment. Your money is still here.</p>
            </div>
          </div>
        </div>
      </div>

      {/* The family's approval card. */}
      <div data-ui aria-hidden className="m-in order-2 rounded-[20px] bg-m-surface p-6 text-m-ink shadow-[0_1px_2px_rgba(23,23,33,0.06),0_24px_60px_-20px_rgba(10,10,30,0.55)] [animation-delay:350ms] sm:p-8 lg:order-none">
        <div className="flex items-center justify-between text-[15px] text-m-ink-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-m-hold-bg px-3 py-1 text-m-hold"><Dot className="bg-m-hold" />Held for family</span>
          <span>2:31 PM</span>
        </div>
        <p className="mt-6 text-[17px] text-m-ink-2">Rosa wants to pay</p>
        <p className="mt-1 text-[40px] leading-none font-[480] tracking-[-0.01em] tabular-nums">$500.00</p>
        <p className="mt-2 text-[17px] text-m-ink-2">to QuickGift Cards</p>
        <p className="mt-7 text-[17px] font-[500]">Why it paused</p>
        <ul className="mt-3 space-y-2.5 text-[17px]">
          <li className="m-in flex items-center gap-3 [animation-delay:1100ms]"><Dot className="bg-m-indigo" />Gift card purchase</li>
          <li className="m-in flex items-center gap-3 [animation-delay:1250ms]"><Dot className="bg-m-indigo" />Paid while on a phone call</li>
          <li className="m-in flex items-center gap-3 [animation-delay:1400ms]"><Dot className="bg-m-indigo" />Someone they have not paid before</li>
        </ul>
        <div className="mt-8 grid">
          <div className="m-out col-start-1 row-start-1 grid grid-cols-2 gap-3 [animation-delay:3300ms]">
            <span className="m-tap block rounded-full bg-m-ink py-3 text-center text-[17px] font-[480] text-white [animation-delay:2900ms]">Deny</span>
            <span className="block rounded-full bg-m-indigo/10 py-3 text-center text-[17px] font-[480]">Approve</span>
          </div>
          <div className="m-swap col-start-1 row-start-1 rounded-2xl bg-m-safe-bg px-4 py-3 text-[17px] leading-snug text-m-safe [animation-delay:3400ms]">
            Maya said no at 2:32 PM. The money stayed in Rosa&rsquo;s account.
          </div>
        </div>
      </div>

      {/* The push that reached Maya. */}
      <div aria-hidden className="m-in order-1 lg:order-none lg:mt-6 [animation-delay:150ms] lg:[animation-delay:550ms]">
        <div className="flex gap-3 rounded-[20px] bg-m-night-high/90 p-4 text-m-on-dark">
          <AppMark />
          <div className="min-w-0">
            <p className="flex justify-between gap-3 text-[15px] text-m-fog"><span>checkwith.us</span><span>now</span></p>
            <p className="mt-1 text-[17px] leading-snug">Rosa: $500.00 to QuickGift Cards. Approve or deny?</p>
          </div>
        </div>
        <p className="mt-4 hidden text-[17px] leading-relaxed text-m-fog lg:block">Every approver gets the push. One no stops the payment. No answer in time, and the money stays put.</p>
      </div>
    </div>
  );
}
