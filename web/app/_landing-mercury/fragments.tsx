import { AppMark, Dot } from './bits';

/**
 * Interface fragments drawn in HTML: what Rosa and her family really see.
 * All names, numbers and businesses are fictional. Each one is a picture, so screen readers get one label.
 */

// DESIGN.md level 1: a hair-thin stack under floating product mockups only.
const card = 'rounded-[20px] bg-m-surface text-m-ink shadow-[0_1px_2px_rgba(40,37,59,0.05),0_12px_32px_-18px_rgba(40,37,59,0.28)]'; // taste-skill-ignore

export function InboxFragment() {
  return (
    <div data-ui role="img" aria-label="Rosa's messages. A text from her pharmacy is in the inbox. A fake delivery text was kept out." className={`${card} p-5 sm:p-6`}>
      <p className="text-[15px] text-m-ink-2">Messages</p>
      <div aria-hidden className="mt-4 space-y-3">
        <div data-reveal className="flex gap-3 rounded-2xl bg-m-canvas p-4 [--d:120ms]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-m-lavender-deep text-[15px] font-[500] text-m-ink-2">CP</span>
          <div className="min-w-0 flex-1">
            <p className="flex justify-between gap-2 text-[17px] font-[500]"><span>Corner Pharmacy</span><span className="font-normal text-m-ink-2">9:12 AM</span></p>
            <p className="mt-1 text-[17px] leading-snug text-m-ink-2">Your refill is ready for pickup.</p>
          </div>
        </div>
        <div data-reveal className="rounded-2xl bg-m-stop-bg p-4 [--d:260ms]">
          <p className="flex items-center justify-between gap-2 text-[15px] text-m-stop"><span className="inline-flex items-center gap-2"><Dot className="bg-m-stop" />Kept out of the inbox</span><span>9:40 AM</span></p>
          <p className="mt-2 text-[17px] leading-snug text-m-ink line-through decoration-m-stop/40">Your package is on hold. Pay a $1.99 fee today at parcel-redeliver.example or it returns.</p>
        </div>
      </div>
    </div>
  );
}

export function CallFragment() {
  return (
    <div data-ui role="img" aria-label="An incoming call. The screen says Possible scam above the number." className="rounded-[28px] bg-m-night p-6 text-center text-m-on-dark sm:p-8">
      <div aria-hidden>
        <p data-reveal className="inline-flex items-center gap-2 rounded-full bg-[#3c1f27] px-3 py-1 text-[15px] text-[#f4a9b6] [--d:120ms]"><Dot className="bg-[#f4a9b6]" />Possible scam</p>
        <p data-reveal className="mt-4 text-[21px] leading-tight font-[460] whitespace-nowrap tabular-nums sm:text-[28px] [--d:200ms]">+1 (352) 555-0143</p>
        <p className="mt-1 text-[17px] text-m-fog">Incoming call</p>
        <div className="mt-8 flex justify-center gap-14">
          <span className="flex flex-col items-center gap-2 text-[15px] text-m-fog"><span className="flex size-14 items-center justify-center rounded-full bg-[#d6455d]"><PhoneIcon className="rotate-[135deg]" /></span>Decline</span>
          <span className="flex flex-col items-center gap-2 text-[15px] text-m-fog"><span className="flex size-14 items-center justify-center rounded-full bg-[#2f9e62]"><PhoneIcon /></span>Accept</span>
        </div>
      </div>
    </div>
  );
}

export function PausedFragment() {
  return (
    <div data-ui role="img" aria-label="Rosa's screen while a payment waits: Paused. Your family will call. One button: Ask my family." className={`${card} p-6 sm:p-8`}>
      <div aria-hidden>
        <span className="inline-flex items-center gap-2 rounded-full bg-m-hold-bg px-3 py-1 text-[15px] text-m-hold"><Dot className="bg-m-hold" />Paused</span>
        <p data-reveal className="mt-5 text-[28px] leading-[1.1] font-[480] tracking-[-0.01em] [--d:120ms]">Your family will call.</p>
        <p data-reveal className="mt-3 text-[17px] leading-snug text-m-ink-2 [--d:200ms]">$500.00 to QuickGift Cards is waiting for Maya or Daniel.</p>
        <span data-reveal className="mt-7 block rounded-full bg-m-indigo py-4 text-center text-[18px] font-[480] text-white [--d:300ms]">Ask my family</span>
      </div>
    </div>
  );
}

