(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- i18n ---------------- */
  const T = {
    it: {
      nav_bio: 'Bio', nav_works: 'Opere', nav_contact: 'Contatti',
      hero_sub: 'dipinti originali · occhi · spirali', scroll: 'scorri',
      bio_label: 'Bio', works_label: 'Opere', works_title: 'Opere',
      f_all: 'Tutte', f_avail: 'Disponibili', f_sold: 'Vendute',
      empty: 'Nuove opere in arrivo.', contact_label: 'Contatti',
      contact_title: 'Guardiamoci.', contact_text: 'Per opere, commissioni o semplicemente per parlare.',
      top: 'torna su ↑', prev: '← precedente', next: 'successiva →',
      avail: 'Disponibile', sold: 'Venduta', view: 'vedi',
      year: 'Anno', technique: 'Tecnica', size: 'Dimensioni',
      price: 'Prezzo', on_request: 'Prezzo su richiesta',
      sold_long: 'Venduta — ma posso dipingerne una simile per te',
      req_mail: 'Richiedi via email', req_ig: 'Scrivimi su Instagram', req_wa: 'WhatsApp',
      ask_similar: 'Chiedi un\'opera simile',
      msg: t => `Ciao sunshyray! Sono interessato/a all'opera "${t}".`,
      marquee: ['sunshyray', 'dipinti', 'occhio rosso', 'occhio bianco', 'spirali']
    },
    en: {
      nav_bio: 'Bio', nav_works: 'Works', nav_contact: 'Contact',
      hero_sub: 'original paintings · eyes · spirals', scroll: 'scroll',
      bio_label: 'Bio', works_label: 'Works', works_title: 'Works',
      f_all: 'All', f_avail: 'Available', f_sold: 'Sold',
      empty: 'New works coming soon.', contact_label: 'Contact',
      contact_title: 'Look at me.', contact_text: 'For works, commissions, or just to talk.',
      top: 'back to top ↑', prev: '← previous', next: 'next →',
      avail: 'Available', sold: 'Sold', view: 'view',
      year: 'Year', technique: 'Technique', size: 'Size',
      price: 'Price', on_request: 'Price on request',
      sold_long: 'Sold — but I can paint something similar for you',
      req_mail: 'Enquire by email', req_ig: 'Message on Instagram', req_wa: 'WhatsApp',
      ask_similar: 'Ask for a similar piece',
      msg: t => `Hi sunshyray! I'm interested in the painting "${t}".`,
      marquee: ['sunshyray', 'paintings', 'red eye', 'white eye', 'spirals']
    }
  };
  let lang = (() => {
    try { const s = localStorage.getItem('lang'); if (s) return s; } catch (e) {}
    return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
  })();
  const t = k => T[lang][k];

  /* ---------------- spirals ---------------- */
  function spiralD(turns = 6, step = .12) {
    const max = turns * Math.PI * 2, b = 92 / max;
    let d = '';
    for (let a = 0; a <= max; a += step) {
      const r = b * a;
      d += (a ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
    }
    return d;
  }
  $$('.spiral-path').forEach(p => {
    const svg = p.closest('svg');
    const turns = svg.classList.contains('hero__spiral') ? 14 : svg.classList.contains('mini-spiral') ? 3 : svg.classList.contains('loader__spiral') ? 5 : 7;
    p.setAttribute('d', spiralD(turns));
    p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
  });

  /* ---------------- split text ---------------- */
  function split(el, text) {
    el.innerHTML = '';
    [...text].forEach((c, i) => {
      const o = document.createElement('span'); o.className = 'ch';
      const s = document.createElement('span'); s.textContent = c === ' ' ? ' ' : c;
      o.style.setProperty('--i', i); o.appendChild(s); el.appendChild(o);
    });
  }
  $$('.split').forEach(el => split(el, el.textContent.trim()));

  /* ---------------- reveal observer ---------------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15, rootMargin: '0px 0px -5% 0px' });
  const observe = el => io.observe(el);
  $$('.reveal-up, main .split:not(.hero__title .split)').forEach(observe);

  /* ---------------- marquee ---------------- */
  const mini = '<svg viewBox="-100 -100 200 200"><path class="spiral-path" d="' + spiralD(3) + '"/></svg>';
  function buildMarquee() {
    const words = t('marquee');
    const one = words.map((w, i) => `<span class="${i % 2 ? 'o' : ''}">${w} ${mini}</span>`).join('');
    $('.marquee__track').innerHTML = one + one + one + one;
  }

  /* ---------------- loader ---------------- */
  const start = performance.now();
  const countEl = $('.loader__count span');
  const loaderDur = reduced ? 200 : 1500;
  (function tick(now) {
    const p = Math.min(1, (now - start) / loaderDur);
    countEl.textContent = Math.round((1 - Math.pow(1 - p, 3)) * 100);
    if (p < 1) requestAnimationFrame(tick);
  })(start);

  /* ---------------- eyes ---------------- */
  const eyes = $$('.eye').map(el => ({ el, iris: $('.eye__iris', el), x: 0, y: 0, tx: 0, ty: 0 }));
  let px = innerWidth / 2, py = innerHeight / 2, pointerActive = false;
  addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; pointerActive = true; }, { passive: true });
  if (!finePointer) {
    // on touch: the eyes wander around by themselves
    setInterval(() => {
      px = innerWidth * (.15 + Math.random() * .7);
      py = innerHeight * (.1 + Math.random() * .8);
      pointerActive = true;
    }, 1800);
  }
  function blink() {
    const which = Math.random() < .18 ? [eyes[Math.random() < .5 ? 0 : 1]] : eyes;
    which.forEach(e => e.el.classList.add('blink'));
    setTimeout(() => which.forEach(e => e.el.classList.remove('blink')), 150);
    setTimeout(blink, 2200 + Math.random() * 4200);
  }

  /* ---------------- cursor ---------------- */
  const cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  let cx = px, cy = py, rx = px, ry = py;
  if (finePointer && !reduced) {
    document.documentElement.classList.add('has-cursor');
    document.addEventListener('pointerover', e => {
      const v = e.target.closest('[data-cursor="view"]');
      const h = e.target.closest('a, button');
      cursor.classList.toggle('is-view', !!v);
      cursor.classList.toggle('is-hover', !v && !!h);
      if (v) label.textContent = t('view');
    });
    document.addEventListener('pointerleave', () => cursor.style.opacity = 0);
    document.addEventListener('pointerenter', () => cursor.style.opacity = 1);
  }

  /* ---------------- scroll-linked ---------------- */
  const bioSpiral = $('.bio__spiral'), contactSpiral = $('.contact__spiral');
  const bioText = $('#bioText');
  let scrollY = window.scrollY;
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  function updateWords() {
    const words = bioText._w; if (!words) return;
    const r = bioText.getBoundingClientRect();
    const vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n || reduced));
  }

  /* ---------------- main loop ---------------- */
  function loop() {
    // eyes
    eyes.forEach(e => {
      const r = e.el.getBoundingClientRect();
      if (r.bottom < 0) return;
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const dx = px - ex, dy = py - ey, dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 400);
      e.tx = pointerActive ? (dx / dist) * 44 * k : 0;
      e.ty = pointerActive ? (dy / dist) * 20 * k : 0;
      e.x = lerp(e.x, e.tx, finePointer ? .12 : .05);
      e.y = lerp(e.y, e.ty, finePointer ? .12 : .05);
      e.iris.setAttribute('transform', `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)})`);
    });
    // cursor
    if (finePointer) {
      cx = lerp(cx, px, .6); cy = lerp(cy, py, .6);
      rx = lerp(rx, px, .16); ry = lerp(ry, py, .16);
      dot.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    }
    // scroll rotations
    if (!reduced) {
      bioSpiral.style.transform = `rotate(${scrollY * .12}deg)`;
      contactSpiral.style.transform = `rotate(${-scrollY * .08}deg)`;
    }
    updateWords();
    requestAnimationFrame(loop);
  }

  /* ---------------- data ---------------- */
  let works = [], site = {}, filter = 'all';
  const bust = '?v=' + Date.now();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (w, key) => (lang === 'en' && w[key + '_en']) ? w[key + '_en'] : (w[key] || '');

  async function load() {
    try {
      const [a, b] = await Promise.all([
        fetch('data/opere.json' + bust).then(r => r.json()),
        fetch('data/sito.json' + bust).then(r => r.json())
      ]);
      works = Array.isArray(a) ? a : []; site = b || {};
    } catch (e) { console.warn('dati non caricati', e); }
  }

  function renderBio() {
    const txt = (lang === 'en' && site.bio_en) ? site.bio_en : (site.bio_it || '');
    bioText.innerHTML = '';
    bioText._w = txt.split(/\s+/).filter(Boolean).map(w => {
      const s = document.createElement('span');
      s.className = 'w' + (/ross|red\b|spiral|occh|eye/i.test(w) ? ' red' : '');
      s.textContent = w; bioText.append(s, ' ');
      return s;
    });
  }

  function channels(title) {
    const out = [];
    const msg = t('msg')(title || '');
    if (site.email) out.push({ k: 'req_mail', href: `mailto:${site.email}?subject=${encodeURIComponent('sunshyray — ' + (title || ''))}&body=${encodeURIComponent(msg)}` });
    if (site.instagram) out.push({ k: 'req_ig', href: `https://ig.me/m/${site.instagram.replace(/^@/, '')}` });
    if (site.whatsapp) out.push({ k: 'req_wa', href: `https://wa.me/${site.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` });
    return out;
  }

  function renderContact() {
    const box = $('#contactLinks'); box.innerHTML = '';
    const ig = (site.instagram || '').replace(/^@/, '');
    if (ig) box.insertAdjacentHTML('beforeend', `<a class="pill" target="_blank" rel="noopener" href="https://instagram.com/${esc(ig)}">Instagram ↗</a>`);
    if (site.email) box.insertAdjacentHTML('beforeend', `<a class="pill" href="mailto:${esc(site.email)}">${esc(site.email)}</a>`);
    if (site.whatsapp) box.insertAdjacentHTML('beforeend', `<a class="pill" target="_blank" rel="noopener" href="https://wa.me/${esc(site.whatsapp.replace(/\D/g, ''))}">WhatsApp ↗</a>`);
  }

  const grid = $('#grid');
  function renderGrid() {
    grid.innerHTML = '';
    works.forEach((w, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.dataset.cursor = 'view'; b.dataset.id = w.id;
      const sold = w.stato === 'venduta';
      b.innerHTML = `
        <div class="card__media" style="aspect-ratio:${w.w || 4}/${w.h || 5}">
          <img src="${esc(w.thumb || w.img)}" alt="${esc(L(w, 'titolo'))}" loading="lazy" width="${w.w || ''}" height="${w.h || ''}">
          <span class="card__tag ${sold ? 'sold' : ''}">${t(sold ? 'sold' : 'avail')}</span>
        </div>
        <div class="card__cap">
          <div><span class="card__num">${String(i + 1).padStart(2, '0')}</span><span class="card__title">${esc(L(w, 'titolo'))}</span></div>
          <span class="card__meta">${esc([w.anno, w.dimensioni].filter(Boolean).join(' · '))}</span>
        </div>`;
      b.addEventListener('click', e => openModal(i, e));
      if (finePointer) {
        const m = $('.card__media', b);
        b.addEventListener('pointermove', e => {
          const r = m.getBoundingClientRect();
          m.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
          m.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
        });
      }
      grid.appendChild(b);
      observe(b);
    });
    applyFilter();
  }

  function applyFilter() {
    let shown = 0;
    $$('.card', grid).forEach((c, i) => {
      const ok = filter === 'all' || works[i].stato === filter;
      c.classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    });
    $('#empty').hidden = shown > 0;
  }
  $$('.filters button').forEach(b => b.addEventListener('click', () => {
    $$('.filters button').forEach(x => x.classList.toggle('is-active', x === b));
    filter = b.dataset.filter;
    applyFilter();
  }));

  /* ---------------- modal ---------------- */
  const modal = $('#modal');
  let current = -1;
  const visibleIdx = () => works.map((w, i) => i).filter(i => filter === 'all' || works[i].stato === filter);

  function fillModal(i) {
    const w = works[i]; current = i;
    const sold = w.stato === 'venduta';
    const title = L(w, 'titolo');
    const img = $('#mImg'); img.src = w.img; img.alt = title;
    $('#mNum').textContent = `${String(i + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
    $('#mTitle').textContent = title;
    const meta = [['year', w.anno], ['technique', L(w, 'tecnica')], ['size', w.dimensioni]].filter(m => m[1]);
    $('#mMeta').innerHTML = meta.map(([k, v]) => `<dt>${t(k)}</dt><dd>${esc(v)}</dd>`).join('');
    $('#mMeta').hidden = !meta.length;
    $('#mDesc').textContent = L(w, 'descrizione');
    const pr = $('#mPrice');
    pr.classList.toggle('sold', sold);
    pr.innerHTML = sold ? esc(t('sold_long')) : (w.prezzo ? `<small>${t('price')}</small>${esc(w.prezzo)}` : `<small>${t('price')}</small>${t('on_request')}`);
    const ch = channels(title);
    $('#mActions').innerHTML = ch.map((c, j) =>
      `<a class="pill ${j === 0 ? 'pill--red' : ''}" target="${c.href.startsWith('mailto') ? '_self' : '_blank'}" rel="noopener" href="${esc(c.href)}">${sold && j === 0 ? t('ask_similar') : t(c.k)}</a>`).join('');
    history.replaceState(null, '', '#' + w.id);
  }

  function openModal(i, e) {
    const x = e && e.clientX != null && e.clientX ? e.clientX : innerWidth / 2;
    const y = e && e.clientY != null && e.clientY ? e.clientY : innerHeight / 2;
    modal.style.setProperty('--cx', x + 'px'); modal.style.setProperty('--cy', y + 'px');
    fillModal(i);
    modal.scrollTop = 0;
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => $('.modal__close').focus({ preventScroll: true }), 50);
  }
  function closeModal() {
    if (!modal.classList.contains('open')) return;
    const card = $(`.card[data-id="${CSS.escape(works[current].id)}"]`);
    if (card) {
      const r = card.getBoundingClientRect();
      modal.style.setProperty('--cx', (r.left + r.width / 2) + 'px');
      modal.style.setProperty('--cy', (r.top + r.height / 2) + 'px');
    }
    modal.classList.remove('open'); modal.classList.add('closing'); modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => modal.classList.remove('closing'), 900);
    if (card) card.focus({ preventScroll: true });
  }
  function step(d) {
    const v = visibleIdx(); if (!v.length) return;
    const pos = v.indexOf(current);
    const next = v[(pos + d + v.length) % v.length];
    $$('.m-in, .modal__media img', modal).forEach(el => { el.style.transition = 'none'; el.style.opacity = 0; el.style.transform = 'translateY(16px)'; });
    requestAnimationFrame(() => {
      fillModal(next);
      requestAnimationFrame(() => $$('.m-in, .modal__media img', modal).forEach((el, k) => {
        el.style.transition = `opacity .7s ${k * 40}ms, transform .9s cubic-bezier(.16,1,.3,1) ${k * 40}ms`;
        el.style.opacity = ''; el.style.transform = '';
      }));
    });
  }
  $('.modal__close').addEventListener('click', closeModal);
  $('#mPrev').addEventListener('click', () => step(-1));
  $('#mNext').addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  // swipe on touch
  let sx = null;
  modal.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', e => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 70) step(dx < 0 ? 1 : -1);
  });

  /* ---------------- language ---------------- */
  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-split]').forEach(el => { const was = el.classList.contains('in'); split(el, t(el.dataset.i18nSplit)); if (was) el.classList.add('in'); });
    buildMarquee(); renderBio(); renderContact();
    if (works.length) renderGrid();
    if (modal.classList.contains('open')) fillModal(current);
  }
  $('.lang').addEventListener('click', () => {
    lang = lang === 'it' ? 'en' : 'it';
    try { localStorage.setItem('lang', lang); } catch (e) {}
    applyLang();
  });

  /* ---------------- boot ---------------- */
  $('#year').textContent = new Date().getFullYear();
  applyLang();
  const minWait = new Promise(r => setTimeout(r, loaderDur + 150));
  Promise.all([load(), minWait]).then(() => {
    applyLang();
    $('.loader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    document.documentElement.classList.add('is-ready');
    setTimeout(() => $('.hero__title .split').classList.add('in'), 250);
    setTimeout(() => $('.hero__sub').classList.add('in'), 700);
    setTimeout(blink, 2600);
    const id = decodeURIComponent(location.hash.slice(1));
    const i = works.findIndex(w => w.id === id);
    if (i > -1) setTimeout(() => openModal(i), 900);
  });
  requestAnimationFrame(loop);
})();
