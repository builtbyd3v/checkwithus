import type { ReactNode } from 'react';

/*
 * A drawn iPhone-like frame. Everything inside is sized in container units
 * (cqw), so the same screens render at any phone width. The screens are
 * real product UI drawn in HTML, so they carry data-ui and keep their own
 * small type and separators.
 */

type PhoneProps = { label: string; className?: string; children: ReactNode };

export function Phone({ label, className = '', children }: PhoneProps) {
  return (
    <figure role="img" aria-label={label} className={`@container ${className}`}>
      <div data-ui className="relative aspect-[9/19.5] w-full rounded-[15cqw] bg-[#4a4a4e] p-[0.8cqw]">
        <span aria-hidden className="absolute top-[22%] -left-[0.9cqw] h-[7%] w-[1.2cqw] rounded-l-full bg-[#4a4a4e]" />
        <span aria-hidden className="absolute top-[31%] -left-[0.9cqw] h-[7%] w-[1.2cqw] rounded-l-full bg-[#4a4a4e]" />
        <span aria-hidden className="absolute top-[26%] -right-[0.9cqw] h-[11%] w-[1.2cqw] rounded-r-full bg-[#4a4a4e]" />
        <div className="h-full rounded-[14.2cqw] bg-black p-[2.4cqw]">
          <div className="relative h-full overflow-hidden rounded-[12cqw] bg-white text-ap-ink">
            <span aria-hidden className="absolute top-[2.6cqw] left-1/2 z-20 h-[8.5cqw] w-[29cqw] -translate-x-1/2 rounded-full bg-black" />
            {children}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** One screen layer. `dark` switches the status bar for the call screen. */
function Screen({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <div className={`absolute inset-0 flex flex-col px-[6cqw] pt-[3.6cqw] pb-[7cqw] ${dark ? 'bg-[#141416] text-white' : 'bg-white'}`}>
      <div className="flex h-[8cqw] items-center justify-between px-[4cqw] text-[4.2cqw] font-semibold">
        <span>10:24</span>
        <span aria-hidden className={`h-[3.4cqw] w-[7cqw] rounded-[1cqw] ${dark ? 'bg-white' : 'bg-ap-ink'}`} />
      </div>
      {children}
    </div>
  );
}

const bigButton = 'mt-auto flex h-[15cqw] items-center justify-center rounded-full bg-ap-blue text-[5.6cqw] font-semibold text-white';

export function SafeScreen() {
  return (
    <Screen>
      <p className="mt-[10cqw] text-[5cqw] text-ap-mute">Good morning, Rosa</p>
      <div className="mt-[14cqw] flex flex-col items-center text-center">
        <span className="flex size-[30cqw] items-center justify-center rounded-full bg-ap-ok text-white">
          <svg viewBox="0 0 24 24" className="size-[15cqw]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <p className="mt-[8cqw] text-[11cqw] leading-none font-semibold tracking-[-0.03em]">You&rsquo;re safe.</p>
        <p className="mt-[4cqw] text-[5.4cqw] leading-snug text-ap-mute">Nothing needs you today.</p>
      </div>
      <span className={bigButton}>Ask my family</span>
    </Screen>
  );
}

const JUNK = [
  { from: '+1 (305) 555-0142', text: 'Your package is on hold. Pay the $1.99 fee today at parcel-redeliver.co', time: '9:12' },
  { from: '+1 (754) 555-0187', text: 'Toll notice: you owe $4.85. Pay now to avoid a $50 fine.', time: '8:40' },
  { from: 'Account Alert', text: 'Your bank account is locked. Verify now at secure-acct-help.net', time: 'Mon' },
  { from: '+1 (561) 555-0123', text: 'Grandma, it is me. I am in trouble and need money fast. Do not tell Mom.', time: 'Sun' },
];

export function JunkScreen() {
  return (
    <Screen>
      <p className="mt-[8cqw] text-[4.6cqw] text-ap-blue">&lsaquo; Filters</p>
      <p className="mt-[2cqw] text-[10cqw] leading-none font-bold tracking-[-0.02em]">Junk</p>
      <ul className="mt-[5cqw] space-y-[1.5cqw]">
        {JUNK.map((m) => (
          <li key={m.from} className="py-[3.4cqw]">
            <p className="flex justify-between text-[4.6cqw] font-semibold">{m.from}<span className="font-normal text-ap-mute">{m.time}</span></p>
            <p className="mt-[1cqw] text-[4.2cqw] leading-snug text-ap-mute">{m.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-auto rounded-[5cqw] bg-ap-parch p-[4.5cqw] text-[4.3cqw] leading-snug">
        <span className="font-semibold">checkwith.us moved 4 texts here.</span> They were checked on this iPhone and never left it.
      </p>
    </Screen>
  );
}

export function CallScreen() {
  return (
    <Screen dark>
      <div className="mt-[16cqw] text-center">
        <p className="text-[5cqw] text-white/70">Incoming call</p>
        <p className="mt-[3cqw] text-[11cqw] leading-none font-semibold tracking-[-0.03em]">Possible scam</p>
        <p className="mt-[4cqw] text-[5.4cqw] text-white/70">+1 (786) 555-0199</p>
      </div>
      <div className="mt-auto flex justify-between px-[5cqw] text-center text-[4.4cqw]">
        <span className="flex flex-col items-center gap-[2.5cqw]">
          <span className="flex size-[19cqw] items-center justify-center rounded-full bg-[#ff3b30]">
            <svg viewBox="0 0 24 24" className="size-[9cqw] rotate-[135deg]" fill="currentColor" aria-hidden><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" /></svg>
          </span>
          Decline
        </span>
        <span className="flex flex-col items-center gap-[2.5cqw]">
          <span className="flex size-[19cqw] items-center justify-center rounded-full bg-[#34c759]">
            <svg viewBox="0 0 24 24" className="size-[9cqw]" fill="currentColor" aria-hidden><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" /></svg>
          </span>
          Accept
        </span>
      </div>
    </Screen>
  );
}

export function PausedScreen() {
  return (
    <Screen>
      <div className="mt-[10cqw] flex flex-col items-center text-center">
        <span className="flex size-[22cqw] items-center justify-center gap-[3cqw] rounded-full bg-ap-ink" aria-hidden>
          <span className="h-[8.5cqw] w-[2.6cqw] rounded-full bg-white" />
          <span className="h-[8.5cqw] w-[2.6cqw] rounded-full bg-white" />
        </span>
        <p className="mt-[6cqw] text-[11cqw] leading-none font-semibold tracking-[-0.03em]">Paused.</p>
        <p className="mt-[3cqw] text-[5.4cqw] leading-snug">Your family will call you.</p>
      </div>
      <div className="mt-[7cqw] rounded-[5cqw] bg-ap-parch p-[5cqw]">
        <p className="flex items-baseline justify-between">
          <span className="text-[8cqw] font-semibold tracking-[-0.02em]">$500.00</span>
          <span className="text-[4.4cqw] text-ap-mute">QuickGift Cards</span>
        </p>
        <ul className="mt-[3cqw] space-y-[1.5cqw] text-[4.4cqw] leading-snug">
          <li>Gift card purchase</li>
          <li>Paid while on a phone call</li>
        </ul>
      </div>
      <p className="mt-[5cqw] flex items-center gap-[3cqw] text-[4.4cqw] leading-snug">
        <span aria-hidden className="flex">
          <span className="flex size-[9cqw] items-center justify-center rounded-full bg-ap-ink text-[4cqw] font-semibold text-white">S</span>
          <span className="-ml-[2cqw] flex size-[9cqw] items-center justify-center rounded-full bg-ap-blue text-[4cqw] font-semibold text-white">P</span>
        </span>
        Sam and Priya know.
      </p>
      <span className={bigButton}>Ask my family</span>
    </Screen>
  );
}

export function FamilyScreen() {
  return (
    <Screen>
      <p className="mt-[8cqw] text-[4.6cqw] text-ap-mute">Sam&rsquo;s phone</p>
      <p className="mt-[1cqw] text-[8.6cqw] leading-none font-bold tracking-[-0.02em]">Rosa wants to pay</p>
      <div className="mt-[5cqw] rounded-[5cqw] bg-ap-parch p-[5cqw]">
        <p className="text-[10cqw] leading-none font-semibold tracking-[-0.03em]">$1,250.00</p>
        <p className="mt-[2cqw] text-[4.6cqw]">to Bright Roof Co.</p>
        <p className="mt-[4cqw] text-[4cqw] font-semibold text-ap-mute">Why it waited</p>
        <ul className="mt-[1cqw] space-y-[1cqw] text-[4.4cqw] leading-snug">
          <li>Someone she has not paid before</li>
          <li>Over the limit you set</li>
        </ul>
      </div>
      <p className="mt-[5cqw] text-[4cqw] font-semibold text-ap-mute">Needs 2 yeses</p>
      <ul className="mt-[2cqw] space-y-[2cqw] text-[4.6cqw]">
        <li className="flex items-center justify-between">Priya<span className="font-semibold text-ap-ok">Yes</span></li>
        <li className="flex items-center justify-between">Sam (you)<span className="text-ap-mute">Waiting</span></li>
      </ul>
      <div className="mt-auto grid grid-cols-2 gap-[3cqw] text-[5.4cqw] font-semibold">
        <span className="flex h-[14cqw] items-center justify-center rounded-full bg-ap-parch">Deny</span>
        <span className="flex h-[14cqw] items-center justify-center rounded-full bg-ap-blue text-white">Approve</span>
      </div>
    </Screen>
  );
}
