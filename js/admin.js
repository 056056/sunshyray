(() => {
  'use strict';
  // lo studio non si apre dentro pagine altrui (protezione dal "clickjacking")
  if (window.top !== window.self) { document.body.innerHTML = ''; try { window.top.location = window.self.location.href; } catch (e) {} return; }
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
  // dopo l'ingresso con la password il telefono resta dentro per 14 giorni, poi la richiede
  const SESSION_DAYS = 14;
  if (+store.get('ss_exp') < Date.now()) { store.del('ss_token'); store.del('ss_exp'); }
  let TOKEN = store.get('ss_token');
  const remember = () => { store.set('ss_token', TOKEN); store.set('ss_exp', String(Date.now() + SESSION_DAYS * 864e5)); };

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
      e.status === 401 ? 'La chiave di GitHub è scaduta. Premi "esci", poi "Prima volta, o password dimenticata?" e mettine una nuova.'
      : e.message === 'image' ? 'Questa foto non si riesce ad aprire. Prova con una foto JPG o PNG.'
      : 'Controlla la connessione e riprova. (' + (e.detail || e.message) + ')');
  }
  $('#ovBtn').onclick = idle;

  /* ---------- accesso con password ----------
     La chiave di GitHub viene salvata nel repo dentro data/chiave.json,
     chiusa con la password (PBKDF2 + AES-GCM): senza password è illeggibile. */
  const KEYFILE = 'data/chiave.json';
  const te = new TextEncoder();
  const toB64 = u8 => btoa(String.fromCharCode(...u8));
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function derive(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function lock(token, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 1000000;
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await derive(pw, salt, iter), te.encode(token)));
    return { v: 1, iter, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
  }
  async function unlock(box, pw) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, await derive(pw, fromB64(box.salt), box.iter), fromB64(box.data));
    return new TextDecoder().decode(pt);
  }
  async function fetchBox() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${KEYFILE}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github.raw+json' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (e) {}
    try { const r = await fetch('../' + KEYFILE + '?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
    return null;
  }
  async function saveBox(pw) {
    const box = await lock(TOKEN, pw);
    const { sha } = await getJSON(KEYFILE, null);
    await putJSON(KEYFILE, box, 'Password dello studio', sha);
    return box;
  }
  const pwProblem = (a, b) => a.length < 10 ? 'La password deve avere almeno 10 caratteri.' : a !== b ? 'Le due password non sono uguali.' : '';

  async function tryLogin() {
    const r = await api('');
    if (!r.permissions || !r.permissions.push) { const e = new Error('nopush'); e.status = 403; throw e; }
  }
  let box = null;
  function showSetup(on) { $('#setupBox').hidden = !on; $('#pwBox').hidden = on; $('#loginErr').textContent = $('#setupErr').textContent = ''; (on ? $('#tok') : $('#pw')).focus(); }
  $('#toSetup').onclick = () => showSetup(true);
  $('#toPw').onclick = () => showSetup(false);
  async function boot() {
    if (!REPO) $('#repoField').hidden = false;
    if (TOKEN && REPO) {
      try { busy('Apro lo studio…'); await tryLogin(); idle(); showApp(); return; }
      catch (e) { idle(); TOKEN = ''; store.del('ss_token'); store.del('ss_exp'); }
    }
    $('#login').hidden = false;
    box = REPO ? await fetchBox() : null;
    showSetup(!box);
  }
  async function enter() {
    const pw = $('#pw').value;
    $('#loginErr').textContent = '';
    if (!pw) { $('#pw').focus(); return; }
    if (!box) box = await fetchBox();
    if (!box) { showSetup(true); $('#setupErr').textContent = 'Non c\'è ancora nessuna password: creala qui sotto.'; return; }
    busy('Apro lo studio…');
    try { TOKEN = await unlock(box, pw); }
    catch (e) { idle(); $('#loginErr').textContent = 'Password sbagliata. Riprova.'; $('#pw').select(); return; }
    try {
      await tryLogin();
      remember(); store.set('ss_repo', REPO);
      idle(); $('#login').hidden = true; $('#pw').value = ''; showApp();
    } catch (e) {
      idle(); TOKEN = '';
      $('#loginErr').textContent = e.status === 401 || e.status === 403 || e.status === 404
        ? 'La password è giusta, ma la chiave di GitHub è scaduta. Tocca “Prima volta, o password dimenticata?” e mettine una nuova.'
        : 'Errore di connessione. Riprova.';
    }
  }
  $('#loginBtn').onclick = enter;
  $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });
  $('#setupBtn').onclick = async () => {
    const tok = $('#tok').value.trim(), p1 = $('#np1').value, p2 = $('#np2').value;
    if (!REPO) REPO = $('#repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const err = $('#setupErr'); err.textContent = '';
    if (!tok || !REPO) { err.textContent = 'Incolla la chiave di GitHub.'; return; }
    const pp = pwProblem(p1, p2); if (pp) { err.textContent = pp; return; }
    TOKEN = tok;
    try { busy('Controllo la chiave…'); await tryLogin(); }
    catch (e) {
      idle(); TOKEN = '';
      err.textContent = e.status === 404 ? 'Repository non trovato, oppure la chiave non ha accesso a questo repository.' : e.status === 401 ? 'Chiave non valida.' : e.status === 403 ? 'La chiave non ha il permesso di scrittura (Contents: Read and write).' : 'Errore di connessione.';
      return;
    }
    try {
      busy('Salvo la password…'); box = await saveBox(p1);
      remember(); store.set('ss_repo', REPO);
      ['#tok', '#np1', '#np2'].forEach(s => $(s).value = '');
      $('#login').hidden = true; showApp();
      done('Fatto!', 'Da ora, su qualsiasi telefono, per entrare nello studio basta la password.');
    } catch (e) { fail(e); }
  };
  $('#logout').onclick = () => { if (confirm('Vuoi uscire? Per rientrare ti servirà la password.')) { store.del('ss_token'); store.del('ss_exp'); location.reload(); } };
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
  function wireDrop(zone, inputs, onFile, isActive) {
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', e => { e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) onFile(f); });
    inputs.forEach(input => input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); input.value = ''; }));
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

  /* ---------- trova da solo il quadro nella foto ----------
     1) dal bordo della foto ricavo com'è il muro, compresa la luce che cambia
        (una superficie liscia: chiaro da una parte, più scuro dall'altra);
     2) tutto ciò che si discosta dal muro è "quadro";
     3) tengo la macchia più grande al centro e prendo i suoi 4 angoli estremi.
     Prima provo una soglia severa (angoli precisissimi), poi una più morbida.
     Se il risultato non sembra un quadro, restituisco null (pallini a mano). */
  function solve(A, y) { // sistema lineare piccolo (eliminazione di Gauss)
    const n = y.length, M = A.map((r, i) => [...r, y[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return null;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function detectQuad(img) {
    const cv = scaled(img, 360), w = cv.width, h = cv.height, N = w * h;
    const d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const bw = Math.max(3, Math.round(Math.min(w, h) * .04));
    const feat = (x, y) => { const X = x / w - .5, Y = y / h - .5; return [1, X, Y, X * X, Y * Y, X * Y]; };
    // muro: superficie di secondo grado per ogni colore, stimata sul bordo
    const AtA = Array.from({ length: 6 }, () => new Array(6).fill(0)), Aty = [0, 1, 2].map(() => new Array(6).fill(0));
    const border = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= bw && x < w - bw && y >= bw && y < h - bw) continue;
      const f = feat(x, y), i = (y * w + x) * 4; border.push(i);
      for (let r = 0; r < 6; r++) { for (let c = 0; c < 6; c++) AtA[r][c] += f[r] * f[c]; for (let k = 0; k < 3; k++) Aty[k][r] += f[r] * d[i + k]; }
    }
    const coef = Aty.map(v => solve(AtA, v)); if (coef.some(c => !c)) return null;
    const D = new Float32Array(N), hist = new Uint32Array(256);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const f = feat(x, y), p = y * w + x, i = p * 4; let s2 = 0;
      for (let k = 0; k < 3; k++) { let m = 0; for (let r = 0; r < 6; r++) m += coef[k][r] * f[r]; s2 += (d[i + k] - m) ** 2; }
      const v = Math.min(255, Math.sqrt(s2)); D[p] = v; hist[v | 0]++;
    }
    const bres = border.map(i => D[i / 4]).sort((a, b) => a - b), noise = bres[bres.length >> 1];
    if (noise > 30) return null;                                // muro troppo vario: non indovino
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let wB = 0, sB = 0, best = 0, otsu = 40;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; const wF = N - wB; if (!wF) break;
      sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, bt = wB * wF * (mB - mF) ** 2;
      if (bt > best) { best = bt; otsu = t; }
    }
    const strict = Math.max(otsu, noise * 2.6 + 12, 22), soft = Math.min(otsu, Math.max(noise * 3.4 + 14, 24));
    return quadAt(strict) || (soft < strict ? quadAt(soft) : null);

    function quadAt(thr) {
      const lab = new Int32Array(N), stack = new Int32Array(N); let L = 0, bestL = 0, bestScore = 0;
      for (let p0 = 0; p0 < N; p0++) {
        if (D[p0] <= thr || lab[p0]) continue;
        L++; let sp = 0, n = 0, central = 0; stack[sp++] = p0; lab[p0] = L;
        while (sp) {
          const p = stack[--sp]; n++;
          const x = p % w, y = (p / w) | 0;
          if (Math.abs(x - w / 2) < w * .2 && Math.abs(y - h / 2) < h * .2) central++;
          if (x > 0 && D[p - 1] > thr && !lab[p - 1]) { lab[p - 1] = L; stack[sp++] = p - 1; }
          if (x < w - 1 && D[p + 1] > thr && !lab[p + 1]) { lab[p + 1] = L; stack[sp++] = p + 1; }
          if (y > 0 && D[p - w] > thr && !lab[p - w]) { lab[p - w] = L; stack[sp++] = p - w; }
          if (y < h - 1 && D[p + w] > thr && !lab[p + w]) { lab[p + w] = L; stack[sp++] = p + w; }
        }
        const score = n * (central ? 3 : 1);
        if (score > bestScore) { bestScore = score; bestL = L; }
      }
      if (!bestL) return null;
      let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity], area = 0;
      for (let p = 0; p < N; p++) {
        if (lab[p] !== bestL) continue; area++;
        const x = p % w + .5, y = ((p / w) | 0) + .5, s = x + y, df = x - y;
        if (s < tl[2]) tl = [x, y, s]; if (s > br[2]) br = [x, y, s];
        if (df > tr[2]) tr = [x, y, df]; if (df < bl[2]) bl = [x, y, df];
      }
      const poly = [tl, tr, br, bl].map(([x, y]) => [x, y]);
      let A2 = 0; for (let i = 0; i < 4; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 4]; A2 += x1 * y2 - x2 * y1; }
      const qa = Math.abs(A2) / 2;
      if (qa < N * .06 || qa > N * .97 || area < qa * .6) return null;     // troppo piccolo, troppo grande o "bucato"
      for (let i = 0; i < 4; i++) {
        const a = poly[i], b = poly[(i + 1) % 4], c = poly[(i + 2) % 4];
        if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) <= 0) return null;
        if (dist(a, b) < Math.min(w, h) * .12) return null;
      }
      return poly.map(([x, y]) => ({ x: x / w, y: y / h }));
    }
  }

  /* ---------- editor dei 4 angoli ---------- */
  let src = null;        // foto originale aperta
  let corners = null;    // 4 angoli scelti (0..1), oppure null = foto intera
  let photoReady = false;
  const stage = $('#stage');
  const defaultCorners = () => [{ x: .06, y: .06 }, { x: .94, y: .06 }, { x: .94, y: .94 }, { x: .06, y: .94 }];
  function drawCrop() {
    $$('.hdl:not(.hdl--m)').forEach((h, k) => { h.style.left = (corners[k].x * 100) + '%'; h.style.top = (corners[k].y * 100) + '%'; });
    $$('.hdl--m').forEach(h => { const [a, b] = SIDES[+h.dataset.s]; h.style.left = ((corners[a].x + corners[b].x) * 50) + '%'; h.style.top = ((corners[a].y + corners[b].y) * 50) + '%'; });
    const pts = corners.map(p => `${p.x},${p.y}`).join(' ');
    $('#cropPoly').setAttribute('points', pts);
    $('#cropShade').setAttribute('d', `M0 0H1V1H0Z M${corners.map(p => `${p.x} ${p.y}`).join(' L')}Z`);
  }
  // lente d'ingrandimento sopra il dito
  let cropC = null; const loupe = $('#loupe'), lx = loupe.getContext('2d');
  function showLoupe(k, ev) {
    if (!cropC) return;
    const z = 4, S = 240, p = corners[k], sx = p.x * cropC.width, sy = p.y * cropC.height, half = S / (2 * z) * (cropC.width / stage.getBoundingClientRect().width);
    lx.fillStyle = '#000'; lx.fillRect(0, 0, S, S);
    lx.drawImage(cropC, sx - half, sy - half, half * 2, half * 2, 0, 0, S, S);
    lx.strokeStyle = '#fff'; lx.lineWidth = 2; lx.beginPath(); lx.moveTo(S / 2, S / 2 - 22); lx.lineTo(S / 2, S / 2 + 22); lx.moveTo(S / 2 - 22, S / 2); lx.lineTo(S / 2 + 22, S / 2); lx.stroke();
    lx.strokeStyle = '#b0241c'; lx.lineWidth = 1; lx.beginPath(); lx.arc(S / 2, S / 2, 5, 0, 7); lx.stroke();
    const up = ev.clientY - 150 > 8;
    loupe.style.left = Math.min(innerWidth - 128, Math.max(8, ev.clientX - 60)) + 'px';
    loupe.style.top = (up ? ev.clientY - 150 : ev.clientY + 40) + 'px';
    loupe.hidden = false;
  }
  $$('.hdl:not(.hdl--m)').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const k = +h.dataset.k;
      showLoupe(k, e);
      const move = ev => {
        const r = stage.getBoundingClientRect();
        corners[k] = { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
        drawCrop(); showLoupe(k, ev);
      };
      const up = () => { loupe.hidden = true; h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  });
  // maniglie a metà dei lati: spostano un lato intero
  const SIDES = [[0, 1], [1, 2], [2, 3], [3, 0]];
  $$('.hdl--m').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const [a, b] = SIDES[+h.dataset.s], r0 = stage.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY }, A0 = { ...corners[a] }, B0 = { ...corners[b] };
      const cl = v => Math.min(1, Math.max(0, v));
      const move = ev => {
        const dx = (ev.clientX - start.x) / r0.width, dy = (ev.clientY - start.y) / r0.height;
        corners[a] = { x: cl(A0.x + dx), y: cl(A0.y + dy) }; corners[b] = { x: cl(B0.x + dx), y: cl(B0.y + dy) };
        drawCrop();
      };
      const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
  });
  let found = null;
  function openCrop(keep) {
    if (!keep || !corners) {
      try { found = detectQuad(src); } catch (e) { found = null; }
      corners = found ? found.map(p => ({ ...p })) : defaultCorners();
    }
    const tip = $('#cropTip'); tip.classList.toggle('found', !!found);
    tip.innerHTML = found
      ? '<b>Ho trovato il quadro ✓</b> Controlla che i 4 pallini rossi siano proprio sugli angoli della tela (tenendoli premuti li vedi da vicino). I pallini bianchi spostano un lato intero. Poi premi <b>Raddrizza</b>.'
      : '<b>Trascina i 4 pallini rossi sugli angoli del quadro</b> (tenendoli premuti li vedi da vicino). I pallini bianchi spostano un lato intero. Così la foto diventa dritta, senza muro intorno.';
    cropC = scaled(src, 1600);
    $('#cropImg').src = cropC.toDataURL('image/jpeg', .85);
    $('#crop').hidden = false; $('#drop').hidden = true; $('#recrop').hidden = true;
    drawCrop();
    $('#crop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  /* ---------- ritocchi ----------
     Forma e margini cambiano i 4 angoli (poi la foto viene raddrizzata di nuovo);
     inclinazione, luce e colore si applicano dopo. La stessa funzione disegna
     l'anteprima e la foto finale: quello che si vede sulla tela finta è quello
     che viene pubblicato. */
  const TUNE = [
    ['g', 'Forma'],
    ['rot', 'Inclinazione', -10, 10, .1, '°', 'gira la foto per raddrizzarla'],
    ['kv', 'Prospettiva alto / basso', -15, 15, .5, '', 'se la tela sembra più stretta sopra o sotto'],
    ['kh', 'Prospettiva sinistra / destra', -15, 15, .5, '', 'se un lato sembra più corto dell\'altro'],
    ['g', 'Margini  ( − allarga · + stringe )'],
    ['top', 'Sopra', -6, 15, .2, '%'], ['bottom', 'Sotto', -6, 15, .2, '%'],
    ['left', 'Sinistra', -6, 15, .2, '%'], ['right', 'Destra', -6, 15, .2, '%'],
    ['g', 'Colore'],
    ['light', 'Luce', -50, 50, 1, ''], ['contrast', 'Contrasto', -50, 60, 1, ''],
    ['sat', 'Saturazione', -60, 60, 1, '', 'colori più vivi o più spenti'],
    ['warm', 'Calore', -40, 40, 1, '', '− più freddo · + più caldo'],
    ['sharp', 'Nitidezza', 0, 100, 1, '', 'dettagli e pennellate più definiti']
  ];
  const GEO = ['kv', 'kh', 'top', 'bottom', 'left', 'right'];
  const T0 = Object.fromEntries(TUNE.filter(r => r[0] !== 'g').map(r => [r[0], 0]));
  let T = { ...T0 }, base = null, tuneRaf = 0, geoDirty = false, gridLock = false, gridTimer = 0;
  $('#tuneRows').innerHTML = TUNE.map(r => r[0] === 'g' ? `<p class="tg">${r[1]}</p>` : `
    <div class="sl" data-k="${r[0]}">
      <div class="slh"><span>${r[1]}${r[6] ? `<small>${r[6]}</small>` : ''}</span><output data-o="${r[0]}" title="tocca per azzerare">0${r[5]}</output></div>
      <div class="slc"><button type="button" data-d="-1" aria-label="meno">−</button><input type="range" data-k="${r[0]}" min="${r[2]}" max="${r[3]}" step="${r[4]}" value="0" aria-label="${r[1]}"><button type="button" data-d="1" aria-label="più">+</button></div>
    </div>`).join('');
  const rowOf = k => TUNE.find(x => x[0] === k);
  const fmt = (k, v) => { const r = rowOf(k); return (v > 0 && r[2] < 0 ? '+' : '') + (+v).toFixed(r[4] < 1 ? 1 : 0).replace(/\.0$/, '') + r[5]; };
  function showVal(k) { const o = $(`output[data-o="${k}"]`); o.textContent = fmt(k, T[k]); o.classList.toggle('chg', T[k] !== 0); }
  function syncTune() { $$('#tuneRows input').forEach(i => { i.value = T[i.dataset.k]; showVal(i.dataset.k); }); }
  function flashGrid() { const g = $('#mGrid'); g.classList.add('on'); clearTimeout(gridTimer); if (!gridLock) gridTimer = setTimeout(() => g.classList.remove('on'), 1400); }
  function setT(k, v) {
    const r = rowOf(k); v = Math.min(r[3], Math.max(r[2], Math.round(v / r[4]) * r[4]));
    T[k] = +v.toFixed(2); showVal(k); $(`#tuneRows input[data-k="${k}"]`).value = T[k];
    if (GEO.includes(k)) geoDirty = true;
    if (GEO.includes(k) || k === 'rot') flashGrid();
    cancelAnimationFrame(tuneRaf); tuneRaf = requestAnimationFrame(refreshMock);
  }
  $('#tuneRows').addEventListener('input', e => { const k = e.target.dataset.k; if (k) setT(k, +e.target.value); });
  $('#tuneRows').addEventListener('click', e => {
    const btn = e.target.closest('button[data-d]'), out = e.target.closest('output[data-o]');
    if (btn) { const k = btn.closest('.sl').dataset.k; setT(k, T[k] + rowOf(k)[4] * +btn.dataset.d); }
    if (out) setT(out.dataset.o, 0);
  });
  $('#tuneReset').onclick = () => { const geo = GEO.some(k => T[k]); T = { ...T0 }; syncTune(); if (geo) geoDirty = true; refreshMock(); };
  $('#tuneGrid').onclick = () => { gridLock = !gridLock; $('#tuneGrid').classList.toggle('on', gridLock); $('#mGrid').classList.toggle('on', gridLock); };
  // "com'era": tenendo premuto si vede la foto senza ritocchi
  const before = on => { if (!base) return; $('#preview').src = on ? (base.__plain || (base.__plain = base.toDataURL('image/jpeg', .85))) : lastUrl; };
  let lastUrl = '';
  ['pointerdown'].forEach(ev => $('#tuneBefore').addEventListener(ev, e => { e.preventDefault(); $('#tuneBefore').classList.add('on'); before(true); }));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('#tuneBefore').addEventListener(ev, () => { if ($('#tuneBefore').classList.contains('on')) { $('#tuneBefore').classList.remove('on'); before(false); } }));
  $('#tuneBefore').addEventListener('contextmenu', e => e.preventDefault());
  // luce automatica: porta i toni più scuri e più chiari quasi al nero e al bianco
  $('#tuneAuto').onclick = () => {
    if (!base) return;
    const c = scaled(base, 300), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, h = new Uint32Array(256); let n = 0;
    for (let i = 0; i < d.length; i += 4) { h[Math.round(.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2])]++; n++; }
    const pct = q => { let a = 0; for (let v = 0; v < 256; v++) { a += h[v]; if (a >= n * q) return v; } return 255; };
    const lo = pct(.01), hi = Math.max(pct(.99), lo + 20);
    const bf = 256 / (lo + hi), cf = 235 / ((hi - lo) * bf);
    setT('light', (bf - 1) * 100); setT('contrast', (cf - 1) * 100);
  };

  // angoli effettivi = angoli scelti + margini + prospettiva
  function effCorners(p) {
    const q = (corners || [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]).map(c => [c.x, c.y]);
    const lerp = (P, Q, t) => [(Q[0] - P[0]) * t, (Q[1] - P[1]) * t];
    const add = (P, ...vs) => vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1]], P);
    const t = p.top / 100, b = p.bottom / 100, l = p.left / 100, r = p.right / 100, kv = p.kv / 200, kh = p.kh / 200;
    const [q0, q1, q2, q3] = q;
    const P = [
      add(q0, lerp(q0, q3, t), lerp(q0, q1, l), lerp(q0, q1, kv), lerp(q0, q3, kh)),
      add(q1, lerp(q1, q2, t), lerp(q1, q0, r), lerp(q1, q0, kv), lerp(q1, q2, -kh)),
      add(q2, lerp(q2, q1, b), lerp(q2, q3, r), lerp(q2, q3, -kv), lerp(q2, q1, kh)),
      add(q3, lerp(q3, q0, b), lerp(q3, q2, l), lerp(q3, q2, -kv), lerp(q3, q0, -kh))
    ];
    return P.map(([x, y]) => ({ x, y }));
  }
  const ratioNow = () => corners ? parseDims($('#f-dim').value) : 0;
  function render(img, p) {
    const W = img.width, H = img.height;
    const th = p.rot * Math.PI / 180, co = Math.abs(Math.cos(th)), si = Math.abs(Math.sin(th));
    const zoom = Math.max(co + si * H / W, co + si * W / H);   // niente angoli vuoti dopo l'inclinazione
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const x = out.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.translate(W / 2, H / 2); x.rotate(th); x.scale(zoom, zoom); x.drawImage(img, -W / 2, -H / 2);
    if (p.light || p.contrast || p.warm || p.sat || p.sharp) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      const id = x.getImageData(0, 0, W, H), d = id.data, bf = 1 + p.light / 100, cf = 1 + p.contrast / 100, wk = p.warm * .8, sf = 1 + p.sat / 100;
      for (let i = 0; i < d.length; i += 4) {
        let r = (d[i] * bf - 128) * cf + 128 + wk, g = (d[i + 1] * bf - 128) * cf + 128 + wk * .25, b = (d[i + 2] * bf - 128) * cf + 128 - wk;
        if (sf !== 1) { const y = .299 * r + .587 * g + .114 * b; r = y + (r - y) * sf; g = y + (g - y) * sf; b = y + (b - y) * sf; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
      if (p.sharp) { // maschera di contrasto 3x3, proporzionata alla grandezza della foto
        const amt = p.sharp / 100 * 1.4, src2 = new Uint8ClampedArray(d), w4 = W * 4;
        for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
          const i = yy * w4 + xx * 4;
          for (let k = 0; k < 3; k++) {
            const j = i + k, blur = (src2[j - 4] + src2[j + 4] + src2[j - w4] + src2[j + w4] + src2[j - w4 - 4] + src2[j - w4 + 4] + src2[j + w4 - 4] + src2[j + w4 + 4] + src2[j]) / 9;
            d[j] = src2[j] + (src2[j] - blur) * amt;
          }
        }
      }
      x.putImageData(id, 0, 0);
    }
    return out;
  }
  function makeBase() { base = warp(src, effCorners(T), 1000, ratioNow()); geoDirty = false; }
  function refreshMock() {
    if (!src) return;
    if (geoDirty || !base) makeBase();
    lastUrl = render(base, T).toDataURL('image/jpeg', .85);
    $('#preview').src = lastUrl; $('#mCv').style.setProperty('--img', `url("${lastUrl}")`);
  }
  $('#f-dim').addEventListener('change', () => { if (src) { geoDirty = true; refreshMock(); } });
  // foto finale, alla massima qualità, con gli stessi ritocchi
  const finalImage = () => render(warp(src, effCorners(T), 2200, ratioNow()), T);

  async function showPreview() {
    geoDirty = true; refreshMock(); syncTune();
    $('#tune').hidden = false; $('#retouchOld').hidden = true;
    $('#dropEmpty').hidden = true; $('#dropFull').hidden = false;
    $('#crop').hidden = true; $('#drop').hidden = false; $('#recrop').hidden = !corners && !src;
    photoReady = true;
    $('#drop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#cropOk').onclick = async () => { busy('Raddrizzo la foto…'); await new Promise(r => setTimeout(r, 30)); try { await showPreview(); idle(); } catch (e) { fail(e); } };
  $('#cropSkip').onclick = async () => { corners = null; busy('Preparo la foto…'); await new Promise(r => setTimeout(r, 30)); await showPreview(); idle(); };
  $('#recrop').onclick = () => openCrop(true);

  async function handleFile(file) {
    try { busy('Apro la foto…'); src = await decode(file); T = { ...T0 }; idle(); openCrop(false); }
    catch (e) { fail(new Error('image')); }
  }
  wireDrop($('#drop'), ['#file', '#fileCam', '#file2', '#fileCam2'].map(s => $(s)), handleFile, () => $('#p-new').classList.contains('on'));

  /* ---------- modulo opera ---------- */
  let editing = null;
  const F = { titolo: '#f-titolo', descrizione: '#f-desc', anno: '#f-anno', prezzo: '#f-prezzo', tecnica: '#f-tecnica', dimensioni: '#f-dim', titolo_en: '#f-titolo-en', descrizione_en: '#f-desc-en', tecnica_en: '#f-tecnica-en' };
  function readForm() {
    const o = {}; for (const k in F) o[k] = $(F[k]).value.trim();
    o.stato = document.querySelector('input[name=stato]:checked').value;
    return o;
  }
  function resetForm() {
    editing = null; src = null; corners = null; photoReady = false; base = null; T = { ...T0 }; $('#tune').hidden = true; $('#retouchOld').hidden = true; $('#mCv').style.removeProperty('--img');
    for (const k in F) $(F[k]).value = '';
    $('input[name=stato][value=disponibile]').checked = true;
    $('#dropEmpty').hidden = false; $('#dropFull').hidden = true; $('#drop').hidden = false;
    $('#crop').hidden = true; $('#recrop').hidden = true;
    $('#formTitle').textContent = 'Nuova opera';
    $('#formLead').textContent = 'Fotografa il quadro: gli angoli della tela li trovo io, tu controlli e premi Raddrizza. Poi scrivi due righe e premi Pubblica.';
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
        const full = finalImage();
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
  const thumbImg = it => `<img src="${esc(rawUrl(it.thumb || it.img))}" alt="" loading="lazy" data-fb="../${esc(it.thumb || it.img)}">`;
  document.addEventListener('error', e => { const i = e.target; if (i.tagName === 'IMG' && i.dataset.fb && i.src.indexOf(i.dataset.fb.slice(3)) < 0) { i.src = i.dataset.fb; delete i.dataset.fb; } }, true);
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
    $('#preview').src = rawUrl(w.img); $('#mCv').style.setProperty('--img', `url("${rawUrl(w.thumb || w.img)}")`); $('#dropEmpty').hidden = true; $('#dropFull').hidden = false;
    $('#formTitle').textContent = 'Modifica opera';
    $('#formLead').textContent = 'Cambia quello che vuoi. Se non tocchi la foto, resta quella di prima.';
    $('#publish').textContent = 'Salva modifiche'; $('#cancelEdit').hidden = false;
    $('#retouchOld').hidden = false; $('#retouchOld').dataset.img = w.img;
    tab('new');
  }
  $('#retouchOld').onclick = async () => {
    const p = $('#retouchOld').dataset.img;
    try {
      busy('Apro la foto…');
      let r = await fetch('../' + p, { cache: 'no-store' }).catch(() => null);
      if (!r || !r.ok) r = await fetch(rawUrl(p), { cache: 'no-store' });
      if (!r.ok) throw new Error('image');
      src = await decode(await r.blob()); corners = null; T = { ...T0 };
      await showPreview(); idle();
    } catch (e) { fail(new Error('image')); }
  };
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
  wireDrop($('#nbDrop'), ['#nbFile', '#nbCam', '#nbFile2', '#nbCam2'].map(s => $(s)), handleNbFile, () => $('#p-nb').classList.contains('on'));
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

  /* ---------- cambia password ---------- */
  $('#chPw').onclick = async () => {
    const p1 = $('#cp1').value, p2 = $('#cp2').value, pp = pwProblem(p1, p2);
    if (pp) { say('Controlla la password', pp); return; }
    try {
      busy('Cambio la password…'); box = await saveBox(p1);
      $('#cp1').value = $('#cp2').value = '';
      done('Password cambiata', 'Da ora usa quella nuova, su tutti i telefoni.');
    } catch (e) { fail(e); }
  };

  boot();
})();
