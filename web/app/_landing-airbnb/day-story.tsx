'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { BillScene, BuzzScene, CallScene, PauseScene, SafeScene, TextScene } from './art';

type Beat = {
  time: string;
  title: string;
  text: string;
  badge: string;
  tone: 'coral' | 'safe' | 'ink';
  Scene: ComponentType;
};

const BEATS: Beat[] = [
  {
    time: '9:14 AM',
    title: 'A fake delivery text never shows up.',
    text: 'Mom reads her messages with her tea. The scam text went straight to Junk. The check ran on her iPhone, so the text never left it.',
    badge: 'Scam text kept out',
    tone: 'ink',
    Scene: TextScene,
  },
  {
    time: '10:02 AM',
    title: 'The phone rings as “Possible scam”.',
    text: 'A known scam number calls. Her screen warns her before she picks up. She answers anyway, and that is fine.',
    badge: 'Possible scam',
    tone: 'coral',
    Scene: CallScene,
  },
  {
    time: '10:05 AM',
    title: 'The caller wants gift cards. The payment pauses.',
    text: 'Mom tries to pay $500 in gift cards while still on the call. Her screen says “Paused. Your family will call you.” Nothing else for her to do.',
    badge: 'Paused',
    tone: 'coral',
    Scene: PauseScene,
  },
  {
    time: '10:05 AM',
    title: 'Dani’s phone buzzes at work.',
    text: 'Dani sees the amount, who it is for, and why it paused, in plain words: a gift card purchase, paid while on a phone call.',
    badge: 'Needs a family answer',
    tone: 'coral',
    Scene: BuzzScene,
  },
  {
    time: '10:06 AM',
    title: 'Dani taps No. Mom is safe.',
    text: 'The money never moves. Mom’s screen changes to “You’re safe”, and Dani calls her to explain.',
    badge: 'You’re safe',
    tone: 'safe',
    Scene: SafeScene,
  },
  {
    time: '12:00 PM',
    title: 'The electric bill pays on its own.',
    text: 'The family set an allowance for utility bills under $200. Routine bills inside it pay without a push to anyone.',
    badge: 'Paid, no one asked',
    tone: 'safe',
    Scene: BillScene,
  },
];

const badgeTone = {
  coral: 'bg-cw-coral text-white',
  safe: 'bg-cw-safe text-white',
  ink: 'bg-cw-ink text-white',
} as const;

// Sun position over the day, one step per beat (morning low left, noon high right).
const sunSteps = [
  'translate-x-0 translate-y-0',
  'translate-x-[18%] -translate-y-2',
  'translate-x-[36%] -translate-y-4',
  'translate-x-[54%] -translate-y-5',
  'translate-x-[72%] -translate-y-6',
  'translate-x-[90%] -translate-y-6',
];

/** Index of the beat crossing the middle of the screen. */
function useActiveIndex(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const el of refs.current.slice(0, count)) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [count]);
  return { refs, active };
}

function Badge({ beat, className = '' }: { beat: Beat; className?: string }) {
  return (
    <span className={`inline-flex min-h-10 items-center rounded-full px-4 text-base font-semibold ${badgeTone[beat.tone]} ${className}`}>
      {beat.badge}
    </span>
  );
}

export function DayStory() {
  const { refs, active } = useActiveIndex(BEATS.length);
  const current = BEATS[active];

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-16">
      {/* Desktop: one sticky picture that follows the story. */}
      <div className="hidden lg:col-span-7 lg:block">
        <div className="sticky top-[12vh]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-cw-warm">
            {BEATS.map(({ Scene, time }, i) => (
              <div
                key={time + i}
                className={`absolute inset-0 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${i === active ? 'scale-100 opacity-100' : 'scale-[1.03] opacity-0'}`}
              >
                <Scene />
              </div>
            ))}
            <div className="absolute left-6 top-6 flex items-center gap-3">
              <span className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-base font-semibold tabular-nums text-cw-ink">
                {current.time}
              </span>
              <Badge beat={current} />
            </div>
          </div>
          {/* The day passing: a sun that climbs as you read. */}
          <div className="relative mt-6 h-14 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-x-0 bottom-2 h-2 rounded-full bg-cw-soft" />
            <div className={`absolute bottom-0 left-0 w-full transition-transform duration-700 ease-out motion-reduce:transition-none ${sunSteps[active]}`}>
              <span className="block h-8 w-8 rounded-full bg-[#ffc24b]" />
            </div>
          </div>
        </div>
      </div>

      <ol className="lg:col-span-5">
        {BEATS.map((beat, i) => (
          <li
            key={beat.time + i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            className="flex flex-col justify-center py-10 lg:min-h-[66vh] lg:py-0"
          >
            <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-[24px] bg-cw-warm lg:hidden">
              <beat.Scene />
              <Badge beat={beat} className="absolute left-4 top-4" />
            </div>
            <p className="cw-reveal text-xl font-semibold tabular-nums text-cw-coral">{beat.time}</p>
            <h3 className="cw-reveal-2 mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-cw-ink lg:text-[30px]">
              {beat.title}
            </h3>
            <p className="cw-reveal-3 mt-4 max-w-[34rem] text-lg leading-[1.6] text-cw-body lg:text-xl">{beat.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
