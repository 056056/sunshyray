(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* ---------- spiral icons ---------- */
  const spiral = (turns) => { const max = turns * Math.PI * 2, b = 90 / max; let d = ''; for (let a = 0; a <= max; a += .12) { const r = b * a; d += (a ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); } return d; };
  $('#spD').setAttribute('d', spiral(3)); $('#spO').setAttribute('d', spiral(4));

  /* ---------- storage ---------- */
  const store = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- repo detection ---------- */
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

  /* ---------- GitHub API ---------- */
  async function api(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${REPO}${path ? "/" + path : ""}`, {
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
  function putFile(path, base64, message, sha) {
    return api('contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }) });
  }
  const putJSON = (path, data, msg, sha) => putFile(path, b64encode(JSON.stringify(data, null, 1) + '\n'), msg, sha);
  async function deleteFile(path, message) {
    try { const f = await api('contents/' + path); await api('contents/' + path, { method: 'DELETE', body: JSON.stringify({ message, sha: f.sha }) }); } catch (e) { if (e.status !== 404) throw e; }
  }
  // save the JSON, retrying once if somebody changed it in the meantime
  async function updateWorks(mutator, msg) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, sha } = await getJSON('data/opere.json', []);
      const next = mutator(data);
      try { await putJSON('data/opere.json', next, msg, sha); return next; }
      catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
    }
    throw new Error('conflict');
  }

  /* ---------- overlay ---------- */
  const ov = $('#ov');
  function busy(msg, sub = '') { ov.className = 'ov on'; $('#ovMsg').textContent = msg; $('#ovSub').textContent = sub; }
  function done(msg, sub = '') { ov.className = 'ov on done'; $('#ovMsg').textContent = msg; $('#ovSub').textContent = sub; }
  function fail(e) {
    console.error(e);
    ov.className = 'ov on fail';
    $('#ovMsg').textContent = 'Qualcosa non ha funzionato';
    $('#ovSub').textContent = e.status === 401 ? 'La chiave di accesso non è più valida. Premi "esci" e inseriscine una nuova.'
      : (e.message === 'image' ? 'Questa foto non si riesce ad aprire. Prova con una foto JPG o PNG.'
      : 'Controlla la connessione e riprova. (' + (e.detail || e.message) + ')');
  }
  $('#ovBtn').onclick = () => { ov.className = 'ov'; };

  /* ---------- login ---------- */
  async function tryLogin() {
    const r = await api('');
    if (!r.permissions || !r.permissions.push) { const e = new Error('nopush'); e.status = 403; throw e; }
  }
  async function boot() {
    if (!REPO) $('#repoField').hidden = false;
    if (!TOKEN || !REPO) { $('#login').hidden = false; return; }
    try { busy('Apro lo studio…'); await tryLogin(); ov.className = 'ov'; showApp(); }
    catch (e) { ov.className = 'ov'; $('#login').hidden = false; $('#loginErr').textContent = 'La chiave salvata non funziona più: inseriscine una nuova.'; }
  }
  $('#loginBtn').onclick = async () => {
    TOKEN = $('#tok').value.trim();
    if (!REPO) REPO = $('#repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    $('#loginErr').textContent = '';
    if (!TOKEN || !REPO) { $('#loginErr').textContent = 'Compila tutti i campi.'; return; }
    try {
      busy('Controllo la chiave…'); await tryLogin();
      store.set('ss_token', TOKEN); store.set('ss_repo', REPO);
      ov.className = 'ov'; $('#login').hidden = true; showApp();
    } catch (e) {
      ov.className = 'ov';
      $('#loginErr').textContent = e.status === 404 ? 'Repository non trovato, oppure la chiave non ha accesso a questo repository.' : e.status === 401 ? 'Chiave non valida.' : e.status === 403 ? 'La chiave non ha il permesso di scrittura (Contents: Read and write).' : 'Errore di connessione.';
    }
  };
  $('#logout').onclick = () => { if (confirm('Vuoi uscire? Dovrai reinserire la chiave.')) { store.del('ss_token'); location.reload(); } };

  function showApp() { $('#app').hidden = false; $('#logout').hidden = false; loadList(); loadBio(); }

  /* ---------- tabs ---------- */
  function tab(name) {
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === name));
    $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + name));
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.tabs button').forEach(b => b.onclick = () => { if (b.dataset.t === 'new' && editing) resetForm(); tab(b.dataset.t); if (b.dataset.t === 'list') loadList(); });

  /* ---------- image handling ---------- */
  let photo = null; // {full: Blob, thumb: Blob, w, h}
  const drop = $('#drop'), fileIn = $('#file');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  fileIn.addEventListener('change', () => { if (fileIn.files[0]) handleFile(fileIn.files[0]); });
  // also allow dropping anywhere on the page
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); if ($('#p-new').classList.contains('on') && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  async function decode(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = URL.createObjectURL(file); });
    }
  }
  function resize(img, max, q) {
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * s), h = Math.round(img.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    return new Promise(r => c.toBlob(b => r({ blob: b, w, h }), 'image/jpeg', q));
  }
  async function handleFile(file) {
    try {
      busy('Preparo la foto…');
      const img = await decode(file);
      const full = await resize(img, 2200, .86);
      const thumb = await resize(img, 900, .8);
      photo = { full: full.blob, thumb: thumb.blob, w: full.w, h: full.h };
      $('#preview').src = URL.createObjectURL(full.blob);
      $('#dropEmpty').hidden = true; $('#dropFull').hidden = false;
      ov.className = 'ov';
      $('#f-titolo').focus({ preventScroll: true });
    } catch (e) { fail(new Error('image')); }
  }
  const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const slug = s => (s || 'opera').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'opera';

  /* ---------- form ---------- */
  let editing = null; // id of work being edited
  const F = { titolo: '#f-titolo', descrizione: '#f-desc', anno: '#f-anno', prezzo: '#f-prezzo', tecnica: '#f-tecnica', dimensioni: '#f-dim', tema: '#f-tema', tema_en: '#f-tema-en', titolo_en: '#f-titolo-en', descrizione_en: '#f-desc-en', tecnica_en: '#f-tecnica-en' };
  function readForm() {
    const o = {}; for (const k in F) o[k] = $(F[k]).value.trim();
    o.stato = document.querySelector('input[name=stato]:checked').value;
    return o;
  }
  function resetForm() {
    editing = null; photo = null;
    for (const k in F) $(F[k]).value = '';
    $('input[name=stato][value=disponibile]').checked = true;
    $('#dropEmpty').hidden = false; $('#dropFull').hidden = true; fileIn.value = '';
    $('#formTitle').textContent = 'Nuova opera';
    $('#formLead').textContent = 'Trascina qui la foto del quadro (o toccala per sceglierla), scrivi due righe e premi Pubblica.';
    $('#publish').textContent = 'Pubblica'; $('#cancelEdit').hidden = true;
  }
  $('#cancelEdit').onclick = () => { resetForm(); tab('list'); };

  $('#publish').onclick = async () => {
    const data = readForm();
    if (!editing && !photo) { busy(''); fail({ message: 'x', detail: 'manca la foto' }); $('#ovMsg').textContent = 'Manca la foto'; $('#ovSub').textContent = 'Trascina o scegli la foto del quadro.'; return; }
    if (!data.titolo) { $('#f-titolo').focus(); $('#f-titolo').style.borderColor = 'var(--red)'; setTimeout(() => $('#f-titolo').style.borderColor = '', 1500); return; }
    try {
      let imgFields = {};
      const id = editing || (slug(data.titolo) + '-' + Date.now().toString(36));
      if (photo) {
        const v = editing ? '-' + Date.now().toString(36) : '';
        const full = `opere/${id}${v}.jpg`, thumb = `opere/${id}${v}-s.jpg`;
        busy('Carico la foto…', 'Non chiudere la pagina');
        await putFile(full, await blobB64(photo.full), `Foto: ${data.titolo}`);
        busy('Quasi fatto…', 'Non chiudere la pagina');
        await putFile(thumb, await blobB64(photo.thumb), `Miniatura: ${data.titolo}`);
        imgFields = { img: full, thumb, w: photo.w, h: photo.h };
      } else busy('Salvo…');
      let oldImgs = null;
      await updateWorks(list => {
        if (editing) {
          const i = list.findIndex(w => w.id === editing);
          if (i > -1) { if (photo) oldImgs = [list[i].img, list[i].thumb]; list[i] = { ...list[i], ...data, ...imgFields }; }
          return list;
        }
        return [{ id, ...imgFields, ...data }, ...list];
      }, (editing ? 'Modifica: ' : 'Nuova opera: ') + data.titolo);
      if (oldImgs) for (const p of oldImgs) if (p) await deleteFile(p, 'Rimuovo vecchia foto').catch(() => {});
      done(editing ? 'Modifiche salvate' : 'Pubblicata!', 'Sarà visibile sul sito tra un paio di minuti.');
      resetForm(); loadList();
    } catch (e) { fail(e); }
  };

  /* ---------- list ---------- */
  let works = [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rawUrl = p => `https://raw.githubusercontent.com/${REPO}/HEAD/${p}`;
  async function loadList() {
    const box = $('#list');
    try {
      works = (await getJSON('data/opere.json', [])).data;
      if (!works.length) { box.innerHTML = '<p class="note">Ancora nessuna opera. Aggiungine una dalla scheda “＋ Nuova”.</p>'; return; }
      box.innerHTML = works.map((w, i) => `
        <div class="item" data-i="${i}">
          <img src="${esc(rawUrl(w.thumb || w.img))}" alt="" loading="lazy" onerror="this.src='${esc(w.thumb || w.img)}'">
          <div>
            <h3>${esc(w.titolo)}</h3>
            <div class="m"><span class="pill-s ${w.stato === 'venduta' ? 'sold' : ''}">${w.stato === 'venduta' ? 'Venduta' : 'Disponibile'}</span>${w.prezzo ? ' · ' + esc(w.prezzo) : ''}</div>
            <div class="acts">
              <button data-a="edit">Modifica</button>
              <button data-a="toggle">${w.stato === 'venduta' ? 'Segna disponibile' : 'Segna venduta'}</button>
              <button data-a="up" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>↑</button>
              <button data-a="down" ${i === works.length - 1 ? 'disabled style="opacity:.3"' : ''}>↓</button>
              <button data-a="del" class="del">Elimina</button>
            </div>
          </div>
        </div>`).join('');
    } catch (e) { box.innerHTML = '<p class="note">Non riesco a caricare le opere. Controlla la connessione.</p>'; }
  }
  $('#list').addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const w = works[+b.closest('.item').dataset.i]; const a = b.dataset.a;
    if (a === 'edit') {
      editing = w.id; photo = null;
      for (const k in F) $(F[k]).value = w[k] || '';
      $(`input[name=stato][value=${w.stato === 'venduta' ? 'venduta' : 'disponibile'}]`).checked = true;
      $('#preview').src = rawUrl(w.img); $('#dropEmpty').hidden = true; $('#dropFull').hidden = false;
      $('#formTitle').textContent = 'Modifica opera';
      $('#formLead').textContent = 'Cambia quello che vuoi. Se non tocchi la foto, resta quella di prima.';
      $('#publish').textContent = 'Salva modifiche'; $('#cancelEdit').hidden = false;
      tab('new'); return;
    }
    try {
      if (a === 'toggle') {
        busy('Aggiorno…');
        await updateWorks(l => l.map(x => x.id === w.id ? { ...x, stato: x.stato === 'venduta' ? 'disponibile' : 'venduta' } : x), 'Stato: ' + w.titolo);
        done('Fatto', 'Il sito si aggiorna tra un paio di minuti.');
      } else if (a === 'up' || a === 'down') {
        busy('Sposto…');
        await updateWorks(l => { const i = l.findIndex(x => x.id === w.id), j = i + (a === 'up' ? -1 : 1); if (i > -1 && j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]]; return l; }, 'Ordine opere');
        ov.className = 'ov';
      } else if (a === 'del') {
        if (!confirm(`Eliminare “${w.titolo}” dal sito? Non si può annullare.`)) return;
        busy('Elimino…');
        await updateWorks(l => l.filter(x => x.id !== w.id), 'Elimino: ' + w.titolo);
        for (const p of [w.img, w.thumb]) if (p) await deleteFile(p, 'Elimino foto: ' + w.titolo).catch(() => {});
        done('Eliminata', 'Il sito si aggiorna tra un paio di minuti.');
      }
      loadList();
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
      for (const k in B) data[k] = $(B[k]).value.trim().replace(k === 'instagram' ? /^@/ : /^$/, '');
      await putJSON('data/sito.json', data, 'Bio e contatti', sha);
      done('Salvato', 'Il sito si aggiorna tra un paio di minuti.');
    } catch (e) { fail(e); }
  };

  boot();
})();
