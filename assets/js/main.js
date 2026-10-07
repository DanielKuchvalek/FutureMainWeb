import { initCursor } from './cursor.js?v=7';
import { initMotion } from './motion.js?v=7';
import { initUI } from './ui.js?v=7';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

initUI();
initMotion({ reduced });
initCursor({ reduced });
root.classList.add('is-loaded');
