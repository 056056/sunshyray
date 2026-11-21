(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* ---------- icone a spirale ---------- */
  const spiral = turns => { const max = turns * Math.PI * 2, b = 90 / max; let d = ''; for (let a = 0; a <= max; a += .12) { const r = b * a; d += (a ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); } return d; };
  $('#spD').setAttribute('d', spiral(3)); $('#spO').setAttribute('d', spiral(4));

  /* ---------- memoria del browser ---------- */
  const store = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- quale repository ---------- */
  function detectRepo() {
    const cfg = (window.SUNSHYRAY && window.SUNSHYRAY.repo) || store.get('ss_repo');
    if (cfg) return cfg;
    const h = location.hostname;
    if (h.endsWith('.github.io')) {
      const owner = h.split('.')[0];
      const seg = location.pathname.split('/').filter(Boolean)[0];
      return owner + '/' + (seg && !seg.endsWith('.html') ? seg : h);
    }
    return '';
  }
  let REPO = detectRepo();
  let TOKEN = store.get('ss_token');

  /* ---------- GitHub ---------- */
  async function api(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${REPO}${path ? '/' + path : ''}`, {
      ...opts, cache: 'no-store',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    if (!r.ok) { const e = new Error('GitHub ' + r.status); e.status = r.status; try { e.detail = (await r.json()).message; } catch (_) {} throw e; }
    return r.status === 204 ? null : r.json();
  }
  const b64encode = str => { const bytes = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));
  async function getJSON(path, fallback) {
    try { const f = await api('contents/' + path); return { data: JSON.parse(b64decode(f.content)), sha: f.sha }; }
    catch (e) { if (e.status === 404) return { data: fallback, sha: null }; throw e; }
  }
  const putFile = (path, base64, message, sha) => api('contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }) });
  const putJSON = (path, data, msg, sha) => putFile(path, b64encode(JSON.stringify(data, null, 1) + '\n'), msg, sha);
  async function deleteFile(path, message) {
    try { const f = await api('contents/' + path); await api('contents/' + path, { method: 'DELETE', body: JSON.stringify({ message, sha: f.sha }) }); } catch (e) { if (e.status !== 404) throw e; }
  }
  // modifica un elenco (opere o quaderno), riprovando se nel frattempo è cambiato
  async function updateList(path, mutator, msg) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, sha } = await getJSON(path, []);
      const next = mutator(Array.isArray(data) ? data : []);
      try { await putJSON(path, next, msg, sha); return next; }
      catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
    }
    throw new Error('conflict');
  }
  const WORKS = 'data/opere.json', NOTES = 'data/quaderno.json';

  /* ---------- schermata di attesa ---------- */
  const ov = $('#ov');
  const busy = (msg, sub = '') => { ov.className = 'ov on'; $('#ovMsg').textContent = msg; $('#ovSub').textContent = sub; };
  const done = (msg, sub = '') => { ov.className = 'ov on done'; $('#ovMsg').textContent = msg; $('#ovSub').textContent = sub; };
  const idle = () => { ov.className = 'ov'; };
  function say(msg, sub) { ov.className = 'ov on fail'; $('#ovMsg').textContent = msg; $('#ovSub').textContent = sub; }
  function fail(e) {
    console.error(e);
    say('Qualcosa non ha funzionato',
      e.status === 401 ? 'La chiave di accesso non è più valida. Premi "esci" e inseriscine una nuova.'
      : e.message === 'image' ? 'Questa foto non si riesce ad aprire. Prova con una foto JPG o PNG.'
      : 'Controlla la connessione e riprova. (' + (e.detail || e.message) + ')');
  }
  $('#ovBtn').onclick = idle;

  /* ---------- accesso ---------- */
  async function tryLogin() {
    const r = await api('');
    if (!r.permissions || !r.permissions.push) { const e = new Error('nopush'); e.status = 403; throw e; }
  }
  async function boot() {
    // link "entra con un tocco": admin.html#chiave=...&repo=...
    const hp = new URLSearchParams(location.hash.slice(1));
    if (hp.get('chiave')) {
      TOKEN = hp.get('chiave'); store.set('ss_token', TOKEN);
      if (hp.get('repo')) { REPO = hp.get('repo'); store.set('ss_repo', REPO); }
      history.replaceState(null, '', location.pathname);
    }
    if (!REPO) $('#repoField').hidden = false;
    if (!TOKEN || !REPO) { $('#login').hidden = false; return; }
    try { busy('Apro lo studio…'); await tryLogin(); store.set('ss_repo', REPO); idle(); showApp(); }
    catch (e) { idle(); $('#login').hidden = false; $('#loginErr').textContent = 'La chiave salvata non funziona più: inseriscine una nuova.'; }
  }
  $('#loginBtn').onclick = async () => {
    TOKEN = $('#tok').value.trim();
    if (!REPO) REPO = $('#repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    $('#loginErr').textContent = '';
    if (!TOKEN || !REPO) { $('#loginErr').textContent = 'Compila tutti i campi.'; return; }
    try {
      busy('Controllo la chiave…'); await tryLogin();
      store.set('ss_token', TOKEN); store.set('ss_repo', REPO);
      idle(); $('#login').hidden = true; showApp();
    } catch (e) {
      idle();
      $('#loginErr').textContent = e.status === 404 ? 'Repository non trovato, oppure la chiave non ha accesso a questo repository.' : e.status === 401 ? 'Chiave non valida.' : e.status === 403 ? 'La chiave non ha il permesso di scrittura (Contents: Read and write).' : 'Errore di connessione.';
    }
  };
  $('#logout').onclick = () => { if (confirm('Vuoi uscire? Dovrai reinserire la chiave.')) { store.del('ss_token'); location.reload(); } };
  function showApp() { $('#app').hidden = false; $('#logout').hidden = false; loadList(); loadNotes(); loadBio(); }

  /* ---------- schede ---------- */
  function tab(name) {
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === name));
    $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + name));
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.tabs button').forEach(b => b.onclick = () => {
    if (b.dataset.t === 'new' && editing) resetForm();
    tab(b.dataset.t);
    if (b.dataset.t === 'list') loadList();
    if (b.dataset.t === 'nb') loadNotes();
  });

  /* ---------- immagini: apertura e ridimensionamento ---------- */
  async function decode(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = URL.createObjectURL(file); }); }
  }
  function scaled(src, max) {
    const s = Math.min(1, max / Math.max(src.width, src.height));
    const c = document.createElement('canvas'); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  const toBlob = (canvas, q) => new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
  const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const slug = s => (s || 'opera').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'opera';
  function wireDrop(zone, input, onFile, isActive) {
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', e => { e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) onFile(f); });
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; });
    addEventListener('drop', e => { if (isActive() && e.dataTransfer.files[0]) { e.preventDefault(); onFile(e.dataTransfer.files[0]); } });
  }
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => e.preventDefault());

  /* ---------- raddrizzamento prospettico ---------- */
  // dai 4 angoli segnati sulla foto (in alto a sx, alto dx, basso dx, basso sx)
  // ricava un rettangolo dritto: la "faccia" della tela
  function squareToQuad(P) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = P;
    const dx3 = x0 - x1 + x2 - x3, dy3 = y0 - y1 + y2 - y3;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0];
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const det = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function parseDims(s) {
    const m = String(s || '').replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*[x×X*]\s*(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) / parseFloat(m[2]) : 0;
  }
  function warp(src, corners, maxSide, ratioHint) {
    const S = scaled(src, 3000), W = S.width, H = S.height;
    const sd = S.getContext('2d').getImageData(0, 0, W, H).data;
    const P = corners.map(p => [p.x * W, p.y * H]);
    const qW = (dist(P[0], P[1]) + dist(P[3], P[2])) / 2, qH = (dist(P[0], P[3]) + dist(P[1], P[2])) / 2;
    const ratio = ratioHint > 0 ? ratioHint : qW / qH;
    const longSrc = Math.max(qW, qH) * (src.width / W);
    const long = Math.min(maxSide, Math.max(400, longSrc));
    const ow = Math.round(ratio >= 1 ? long : long * ratio), oh = Math.round(ratio >= 1 ? long / ratio : long);
    const [a, b, c, d, e, f, g, h] = squareToQuad(P);
    const out = document.createElement('canvas'); out.width = ow; out.height = oh;
    const ox = out.getContext('2d'), od = ox.createImageData(ow, oh), D = od.data;
    for (let y = 0; y < oh; y++) {
      const v = (y + .5) / oh;
      for (let x = 0; x < ow; x++) {
        const u = (x + .5) / ow, den = g * u + h * v + 1;
        let sx = (a * u + b * v + c) / den - .5, sy = (d * u + e * v + f) / den - .5;
        if (sx < 0) sx = 0; if (sy < 0) sy = 0; if (sx > W - 1.001) sx = W - 1.001; if (sy > H - 1.001) sy = H - 1.001;
        const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy;
        const i00 = (iy * W + ix) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
        const o = (y * ow + x) * 4;
        for (let k = 0; k < 3; k++) {
          const top = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx;
          const bot = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
          D[o + k] = top + (bot - top) * fy;
        }
        D[o + 3] = 255;
      }
    }
    ox.putImageData(od, 0, 0);
    return out;
  }

  /* ---------- editor dei 4 angoli ---------- */
  let src = null;        // foto originale aperta
  let corners = null;    // 4 angoli scelti (0..1), oppure null = foto intera
  let photoReady = false;
  const stage = $('#stage');
  const defaultCorners = () => [{ x: .06, y: .06 }, { x: .94, y: .06 }, { x: .94, y: .94 }, { x: .06, y: .94 }];
  function drawCrop() {
    $$('.hdl').forEach((h, k) => { h.style.left = (corners[k].x * 100) + '%'; h.style.top = (corners[k].y * 100) + '%'; });
    const pts = corners.map(p => `${p.x},${p.y}`).join(' ');
    $('#cropPoly').setAttribute('points', pts);
    $('#cropShade').setAttribute('d', `M0 0H1V1H0Z M${corners.map(p => `${p.x} ${p.y}`).join(' L')}Z`);
  }
  $$('.hdl').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const k = +h.dataset.k;
      const move = ev => {
        const r = stage.getBoundingClientRect();
        corners[k] = { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
        drawCrop();
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  });
  function openCrop(keep) {
    if (!keep || !corners) corners = defaultCorners();
    $('#cropImg').src = scaled(src, 1600).toDataURL('image/jpeg', .85);
    $('#crop').hidden = false; $('#drop').hidden = true; $('#recrop').hidden = true;
    drawCrop();
    $('#crop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function showPreview() {
    const pv = corners ? warp(src, corners, 900, parseDims($('#f-dim').value)) : scaled(src, 900);
    $('#preview').src = pv.toDataURL('image/jpeg', .85);
    $('#dropEmpty').hidden = true; $('#dropFull').hidden = false;
    $('#crop').hidden = true; $('#drop').hidden = false; $('#recrop').hidden = false;
    photoReady = true;
  }
  $('#cropOk').onclick = async () => { busy('Raddrizzo la foto…'); await new Promise(r => setTimeout(r, 30)); try { await showPreview(); idle(); $('#f-titolo').focus({ preventScroll: true }); } catch (e) { fail(e); } };
  $('#cropSkip').onclick = async () => { corners = null; await showPreview(); };
  $('#recrop').onclick = () => openCrop(true);

  async function handleFile(file) {
    try { busy('Apro la foto…'); src = await decode(file); idle(); openCrop(false); }
    catch (e) { fail(new Error('image')); }
  }
  wireDrop($('#drop'), $('#file'), handleFile, () => $('#p-new').classList.contains('on'));

  /* ---------- modulo opera ---------- */
  let editing = null;
  const F = { titolo: '#f-titolo', descrizione: '#f-desc', anno: '#f-anno', prezzo: '#f-prezzo', tecnica: '#f-tecnica', dimensioni: '#f-dim', titolo_en: '#f-titolo-en', descrizione_en: '#f-desc-en', tecnica_en: '#f-tecnica-en' };
  function readForm() {
    const o = {}; for (const k in F) o[k] = $(F[k]).value.trim();
    o.stato = document.querySelector('input[name=stato]:checked').value;
    return o;
  }
  function resetForm() {
    editing = null; src = null; corners = null; photoReady = false;
    for (const k in F) $(F[k]).value = '';
    $('input[name=stato][value=disponibile]').checked = true;
    $('#dropEmpty').hidden = false; $('#dropFull').hidden = true; $('#drop').hidden = false;
    $('#crop').hidden = true; $('#recrop').hidden = true;
    $('#formTitle').textContent = 'Nuova opera';
    $('#formLead').textContent = 'Scegli la foto del quadro, poi segna i 4 angoli: la foto viene raddrizzata e messa sulla tela. Poi scrivi due righe e premi Pubblica.';
    $('#publish').textContent = 'Pubblica'; $('#cancelEdit').hidden = true;
  }
  $('#cancelEdit').onclick = () => { resetForm(); tab('list'); };

  $('#publish').onclick = async () => {
    const data = readForm();
    if (!$('#crop').hidden) { say('Prima gli angoli', 'Premi "Raddrizza" (o "Usa la foto intera") sotto la foto.'); return; }
    if (!editing && !photoReady) { say('Manca la foto', 'Trascina o scegli la foto del quadro.'); return; }
    if (!data.titolo) { $('#f-titolo').focus(); $('#f-titolo').style.borderColor = 'var(--red)'; setTimeout(() => $('#f-titolo').style.borderColor = '', 1500); return; }
    try {
      let imgFields = {};
      const id = editing || (slug(data.titolo) + '-' + Date.now().toString(36));
      if (photoReady && src) {
        busy('Preparo la foto…', 'Non chiudere la pagina');
        await new Promise(r => setTimeout(r, 30));
        const full = corners ? warp(src, corners, 2200, parseDims(data.dimensioni)) : scaled(src, 2200);
        const thumbC = scaled(full, 900);
        const v = editing ? '-' + Date.now().toString(36) : '';
        const fp = `opere/${id}${v}.jpg`, tp = `opere/${id}${v}-s.jpg`;
        busy('Carico la foto…', 'Non chiudere la pagina');
        await putFile(fp, await blobB64(await toBlob(full, .86)), `Foto: ${data.titolo}`);
        busy('Quasi fatto…', 'Non chiudere la pagina');
        await putFile(tp, await blobB64(await toBlob(thumbC, .8)), `Miniatura: ${data.titolo}`);
        imgFields = { img: fp, thumb: tp, w: full.width, h: full.height };
      } else busy('Salvo…');
      let oldImgs = null;
      await updateList(WORKS, list => {
        if (editing) {
          const i = list.findIndex(w => w.id === editing);
          if (i > -1) { if (imgFields.img) oldImgs = [list[i].img, list[i].thumb]; list[i] = { ...list[i], ...data, ...imgFields }; }
          return list;
        }
        return [{ id, ...imgFields, ...data }, ...list];
      }, (editing ? 'Modifica: ' : 'Nuova opera: ') + data.titolo);
      if (oldImgs) for (const p of oldImgs) if (p) await deleteFile(p, 'Rimuovo vecchia foto').catch(() => {});
      done(editing ? 'Modifiche salvate' : 'Pubblicata!', 'Sarà visibile sul sito tra un paio di minuti.');
      resetForm(); loadList();
    } catch (e) { fail(e); }
  };

  /* ---------- elenchi ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rawUrl = p => `https://raw.githubusercontent.com/${REPO}/HEAD/${p}`;
  const thumbImg = it => `<img src="${esc(rawUrl(it.thumb || it.img))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${esc(it.thumb || it.img)}'">`;
  const moveBtns = (i, n) => `<button data-a="up" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>↑</button><button data-a="down" ${i === n - 1 ? 'disabled style="opacity:.3"' : ''}>↓</button>`;
  const swap = (l, id, dir) => { const i = l.findIndex(x => x.id === id), j = i + (dir === 'up' ? -1 : 1); if (i > -1 && j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]]; return l; };

  let works = [];
  async function loadList() {
    const box = $('#list');
    try {
      works = (await getJSON(WORKS, [])).data || [];
      if (!works.length) { box.innerHTML = '<p class="note">Ancora nessuna opera. Aggiungine una dalla scheda “＋ Opera”.</p>'; return; }
      box.innerHTML = works.map((w, i) => `
        <div class="item" data-i="${i}">
          ${thumbImg(w)}
          <div>
            <h3>${esc(w.titolo)}</h3>
            <div class="m"><span class="pill-s ${w.stato === 'venduta' ? 'sold' : ''}">${w.stato === 'venduta' ? 'Venduta' : 'Disponibile'}</span>${w.prezzo ? ' · ' + esc(w.prezzo) : ''}${w.dimensioni ? ' · ' + esc(w.dimensioni) : ''}</div>
            <div class="acts">
              <button data-a="edit">Modifica</button>
              <button data-a="toggle">${w.stato === 'venduta' ? 'Segna disponibile' : 'Segna venduta'}</button>
              ${moveBtns(i, works.length)}
              <button data-a="del" class="del">Elimina</button>
            </div>
          </div>
        </div>`).join('');
    } catch (e) { box.innerHTML = '<p class="note">Non riesco a caricare le opere. Controlla la connessione.</p>'; }
  }
  function startEdit(w) {
    resetForm(); editing = w.id;
    for (const k in F) $(F[k]).value = w[k] || '';
    $(`input[name=stato][value=${w.stato === 'venduta' ? 'venduta' : 'disponibile'}]`).checked = true;
    $('#preview').src = rawUrl(w.img); $('#dropEmpty').hidden = true; $('#dropFull').hidden = false;
    $('#formTitle').textContent = 'Modifica opera';
    $('#formLead').textContent = 'Cambia quello che vuoi. Se non tocchi la foto, resta quella di prima.';
    $('#publish').textContent = 'Salva modifiche'; $('#cancelEdit').hidden = false;
    tab('new');
  }
  $('#list').addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const w = works[+b.closest('.item').dataset.i], a = b.dataset.a;
    if (a === 'edit') { startEdit(w); return; }
    try {
      if (a === 'toggle') {
        busy('Aggiorno…');
        await updateList(WORKS, l => l.map(x => x.id === w.id ? { ...x, stato: x.stato === 'venduta' ? 'disponibile' : 'venduta' } : x), 'Stato: ' + w.titolo);
        done('Fatto', 'Il sito si aggiorna tra un paio di minuti.');
      } else if (a === 'up' || a === 'down') {
        busy('Sposto…'); await updateList(WORKS, l => swap(l, w.id, a), 'Ordine opere'); idle();
      } else if (a === 'del') {
        if (!confirm(`Eliminare “${w.titolo}” dal sito? Non si può annullare.`)) return;
        busy('Elimino…');
        await updateList(WORKS, l => l.filter(x => x.id !== w.id), 'Elimino: ' + w.titolo);
        for (const p of [w.img, w.thumb]) if (p) await deleteFile(p, 'Elimino foto: ' + w.titolo).catch(() => {});
        done('Eliminata', 'Il sito si aggiorna tra un paio di minuti.');
      }
      loadList();
    } catch (err) { fail(err); }
  });

  /* ---------- quaderno ---------- */
  let nbSrc = null, notes = [];
  async function handleNbFile(file) {
    try {
      busy('Apro la foto…'); nbSrc = await decode(file);
      $('#nbPreview').src = scaled(nbSrc, 900).toDataURL('image/jpeg', .85);
      $('#nbEmpty').hidden = true; $('#nbFull').hidden = false; idle();
    } catch (e) { fail(new Error('image')); }
  }
  wireDrop($('#nbDrop'), $('#nbFile'), handleNbFile, () => $('#p-nb').classList.contains('on'));
  $('#nbAdd').onclick = async () => {
    if (!nbSrc) { say('Manca la foto', 'Trascina o scegli la foto della pagina.'); return; }
    try {
      busy('Carico la pagina…', 'Non chiudere la pagina');
      const id = 'pagina-' + Date.now().toString(36);
      const full = scaled(nbSrc, 2000), th = scaled(full, 700);
      const fp = `quaderno/${id}.jpg`, tp = `quaderno/${id}-s.jpg`;
      await putFile(fp, await blobB64(await toBlob(full, .85)), 'Quaderno: nuova pagina');
      await putFile(tp, await blobB64(await toBlob(th, .8)), 'Quaderno: miniatura');
      const nota = $('#nb-nota').value.trim(), nota_en = $('#nb-nota-en').value.trim();
      await updateList(NOTES, l => [{ id, img: fp, thumb: tp, w: full.width, h: full.height, nota, nota_en }, ...l], 'Quaderno: nuova pagina');
      nbSrc = null; $('#nb-nota').value = ''; $('#nb-nota-en').value = '';
      $('#nbEmpty').hidden = false; $('#nbFull').hidden = true;
      done('Aggiunta al quaderno', 'Sarà visibile sul sito tra un paio di minuti.');
      loadNotes();
    } catch (e) { fail(e); }
  };
  async function loadNotes() {
    const box = $('#nbList');
    try {
      notes = (await getJSON(NOTES, [])).data || [];
      if (!notes.length) { box.innerHTML = '<p class="note">Il quaderno è vuoto: sul sito la sezione resta nascosta finché non aggiungi una pagina.</p>'; return; }
      box.innerHTML = notes.map((n, i) => `
        <div class="item nb" data-i="${i}">
          ${thumbImg(n)}
          <div>
            <h3>${esc(n.nota || 'pagina senza nota')}</h3>
            <div class="acts">${moveBtns(i, notes.length)}<button data-a="del" class="del">Elimina</button></div>
          </div>
        </div>`).join('');
    } catch (e) { box.innerHTML = '<p class="note">Non riesco a caricare il quaderno. Controlla la connessione.</p>'; }
  }
  $('#nbList').addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const n = notes[+b.closest('.item').dataset.i], a = b.dataset.a;
    try {
      if (a === 'up' || a === 'down') { busy('Sposto…'); await updateList(NOTES, l => swap(l, n.id, a), 'Ordine quaderno'); idle(); }
      else if (a === 'del') {
        if (!confirm('Togliere questa pagina dal quaderno? Non si può annullare.')) return;
        busy('Elimino…');
        await updateList(NOTES, l => l.filter(x => x.id !== n.id), 'Quaderno: elimino pagina');
        for (const p of [n.img, n.thumb]) if (p) await deleteFile(p, 'Quaderno: elimino foto').catch(() => {});
        done('Eliminata', 'Il sito si aggiorna tra un paio di minuti.');
      }
      loadNotes();
    } catch (err) { fail(err); }
  });

  /* ---------- bio ---------- */
  const B = { manifesto_it: '#m-it', manifesto_en: '#m-en', bio_it: '#b-it', bio_en: '#b-en', instagram: '#b-ig', email: '#b-mail', whatsapp: '#b-wa' };
  async function loadBio() {
    try { const { data } = await getJSON('data/sito.json', {}); for (const k in B) $(B[k]).value = data[k] || ''; } catch (e) {}
  }
  $('#saveBio').onclick = async () => {
    try {
      busy('Salvo…');
      const { data, sha } = await getJSON('data/sito.json', {});
      for (const k in B) { let v = $(B[k]).value.trim(); if (k === 'instagram') v = v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?].*$/, ''); data[k] = v; }
      await putJSON('data/sito.json', data, 'Bio e contatti', sha);
      done('Salvato', 'Il sito si aggiorna tra un paio di minuti.');
    } catch (e) { fail(e); }
  };

  /* ---------- entra da un altro telefono ---------- */
  $('#shareKey').onclick = async () => {
    const link = location.origin + location.pathname + '#chiave=' + encodeURIComponent(TOKEN) + '&repo=' + encodeURIComponent(REPO);
    try {
      if (navigator.share) { await navigator.share({ title: 'studio sunshyray', url: link }); return; }
      await navigator.clipboard.writeText(link);
      done('Link copiato', 'Mandalo solo a lei (o a te stesso) e poi cancella il messaggio.');
    } catch (e) { if (e.name !== 'AbortError') { $('#shareOut').hidden = false; $('#shareOut').value = link; $('#shareOut').select(); } }
  };

  addEventListener('hashchange', () => { if (location.hash.includes('chiave=')) location.reload(); });
  boot();
})();