export function SequenceFragment() {
  return (
    <div data-ui role="img" aria-label="Rosa's activity: $400 cash from an ATM at 1:52 PM, then a $500 gift card at 2:09 PM. The gift card is held as cash then gift cards." className={`${card} p-6 sm:p-8`}>
      <div aria-hidden>
        <p className="flex justify-between text-[15px] text-m-ink-2"><span>Rosa&rsquo;s activity</span><span>Today</span></p>
        <ol className="relative mt-6 space-y-6 pl-8">
          <span className="absolute top-2 bottom-8 left-[7px] w-0.5 rounded-full bg-m-lavender-deep" />
          <li data-reveal="side" className="relative [--d:100ms]">
            <span className="absolute top-1.5 -left-8 size-4 rounded-full bg-m-lavender-deep" />
            <p className="flex justify-between gap-4 text-[17px]"><span className="font-[500]">Cash from an ATM</span><span className="tabular-nums">$400.00</span></p>
            <p className="mt-1 text-[17px] text-m-ink-2">1:52 PM, Main Street</p>
          </li>
          <li data-reveal="side" className="relative [--d:260ms]">
            <span className="absolute top-1.5 -left-8 size-4 rounded-full bg-m-hold" />
            <p className="flex justify-between gap-4 text-[17px]"><span className="font-[500]">QuickGift Cards</span><span className="tabular-nums">$500.00</span></p>
            <p className="mt-1 text-[17px] text-m-ink-2">2:09 PM, 17 minutes later</p>
          </li>
        </ol>
        <div data-reveal className="mt-6 rounded-2xl bg-m-hold-bg p-4 [--d:420ms]">
          <p className="flex items-center gap-2 text-[17px] font-[500] text-m-hold"><Dot className="bg-m-hold" />Held: cash, then gift cards</p>
          <p className="mt-1.5 text-[17px] leading-snug text-m-ink">Each step looks normal alone. Together, inside two hours, they are how scammers coach people to pay.</p>
        </div>
      </div>
    </div>
  );
}

const votes = [
  { name: 'Maya', role: 'Daughter', answer: 'Approved', time: '3:04 PM', tone: 'text-m-safe bg-m-safe-bg', d: '[--d:200ms]' },
  { name: 'Daniel', role: 'Son', answer: 'Denied', time: '3:06 PM', tone: 'text-m-stop bg-m-stop-bg', d: '[--d:420ms]' },
] as const;

export function VoteFragment() {
  return (
    <div data-ui role="img" aria-label="A $1,800 wire transfer needs two approvals. Maya approved. Daniel denied. The payment is stopped." className={`${card} p-6 sm:p-8`}>
      <div aria-hidden>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="text-[40px] leading-none font-[480] tracking-[-0.01em] tabular-nums">$1,800.00</p>
          <p className="text-[17px] text-m-ink-2">Needs 2 approvals</p>
        </div>
        <p className="mt-2 text-[17px] text-m-ink-2">Wire transfer to Lakeside Title Co.</p>
        <ul className="mt-7 space-y-3">
          {votes.map((v) => (
            <li key={v.name} data-reveal className={`flex items-center justify-between gap-4 rounded-2xl bg-m-canvas p-4 ${v.d}`}>
              <span className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-m-lavender-deep text-[17px] font-[500] text-m-ink-2">{v.name[0]}</span>
                <span><span className="block text-[17px] font-[500]">{v.name}</span><span className="block text-[15px] text-m-ink-2">{v.role}</span></span>
              </span>
              <span className="text-right"><span className={`inline-block rounded-full px-3 py-1 text-[15px] ${v.tone}`}>{v.answer}</span><span className="mt-1 block text-[15px] text-m-ink-2">{v.time}</span></span>
            </li>
          ))}
        </ul>
        <div data-reveal className="mt-4 rounded-2xl bg-m-ink p-4 text-white [--d:640ms]">
          <p className="text-[17px] font-[500]">Stopped. One no is enough.</p>
          <p className="mt-1 text-[17px] text-m-fog">The money never left Rosa&rsquo;s account.</p>
        </div>
      </div>
    </div>
  );
}

export function AllowanceFragment() {
  return (
    <div data-ui role="img" aria-label="An allowance for utility bills under $200 until November 30. A $142.18 water bill paid with no push to the family." className={`${card} p-6 sm:p-8`}>
      <div aria-hidden>
        <p className="text-[15px] text-m-ink-2">Allowance</p>
        <p className="mt-2 text-[28px] leading-tight font-[480]">Utility bills under $200</p>
        <p className="mt-1 text-[17px] text-m-ink-2">Until Nov 30. Set by Maya.</p>
        <div data-reveal className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-m-canvas p-4 [--d:200ms]">
          <span><span className="block text-[17px] font-[500]">City Water &amp; Power</span><span className="block text-[15px] text-m-ink-2">Paid on its own. No push.</span></span>
          <span className="text-right"><span className="block text-[17px] tabular-nums">$142.18</span><span className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-m-safe"><Dot className="bg-m-safe" />Paid</span></span>
        </div>
      </div>
    </div>
  );
}

export function BankAlertFragment() {
  return (
    <div data-ui role="img" aria-label="An alert on Maya's phone: Rosa is at a bank while on a phone call." className="rounded-[20px] bg-m-night p-5 text-m-on-dark sm:p-6">
      <div aria-hidden className="flex gap-3">
        <AppMark />
        <div className="min-w-0">
          <p className="flex justify-between gap-3 text-[15px] text-m-fog"><span>checkwith.us</span><span>now</span></p>
          <p className="mt-1 text-[17px] leading-snug">Rosa is at a bank while on a phone call. You may want to call her.</p>
        </div>
      </div>
    </div>
  );
}

function PhoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-6 fill-white ${className}`} aria-hidden>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  );
}
