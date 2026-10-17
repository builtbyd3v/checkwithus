'use client';

import { useEffect } from 'react';

/** Plays each [data-reveal] element's entrance once, when it scrolls into view. */
export function Reveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    // Whatever is already on screen stays put, so nothing flashes away on load.
    for (const el of items) {
      const box = el.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) el.classList.add('is-in');
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    for (const el of items) if (!el.classList.contains('is-in')) io.observe(el);
    document.documentElement.dataset.mReveal = '';
    return () => io.disconnect();
  }, []);
  return null;
}
