import { initParticles } from './particles.js?v=7';
import { initCursor } from './cursor.js?v=7';
import { initMotion } from './motion.js?v=7';
import { initUI } from './ui.js?v=7';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

initUI();
initMotion({ reduced });
initCursor({ reduced });
// Hlavička, slogan a šipka se ukážou, když se pixely skládají do nápisu.
initParticles({ reduced, onReveal: () => root.classList.add('is-loaded') });
