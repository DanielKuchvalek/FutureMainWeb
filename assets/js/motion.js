// Pohyb při rolování: odkrývání bloků, vyvolávání obrázků, plovoucí pixely po stranách
// a výpověď, ve které se slova postupně rozsvěcují.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const PIXEL_COLORS = ['#2457ff', '#2457ff', '#3a68ff', '#6b8fff', '#a7bcff', '#7a3cff', '#b18cff', '#2457ff'];

export function initMotion({ reduced }) {
  initSkeletons();
  initReveals(reduced);
  const words = initWords(reduced);
  const pixels = initPixels();
  initScroll(reduced, words, pixels);
}

// Obrázek ve „skeletonu“: plocha pulzuje, dokud se obrázek nenačte; pak se vyvolá.
function initSkeletons() {
  for (const box of document.querySelectorAll('.skeleton')) {
    const img = box.querySelector(':scope > img');
    if (!img) continue;
    const done = () => box.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  }
}

function initReveals(reduced) {
  const items = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
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
  items.forEach((el) => io.observe(el));
}

// Rozdělí výpověď na slova; nezlomitelné úseky (e-shop, „a aplikace“) zůstanou celé.
function initWords(reduced) {
  const p = document.querySelector('[data-words]');
  if (!p || reduced) return null;
  const words = [];
  for (const node of [...p.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/( +)/)) {
        if (!part) continue;
        if (/^ +$/.test(part)) frag.append(part);
        else {
          const span = document.createElement('span');
          span.className = 'word';
          span.textContent = part;
          frag.append(span);
          words.push(span);
        }
      }
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      node.classList.add('word');
      words.push(node);
    }
  }
  words.forEach((w, i) => w.style.setProperty('--i', i));
  p.style.setProperty('--n', words.length);
  p.style.setProperty('--p', 0);
  return p;
}

// Barevné čtverečky na okrajích sekcí (atribut data-pixels = počet). Pozice jsou pseudonáhodné,
// ale pokaždé stejné, ať stránka nevypadá při každém načtení jinak.
function initPixels() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const out = [];
  const narrow = innerWidth < 760;
  for (const sec of document.querySelectorAll('[data-pixels]')) {
    const layer = document.createElement('div');
    layer.className = 'pixels';
    layer.setAttribute('aria-hidden', 'true');
    const n = Math.round(Number(sec.dataset.pixels || 12) * (narrow ? 0.55 : 1));
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      const left = i % 2 === 0;
      const edge = narrow ? 3.5 : 8;
      const x = left ? rnd() * edge : 100 - rnd() * edge;
      const size = Math.round((narrow ? 4 : 6) + Math.pow(rnd(), 2) * (narrow ? 10 : 26));
      el.style.cssText = `left:${x.toFixed(2)}%;top:${(rnd() * 96).toFixed(2)}%;width:${size}px;height:${size}px;background:${PIXEL_COLORS[Math.floor(rnd() * PIXEL_COLORS.length)]};opacity:${(0.35 + rnd() * 0.6).toFixed(2)};margin-left:${left ? 0 : -size}px`;
      layer.append(el);
      out.push({ el, sec, speed: (rnd() - 0.5) * 0.5 });
    }
    sec.prepend(layer);
  }
  return out;
}

function initScroll(reduced, words, pixels) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = innerHeight;

    if (!reduced) {
      for (const px of pixels) {
        const r = px.sec.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const off = (r.top + r.height / 2 - vh / 2) * px.speed;
        px.el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
      }
    }

    if (words) {
      const r = words.getBoundingClientRect();
      words.style.setProperty('--p', clamp01((vh * 0.9 - r.top) / (vh * 0.6)).toFixed(3));
    }
  };

  const schedule = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
}
