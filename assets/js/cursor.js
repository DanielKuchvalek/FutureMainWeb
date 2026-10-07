// Kurzor: tečka jde přesně za myší, kroužek ji měkce dohání. Nad odkazem se zvětší,
// nad projektem nebo videem ukáže popisek (atribut data-cursor). Jen pro myš.

export function initCursor({ reduced }) {
  if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const root = document.documentElement;
  const el = document.querySelector('.cursor');
  if (!el) return;
  const dot = el.querySelector('.cursor__dot');
  const ring = el.querySelector('.cursor__ring');
  const label = el.querySelector('[data-cursor-label]');

  let x = 0;
  let y = 0;
  let rx = 0;
  let ry = 0;
  let raf = 0;
  let seen = false;

  root.classList.add('has-cursor');
  el.classList.add('is-hidden');

  const follow = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(follow) : 0;
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (!seen) {
        seen = true;
        rx = x;
        ry = y;
      }
      el.classList.remove('is-hidden');
      if (!raf) raf = requestAnimationFrame(follow);
    },
    { passive: true },
  );

  document.documentElement.addEventListener('mouseleave', () => el.classList.add('is-hidden'));
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));

  document.addEventListener('pointerover', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const named = target.closest('[data-cursor]');
    const active = target.closest('a, button, label, summary');
    el.classList.toggle('is-text', !!target.closest('input, textarea'));
    el.classList.toggle('has-label', !!named);
    el.classList.toggle('is-hover', !named && !!active);
    if (named) label.textContent = named.dataset.cursor;
  });
}
