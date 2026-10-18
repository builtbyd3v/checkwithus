'use client';

import { useEffect } from 'react';

/**
 * Scroll reveal for every [data-reveal] element. Only elements that start below the fold are hidden,
 * and only once script runs, so the page is complete without it. Each element reveals once.
 * The CSS in globals.css skips the travel for prefers-reduced-motion.
 */
export function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-reveal', 'in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const el of document.querySelectorAll('[data-reveal]')) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      el.setAttribute('data-reveal', 'pending');
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
