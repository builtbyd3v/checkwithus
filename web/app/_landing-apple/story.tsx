'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Phone } from './phone';

export type Chapter = { id: string; name: string; title: string; body: string; label: string; screen: ReactNode };

/**
 * Desktop only: the phone stays pinned in the middle of the screen while the
 * page scrolls through the chapters; its screen and the words beside it
 * change. Without script it shows the first chapter, and the phone layout
 * (StoryList) carries the same content.
 */
export function StoryStage({ chapters }: { chapters: Chapter[] }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const n = chapters.length;

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -top / (height - window.innerHeight)));
      setActive(Math.min(n - 1, Math.floor(progress * n)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [n]);

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const span = el.offsetHeight - window.innerHeight;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.offsetTop + (span * (i + 0.5)) / n, behavior: reduce ? 'auto' : 'smooth' });
  };

  // ponytail: height is 100svh per chapter, hard-coded for four chapters.
  return (
    <section ref={ref} aria-label="What changes on the phone" className="relative hidden h-[400svh] lg:block">
      <div className="sticky top-0 grid h-svh grid-cols-[minmax(0,1.25fr)_auto_minmax(0,0.75fr)] items-center gap-[clamp(2rem,4vw,5rem)] px-[clamp(2rem,5vw,6rem)]">
        <div className="grid">
          {chapters.map((c, i) => (
            <div
              key={c.id}
              className={`[grid-area:1/1] max-w-[36rem] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${i === active ? 'opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
            >
              <h2 className="text-[clamp(2.5rem,1.2rem+2.2vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">{c.title}</h2>
              <p className="mt-6 text-[clamp(1.1875rem,1.1rem+0.25vw,1.3125rem)] leading-[1.5] text-white">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="relative w-[clamp(16rem,37svh,22rem)]">
          {chapters.map((c, i) => (
            <div
              key={c.id}
              aria-hidden={i !== active}
              className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${i === 0 ? 'relative' : 'absolute inset-0'} ${i === active ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0'}`}
            >
              <Phone label={c.label}>{c.screen}</Phone>
            </div>
          ))}
        </div>

        <ol aria-label="Chapters" className="justify-self-end space-y-1 text-right">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={i === active ? 'step' : undefined}
                className={`rounded-full px-4 py-2 text-[1.1875rem] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ap-sky active:scale-95 ${i === active ? 'text-white' : 'text-ap-mute-dark hover:text-white'}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
