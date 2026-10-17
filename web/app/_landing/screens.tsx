import type { ReactNode } from 'react';

// Fragments of the older adult's iPhone app, built in HTML (no device frame, no screenshots).
// Plain components with no hooks, so both server and client components can render them.

type PhoneScreenProps = { children: ReactNode; dark?: boolean; className?: string };

export function PhoneScreen({ children, dark = false, className = '' }: PhoneScreenProps) {
  return (
    <div
      data-ui
      className={`flex h-[600px] w-[340px] flex-col rounded-[44px] px-7 pt-5 pb-8 font-sans ${dark ? 'bg-ink text-paper' : 'bg-screen text-ink'} ${className}`}
    >
      <div className="flex justify-between text-[15px] font-semibold">
        <span>9:41</span>
        <span>checkwith.us</span>
      </div>
      {children}
    </div>
  );
}

function AskButton() {
  return (
    <span className="mt-auto flex h-16 items-center justify-center rounded-full bg-sage text-xl font-semibold text-white">
      Ask my family
    </span>
  );
}

export function SafeScreen() {
  return (
    <PhoneScreen>
      <span aria-hidden="true" className="mt-12 flex size-16 items-center justify-center rounded-full bg-sage text-white">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <p className="mt-6 text-[44px] leading-none font-semibold tracking-tight">You&rsquo;re safe.</p>
      <p className="mt-4 text-xl leading-snug">Nothing is waiting for you. Your family is here if you need them.</p>
      <AskButton />
    </PhoneScreen>
  );
}

const MESSAGES = [
  { from: 'Sarah', text: 'Dinner on Sunday? I will bring the pie.', at: '9:12' },
  { from: 'Pharmacy', text: 'Your prescription is ready for pickup.', at: '8:40' },
  { from: 'Dr. Lee’s office', text: 'Reminder: checkup on Tuesday at 10 AM.', at: 'Mon' },
];

export function TextsScreen() {
  return (
    <PhoneScreen>
      <p className="mt-8 text-[34px] leading-none font-semibold tracking-tight">Messages</p>
      <ul className="mt-6 space-y-5">
        {MESSAGES.map((m) => (
          <li key={m.from} className="flex gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-field text-lg font-semibold">{m.from[0]}</span>
            <span className="min-w-0">
              <span className="flex justify-between gap-2 text-lg font-semibold">{m.from}<span className="text-[15px] font-normal text-soft">{m.at}</span></span>
              <span className="block text-[17px] leading-snug text-soft">{m.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-auto rounded-3xl bg-panel px-5 py-4 text-[17px] leading-snug">
        2 scam texts went to Junk. They were checked on this iPhone.
      </p>
    </PhoneScreen>
  );
}

export function CallScreen() {
  return (
    <PhoneScreen dark>
      <p className="mt-16 text-center text-lg text-paper/80">+1 (202) 555-0148</p>
      <p className="mt-2 text-center text-[44px] leading-none font-semibold tracking-tight">Possible scam</p>
      <p className="mt-4 text-center text-lg text-paper/80">This number is on a scam list.</p>
      <div className="mt-auto flex justify-between px-4 text-center text-[15px]">
        <span>
          <span className="mb-2 flex size-[72px] items-center justify-center rounded-full bg-[#c4352b] text-white">
            <svg viewBox="0 0 24 24" className="size-8 rotate-[135deg]" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" /></svg>
          </span>
          Decline
        </span>
        <span>
          <span className="mb-2 flex size-[72px] items-center justify-center rounded-full bg-[#3a7d44] text-white">
            <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" /></svg>
          </span>
          Answer
        </span>
      </div>
    </PhoneScreen>
  );
}

type PaymentScreenProps = { held: boolean; amount: string; payee: string; reasons: string[]; className?: string };

/** The older adult's screen after a payment: paid, or paused for the family. */
export function PaymentScreen({ held, amount, payee, reasons, className }: PaymentScreenProps) {
  return (
    <PhoneScreen className={className}>
      <p className="mt-12 text-[44px] leading-none font-semibold tracking-tight">{held ? 'Paused.' : 'Paid.'}</p>
      <p className="mt-4 text-xl leading-snug">{held ? 'Your family will call you soon.' : 'This one went through as usual.'}</p>
      <div className="mt-8 rounded-3xl bg-panel px-5 py-4">
        <p className="text-[32px] leading-none font-semibold tracking-tight">{amount}</p>
        <p className="mt-2 text-lg">{payee}</p>
        {held && <p className="mt-2 text-[17px] leading-snug text-soft">{reasons[0]}{reasons.length > 1 ? ` and ${reasons.length - 1} more` : ''}</p>}
      </div>
      {held ? <AskButton /> : <span className="mt-auto text-center text-lg text-soft">You&rsquo;re safe.</span>}
    </PhoneScreen>
  );
}
