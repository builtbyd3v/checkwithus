'use client';

import { useEffect, useState } from 'react';
import { SCREENS } from './screens';


/** The still half of the page: her iPhone screen, which changes as each story block reaches the reading line. */
export function Stage({ className }: { className: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>('[data-step]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(Number(e.target.getAttribute('data-step')));
      },
      { rootMargin: '-55% 0px -40% 0px' },
    );
    blocks.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, []);

  return (
    <div className={className}>
      <div aria-hidden="true" className="relative h-[600px] w-[340px]">
        {SCREENS.map((screen, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-[opacity,translate] duration-1000 ease-out motion-reduce:transition-none ${i === step ? 'opacity-100' : 'translate-y-3 opacity-0'}`}
          >
            {screen}
          </div>
        ))}
      </div>
    </div>
  );
}
