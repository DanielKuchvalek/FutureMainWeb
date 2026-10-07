# Video na pozadí hero

> Momentálně se nepoužívá: hero má od 6. 10. 2026 fotografii. Zdroj zůstává pro případ, že by se video vracelo.

Video v hero (`assets/video/reel-d.*` na šířku, `reel-m.*` na výšku) se renderuje
z `stage.html`: šest záběrů projektů po 5 s, prolínačka 0,6 s, smyčka 30 s.
Stejné časy používá `assets/js/hero.js` (konstanty `SHOT`, `FADE`, `COUNT`).
Když změníte počet nebo délku záběrů, upravte je na obou místech
a v `index.html` i tlačítka kapitol.

## Přegenerování

```sh
cd _zdroje/reel
node render.js stills d          # náhledy záběrů na šířku (m = na výšku)
node render.js frames d 30       # všechny snímky do frames-d/
node render.js frames m 30

# na šířku 1600×900 (WebM) a 1440×810 (MP4), na výšku 720×1280
ffmpeg -framerate 30 -i frames-d/f%04d.jpg -vf "scale=1600:900:flags=lanczos,format=yuv420p" \
  -c:v libvpx-vp9 -crf 47 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 75 -keyint_min 75 -an ../../assets/video/reel-d.webm
ffmpeg -framerate 30 -i frames-d/f%04d.jpg -vf "scale=1440:810:flags=lanczos,gblur=sigma=0.5,format=yuv420p" \
  -c:v libx264 -preset slow -crf 31 -profile:v high -g 75 -keyint_min 75 -sc_threshold 0 -movflags +faststart -an ../../assets/video/reel-d.mp4
ffmpeg -framerate 30 -i frames-m/f%04d.jpg -vf "scale=720:1280:flags=lanczos,format=yuv420p" \
  -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 75 -keyint_min 75 -an ../../assets/video/reel-m.webm
ffmpeg -framerate 30 -i frames-m/f%04d.jpg -vf "scale=720:1280:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 31 -profile:v high -g 75 -keyint_min 75 -sc_threshold 0 -movflags +faststart -an ../../assets/video/reel-m.mp4

# statické obrázky (první snímek) pro rychlé načtení a omezený pohyb
ffmpeg -i frames-d/f0000.jpg -vf scale=1600:900 poster-d.png && cwebp -q 72 poster-d.png -o ../../assets/video/reel-d.webp
ffmpeg -i frames-m/f0000.jpg -vf scale=720:1280 poster-m.png && cwebp -q 72 poster-m.png -o ../../assets/video/reel-m.webp
```

Klíčové snímky po 75 snímcích (2,5 s) padají na začátek každé kapitoly, takže skok na projekt je okamžitý.
`render.js` používá puppeteer-core ze složky `hazenaTurnaje2/brag-output/work/node_modules` a nainstalovaný Google Chrome.
Složky `frames-*` a obrázky `poster-*.png` po zakódování smažte.

Po nahrání nového videa zvyšte v `index.html` číslo verze u videa (`data-version`) a u obrázků
`reel-d.webp?v=` / `reel-m.webp?v=` – videa a obrázky si prohlížeče drží v mezipaměti 30 dní.
