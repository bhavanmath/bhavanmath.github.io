/* ==========================================================================
   Portfolio – main.js

   1. Settings
   2. Hero name (splits the name into letters so they can drop in)
   3. Loading screen (falling Greek letters)
   4. Header and navigation
   5. Copy email, footer year
   ========================================================================== */

(() => {
  'use strict';

  /* 1. Settings
     ====================================================================== */
  const LOADER_MS = 2000;           // length of the loading screen
  const LOADER_MS_REDUCED = 1200;   // used when the visitor prefers reduced motion
  const LETTER_FONT = '"Noto Serif Display", "Times New Roman", Georgia, serif';

  const root = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Greek alphabet, lower and upper case (skips the final sigma and the unassigned code point)
  const GREEK = [];
  for (let c = 0x03b1; c <= 0x03c9; c++) if (c !== 0x03c2) GREEK.push(String.fromCharCode(c));
  for (let c = 0x0391; c <= 0x03a9; c++) if (c !== 0x03a2) GREEK.push(String.fromCharCode(c));


  /* 2. Hero name
     ====================================================================== */
  function splitHeroName() {
    const title = document.querySelector('.hero__title');
    if (!title) return;

    const text = title.textContent.trim();
    title.setAttribute('aria-label', text);
    title.textContent = '';

    let index = 0;
    const words = text.split(/\s+/);

    words.forEach((word, w) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.setAttribute('aria-hidden', 'true');

      Array.from(word).forEach((ch) => {
        const charEl = document.createElement('span');
        charEl.className = 'char';
        charEl.style.setProperty('--i', index++);
        charEl.textContent = ch;
        wordEl.appendChild(charEl);
      });

      title.appendChild(wordEl);
      if (w < words.length - 1) title.appendChild(document.createTextNode(' '));
    });
  }


  /* 3. Loading screen
     ====================================================================== */
  let loadingFinished = false;

  // Reveals the page and fades the loader away. Safe to call more than once.
  function finishLoading(loader) {
    if (loadingFinished) return;
    loadingFinished = true;

    body.classList.remove('is-loading');
    root.classList.add('is-loaded');

    if (!loader) return;
    loader.classList.add('is-done');

    const remove = () => { if (loader.parentNode) loader.remove(); };
    loader.addEventListener('transitionend', (e) => {
      if (e.target === loader && e.propertyName === 'opacity') remove();
    });
    setTimeout(remove, 1200); // fallback if transitionend never fires
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Each letter is a small free-fall simulation: y = y0 + v0·t + ½·g·t²
  function createLetters(width, height) {
    const scale = Math.min(Math.max(width / 1100, 0.7), 1.25);
    const count = Math.round(Math.min(Math.max(width / 28, 22), 64));
    const gravity = height * 1.3; // px per second², so the fall time is similar on every screen

    return Array.from({ length: count }, () => {
      const depth = Math.random();                 // 0 = far away, 1 = close
      const size = (16 + depth * 40) * scale;
      return {
        ch: GREEK[Math.floor(Math.random() * GREEK.length)],
        x: Math.random() * width,
        y0: -size * 1.5,
        v0: height * (0.04 + Math.random() * 0.2),
        vx: (Math.random() - 0.5) * 24,
        g: gravity * (0.85 + depth * 0.3),
        delay: Math.pow(Math.random(), 1.3) * 0.7, // seconds before the letter is released
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 3,
        size,
        alpha: 0.18 + depth * 0.72
      };
    });
  }

  function initLoader() {
    const loader = document.getElementById('loader');
    if (!loader) { finishLoading(null); return; }

    const canvas = loader.querySelector('.loader__canvas');
    const countEl = loader.querySelector('.loader__count');
    const barEl = loader.querySelector('.loader__bar-fill');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    const duration = reducedMotion ? LOADER_MS_REDUCED : LOADER_MS;
    const showLetters = Boolean(ctx) && !reducedMotion;

    let width = 0;
    let height = 0;
    let letters = [];
    let startTime = null;
    let rafId = 0;

    // Lock scrolling while loading. Done here (not in the HTML) so the page
    // can never stay locked if this script fails to load.
    body.classList.add('is-loading');

    // Ask the browser to fetch the Greek glyphs of the heading font once the
    // font stylesheet has arrived. Until then the letters use a system serif.
    if (showLetters && document.fonts && document.fonts.load) {
      const requestGreek = () => {
        document.fonts.load('300 32px "Noto Serif Display"', '\u03b1\u03a9').catch(() => {});
      };
      const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
      if (!fontLink || fontLink.sheet) requestGreek();
      else fontLink.addEventListener('load', requestGreek, { once: true });
    }

    function resize() {
      if (!showLetters) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = loader.clientWidth;
      height = loader.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      letters = createLetters(width, height);
    }

    function draw(seconds) {
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      for (const l of letters) {
        const t = seconds - l.delay;
        if (t <= 0) continue;

        const y = l.y0 + l.v0 * t + 0.5 * l.g * t * t;
        if (y - l.size > height) continue; // already below the screen

        ctx.save();
        ctx.translate(l.x + l.vx * t, y);
        ctx.rotate(l.rot + l.spin * t);
        ctx.globalAlpha = l.alpha;
        ctx.font = `300 ${l.size}px ${LETTER_FONT}`;
        ctx.fillText(l.ch, 0, 0);
        ctx.restore();
      }
    }

    function complete() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      if (countEl) countEl.textContent = '100%';
      if (barEl) barEl.style.transform = 'scaleX(1)';
      finishLoading(loader);
    }

    function frame(now) {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutQuad(progress);

      if (countEl) countEl.textContent = Math.round(eased * 100) + '%';
      if (barEl) barEl.style.transform = 'scaleX(' + eased + ')';
      if (showLetters) draw(elapsed / 1000);

      if (progress < 1) rafId = requestAnimationFrame(frame);
      else complete();
    }

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(frame);

    // Safety net: never leave a visitor stuck on the loading screen
    setTimeout(complete, duration + 3000);
  }


  /* 4. Header and navigation
     ====================================================================== */
  function initNavigation() {
    const header = document.querySelector('.header');
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    const links = Array.from(document.querySelectorAll('.nav__link'));
    if (!header || !toggle || !nav || !links.length) return;

    const sections = links
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    // Mobile menu
    const setMenu = (open) => {
      nav.classList.toggle('is-open', open);
      body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });

    const desktopQuery = window.matchMedia('(min-width: 47.5625rem)');
    const onBreakpoint = (e) => { if (e.matches) setMenu(false); };
    if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', onBreakpoint);
    else if (desktopQuery.addListener) desktopQuery.addListener(onBreakpoint);

    // Header border and highlight for the section currently in view
    let ticking = false;

    function update() {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);

      const probe = window.scrollY + window.innerHeight * 0.35;
      let current = sections[0];
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top + window.scrollY <= probe) current = section;
      });

      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = sections[sections.length - 1];

      links.forEach((link) => {
        const active = link.getAttribute('href') === '#' + current.id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }


  /* 5. Copy email, footer year
     ====================================================================== */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers
    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      ok ? resolve() : reject(new Error('Copy failed'));
    });
  }

  function initCopyEmail() {
    const button = document.getElementById('copy-email');
    const link = document.getElementById('email-link');
    const status = document.getElementById('copy-status');
    if (!button || !link) return;

    const idleLabel = button.textContent;
    let timer = 0;

    const flash = (message) => {
      button.textContent = message;
      if (status) status.textContent = message;
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = idleLabel;
        if (status) status.textContent = '';
      }, 1800);
    };

    button.addEventListener('click', () => {
      copyText(link.textContent.trim()).then(() => flash('Copied'), () => flash('Copy failed'));
    });
  }

  function setFooterYear() {
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  }


  /* Start
     ====================================================================== */
  // Each step is isolated: if one fails, the others (and the loader) still run.
  [splitHeroName, initNavigation, initCopyEmail, setFooterYear].forEach((step) => {
    try { step(); } catch (err) { console.error(err); }
  });

  try {
    initLoader();
  } catch (err) {
    console.error(err);
    finishLoading(document.getElementById('loader'));
  }
})();
