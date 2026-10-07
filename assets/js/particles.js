// Úvod: během načítání dýchá měkká koule, pak se z ní rozletí pixely a poskládají nápis UTOPIA.
// Písmo, velikost i polohu nápisu bere z HTML ([data-logo]), takže sedí na každé obrazovce.
// Myš pixely odhání, při rolování se nápis rozpadne.

// Nápis: hlavně modrá, trochu fialové a jen výjimečně barva některého z projektů.
const LOGO_COLORS = [
  ['#2457ff', 46],
  ['#3a68ff', 20],
  ['#5b82ff', 14],
  ['#8eaaff', 6],
  ['#7a3cff', 10],
  ['#ff7a00', 1],
  ['#be1e3e', 1],
  ['#0f8a45', 1],
  ['#6e2f9b', 1],
];

// Poletující čtverečky kolem: světlejší a pestřejší.
const DUST_COLORS = [
  ['#2457ff', 30],
  ['#6b8fff', 20],
  ['#a7bcff', 18],
  ['#7a3cff', 14],
  ['#b18cff', 10],
  ['#ff7a00', 3],
  ['#0f8a45', 3],
  ['#be1e3e', 2],
];

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function initParticles({ reduced, onReveal }) {
  const root = document.documentElement;
  const hero = document.querySelector('[data-hero]');
  const canvas = hero?.querySelector('[data-particles]');
  const logo = hero?.querySelector('[data-logo]');
  const orb = hero?.querySelector('[data-orb]');
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || !logo) {
    onReveal();
    return;
  }

  const rand = mulberry32(20261006);
  const picker = (palette) => {
    const total = palette.reduce((s, [, w]) => s + w, 0);
    return () => {
      let r = rand() * total;
      for (const [c, w] of palette) if ((r -= w) <= 0) return c;
      return palette[0][0];
    };
  };
  const pickLogo = picker(LOGO_COLORS);
  const pickDust = picker(DUST_COLORS);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let parts = [];
  let dust = [];
  let origin = { x: 0, y: 0 };
  let formEnd = 0;
  let start = 0;
  let assembled = false;
  let revealed = false;
  let raf = 0;
  let visible = true;
  let scrollK = 0;
  const mouse = { x: 0, y: 0, active: false };
  const R = 90;

  function measure() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  // Body mřížky uvnitř písmen nápisu.
  function sample() {
    const hr = hero.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(logo);
    const tr = range.getBoundingClientRect();
    const cs = getComputedStyle(logo);
    const text = cs.textTransform === 'uppercase' ? logo.textContent.toUpperCase() : logo.textContent;

    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('fontStretch' in o) o.fontStretch = 'expanded';
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    // šířku srovnáme s HTML (kdyby prohlížeč neuměl rozšířené písmo v canvasu)
    const sx = tr.width / Math.max(1, o.measureText(text).width);
    const cx = tr.left - hr.left + tr.width / 2;
    const cy = tr.top - hr.top + tr.height / 2;
    o.setTransform(sx, 0, 0, 1, cx, cy);
    o.fillText(text, 0, 0);

    const step = W < 600 ? 3 : W < 1100 ? 5 : 6;
    const x0 = Math.max(0, Math.floor(tr.left - hr.left) - 6);
    const x1 = Math.min(W, Math.ceil(tr.right - hr.left) + 6);
    const y0 = Math.max(0, Math.floor(tr.top - hr.top) - 12);
    const y1 = Math.min(H, Math.ceil(tr.bottom - hr.top) + 12);
    const data = o.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
      }
    }
    return { pts, step, cy };
  }

  function build(intro) {
    const hr = hero.getBoundingClientRect();
    const or = orb.getBoundingClientRect();
    origin = { x: or.left - hr.left + or.width / 2, y: or.top - hr.top + or.height / 2 };
    const { pts, step, cy } = sample();

    parts = pts.map(([x, y]) => {
      const a = rand() * Math.PI * 2;
      const gauss = (rand() + rand() + rand() - 1.5) / 1.5;
      return {
        tx: x,
        ty: y,
        x: origin.x,
        y: origin.y,
        vx: 0,
        vy: 0,
        bx: rand() * W,
        by: cy + gauss * H * 0.14,
        s: step * (0.78 + rand() * 0.3),
        c: pickLogo(),
        d1: rand() * 240,
        d2: 620 + (x / W) * 560 + rand() * 300,
        dx: Math.cos(a),
        dy: Math.sin(a),
        spread: 140 + rand() * 460,
        ph: rand() * Math.PI * 2,
      };
    });
    // stejné barvy za sebou = méně přepínání štětce
    parts.sort((a, b) => (a.c < b.c ? -1 : 1));
    formEnd = Math.max(...parts.map((p) => p.d2)) + 1000;

    // poletující čtverečky se vyhnou sloganu a podtitulku, ať nic neruší čtení
    const pad = 28;
    const keepOut = [...hero.querySelectorAll('.hero__tagline, .hero__sub')].map((el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - hr.left - pad, r: r.right - hr.left + pad, t: r.top - hr.top - pad, b: r.bottom - hr.top + pad };
    });
    const blocked = (x, y) => keepOut.some((k) => x > k.l && x < k.r && y > k.t && y < k.b);
    const n = W < 600 ? 46 : 120;
    dust = Array.from({ length: n }, () => {
      let x;
      let y;
      let tries = 0;
      do {
        const gauss = (rand() + rand() + rand() - 1.5) / 1.5;
        x = rand() * W;
        y = cy + gauss * H * 0.3;
      } while (blocked(x, y) && ++tries < 12);
      return {
        x,
        y,
        s: 2 + Math.pow(rand(), 3) * (W < 600 ? 10 : 18),
        c: pickDust(),
        a: 0.18 + rand() * 0.55,
        sp: 0.3 + rand() * 0.7,
        ph: rand() * Math.PI * 2,
        amp: 4 + rand() * 16,
      };
    }).sort((a, b) => (a.c < b.c ? -1 : 1));

    if (!intro) {
      for (const p of parts) {
        p.x = p.tx;
        p.y = p.ty;
      }
      assembled = true;
    }
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const k = scrollK;
    const fade = 1 - k;
    const dustIn = assembled ? 1 : clamp01((t - 300) / 1200);

    let color = '';
    for (const d of dust) {
      const x = d.x + Math.cos(t * 0.00031 * d.sp + d.ph) * d.amp * 0.7;
      const y = d.y + Math.sin(t * 0.00042 * d.sp + d.ph) * d.amp - k * 160 * d.sp;
      ctx.globalAlpha = d.a * dustIn * fade;
      if (d.c !== color) ctx.fillStyle = color = d.c;
      ctx.fillRect(x, y, d.s, d.s);
    }

    ctx.globalAlpha = fade;
    color = '';
    for (const p of parts) {
      const ox = p.dx * p.spread * k;
      const oy = p.dy * p.spread * k - k * 90;
      if (p.c !== color) ctx.fillStyle = color = p.c;
      ctx.fillRect(p.x + ox - p.s / 2, p.y + oy - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  function step(t) {
    if (!assembled) {
      for (const p of parts) {
        const a = easeOut(clamp01((t - p.d1) / 700));
        const b = easeInOut(clamp01((t - p.d2) / 1000));
        const bx = lerp(origin.x, p.bx, a);
        const by = lerp(origin.y, p.by, a);
        p.x = lerp(bx, p.tx, b);
        p.y = lerp(by, p.ty, b);
      }
      if (!revealed && t > formEnd * 0.62) {
        revealed = true;
        onReveal();
      }
      if (t >= formEnd) assembled = true;
      return;
    }
    // pružina zpět na místo + odpuzování od myši + jemné „dýchání“
    const R2 = R * R;
    for (const p of parts) {
      const wob = Math.sin(t * 0.0016 + p.ph) * 0.35;
      let fx = (p.tx + wob - p.x) * 0.075;
      let fy = (p.ty - wob - p.y) * 0.075;
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 3.4;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      p.vx = (p.vx + fx) * 0.8;
      p.vy = (p.vy + fy) * 0.8;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  function frame(now) {
    raf = 0;
    if (!start) start = now;
    const t = now - start;
    step(t);
    draw(t);
    if (visible && scrollK < 1) raf = requestAnimationFrame(frame);
  }

  const wake = () => {
    if (!raf && visible && scrollK < 1 && !reduced) raf = requestAnimationFrame(frame);
  };

  // počkat na písmo nápisu, ať se pixely poskládají do správných tvarů
  const t0 = performance.now();
  try {
    const cs = getComputedStyle(logo);
    await Promise.race([document.fonts.load(`${cs.fontWeight} 100px ${cs.fontFamily}`), sleep(2500)]);
    await Promise.race([document.fonts.ready, sleep(2500)]);
  } catch (e) {}
  const waited = performance.now() - t0;
  if (!reduced && waited < 650) await sleep(650 - waited);

  measure();
  build(!reduced);
  root.classList.add('particles-on');

  if (reduced) {
    draw(0);
    onReveal();
  } else {
    raf = requestAnimationFrame(frame);
  }

  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduced) return;
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  });
  hero.addEventListener('pointerleave', () => (mouse.active = false));

  addEventListener(
    'scroll',
    () => {
      const k = clamp01(window.scrollY / (H * 0.85));
      if (k === scrollK) return;
      scrollK = k;
      if (reduced) draw(0);
      else wake();
    },
    { passive: true },
  );

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  }).observe(hero);

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (hero.clientWidth === W && Math.abs(hero.clientHeight - H) < 120) return; // lišta prohlížeče na mobilu
      measure();
      build(false);
      revealed = true;
      draw(performance.now() - start);
      wake();
    }, 200);
  });
}
