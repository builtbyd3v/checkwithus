'use client';

import { useEffect, useRef, useState } from 'react';
import { HOLD_REASON_LABELS } from '@/lib/rules';
import { Phone, type PhoneState } from './phone';

type Answer = 'yes' | 'no' | null;

const AFTER: Record<'yes' | 'no' | 'none', string> = {
  none: 'A family member taps no. The $500 stays in her account, and the ring settles back to calm.',
  no: 'You said no. The $500 stays in her account, and her phone tells her she is safe.',
  yes: 'You said yes. The payment goes through, and the ring settles back to calm.',
};

/** Scroll story: the ring is calm, turns amber when a payment pauses, and calms again when the family answers. */
export function PauseStory() {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<Answer>(null);
  const steps = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setStep(Number((entry.target as HTMLElement).dataset.step));
      }
    }, { rootMargin: '-55% 0px -40% 0px' });
    for (const el of steps.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  const state: PhoneState = step === 0 ? 'calm'
    : answer === 'yes' ? 'paid'
    : answer === 'no' || step === 2 ? 'stopped'
    : 'paused';

  const answerButton = 'inline-flex min-h-14 items-center rounded-full px-7 text-lg font-semibold transition-[translate,scale,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cw-ink';

  return <div className="relative grid lg:grid-cols-[1fr_1fr] lg:gap-16">
    <div className="sticky top-0 z-10 -mx-4 grid h-[380px] place-items-center overflow-hidden bg-cw-canvas sm:-mx-8 sm:h-[500px] lg:top-[8vh] lg:mx-0 lg:h-[84vh] lg:overflow-visible lg:bg-transparent">
      <Phone state={state} className="-my-[108px] scale-[0.6] sm:-my-[54px] sm:scale-[0.8] lg:my-0 lg:scale-100" />
    </div>

    <ol className="relative">
      <li ref={(el) => { steps.current[0] = el; }} data-step="0" className="min-h-[70svh] pt-8 lg:flex lg:min-h-[84vh] lg:flex-col lg:justify-center lg:pt-0">
        <h3 className="font-cw-display text-[34px] font-light leading-[1.1] sm:text-[44px]">A normal afternoon.</h3>
        <p className="mt-5 max-w-md text-xl leading-relaxed">Groceries pay. The pharmacy pays. The ring breathes slowly, and nothing asks for her attention.</p>
      </li>

      <li ref={(el) => { steps.current[1] = el; }} data-step="1" className="min-h-[90svh] pt-8 lg:flex lg:min-h-[84vh] lg:flex-col lg:justify-center lg:pt-0">
        <h3 className="font-cw-display text-[34px] font-light leading-[1.1] sm:text-[44px]">A gift card, during a call.</h3>
        <p className="mt-5 max-w-md text-xl leading-relaxed">A caller pushes her to buy a $500 gift card. The payment pauses, and the ring turns amber. Your phone gets this:</p>
        <div className="mt-8 max-w-md rounded-3xl bg-white p-6 sm:p-7">
          <p className="text-lg font-semibold">Mom wants to pay $500.00</p>
          <p className="mt-1 text-lg text-cw-stone">To a gift card store</p>
          <p className="mt-5 text-base font-semibold text-cw-stone">Why it paused</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[HOLD_REASON_LABELS.gift_card, HOLD_REASON_LABELS.during_call].map((r) => <li key={r} className="rounded-full bg-cw-amber/30 px-4 py-2 text-base font-semibold text-cw-gold-deep">{r}</li>)}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" aria-pressed={answer === 'no'} onClick={() => setAnswer('no')} className={`${answerButton} bg-cw-stone text-white hover:bg-cw-ink`}>Say no</button>
            <button type="button" aria-pressed={answer === 'yes'} onClick={() => setAnswer('yes')} className={`${answerButton} bg-cw-sand text-cw-ink hover:bg-cw-sage-pale`}>Say yes</button>
          </div>
        </div>
      </li>

      <li ref={(el) => { steps.current[2] = el; }} data-step="2" className="min-h-[70svh] pt-8 lg:flex lg:min-h-[84vh] lg:flex-col lg:justify-center lg:pt-0">
        <h3 className="font-cw-display text-[34px] font-light leading-[1.1] sm:text-[44px]">The family answers. Calm returns.</h3>
        <p aria-live="polite" className="mt-5 max-w-md text-xl leading-relaxed">{AFTER[answer ?? 'none']}</p>
      </li>
    </ol>
  </div>;
}
