// Render showreelu pro pozadí hero.
//   node render.js stills d|m          → náhledy záběrů (stills-*.jpg)
//   node render.js frames d|m [fps]    → všechny snímky do frames-<o>/
const puppeteer = require('/Applications/XAMPP/xamppfiles/htdocs/hazenaTurnaje2/brag-output/work/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const [mode = 'stills', o = 'd', fpsArg] = process.argv.slice(2);
const FPS = Number(fpsArg) || 30;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  const W = o === 'm' ? 1080 : 1920;
  const H = o === 'm' ? 1920 : 1080;
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.join(DIR, 'stage.html') + '?o=' + o, { waitUntil: 'load' });
  const info = await page.evaluate(() => window.ready);
  console.log('stage', JSON.stringify(info));

  const shoot = async (t, file, q = 90) => {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: file, type: 'jpeg', quality: q, optimizeForSpeed: true });
  };

  if (mode === 'stills') {
    const times = process.argv[5] ? process.argv[5].split(',').map(Number) : null;
    const list = times || [0, ...[0, 1, 2, 3, 4, 5].map((i) => i * info.D + info.D * 0.5), info.D - info.F / 2];
    for (const t of list) {
      const f = path.join(DIR, `still-${o}-${String(t).replace('.', '_')}.jpg`);
      await shoot(t, f, 85);
      console.log('still', t, f);
    }
  } else {
    const out = path.join(DIR, 'frames-' + o);
    fs.mkdirSync(out, { recursive: true });
    const n = Math.round(info.T * FPS);
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await shoot(i / FPS, path.join(out, `f${String(i).padStart(4, '0')}.jpg`), 94);
      if (i % 60 === 0) console.log(`frame ${i}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    console.log('done', n, 'frames', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
