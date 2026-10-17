export type PhoneState = 'calm' | 'paused' | 'stopped' | 'paid';

type Screen = { title: string; note: string; detail?: string };

// What the parent's app shows in each state (plain words, one action).
const SCREENS: Record<PhoneState, Screen> = {
  calm: { title: "You're safe.", note: 'Nothing needs you today.' },
  paused: { title: 'Your family will call.', note: 'This payment is paused.', detail: 'Gift card, $500.00' },
  stopped: { title: "You're safe.", note: 'Your family said no. Your $500 stayed in your account.' },
  paid: { title: 'Paid.', note: 'Your family said yes. The $500 went through.' },
};

const STATES = Object.keys(SCREENS) as PhoneState[];

// ponytail: sample payments for the drawing, not live data.
const TODAY = [['Groceries', '$42.18'], ['Pharmacy', '$12.40'], ['Electric bill', '$88.06']];

type RingProps = { tone: 'calm' | 'amber'; on: boolean };

/** Two soft halos that breathe. Colour swaps by crossfading layers, so only opacity and transform move. */
function Ring({ tone, on }: RingProps) {
  const inner = tone === 'calm'
    ? 'bg-[radial-gradient(closest-side,transparent_68%,rgb(206_212_184/0.6)_80%,transparent_100%)] animate-cw-breathe'
    : 'bg-[radial-gradient(closest-side,transparent_68%,rgb(221_170_97/0.85)_80%,transparent_100%)] animate-cw-breathe-fast';
  const outer = tone === 'calm'
    ? 'bg-[radial-gradient(closest-side,transparent_80%,rgb(206_212_184/0.28)_90%,transparent_100%)] animate-cw-breathe [animation-delay:-3.5s]'
    : 'bg-[radial-gradient(closest-side,transparent_80%,rgb(221_170_97/0.4)_90%,transparent_100%)] animate-cw-breathe-fast [animation-delay:-1.6s]';
  return <div className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${on ? 'opacity-100' : 'opacity-0'}`}>
    <div className={`absolute inset-[6%] rounded-full motion-reduce:animate-none ${inner}`} />
    <div className={`absolute inset-0 rounded-full motion-reduce:animate-none ${outer}`} />
  </div>;
}

type PhoneProps = { state: PhoneState; className?: string };

/** The parent's iPhone, drawn in HTML, with the protection ring around it. */
export function Phone({ state, className = '' }: PhoneProps) {
  const amber = state === 'paused';
  const screen = SCREENS[state];
  return <div className={`relative grid place-items-center ${className}`}>
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2">
      <Ring tone="calm" on={!amber} />
      <Ring tone="amber" on={amber} />
    </div>
    <div role="img" aria-label={`Your parent's phone: ${screen.title} ${screen.note}`} className="relative h-[540px] w-[264px] rounded-[52px] bg-cw-bezel p-[10px]">
      <div className="grid h-full overflow-hidden rounded-[42px] bg-cw-canvas text-cw-ink">
        {STATES.map((s) => {
          const { title, note, detail } = SCREENS[s];
          const active = s === state;
          return <div key={s} aria-hidden="true" className={`col-start-1 row-start-1 flex flex-col px-6 pb-7 pt-5 transition-[opacity,translate] duration-700 ease-out ${active ? 'opacity-100' : 'translate-y-2 opacity-0'}`}>
            <div className="flex items-center justify-between text-[15px] font-semibold">
              <span>2:14</span>
              <span className="h-[22px] w-[76px] rounded-full bg-cw-ink" />
              <span className="tabular-nums">100%</span>
            </div>
            <p className="mt-14 flex items-center gap-2 text-[16px] font-semibold text-cw-stone">
              <span className={`size-2.5 rounded-full ${s === 'paused' ? 'bg-cw-amber' : 'bg-cw-forest'}`} />
              {s === 'paused' ? 'Paused' : 'Protected'}
            </p>
            <p className="mt-4 font-cw-display text-[38px] font-light leading-[1.05] tracking-[-0.01em]">{title}</p>
            <p className="mt-4 text-[17px] leading-snug text-cw-stone">{note}</p>
            {detail && <p className="mt-5 rounded-2xl bg-cw-sand px-4 py-3 text-[17px] font-semibold">{detail}</p>}
            {s === 'calm' && <div className="mt-6 rounded-2xl bg-cw-sand px-4 py-1 text-[16px]">
              {TODAY.map(([what, amount]) => <p key={what} className="flex justify-between py-2.5"><span>{what}</span><span className="tabular-nums text-cw-stone">{amount}</span></p>)}
            </div>}
            <span className="mt-auto flex h-14 items-center justify-center rounded-full bg-cw-stone text-[18px] font-semibold text-white">Ask my family</span>
          </div>;
        })}
      </div>
    </div>
  </div>;
}
