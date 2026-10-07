// Hlavička, mobilní menu, videa ke spuštění a kontaktní formulář.

export function initUI() {
  const root = document.documentElement;

  // ---------- hlavička ----------
  // Nahoře průhledná, po odrolování tmavé sklo.
  const header = document.querySelector('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- mobilní menu ----------
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const setMenu = (open) => {
    root.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.querySelector('a')?.focus();
  };
  toggle.addEventListener('click', () => setMenu(!root.classList.contains('nav-open')));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && root.classList.contains('nav-open')) setMenu(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('nav-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
  });

  // ---------- videa ke spuštění ----------
  const videoDialog = document.querySelector('[data-video-dialog]');
  const video = videoDialog.querySelector('video');
  let opener = null;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-video]');
    if (!btn) return;
    opener = btn;
    video.poster = btn.dataset.poster || '';
    video.src = btn.dataset.video;
    videoDialog.classList.toggle('is-portrait', btn.dataset.ratio === '9 / 16');
    videoDialog.setAttribute('aria-label', btn.dataset.title || 'Video');
    videoDialog.showModal();
    video.play().catch(() => {});
  });
  const closeVideo = () => videoDialog.close();
  videoDialog.querySelector('[data-video-close]').addEventListener('click', closeVideo);
  videoDialog.addEventListener('click', (e) => {
    if (e.target === videoDialog) closeVideo();
  });
  videoDialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    opener?.focus();
  });

  // ---------- kontaktní formulář ----------
  const form = document.querySelector('[data-contact]');
  if (form) initContact(form);

  // ---------- rok v patičce ----------
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}

function initContact(form) {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[data-submit]');
  const stamp = () => (form.elements.t.value = String(Math.floor(Date.now() / 1000)));
  stamp();

  const rules = {
    jmeno: (v) => v.trim().length >= 2 || 'Napište nám, jak vám máme říkat.',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Zadejte e-mail ve tvaru jmeno@domena.cz.',
    zprava: (v) => v.trim().length >= 10 || 'Napište nám aspoň pár slov (alespoň 10 znaků).',
  };

  const setError = (name, message) => {
    const input = form.elements[name];
    const field = input.closest('.field');
    field.classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', String(!!message));
    field.querySelector('.field__error').textContent = message || '';
  };

  const check = (name) => {
    const result = rules[name](form.elements[name].value);
    setError(name, result === true ? '' : result);
    return result === true;
  };

  for (const name of Object.keys(rules)) {
    form.elements[name].addEventListener('blur', () => {
      if (form.elements[name].value) check(name);
    });
  }
  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (rules[name] && e.target.closest('.field').classList.contains('is-invalid')) check(name);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form__status';
    status.textContent = '';
    const valid = Object.keys(rules).map(check);
    if (valid.includes(false)) {
      form.querySelector('.is-invalid input, .is-invalid textarea')?.focus();
      return;
    }

    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Odesílám…';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.field && rules[data.field]) setError(data.field, data.error);
        throw new Error(data.error || '');
      }
      const email = form.elements.email.value.trim();
      form.reset();
      stamp();
      status.classList.add('is-ok');
      status.textContent = `Zpráva odeslána. Ozveme se vám na ${email}.`;
    } catch (err) {
      status.classList.add('is-error');
      status.textContent = err.message || 'Zprávu se nepodařilo odeslat. Zkuste to prosím za chvíli znovu.';
    } finally {
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Odeslat zprávu';
    }
  });
}
