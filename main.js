/* ==========================================================================
   Portfolio – main.js

   1. Settings
   2. Loading screen (a grid of 0s and 1s)
   3. Header, navigation and section numbers
   4. Copy email, footer year
   5. Hero figure (an interactive Lorenz attractor)
   ========================================================================== */

(() => {
  'use strict';

  /* 1. Settings
     ====================================================================== */
  const LOADER_MS = 2000;           // length of the loading screen
  const LOADER_MS_REDUCED = 1200;   // used when the visitor prefers reduced motion

  // The full loading screen plays once per browser session, and can be skipped
  const INTRO_KEY = 'intro-seen';   // kept in sessionStorage: a new tab or window plays it again
  const SKIP_GRACE_MS = 350;        // key presses and taps in the first moments are ignored

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


  /* 2. Loading screen
     ====================================================================== */
  let loadingFinished = false;
  let introDone = false;
  const introWaiters = [];

  // Runs a function once the loading screen is over (straight away if it already is)
  function whenIntroDone(fn) {
    if (introDone) fn(); else introWaiters.push(fn);
  }

  // Reveals the page and fades the loader away. Safe to call more than once.
  function finishLoading(loader) {
    if (loadingFinished) return;
    loadingFinished = true;

    body.classList.remove('is-loading');
    root.classList.add('is-loaded');

    introDone = true;
    introWaiters.splice(0).forEach((fn) => {
      try { fn(); } catch (err) { console.error(err); }
    });

    if (!loader) return;
    rememberIntro();
    loader.classList.add('is-done');

    const remove = () => { if (loader.parentNode) loader.remove(); };
    loader.addEventListener('transitionend', (e) => {
      if (e.target === loader && e.propertyName === 'opacity') remove();
    });
    setTimeout(remove, 1200); // fallback if transitionend never fires
  }

  // The full loading screen plays once per browser session. Opening the page
  // with ?intro on the end of the address (for example index.html?intro) plays it again.
  function introAlreadySeen() {
    if (new URLSearchParams(window.location.search).has('intro')) return false;
    try { return window.sessionStorage.getItem(INTRO_KEY) === '1'; } catch (err) { return false; }
  }

  function rememberIntro() {
    try { window.sessionStorage.setItem(INTRO_KEY, '1'); } catch (err) { /* storage blocked: it just plays every time */ }
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

    // Already seen in this browser session: no loading screen at all
    if (introAlreadySeen()) {
      loader.remove();
      finishLoading(null);
      return;
    }

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

    // The skip prompt: plain text in the last row of the grid. The digits behind it
    // are left out (see draw), so it sits in the grid like part of the matrix.
    const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const hint = document.createElement('p');
    hint.className = 'loader__hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = touchOnly ? 'tap anywhere to skip' : 'press any key to skip';
    loader.appendChild(hint);
    let hole = null;   // the stretch of the last row that the prompt occupies

    function placeHint() {
      const c = canvas.getBoundingClientRect();
      const l = loader.getBoundingClientRect();
      const row = grid.rows - 1;
      hint.style.left = (c.left - l.left + width / 2) + 'px';
      hint.style.top = (c.top - l.top + grid.ys[row]) + 'px';
      hint.style.bottom = 'auto';
      hint.style.transform = 'translate(-50%, -50%)';
      const half = hint.offsetWidth / 2 + grid.fontSize * 1.5;
      hole = { row, left: width / 2 - half, right: width / 2 + half };
    }

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
      placeHint();
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
        if (hole && ((i / cols) | 0) === hole.row) {
          const x = xs[i % cols];
          if (x > hole.left && x < hole.right) continue;   // under the skip prompt
        }

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
      document.removeEventListener('keydown', onKey);
      finishLoading(loader);
    }

    // Skipping: any key, or a click or tap anywhere. The loading screen then fades
    // away a little faster than it normally does.
    const openedAt = performance.now();
    let skipped = false;

    function skip() {
      if (skipped || performance.now() - openedAt < SKIP_GRACE_MS) return;
      skipped = true;
      loader.classList.add('is-skipping');
      complete();
    }

    function onKey(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;     // browser shortcuts
      if (/^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|Fn)$|^F\d+$/.test(e.key)) return;   // modifier and function keys
      if (e.key === 'Enter' || e.key === ' ') e.preventDefault();     // don't also press something under the loader
      skip();
    }

    function frame(now) {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);

      if (showGrid && grid) draw(progress);

      if (progress < 1) rafId = requestAnimationFrame(frame);
      else complete();
    }

    document.addEventListener('keydown', onKey);
    loader.addEventListener('click', skip);

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


  /* 3. Header and navigation
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
    const brand = document.querySelector('.brand');
    const heroTitle = document.querySelector('.hero__title');
    let ticking = false;

    function update() {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);

      // The name in the header only appears once the big name has scrolled up out of sight
      if (brand && heroTitle) {
        const nameGone = heroTitle.getBoundingClientRect().bottom <= header.offsetHeight;
        brand.classList.toggle('is-hidden', !nameGone);
      }

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


  // Numbers the sections in binary, following the order of the navigation links:
  // Home is 0000 0000, About is 0000 0001, Work is 0000 0010, and so on. Add or remove
  // a section and the numbers follow. They appear above each section title and in the
  // phone menu. (index.html also holds the same text, as a fallback without JavaScript.)
  function toBits(n) {
    const bits = n.toString(2).padStart(8, '0');
    return bits.slice(0, 4) + ' ' + bits.slice(4);
  }

  function initSectionNumbers() {
    document.querySelectorAll('.nav__link').forEach((link, i) => {
      const bits = toBits(i);

      const item = link.closest('.nav__item');
      if (item) item.setAttribute('data-bits', bits);

      const section = document.querySelector(link.getAttribute('href'));
      const mark = section && section.querySelector('.section__mark');
      if (mark) mark.textContent = bits;
    });
  }


  /* 4. Copy email, footer year
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
      area.style.fontSize = '16px';              // stops iPhone Safari zooming in
      area.style.webkitUserSelect = 'text';      // text can't be selected by default on this site,
      area.style.userSelect = 'text';            // so this temporary field opts back in
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, text.length);    // iPhone Safari needs this as well
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


  /* 5. Hero figure: the Lorenz attractor, interactive
     ====================================================================== */
  // A textbook-style figure. Two paths of the Lorenz system (a chaotic system that
  // came out of weather modelling) start one millionth apart. They travel together
  // for a while and then part ways: sensitive dependence on initial conditions.
  // Clicking or tapping the figure chooses where the two paths start. Each run plays
  // for a few seconds and then stops, so nothing keeps running in the background, and
  // a run is paused while the figure is off-screen. If there is not enough room for the
  // figure it is left out, and the caption shrinks before the picture does.
  const LORENZ = { sigma: 10, rho: 28, beta: 8 / 3 };
  const FIG = {
    step: 0.004,       // one integration step, in the system's own time units
    duration: 26,      // length of one run, in time units
    rate: 6.5,         // how fast a run plays, in time units per second (26 / 6.5 is 4 s)
    warmSteps: 3600,   // the first run starts here along the attractor: the paths split about halfway through
    offset: 1e-6,      // how far apart the two paths start
    minWidth: 220,       // the smallest picture, in pixels, that is still worth showing
    minHeight: 170,
    minHeightShort: 140  // with only a one-line caption a slightly smaller picture is accepted
  };
  const FIG_VIEW = { width: 38.5, height: 44, midZ: 25 };   // the part of the x-z plane the picture shows (the attractor is 37 by 42.5)
  const WIDE_LAYOUT = '(min-width: 48rem), (min-width: 32rem) and (max-height: 32rem)';   // keep in step with web.css

  // The words around the picture. Edit freely. <var> marks a mathematical variable (shown in italics).
  const FIG_TEXT = {
    label: 'Figure 1.1',
    title: 'Sensitive dependence on initial conditions.',
    body: 'Two paths of the Lorenz system start 10\u207b\u2076 apart. ' +
          'They stay together for a while, then part ways.',
    short: 'Two Lorenz paths, 10\u207b\u2076 apart.',
    equations: [
      '<var>\u1e8b</var> = <var>\u03c3</var>(<var>y</var> \u2212 <var>x</var>)',
      '<var>\u1e8f</var> = <var>x</var>(<var>\u03c1</var> \u2212 <var>z</var>) \u2212 <var>y</var>',
      '<var>\u017c</var> = <var>xy</var> \u2212 <var>\u03b2z</var>'
    ],
    constants: '<var>\u03c3</var> = 10, <var>\u03c1</var> = 28, <var>\u03b2</var> = 8/3',
    equationsSpoken: 'The Lorenz equations: x-dot equals sigma times y minus x. y-dot equals x times rho minus z, minus y. ' +
                     'z-dot equals x y minus beta z. Sigma is 10, rho is 28 and beta is 8 over 3.'
  };

  // One step of the fourth-order Runge-Kutta method, done in place on s = [x, y, z]
  function lorenzStep(s, dt) {
    const sg = LORENZ.sigma, rh = LORENZ.rho, be = LORENZ.beta;
    const x = s[0], y = s[1], z = s[2];
    const k1x = sg * (y - x), k1y = x * (rh - z) - y, k1z = x * y - be * z;
    const ax = x + k1x * dt / 2, ay = y + k1y * dt / 2, az = z + k1z * dt / 2;
    const k2x = sg * (ay - ax), k2y = ax * (rh - az) - ay, k2z = ax * ay - be * az;
    const bx = x + k2x * dt / 2, by = y + k2y * dt / 2, bz = z + k2z * dt / 2;
    const k3x = sg * (by - bx), k3y = bx * (rh - bz) - by, k3z = bx * by - be * bz;
    const cx = x + k3x * dt, cy = y + k3y * dt, cz = z + k3z * dt;
    const k4x = sg * (cy - cx), k4y = cx * (rh - cz) - cy, k4z = cx * cy - be * cz;
    s[0] = x + (k1x + 2 * k2x + 2 * k3x + k4x) * dt / 6;
    s[1] = y + (k1y + 2 * k2y + 2 * k3y + k4y) * dt / 6;
    s[2] = z + (k1z + 2 * k2z + 2 * k3z + k4z) * dt / 6;
  }

  // 3.2e-4 shown as 3.2×10⁻⁴
  function scientific(v) {
    if (!(v > 0)) return '0';
    const sup = { '-': '\u207b', 0: '\u2070', 1: '\u00b9', 2: '\u00b2', 3: '\u00b3', 4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077', 8: '\u2078', 9: '\u2079' };
    let e = Math.floor(Math.log10(v));
    let m = v / Math.pow(10, e);
    if (m.toFixed(1) === '10.0') { m = 1; e += 1; }
    if (e === 0 || e === 1) return (m * Math.pow(10, e)).toFixed(1);   // 3.2 rather than 3.2×10⁰
    return m.toFixed(1) + '\u00d710' + String(e).split('').map((c) => sup[c]).join('');
  }

  function toRgb(color, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec((color || '').trim());
    if (!m) return fallback;
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function initHeroFigure() {
    const title = document.querySelector('.hero__title');
    if (!title) return;

    const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const verb = touchOnly ? 'Tap' : 'Click';

    // ---- Build the figure: the picture, then the caption under it
    const figure = document.createElement('figure');
    figure.className = 'hero__figure is-removed';
    figure.setAttribute('data-arrange', 'below');
    figure.setAttribute('data-level', 'full');
    figure.innerHTML =
      '<div class="hero__plot">' +
        '<canvas class="hero__trail" role="button" tabindex="0"></canvas>' +
        '<canvas class="hero__heads" aria-hidden="true"></canvas>' +
      '</div>' +
      '<figcaption class="hero__caption">' +
        '<p class="fig__head"><span class="fig__label">' + FIG_TEXT.label + '</span><span class="fig__live" aria-hidden="true"></span></p>' +
        '<p class="fig__short">' + FIG_TEXT.short + ' ' + verb + ' to restart.</p>' +
        '<div class="fig__body">' +
          '<p class="fig__text"><strong>' + FIG_TEXT.title + '</strong> ' + FIG_TEXT.body + ' ' + verb + ' anywhere in the figure to choose where they start.</p>' +
          '<p class="fig__eq" role="img" aria-label="' + FIG_TEXT.equationsSpoken + '">' +
            FIG_TEXT.equations.map((e) => '<span>' + e + '</span>').join(' ') + ' <span class="fig__const">' + FIG_TEXT.constants + '</span>' +
          '</p>' +
        '</div>' +
      '</figcaption>';
    title.insertAdjacentElement('afterend', figure);

    const plot = figure.querySelector('.hero__plot');
    const trail = figure.querySelector('.hero__trail');
    const heads = figure.querySelector('.hero__heads');
    const live = figure.querySelector('.fig__live');
    const ctxT = trail.getContext ? trail.getContext('2d') : null;
    const ctxH = heads.getContext ? heads.getContext('2d') : null;
    if (!ctxT || !ctxH) { figure.remove(); return; }

    trail.setAttribute('aria-label', 'Lorenz attractor. Activate to start two new paths from a different point.');

    const styles = getComputedStyle(root);
    const bright = toRgb(styles.getPropertyValue('--text'), [242, 242, 242]);
    const dim = toRgb(styles.getPropertyValue('--text-3'), [118, 118, 118]);
    const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

    // ---- The simulation: two paths, stored as (x, z) pairs for drawing
    const steps = Math.round(FIG.duration / FIG.step);
    const PA = new Float32Array((steps + 1) * 2);
    const PB = new Float32Array((steps + 1) * 2);
    const A = [0, 0, 0];
    const B = [0, 0, 0];
    let done = 0;           // steps completed so far
    let started = false;    // has any run begun?
    let running = false;    // is a run still playing?
    let shown = false;      // is there room for the figure right now?
    let onScreen = true;    // is the figure scrolled into view?
    let start = { x: 0, z: 0 };
    let rafId = 0;
    let last = 0;
    let fitQueued = 0;
    let w = 0, h = 0, k = 1, ox = 0, oy = 0, dpr = 1;

    // The first run starts on the attractor, at a point where the two paths part ways about halfway through
    const settled = [0.1, 0, 0];
    for (let i = 0; i < FIG.warmSteps; i++) lorenzStep(settled, FIG.step);

    const X = (x) => ox + x * k;
    const Y = (z) => oy - z * k;

    function setSize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = plot.clientWidth;
      h = plot.clientHeight;
      [trail, heads].forEach((c) => {
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
      });
      // One scale factor for both directions, so the picture is never stretched
      const exact = trail.width / w;
      [ctxT, ctxH].forEach((c) => c.setTransform(exact, 0, 0, exact, 0, 0));
      ctxT.lineWidth = 1;
      ctxT.lineJoin = 'round';
      ctxT.lineCap = 'round';
      ctxH.lineWidth = 1;

      const margin = Math.min(w, h) * 0.05;
      k = Math.min((w - margin * 2) / FIG_VIEW.width, (h - margin * 2) / FIG_VIEW.height);
      ox = w / 2;
      oy = h / 2 + FIG_VIEW.midZ * k;
    }

    // One stretch of one path. Older parts are fainter, newer parts brighter.
    function strokeRange(points, i0, i1, rgb, from, to) {
      const f = ((i0 + i1) / 2) / steps;
      ctxT.strokeStyle = rgba(rgb, (from + (to - from) * Math.pow(f, 1.4)).toFixed(3));
      ctxT.beginPath();
      ctxT.moveTo(X(points[i0 * 2]), Y(points[i0 * 2 + 1]));
      for (let i = i0 + 1; i <= i1; i++) ctxT.lineTo(X(points[i * 2]), Y(points[i * 2 + 1]));
      ctxT.stroke();
    }

    function drawTrail(i0, i1) {
      if (i1 <= i0) return;
      strokeRange(PB, i0, i1, dim, 0.06, 0.6);       // the path that started a millionth away
      strokeRange(PA, i0, i1, bright, 0.08, 0.9);    // the main path, on top
    }

    function redrawAll() {
      ctxT.clearRect(0, 0, w, h);
      for (let i = 0; i < done; i += 100) drawTrail(i, Math.min(done, i + 100));
    }

    // The ring marks where the paths started; the dots show where they are now
    function drawHeads() {
      ctxH.clearRect(0, 0, w, h);
      if (!started) return;
      ctxH.strokeStyle = rgba(bright, 0.7);
      ctxH.beginPath();
      ctxH.arc(X(start.x), Y(start.z), 5, 0, Math.PI * 2);
      ctxH.stroke();
      [[PB, dim], [PA, bright]].forEach(([points, rgb]) => {
        ctxH.fillStyle = rgba(rgb, 1);
        ctxH.beginPath();
        ctxH.arc(X(points[done * 2]), Y(points[done * 2 + 1]), 2.8, 0, Math.PI * 2);
        ctxH.fill();
      });
    }

    // Time and the distance between the two paths
    function updateLive() {
      const gap = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      live.textContent = 't = ' + (done * FIG.step).toFixed(1) + '   \u03b4 = ' + scientific(gap);
    }

    function advance(n) {
      const from = done;
      const count = Math.min(n, steps - done);
      for (let i = 0; i < count; i++) {
        lorenzStep(A, FIG.step);
        lorenzStep(B, FIG.step);
        done++;
        PA[done * 2] = A[0]; PA[done * 2 + 1] = A[2];
        PB[done * 2] = B[0]; PB[done * 2 + 1] = B[2];
      }
      return from;
    }

    function frame(now) {
      rafId = 0;
      if (!running || !shown || !onScreen) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const from = advance(Math.max(1, Math.round(FIG.rate * dt / FIG.step)));
      drawTrail(from, done);
      drawHeads();
      updateLive();
      if (done >= steps) { running = false; return; }
      rafId = requestAnimationFrame(frame);
    }

    function schedule() {
      if (running && shown && onScreen && !rafId) {
        last = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    }

    // Begin a run from the point (x0, z0)
    function begin(x0, z0, y0) {
      if (Math.abs(x0) < 0.25) x0 = x0 < 0 ? -0.25 : 0.25;    // not exactly on the z axis, where nothing happens
      if (y0 === undefined) y0 = x0 + (Math.random() - 0.5) * 0.01;
      A[0] = x0; A[1] = y0; A[2] = z0;
      B[0] = x0 + FIG.offset; B[1] = y0; B[2] = z0;
      PA[0] = A[0]; PA[1] = A[2];
      PB[0] = B[0]; PB[1] = B[2];
      done = 0;
      started = true;
      start = { x: x0, z: z0 };
      ctxT.clearRect(0, 0, w, h);

      if (reducedMotion) {          // no animation: show the finished picture at once
        advance(steps);
        redrawAll();
        drawHeads();
        updateLive();
        running = false;
        return;
      }
      running = true;
      drawHeads();
      updateLive();
      schedule();
    }

    function beginAtPoint(clientX, clientY) {
      const r = trail.getBoundingClientRect();
      const x0 = Math.max(-30, Math.min(30, (clientX - r.left - ox) / k));
      const z0 = Math.max(0.5, Math.min(60, (oy - (clientY - r.top)) / k));
      begin(x0, z0);
    }

    function beginAtRandom() {
      begin((Math.random() * 2 - 1) * 17, 8 + Math.random() * 32);
    }

    function beginDefault() {
      if (started || !shown) return;
      begin(settled[0], settled[2], settled[1]);
    }

    // ---- Is there room? Where does the figure go? How much caption fits?
    function fit() {
      fitQueued = 0;

      // 1. On wide screens it goes beside the name. If the name is long enough to reach it,
      //    it goes under the name instead, so the two never touch.
      figure.classList.remove('is-below');
      if (window.matchMedia(WIDE_LAYOUT).matches) {
        const left = figure.getBoundingClientRect().left;
        const range = document.createRange();
        range.selectNodeContents(title);
        let right = 0;
        Array.from(range.getClientRects()).forEach((r) => { right = Math.max(right, r.right); });
        if (right + 24 > left) figure.classList.add('is-below');
      }

      // 2. Keep the picture a good size. In a wide, short space the caption goes beside the
      //    picture (like a margin note); otherwise it goes underneath. Either way the caption
      //    gives up space first (equations, then the explanation) before the picture shrinks.
      figure.classList.remove('is-removed');     // measure as it would really appear (with its bottom margin)
      const box = figure.getBoundingClientRect();
      const wideBox = box.width >= box.height * 1.3 && box.width >= 520;
      const options = wideBox
        ? [['side', 'full'], ['side', 'text'], ['below', 'full'], ['below', 'text'], ['below', 'short']]
        : [['below', 'full'], ['below', 'text'], ['below', 'short']];
      let fits = false;
      options.some(([arrange, level]) => {
        figure.setAttribute('data-arrange', arrange);
        figure.setAttribute('data-level', level);
        const needed = level === 'short' ? FIG.minHeightShort : FIG.minHeight;
        fits = plot.clientWidth >= FIG.minWidth && plot.clientHeight >= needed;
        return fits;
      });

      // 3. Not enough room at all: leave the figure out
      figure.classList.toggle('is-removed', !fits);
      shown = fits;
      if (!fits) return;

      setSize();
      if (started) { redrawAll(); drawHeads(); }
      else whenIntroDone(beginDefault);
      schedule();
    }

    function queueFit() {
      if (!fitQueued) fitQueued = requestAnimationFrame(fit);
    }

    trail.addEventListener('click', (e) => { if (shown) beginAtPoint(e.clientX, e.clientY); });
    trail.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (shown) beginAtRandom();
    });

    window.addEventListener('resize', queueFit);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(queueFit);
      observer.observe(figure);
      observer.observe(title);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);

    // Pause a run while the figure is scrolled out of view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (!onScreen && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        schedule();
      }).observe(figure);
    }

    fit();
  }


  /* Start
     ====================================================================== */
  // A fresh visit always starts on the first screen (unless the link points at a section)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!window.location.hash) window.scrollTo(0, 0);

  // Each step is isolated: if one fails, the others (and the loader) still run.
  [initNavigation, initSectionNumbers, initCopyEmail, setFooterYear, initHeroFigure].forEach((step) => {
    try { step(); } catch (err) { console.error(err); }
  });

  try {
    initLoader();
  } catch (err) {
    console.error(err);
    finishLoading(document.getElementById('loader'));
  }
})();
