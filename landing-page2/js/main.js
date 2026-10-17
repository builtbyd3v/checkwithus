/*
 * Landing page behaviour.
 *
 *   1. Navigation: the pill turns solid after the first scroll, and collapses
 *      into a dropdown menu on narrower screens.
 *   2. Motion (GSAP + ScrollTrigger): one rehearsed hero entrance, then motion
 *      only where it means something. Features arrive as a grid, the steps as
 *      a sequence, pricing resolves onto the recommended plan, and the closing
 *      panel settles once.
 *   3. Pointer effects: cards light up under the cursor; the footer wordmark
 *      follows it.
 *
 * Safety rules the whole file follows:
 *   - Nothing is hidden by CSS alone. Elements are hidden with gsap.set() only
 *     after GSAP is confirmed present, so with no script the page is fully visible.
 *   - prefers-reduced-motion: show everything, animate nothing.
 *   - Only elements below the fold are pre-hidden, so nothing flashes out of view
 *     on a short window or a deep link.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  function one(selector, scope) { return (scope || document).querySelector(selector); }
  function all(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }

  /* Releases the CSS guard that keeps the hero invisible until it can animate. */
  function unguard() { root.classList.remove('rm-motion'); }

  /* ------------------------------------------------------------------ 1. Navigation */

  function initNav() {
    var pill = one('.rm-nav-pill');
    if (!pill) return;

    /*
     * "Scrolled away from the top" is detected with a 48px sentinel pinned to the
     * top of the document, not by reading scroll offsets. Whichever element
     * actually scrolls, the sentinel leaves the viewport and the pill goes solid.
     */
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none;opacity:0;';
    document.body.prepend(sentinel);

    function setStuck(on) { pill.classList.toggle('is-stuck', on); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        setStuck(!entries[0].isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
    } else {
      var queued = false;
      var sync = function () {
        var scroller = document.scrollingElement || document.documentElement;
        setStuck((scroller.scrollTop || window.pageYOffset || 0) > 40);
        queued = false;
      };
      var onScroll = function () {
        if (!queued) { queued = true; window.requestAnimationFrame(sync); }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      sync();
    }

    /* Compact menu: the same link row is reflowed into a dropdown (see CSS). */
    var toggle = one('.rm-nav-toggle');
    var links = document.getElementById('rm-nav-links');
    if (!toggle || !links) return;

    function isOpen() { return pill.classList.contains('is-open'); }
    function setOpen(open) {
      pill.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(!isOpen());
    });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('click', function (event) {
      if (isOpen() && !pill.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    /* Growing back to the wide layout closes the panel. */
    var wide = window.matchMedia('(min-width: 1241px)');
    var onChange = function (event) { if (event.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else if (wide.addListener) wide.addListener(onChange);
  }

  /* ------------------------------------------------------------------ 2. Motion */

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* True when the element starts below the fold and is safe to pre-hide. */
  function belowFold(el) {
    return !!el && el.getBoundingClientRect().top > window.innerHeight * 0.9;
  }

  function initMotion() {
    if (!gsap) {
      unguard();
      return;
    }
    if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    gsap.matchMedia().add(
      { motionOK: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' },
      function (ctx) {
        if (ctx.conditions.reduced) {
          unguard();
          staticFooterMark();
          return;
        }

        var hero = one('.rm-hero-box');
        if (hero) heroEntrance(hero);
        else unguard();

        footerMark();

        if (ScrollTrigger) {
          featureGrid();
          stepSequence();
          pricing();
          closingPanel();
          revealGroup(all('.rm-testi'), 0.07);
        }
      }
    );

    /* Cards light up under the pointer whatever the motion preference is. */
    cursorGlow();
    revealForPrint();
  }

  /*
   * The signature moment: the serif accent ("actually follow") gets a wipe rather
   * than another fade, and everything else supports it.
   */
  function heroEntrance(hero) {
    var badge = one('.rm-badge', hero);
    var h1 = one('.rm-h1', hero);
    var accent = one('.rm-h1-accent', hero);
    var sub = one('.rm-hero-sub', hero);
    var cta = one('.rm-hero-cta-sp', hero);
    var phones = all('.rm-phones > *', hero);

    var rise = [badge, h1, sub, cta].filter(Boolean);
    gsap.set(rise, { autoAlpha: 0, y: 18 });

    /* Negative vertical insets keep italic ascenders and descenders unclipped. */
    if (accent) gsap.set(accent, { y: 18, clipPath: 'inset(-18% 100% -18% 0)' });

    /*
     * The phones sit flush on the bottom edge of the hero, so they never move
     * vertically. They scale up from that edge instead.
     */
    gsap.set(phones, { autoAlpha: 0, scale: 0.96, transformOrigin: 'center bottom' });

    unguard(); // start values are inline now, so the CSS guard can go

    var tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } });
    tl.to(badge, { autoAlpha: 1, y: 0, duration: 0.5 })
      .to(h1, { autoAlpha: 1, y: 0 }, '-=0.30');

    if (accent) {
      tl.to(accent, { y: 0, clipPath: 'inset(-18% -2% -18% 0)', duration: 0.95, ease: 'power2.out' }, '-=0.45');
    }

    tl.to(sub, { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.62')
      .to(cta, { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.42')
      // The lead phone is the middle child, so staggering "from center" lets it
      // arrive first with the other two settling around it.
      .to(phones, { autoAlpha: 1, scale: 1, duration: 0.9, stagger: { each: 0.09, from: 'center' } }, '-=0.50');
  }

  /* A grid reads as grid rhythm: one short stagger in source order. */
  function featureGrid() {
    var items = all('.rm-fgrid .rm-card, .rm-fgrid .rm-shot').filter(belowFold);
    if (!items.length) return;

    gsap.set(items, { autoAlpha: 0, y: 20 });
    ScrollTrigger.batch(items, {
      start: 'top 86%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, overwrite: true });
      }
    });
  }

  /* The three steps are a sequence, so the motion is ordered: a number lands, then its copy. */
  function stepSequence() {
    var steps = all('.rm-step').filter(belowFold);
    if (!steps.length) return;

    var numbers = [];
    var copy = [];
    steps.forEach(function (step) {
      var number = one('.rm-stepnum', step);
      if (number) numbers.push(number);
      copy = copy.concat(all('.rm-card-title, .rm-card-sub', step));
    });

    gsap.set(numbers, { autoAlpha: 0, scale: 0.82, transformOrigin: 'left center' });
    gsap.set(copy, { autoAlpha: 0, y: 14 });

    ScrollTrigger.create({
      trigger: steps[0].parentNode,
      start: 'top 80%',
      once: true,
      onEnter: function () {
        var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        steps.forEach(function (step, index) {
          var at = index * 0.15;
          var number = one('.rm-stepnum', step);
          var text = all('.rm-card-title, .rm-card-sub', step);
          if (number) tl.to(number, { autoAlpha: 1, scale: 1, duration: 0.6 }, at);
          if (text.length) tl.to(text, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.06 }, at + 0.12);
        });
      }
    });
  }

  /* Pricing resolves onto the recommended plan: it starts with the last (annual) card and settles leftward. */
  function pricing() {
    var plans = all('.rm-plans > *').filter(belowFold);
    var includes = one('.rm-includes');

    if (plans.length) {
      gsap.set(plans, { autoAlpha: 0, y: 22 });
      ScrollTrigger.create({
        trigger: plans[0].parentNode,
        start: 'top 82%',
        once: true,
        onEnter: function () {
          gsap.to(plans, { autoAlpha: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: { each: 0.1, from: 'end' } });
        }
      });
    }

    if (includes && belowFold(includes)) {
      gsap.set(includes, { autoAlpha: 0, y: 18 });
      ScrollTrigger.create({
        trigger: includes,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(includes, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' });
        }
      });
    }
  }

  /*
   * The closing frame: one settle, then the QR code arrives and the signal ring starts.
   * Starting the ring is a class, not a tween, so its loop lives in CSS and never runs off-screen.
   */
  function closingPanel() {
    var box = one('.rm-cta-box');
    if (!box) return;

    var qr = one('.rm-qr', box);

    // Already in view (short window, deep link): arm the ring and skip the entrance.
    if (!belowFold(box)) {
      armSignalRing();
      return;
    }

    gsap.set(box, { autoAlpha: 0, y: 26, scale: 0.985 });
    if (qr) gsap.set(qr, { autoAlpha: 0, scale: 0.9 });

    ScrollTrigger.create({
      trigger: box,
      start: 'top 86%',
      once: true,
      onEnter: function () {
        var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: armSignalRing });
        tl.to(box, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8 });
        if (qr) tl.to(qr, { autoAlpha: 1, scale: 1, duration: 0.5 }, '-=0.35');
      }
    });
  }

  function armSignalRing() {
    var box = one('.rm-cta-box');
    if (box) box.classList.add('rm-cta-live');
  }

  /* Siblings that share one reveal. A stagger of 0 means "settle as one". */
  function revealGroup(items, stagger) {
    items = items.filter(Boolean).filter(belowFold);
    if (!items.length) return;

    gsap.set(items, { autoAlpha: 0, y: 18 });
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: stagger || 0, overwrite: true });
      }
    });
  }

  /*
   * Printing or saving as PDF never scrolls, so anything still waiting for a
   * scroll reveal would print blank. Show it all the moment the page is printed.
   */
  function revealForPrint() {
    var selector = [
      '.rm-hero-box > *', '.rm-fgrid .rm-card', '.rm-fgrid .rm-shot',
      '.rm-stepnum', '.rm-step .rm-card-title', '.rm-step .rm-card-sub',
      '.rm-plans > *', '.rm-includes', '.rm-cta-box', '.rm-qr', '.rm-testi'
    ].join(',');

    function reveal() {
      if (!gsap) return;
      var hidden = all(selector).filter(function (el) {
        return parseFloat(getComputedStyle(el).opacity) === 0;
      });
      if (hidden.length) gsap.set(hidden, { autoAlpha: 1, y: 0, scale: 1, clearProps: 'clipPath' });
    }

    window.addEventListener('beforeprint', reveal);
    if (window.matchMedia) {
      var query = window.matchMedia('print');
      if (query.addEventListener) {
        query.addEventListener('change', function (event) { if (event.matches) reveal(); });
      }
    }
  }

  /* ------------------------------------------------------------------ 3. Footer wordmark + pointer glow */

  /* Reduced motion: the wordmark is simply present at its resting strength. */
  function staticFooterMark() {
    var mark = one('.rm-footer-mark');
    if (mark) mark.style.setProperty('--rm-mark-base', '0.07');
  }

  /*
   * The footer wordmark: a light sweeps across it once as the footer arrives,
   * and afterwards that same light follows the cursor. One mechanism, two uses.
   * The lit layer is a second copy of the logo revealed through a radial mask
   * (see CSS), so the light seems to come from behind the mark.
   */
  function footerMark() {
    var mark = one('.rm-footer-mark');
    if (!mark) return;

    var footer = mark.closest('.rm-footer') || mark.parentNode;

    // Unitless on purpose: the stylesheet turns these into percentages with calc(),
    // which is what lets gsap.quickTo() drive them below.
    gsap.set(mark, { '--rm-mark-base': 0, '--rm-mark-lit': 0, '--rm-spot-x': -10, '--rm-spot-y': 46 });

    function sweep() {
      gsap.timeline()
        .to(mark, { '--rm-mark-base': 0.07, duration: 0.9, ease: 'power2.out' })
        .to(mark, { '--rm-mark-lit': 0.62, duration: 0.45, ease: 'power2.out' }, 0.1)
        .to(mark, { '--rm-spot-x': 112, duration: 1.5, ease: 'power1.inOut' }, 0.1)
        .to(mark, { '--rm-mark-lit': 0, duration: 0.5, ease: 'power2.in' }, 1.1);
    }

    if (ScrollTrigger) {
      ScrollTrigger.create({ trigger: footer, start: 'top 92%', once: true, onEnter: sweep });
    } else {
      sweep();
    }

    if (!finePointer) return;

    // quickTo reuses one tween per property instead of creating a new one per pointer event.
    var moveX = gsap.quickTo(mark, '--rm-spot-x', { duration: 0.5, ease: 'power3' });
    var moveY = gsap.quickTo(mark, '--rm-spot-y', { duration: 0.5, ease: 'power3' });
    var rect = null;
    var hovering = false;

    function measure() { rect = mark.getBoundingClientRect(); }

    footer.addEventListener('pointerenter', function () {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      hovering = true;
      measure();
      gsap.to(mark, { '--rm-mark-lit': 0.55, duration: 0.45, ease: 'power2.out' });
    });
    footer.addEventListener('pointerleave', function () {
      hovering = false;
      gsap.to(mark, { '--rm-mark-lit': 0, duration: 0.6, ease: 'power2.out' });
    });
    footer.addEventListener('pointermove', function (event) {
      if (!hovering) return;
      if (!rect) measure();
      // Percent of the mark's box keeps the light correct if the footer reflows.
      moveX(((event.clientX - rect.left) / rect.width) * 100);
      moveY(((event.clientY - rect.top) / rect.height) * 100);
    }, { passive: true });
    window.addEventListener('resize', function () { rect = null; }, { passive: true });
  }

  /*
   * Cards light up from wherever the cursor is. The card's rect is cached on
   * enter so moving never forces a layout read.
   */
  function cursorGlow() {
    if (!finePointer) return;

    all('.rm-card, .rm-plan, .rm-includes, .rm-tile, .rm-testi').forEach(function (card) {
      var rect = null;

      card.addEventListener('pointerenter', function () {
        rect = card.getBoundingClientRect();
        card.classList.add('rm-lit');
      });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('rm-lit');
        rect = null;
      });
      card.addEventListener('pointermove', function (event) {
        if (!rect) rect = card.getBoundingClientRect();
        card.style.setProperty('--rm-cx', (event.clientX - rect.left) + 'px');
        card.style.setProperty('--rm-cy', (event.clientY - rect.top) + 'px');
      }, { passive: true });
    });
  }

  /* ------------------------------------------------------------------ Boot */

  function boot() {
    initNav();
    initMotion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
