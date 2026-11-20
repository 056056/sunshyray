(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- testi ---------------- */
  const T = {
    it: {
      nav_works: 'opere', nav_bio: 'chi sono', nav_contact: 'scrivimi',
      kicker: '— dipinti di sunshyray', go: 'entra nella mostra ↓',
      works_title: 'La mostra', bio_title: 'Chi sono', contact_title: 'Scrivimi',
      f_all: 'tutte', f_avail: 'disponibili', f_sold: 'vendute',
      empty: 'nuovi quadri in arrivo…',
      scrawl: 'dal mio quaderno',
      pc_msg: 'Se un quadro ti ha guardato, scrivimi. Rispondo sempre, anche per commissioni o solo per parlarne.',
      foot: 'tutte le opere sono dipinte a mano', top: 'torna su ↑', close: 'chiudi ✕',
      prev: '← quello prima', next: 'quello dopo →',
      room: n => `sala unica · ${n} ${n === 1 ? 'opera' : 'opere'}`,
      latest: 'l\'ultimo quadro ↑', theme: 'tema', avail: 'disponibile',
      price: 'prezzo', on_request: 'prezzo su richiesta',
      sold_long: 'venduto — ma posso dipingerne uno per te',
      ask_ig: '→ scrivimi su instagram', ask_mail: '→ mandami una mail', ask_wa: '→ whatsapp',
      ask_similar: '→ chiedimi un quadro simile',
      msg: t => `Ciao sunshyray, ho visto "${t}" sul tuo sito e vorrei saperne di più.`,
      manifesto: 'Dipingo ~~quello che vedo~~ quello che *nessuno* vuole guardare.'
    },
    en: {
      nav_works: 'works', nav_bio: 'about', nav_contact: 'write me',
      kicker: '— paintings by sunshyray', go: 'step into the show ↓',
      works_title: 'The show', bio_title: 'About me', contact_title: 'Write me',
      f_all: 'all', f_avail: 'available', f_sold: 'sold',
      empty: 'new paintings coming soon…',
      scrawl: 'from my notebook',
      pc_msg: 'If a painting looked back at you, write to me. I always reply — commissions, or just to talk about it.',
      foot: 'every work is painted by hand', top: 'back to top ↑', close: 'close ✕',
      prev: '← previous one', next: 'next one →',
      room: n => `one room · ${n} ${n === 1 ? 'work' : 'works'}`,
      latest: 'the latest one ↑', theme: 'theme', avail: 'available',
      price: 'price', on_request: 'price on request',
      sold_long: 'sold — but I can paint one for you',
      ask_ig: '→ message me on instagram', ask_mail: '→ send me an email', ask_wa: '→ whatsapp',
      ask_similar: '→ ask me for a similar one',
      msg: t => `Hi sunshyray, I saw "${t}" on your website and would love to know more.`,
      manifesto: 'I paint ~~what I see~~ what *nobody* wants to look at.'
    }
  };
  let lang = (() => {
    try { const s = localStorage.getItem('lang'); if (s) return s; } catch (e) {}
    return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
  })();
  const t = k => T[lang][k];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- linee a mano ---------------- */
  const setLen = p => p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1);
  $$('.scribble-under path').forEach(setLen);


  // "tremolio" dei disegni, come un'animazione fatta a mano
  if (!reduced) { const tb = $('#boilT'); let s = 1; setInterval(() => tb.setAttribute('seed', (s = s % 4 + 1)), 150); }

  /* ---------------- reveal ---------------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  $$('.h2, .about, .rv').forEach(el => io.observe(el));

  /* quadri che "vengono appesi" e poi oscillano se li sfiori */
  function settleOnEnd(el) {
    el.addEventListener('animationend', e => {
      if (e.animationName === 'hang') el.classList.add('settled');
      if (e.animationName === 'nudge') el.classList.remove('nudge');
    });
    el.addEventListener('pointerenter', () => { if (el.classList.contains('settled') && !reduced) el.classList.add('nudge'); });
  }
  const st = document.createElement('style');
  st.textContent = '.settled{opacity:1!important;transform:rotate(var(--tilt,0deg));animation:sway var(--sd,7s) ease-in-out infinite!important;animation-delay:var(--sdl,0s)!important}.settled.nudge{animation:nudge 1.3s ease both!important}@media (prefers-reduced-motion:reduce){.settled{animation:none!important}}';
  document.head.appendChild(st);
  settleOnEnd($('#hung'));

  /* ---------------- manifesto battuto a macchina ---------------- */
  const STRIKE = 'M2 55 C 18 40, 30 66, 46 48 S 74 38, 98 52 M6 62 C 30 50, 66 58, 96 44';
  const CIRCLE = 'M18 8 C 45 0, 88 2, 96 18 C 102 32, 62 40, 28 37 C 6 35, 0 22, 12 12 C 24 3, 48 2, 64 5';
  let typingTimer = null;
  function renderManifesto(text) {
    clearTimeout(typingTimer);
    const h = $('#manifesto'); h.innerHTML = '';
    h.setAttribute('aria-label', text.replace(/~~|\*/g, ''));
    const chars = [], marks = [];
    text.split(/(~~[^~]+~~|\*[^*]+\*)/).filter(Boolean).forEach(part => {
      let target = h, kind = null, inner = part;
      if (part.startsWith('~~')) { kind = 'strike'; inner = part.slice(2, -2); }
      else if (part.startsWith('*')) { kind = 'circle'; inner = part.slice(1, -1); }
      if (kind) {
        target = document.createElement('span'); target.className = 'mark mark--' + kind;
        target.innerHTML = `<svg viewBox="0 0 100 ${kind === 'strike' ? 100 : 40}" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="${kind === 'strike' ? STRIKE : CIRCLE}"/></svg>`;
        h.appendChild(target); marks.push(target);
      }
      [...inner].forEach(ch => {
        const s = document.createElement('span'); s.className = 'c'; s.textContent = ch;
        target.appendChild(s); chars.push(s);
      });
    });
    marks.forEach(m => setLen($('path', m)));
    const caret = document.createElement('span'); caret.className = 'caret';
    if (reduced) { chars.forEach(c => c.classList.add('on')); marks.forEach(m => m.classList.add('drawn')); return; }
    let i = 0;
    (function type() {
      if (i < chars.length) {
        chars[i].classList.add('on'); chars[i].after(caret);
        const ch = chars[i++].textContent;
        typingTimer = setTimeout(type, /[.,]/.test(ch) ? 380 : ch === ' ' ? 90 : 35 + Math.random() * 70);
      } else {
        marks.forEach((m, k) => setTimeout(() => m.classList.add('drawn'), 350 + k * 650));
      }
    })();
  }

  /* ---------------- occhi scarabocchiati ---------------- */
  const eyes = $$('.deye').map(el => ({ el, iris: $('.iris', el), x: 0, y: 0 }));
  let px = innerWidth / 2, py = innerHeight / 3;
  addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; }, { passive: true });
  if (!matchMedia('(hover: hover)').matches) setInterval(() => { px = Math.random() * innerWidth; py = Math.random() * innerHeight; }, 2000);
  function blink() {
    const which = Math.random() < .2 ? [eyes[Math.round(Math.random())]] : eyes;
    which.forEach(e => e.el.classList.add('blink'));
    setTimeout(() => which.forEach(e => e.el.classList.remove('blink')), 140);
    setTimeout(blink, 2500 + Math.random() * 4500);
  }
  if (!reduced) setTimeout(blink, 3000);

  /* ---------------- bio parola per parola ---------------- */
  const bioBox = $('#bioText');
  function updateWords() {
    const w = bioBox._w; if (!w) return;
    const r = bioBox.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * .9 - r.top) / (r.height + innerHeight * .2)));
    const n = reduced ? w.length : Math.round(p * w.length);
    w.forEach((s, i) => s.classList.toggle('on', i < n));
  }

  function loop() {
    eyes.forEach(e => {
      const r = e.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 300);
        e.x += ((dx / d) * 9 * k - e.x) * .1; e.y += ((dy / d) * 5 * k - e.y) * .1;
        e.iris.setAttribute('transform', `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)})`);
      }
    });
    updateWords();
    requestAnimationFrame(loop);
  }

  /* ---------------- dati ---------------- */
  let works = [], site = {}, filter = 'all';
  const L = (w, k) => (lang === 'en' && w[k + '_en']) ? w[k + '_en'] : (w[k] || '');
  async function load() {
    const v = '?v=' + Date.now();
    try {
      const [a, b] = await Promise.all([fetch('data/opere.json' + v).then(r => r.json()), fetch('data/sito.json' + v).then(r => r.json())]);
      works = Array.isArray(a) ? a : []; site = b || {};
    } catch (e) { console.warn('dati non caricati', e); }
  }

  function labelHTML(w, big) {
    const sold = w.stato === 'venduta';
    const meta = [L(w, 'tecnica'), w.dimensioni].filter(Boolean).map(esc).join(', ');
    return `${sold ? '<span class="dot" title="venduto"></span>' : ''}
      <span class="artist">sunshyray</span>
      <b>${esc(L(w, 'titolo'))}${w.anno ? ', ' + esc(w.anno) : ''}</b>
      ${meta ? meta + '<br>' : ''}
      ${!sold && big ? '' : !sold ? `<span class="avail">● ${t('avail')}</span>` : ''}`;
  }

  const TILT = [-.7, .5, -.35, .8, -.55, .3, .6, -.8];
  const LT = [1.2, -1, .7, -1.4, .9, -.6];
  const OFF = [0, 70, 20, 0, 90, 30];
  function renderWall() {
    const wall = $('#wall'); wall.innerHTML = '';
    works.forEach((w, i) => {
      const ratio = (w.w || 4) / (w.h || 5);
      const kind = ratio > 1.15 ? 'wide' : ratio < .85 ? 'tall' : 'sq';
      const a = document.createElement('article');
      a.className = `piece piece--${kind}`; a.dataset.i = i;
      a.style.cssText = `--off:${OFF[i % OFF.length]}px;--d:${(i % 3) * .18}s;--lt:${LT[i % LT.length]}deg;--sd:${6 + (i % 4) * 1.1}s;--sdl:-${(i * 1.7).toFixed(1)}s`;
      a.innerHTML = `
        <div class="piece__hang" style="--tilt:${TILT[i % TILT.length]}deg">
          <button type="button" class="piece__canvas" aria-label="${esc(L(w, 'titolo'))}">
            <img src="${esc(w.thumb || w.img)}" alt="${esc(L(w, 'titolo'))}" loading="lazy" width="${w.w || ''}" height="${w.h || ''}">
          </button>
        </div>
        <div class="label">${labelHTML(w)}</div>`;
      a.querySelector('button').addEventListener('click', () => openRoom(i));
      a.querySelector('.label').addEventListener('click', () => openRoom(i));
      a.querySelector('.label').style.cursor = 'pointer';
      settleOnEnd(a.querySelector('.piece__hang'));
      wall.appendChild(a); io.observe(a);
    });
    $('#showNote').textContent = t('room')(works.length);
    applyFilter();

    // il quadro appeso in apertura: il primo disponibile, o il primo in assoluto
    const hi = Math.max(0, works.findIndex(w => w.stato !== 'venduta'));
    const hw = works[hi];
    $('#hung').hidden = !hw;
    if (hw) {
      $('#hungImg').src = hw.thumb || hw.img; $('#hungImg').alt = L(hw, 'titolo');
      if (hw.w && hw.h) { $('#hungImg').width = hw.w; $('#hungImg').height = hw.h; $('#hungImg').style.height = 'auto'; }
      $('#hungCap').textContent = t('latest');
      $('#hungBtn').onclick = () => openRoom(hi);
    }
  }
  function applyFilter() {
    let n = 0;
    $$('.piece').forEach(p => {
      const ok = filter === 'all' || works[+p.dataset.i].stato === filter;
      p.classList.toggle('is-hidden', !ok); if (ok) n++;
    });
    $('#empty').hidden = n > 0;
  }
  $$('.filters button').forEach(b => b.addEventListener('click', () => {
    $$('.filters button').forEach(x => x.classList.toggle('is-active', x === b));
    filter = b.dataset.filter; applyFilter();
  }));

  function renderBio() {
    const txt = (lang === 'en' && site.bio_en) ? site.bio_en : (site.bio_it || '');
    bioBox.innerHTML = ''; const all = [];
    txt.split(/\n\s*\n/).forEach(par => {
      const p = document.createElement('p');
      par.trim().split('\n').forEach((line, li) => {
        if (li) p.appendChild(document.createElement('br'));
        line.split(/\s+/).filter(Boolean).forEach(word => {
          const s = document.createElement('span'); s.className = 'w'; s.textContent = word;
          p.append(s, ' '); all.push(s);
        });
      });
      bioBox.appendChild(p);
    });
    bioBox._w = all;
  }

  function renderContact() {
    const ul = $('#contactLinks'), ig = (site.instagram || '').replace(/^@/, '');
    const rows = [];
    if (ig) rows.push(`<li><a href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener"><span>@${esc(ig)}</span><small>instagram</small></a></li>`);
    if (site.email) rows.push(`<li><a href="mailto:${esc(site.email)}"><span>${esc(site.email)}</span><small>email</small></a></li>`);
    if (site.whatsapp) rows.push(`<li><a href="https://wa.me/${esc(site.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener"><span>+${esc(site.whatsapp.replace(/\D/g, ''))}</span><small>whatsapp</small></a></li>`);
    while (rows.length < 3) rows.push('<li>&nbsp;</li>');
    ul.innerHTML = rows.join('');
  }

  /* ---------------- scheda opera ---------------- */
  const room = $('#room'); let cur = -1;
  function fillRoom(i) {
    const w = works[i]; cur = i;
    const sold = w.stato === 'venduta', title = L(w, 'titolo');
    $('#rImg').src = w.img; $('#rImg').alt = title;
    $('#rLabel').innerHTML = labelHTML(w, true);
    $('#rDesc').textContent = L(w, 'descrizione');
    const pr = $('#rPrice'); pr.classList.toggle('sold', sold);
    pr.textContent = sold ? t('sold_long') : w.prezzo ? `${t('price')}: ${w.prezzo}` : t('on_request');
    const msg = t('msg')(title), links = [], ig = (site.instagram || '').replace(/^@/, '');
    if (ig) links.push(['ask_ig', `https://ig.me/m/${ig}`]);
    if (site.email) links.push(['ask_mail', `mailto:${site.email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(msg)}`]);
    if (site.whatsapp) links.push(['ask_wa', `https://wa.me/${site.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`]);
    $('#rAsk').innerHTML = links.map(([k, h], j) => `<a href="${esc(h)}" ${h.startsWith('mailto') ? '' : 'target="_blank" rel="noopener"'}>${sold && j === 0 ? t('ask_similar') : t(k)}</a>`).join('');
    history.replaceState(null, '', '#' + w.id);
  }
  function openRoom(i) {
    fillRoom(i); room.scrollTop = 0;
    room.classList.add('open'); room.setAttribute('aria-hidden', 'false');
    document.body.classList.add('room-open');
    $('.room__close').focus({ preventScroll: true });
  }
  function closeRoom() {
    if (!room.classList.contains('open')) return;
    room.classList.remove('open'); room.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('room-open');
    history.replaceState(null, '', location.pathname + location.search);
    const p = $(`.piece[data-i="${cur}"] button`); if (p) p.focus({ preventScroll: true });
  }
  function step(d) {
    const v = works.map((_, i) => i).filter(i => filter === 'all' || works[i].stato === filter);
    if (!v.length) return;
    fillRoom(v[(v.indexOf(cur) + d + v.length) % v.length]);
    const c = $('.room__canvas'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    room.scrollTop = 0;
  }
  $('.room__close').addEventListener('click', closeRoom);
  $('#rPrev').addEventListener('click', () => step(-1));
  $('#rNext').addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (!room.classList.contains('open')) return;
    if (e.key === 'Escape') closeRoom();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  let sx = null;
  room.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  room.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 70) step(dx < 0 ? 1 : -1); });

  /* ---------------- lingua ---------------- */
  function applyLang(first) {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    renderManifesto((lang === 'en' ? site.manifesto_en : site.manifesto_it) || t('manifesto'));
    renderBio(); renderContact(); renderWall();
    if (room.classList.contains('open')) fillRoom(cur);
  }
  $('.lang').addEventListener('click', () => {
    lang = lang === 'it' ? 'en' : 'it';
    try { localStorage.setItem('lang', lang); } catch (e) {}
    applyLang();
  });

  /* ---------------- avvio ---------------- */
  $('#year').textContent = new Date().getFullYear();
  load().then(() => {
    applyLang(true);
    const i = works.findIndex(w => w.id === decodeURIComponent(location.hash.slice(1)));
    if (i > -1) openRoom(i);
  });
  requestAnimationFrame(loop);
})();
