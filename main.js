/* ==========================================================================
   Portfolio – main.js

   1. Settings
   2. Hero name (splits the name into letters so they can drop in)
   3. Loading screen (a grid of 0s and 1s)
   4. Header and navigation
   5. Copy email, footer year
   ========================================================================== */

(() => {
  'use strict';

  /* 1. Settings
     ====================================================================== */
  const LOADER_MS = 2000;           // length of the loading screen
  const LOADER_MS_REDUCED = 1200;   // used when the visitor prefers reduced motion

  // Loading screen: a grid of 0s and 1s
  const GRID_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Roboto Mono", "DejaVu Sans Mono", "Courier New", monospace';
  const GRID_PITCH_X = 2.1;         // distance between digit centres across, in font sizes
  const GRID_PITCH_Y = 2.6;         // distance between digit centres down, in font sizes
  const ALPHA_ZERO = 0.3;           // brightness of a 0
  const ALPHA_ONE = 0.85;           // brightness of a 1
  const FLIP_MS = 130;              // how long a single 0 <-> 1 change takes
  const FLIP_FIRST = 0.06;          // nothing changes before 6% of the loading time (the all-0s start)
  const FLIP_LAST = 0.80;           // ordinary cells have settled on 1 by 80%
  const FLIP_FINAL = 0.86;          // the very last cell turns to 1 at 86%, then the all-1s grid is held
  const BACKFLIP_SHARE = 0.2;       // share of cells that go 0 -> 1 -> 0 -> 1 on the way

  const root = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // Lays the digits out on an evenly spaced grid that, together with its edge
  // padding, fills the whole canvas. The digits always keep their natural
  // proportions: only the gaps between them are adjusted so the grid fits exactly.
  function createGrid(width, height) {
    const shortSide = Math.min(width, height);
    const fontSize = clamp(shortSide / 38, 13, 22);
    const pad = clamp(shortSide * 0.05, 16, 48);

    const innerW = Math.max(width - pad * 2, fontSize * 3);
    const innerH = Math.max(height - pad * 2, fontSize * 3);
    const cols = Math.max(3, Math.round(innerW / (fontSize * GRID_PITCH_X)));
    const rows = Math.max(3, Math.round(innerH / (fontSize * GRID_PITCH_Y)));
    const pitchX = innerW / cols;
    const pitchY = innerH / rows;

    return {
      fontSize,
      cols,
      rows,
      count: cols * rows,
      xs: Array.from({ length: cols }, (_, c) => pad + (c + 0.5) * pitchX),
      ys: Array.from({ length: rows }, (_, r) => pad + (r + 0.5) * pitchY)
    };
  }

  // Gives every cell a list of moments (as fractions of the loading time) at
  // which it flips. Every cell starts as 0, so after one flip it shows 1, after
  // two it shows 0 again, after three 1 again. Every cell ends on an odd
  // number of flips, so the final grid is all 1s.
  function createSchedule(grid, instant) {
    const { cols, rows, count } = grid;
    const times = new Array(count);

    // Reduced motion: no flicker, the whole grid simply switches from 0 to 1 once.
    if (instant) {
      for (let i = 0; i < count; i++) times[i] = [0.5];
      return times;
    }

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      // 0 at the top-left corner, 1 at the bottom-right: a loose diagonal sweep
      const sweep = (col / Math.max(cols - 1, 1) + row / Math.max(rows - 1, 1)) / 2;
      const spread = 0.7 * Math.random() + 0.3 * sweep;

      if (Math.random() < BACKFLIP_SHARE) {
        const on = FLIP_FIRST + Math.random() * 0.45;                         // turns to 1 early,
        const off = on + 0.08 + Math.random() * 0.1;                          // drops back to 0,
        const again = Math.min(off + 0.08 + Math.random() * 0.12, FLIP_LAST); // and ends on 1
        times[i] = [on, off, again];
      } else {
        times[i] = [FLIP_FIRST + (FLIP_LAST - FLIP_FIRST) * spread];
      }
    }

    // Two anchor cells guarantee that no frame between the start and the end is
    // all 0s or all 1s: one cell turns to 1 right at the start and never
    // changes back, and one cell stays 0 until the very last moment.
    const early = (Math.random() * count) | 0;
    const late = (early + 1 + ((Math.random() * (count - 1)) | 0)) % count;
    times[early] = [FLIP_FIRST + 0.01];
    times[late] = [FLIP_FINAL];

    return times;
  }

  function initLoader() {
    const loader = document.getElementById('loader');
    if (!loader) { finishLoading(null); return; }

    const canvas = loader.querySelector('.loader__canvas');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    const duration = reducedMotion ? LOADER_MS_REDUCED : LOADER_MS;
    const flipLength = reducedMotion ? 0 : FLIP_MS / duration; // as a fraction of the loading time
    const showGrid = Boolean(ctx);

    let width = 0;
    let height = 0;
    let grid = null;
    let schedule = null;
    let startTime = null;
    let rafId = 0;
    let observer = null;

    // Lock scrolling while loading. Done here (not in the HTML) so the page
    // can never stay locked if this script fails to load.
    body.classList.add('is-loading');

    // Re-fits the grid whenever the screen size changes (rotation, resizing,
    // browser toolbars). The bitmap is scaled by one factor on both axes, so
    // the digits can never be stretched.
    function resize() {
      if (!showGrid) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;

      // Sharp on high-density screens, but capped so a very large screen never
      // has to paint an enormous bitmap (about 8 million pixels at most).
      const maxScale = Math.min(w > 900 ? 2 : 3, Math.sqrt(8e6 / (w * h)));
      const scale = Math.max(1, Math.min(window.devicePixelRatio || 1, maxScale));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const exact = canvas.width / w;
      ctx.setTransform(exact, 0, 0, exact, 0, 0);

      width = w;
      height = h;

      const next = createGrid(w, h);
      const changed = !grid || next.cols !== grid.cols || next.rows !== grid.rows;
      grid = next;
      if (changed) schedule = createSchedule(grid, reducedMotion);
    }

    // progress: 0 (start) to 1 (end) of the loading time
    function draw(progress) {
      ctx.clearRect(0, 0, width, height);
      ctx.font = grid.fontSize + 'px ' + GRID_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      const { cols, xs, ys, count } = grid;
      const zeros = [];
      const ones = [];
      const changing = []; // cells in the middle of a change: [index, newValue, how far along]

      for (let i = 0; i < count; i++) {
        const list = schedule[i];
        let flips = 0;
        while (flips < list.length && list[flips] <= progress) flips++;

        const value = flips & 1;
        if (flips > 0 && flipLength > 0) {
          const along = (progress - list[flips - 1]) / flipLength;
          if (along < 1) {
            changing.push([i, value, along * along * (3 - 2 * along)]);
            continue;
          }
        }
        (value ? ones : zeros).push(i);
      }

      const put = (digit, i) => ctx.fillText(digit, xs[i % cols], ys[(i / cols) | 0]);

      ctx.globalAlpha = ALPHA_ZERO;
      for (let k = 0; k < zeros.length; k++) put('0', zeros[k]);

      ctx.globalAlpha = ALPHA_ONE;
      for (let k = 0; k < ones.length; k++) put('1', ones[k]);

      // Quick, soft cross-fade between the old and the new digit
      for (let k = 0; k < changing.length; k++) {
        const [i, value, t] = changing[k];
        const from = value ? ALPHA_ZERO : ALPHA_ONE;
        const to = value ? ALPHA_ONE : ALPHA_ZERO;
        ctx.globalAlpha = from * (1 - t);
        put(value ? '0' : '1', i);
        ctx.globalAlpha = to * t;
        put(value ? '1' : '0', i);
      }

      ctx.globalAlpha = 1;
    }

    function complete() {
      cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', resize);
      finishLoading(loader);
    }

    function frame(now) {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);

      if (showGrid && grid) draw(progress);

      if (progress < 1) rafId = requestAnimationFrame(frame);
      else complete();
    }

    resize();
    window.addEventListener('resize', resize);
    if (showGrid && 'ResizeObserver' in window) {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    }
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
    const cue = document.querySelector('.scroll-cue__inner');
    let ticking = false;

    function update() {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);

      // "Scroll to see more" fades out smoothly over the first fifth of a screen of scrolling
      if (cue) {
        const fade = clamp(1 - window.scrollY / (window.innerHeight * 0.2), 0, 1);
        cue.style.opacity = fade < 1 ? String(fade) : '';
        cue.classList.toggle('is-gone', fade <= 0.02);
      }

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
  // A fresh visit always starts on the first screen (unless the link points at a section)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!window.location.hash) window.scrollTo(0, 0);

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
