/* ==========================================================================
   Portfolio – main.js

   1. Settings
   2. Loading screen (a grid of 0s and 1s)
   3. Header, navigation and section numbers
   4. Copy email, footer year
   5. Hero drawing (the Lorenz attractor)
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


  /* 2. Loading screen
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


  /* 5. Hero drawing: the Lorenz attractor
     ====================================================================== */
  // The path of a chaotic system, computed here with a standard numerical method
  // (fourth-order Runge-Kutta) and drawn once as a thin line. Two paths start
  // almost exactly together (one millionth apart) and slowly drift apart: the
  // "butterfly effect". The older part of each path is fainter than the newer part.
  // It is a still picture: nothing moves, and it only redraws if the screen is resized.
  const LORENZ = { sigma: 10, rho: 28, beta: 8 / 3, step: 0.004, duration: 26, offset: 1e-6 };

  // Integrates dx/dt = sigma(y - x), dy/dt = x(rho - z) - y, dz/dt = xy - beta z
  function lorenzRun(x, y, z, steps) {
    const { sigma, rho, beta, step: dt } = LORENZ;
    const out = new Float64Array(steps * 3);
    for (let i = 0; i < steps; i++) {
      const k1x = sigma * (y - x), k1y = x * (rho - z) - y, k1z = x * y - beta * z;
      const ax = x + k1x * dt / 2, ay = y + k1y * dt / 2, az = z + k1z * dt / 2;
      const k2x = sigma * (ay - ax), k2y = ax * (rho - az) - ay, k2z = ax * ay - beta * az;
      const bx = x + k2x * dt / 2, by = y + k2y * dt / 2, bz = z + k2z * dt / 2;
      const k3x = sigma * (by - bx), k3y = bx * (rho - bz) - by, k3z = bx * by - beta * bz;
      const cx = x + k3x * dt, cy = y + k3y * dt, cz = z + k3z * dt;
      const k4x = sigma * (cy - cx), k4y = cx * (rho - cz) - cy, k4z = cx * cy - beta * cz;
      x += (k1x + 2 * k2x + 2 * k3x + k4x) * dt / 6;
      y += (k1y + 2 * k2y + 2 * k3y + k4y) * dt / 6;
      z += (k1z + 2 * k2z + 2 * k3z + k4z) * dt / 6;
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = z;
    }
    return out;
  }

  function buildLorenz() {
    const steps = Math.round(LORENZ.duration / LORENZ.step);

    // Let the path settle onto the attractor first, then start both paths from there
    const warm = lorenzRun(0.1, 0, 0, 1000);
    const n = warm.length - 3;
    const start = [warm[n], warm[n + 1], warm[n + 2]];
    const a = lorenzRun(start[0], start[1], start[2], steps);
    const b = lorenzRun(start[0] + LORENZ.offset, start[1], start[2], steps);

    // Flatten to the x-z plane (z pointing up) and measure the picture
    const flat = (p) => {
      const q = new Float32Array(steps * 2);
      for (let i = 0; i < steps; i++) { q[i * 2] = p[i * 3]; q[i * 2 + 1] = -p[i * 3 + 2]; }
      return q;
    };
    const pa = flat(a);
    const pb = flat(b);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    [pa, pb].forEach((q) => {
      for (let i = 0; i < steps; i++) {
        minX = Math.min(minX, q[i * 2]); maxX = Math.max(maxX, q[i * 2]);
        minY = Math.min(minY, q[i * 2 + 1]); maxY = Math.max(maxY, q[i * 2 + 1]);
      }
    });

    return { steps, pa, pb, minX, maxX, minY, maxY };
  }

  function toRgb(color, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec((color || '').trim());
    if (!m) return fallback;
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function initHeroArt() {
    const title = document.querySelector('.hero__title');
    if (!title) return;

    const wrap = document.createElement('div');
    wrap.className = 'hero__art';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      'Line drawing of the Lorenz attractor, the butterfly-shaped path of a chaotic system, ' +
      'drawn from two almost identical starting points that slowly drift apart.');
    wrap.appendChild(canvas);
    title.insertAdjacentElement('afterend', wrap);

    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) { wrap.remove(); return; }

    const data = buildLorenz();
    const styles = getComputedStyle(root);
    const bright = toRgb(styles.getPropertyValue('--text'), [242, 242, 242]);
    const dim = toRgb(styles.getPropertyValue('--text-3'), [118, 118, 118]);

    let drawnW = 0, drawnH = 0, drawnScale = 0, queued = 0;

    // One path as a series of short strokes whose brightness grows from old to new
    function strokePath(points, rgb, fromAlpha, toAlpha, x, y) {
      const chunks = 60;
      const per = Math.floor(data.steps / chunks);
      for (let c = 0; c < chunks; c++) {
        const t = c / (chunks - 1);
        const alpha = fromAlpha + (toAlpha - fromAlpha) * Math.pow(t, 1.4);
        ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(3) + ')';
        const first = c * per;
        const last = Math.min(data.steps, first + per + 1);
        ctx.beginPath();
        ctx.moveTo(x(points[first * 2]), y(points[first * 2 + 1]));
        for (let i = first + 1; i < last; i++) ctx.lineTo(x(points[i * 2]), y(points[i * 2 + 1]));
        ctx.stroke();
      }
    }

    function render() {
      queued = 0;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      if (w === drawnW && h === drawnH && scale === drawnScale) return;
      drawnW = w; drawnH = h; drawnScale = scale;

      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      if (w < 120 || h < 110) return;   // not enough room: leave the space empty

      // One scale factor for both directions, so the drawing is never stretched
      const exact = canvas.width / w;
      ctx.setTransform(exact, 0, 0, exact, 0, 0);

      const margin = Math.min(w, h) * 0.07;
      const spanX = data.maxX - data.minX;
      const spanY = data.maxY - data.minY;
      const k = Math.min((w - margin * 2) / spanX, (h - margin * 2) / spanY);
      const offX = (w - spanX * k) / 2 - data.minX * k;
      const offY = (h - spanY * k) / 2 - data.minY * k;
      const x = (v) => v * k + offX;
      const y = (v) => v * k + offY;

      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      strokePath(data.pb, dim, 0.06, 0.6, x, y);       // the path that started a millionth away
      strokePath(data.pa, bright, 0.08, 0.9, x, y);    // the main path, on top

      // A small dot where each path ends up
      const end = data.steps - 1;
      [[data.pb, dim], [data.pa, bright]].forEach(([points, rgb]) => {
        ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        ctx.beginPath();
        ctx.arc(x(points[end * 2]), y(points[end * 2 + 1]), 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function schedule() {
      if (!queued) queued = requestAnimationFrame(render);
    }

    render();
    window.addEventListener('resize', schedule);
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(wrap);
  }


  /* Start
     ====================================================================== */
  // A fresh visit always starts on the first screen (unless the link points at a section)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!window.location.hash) window.scrollTo(0, 0);

  // Each step is isolated: if one fails, the others (and the loader) still run.
  [initNavigation, initSectionNumbers, initCopyEmail, setFooterYear, initHeroArt].forEach((step) => {
    try { step(); } catch (err) { console.error(err); }
  });

  try {
    initLoader();
  } catch (err) {
    console.error(err);
    finishLoading(document.getElementById('loader'));
  }
})();
