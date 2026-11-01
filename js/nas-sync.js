/* ══ SINCRONIZACION CON EL NAS DE CASA (en lugar de Firebase) ══
   Habla con la API "appstack" del NAS (FastAPI + PostgreSQL), la misma que usa la app de iOS.
   Solo se activa si el usuario ha elegido "Mi NAS" en la pantalla de entrada y ha puesto su
   direccion; si no, la web sigue funcionando con Firebase como siempre.

   Que se guarda en el NAS:
    - Entrenos: endpoints /workouts (cada entreno es el mismo JSON que usa la app).
    - Perfil, rutinas guardadas y registros de peso: un "item" de la API con el titulo
      ITEM_TITLE y el JSON en las notas.

   Requisitos en el NAS (la web va por HTTPS en GitHub Pages):
    - La API tiene que estar en una direccion HTTPS (por ejemplo con "tailscale serve"),
      porque Safari no deja que una pagina HTTPS llame a un servidor HTTP.
    - En el .env de appstack: CORS_ORIGINS=https://osky562-del.github.io
    - El movil tiene que estar en la wifi de casa o con Tailscale encendido. */
const NAS = (() => {
  const K = {
    mode: 'ko95_backend', url: 'ko95_nasUrl', acc: 'ko95_nasAcc', ref: 'ko95_nasRef',
    user: 'ko95_nasUser', hashes: 'ko95_nasHashes', dels: 'ko95_nasDeletes', rejected: 'ko95_nasRejected',
    profId: 'ko95_nasProfId', profHash: 'ko95_nasProfHash',
    lastOk: 'ko95_nasLastOk', closed: 'ko95_nasClosed', forgot: 'ko95_nasForgot',
  };
  const ITEM_TITLE = 'KO95FIT web: perfil';
  const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const BULK = 200;
  const MAX_PAYLOAD = 250 * 1024;
  const POLL_MS = 60000;

  let busy = false, again = false, pollTimer = null, remoteApply = false;
  // Estado para la tarjeta "Copia en el NAS" del Perfil (EstadoSync en Android).
  let authCtl = null;
  function emitState() { try { window.dispatchEvent(new CustomEvent('nas-sync')); } catch (e) {} }
  // Estado de la copia para la fila de Historial y el Perfil (espejo de EstadoSync/resumenNas de Android).
  let stSyncing = false, stError = null, stOkMs = +(localStorage.getItem(K.lastOk) || 0);

  // ── Utilidades ──
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(v) {
    const s = stable(v); let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + '.' + s.length;
  }
  function cleanUrl(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u;
  }

  // ── Configuracion y sesion ──
  // El NAS de casa es el servidor fijo: se entra directamente con la cuenta del NAS.
  // (Se puede cambiar la direccion desde la pantalla de entrada si algun dia cambia.)
  const DEFAULT_URL = 'https://osky95.tailc34d78.ts.net';
  const url = () => cleanUrl(localStorage.getItem(K.url) || DEFAULT_URL);
  const enabled = () => localStorage.getItem(K.mode) !== 'firebase' && !!url();
  const tokens = () => ({ acc: localStorage.getItem(K.acc), ref: localStorage.getItem(K.ref) });
  const loggedIn = () => !!tokens().ref;
  function saveTokens(t) {
    localStorage.setItem(K.acc, t.access_token);
    localStorage.setItem(K.ref, t.refresh_token);
  }
  function clearSession() { [K.acc, K.ref, K.user].forEach(k => ls.del(k)); }
  function clearSyncState() { [K.hashes, K.dels, K.rejected, K.profId, K.profHash].forEach(k => ls.del(k)); }

  // ── Cliente HTTP ──
  class NasError extends Error {
    constructor(status, detail, kind) { super(detail || ('HTTP ' + status)); this.status = status; this.detail = detail; this.kind = kind; }
  }
  function detailOf(data) {
    if (!data) return '';
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(d => d.msg || '').filter(Boolean).join('. ');
    return '';
  }
  async function raw(method, path, body, accessToken, extSignal) {
    const base = url();
    if (!base) throw new NasError(0, 'Falta la dirección del NAS', 'config');
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 20000);
    // "Dejar de esperar" en la pantalla de entrada: una señal externa corta la petición.
    if (extSignal) { if (extSignal.aborted) ctl.abort(); else extSignal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
    let res;
    try {
      res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
    } catch (e) {
      if (extSignal && extSignal.aborted) throw new NasError(0, 'Cancelado', 'cancel');
      throw new NasError(0, e && e.name === 'AbortError' ? 'El NAS no responde (tiempo agotado)' : 'No se puede conectar con el NAS', 'network');
    } finally { clearTimeout(to); }
    let data = null;
    const txt = res.status === 204 ? '' : await res.text();
    if (txt) { try { data = JSON.parse(txt); } catch (e) { data = null; } }
    if (!res.ok) throw new NasError(res.status, detailOf(data), 'http');
    return data;
  }
  let refreshing = null;
  async function refreshTokens() {
    if (!refreshing) {
      refreshing = (async () => {
        const ref = tokens().ref;
        if (!ref) throw new NasError(401, 'Sesión caducada', 'auth');
        const t = await raw('POST', '/auth/refresh', { refresh_token: ref });
        saveTokens(t);
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  async function api(method, path, body, signal) {
    try {
      return await raw(method, path, body, tokens().acc, signal);
    } catch (e) {
      if (e.status !== 401) throw e;
      try { await refreshTokens(); } catch (e2) { sessionExpired('el NAS ya no acepta esta sesión (' + (e2 && e2.message || 'sesión caducada') + ')'); throw new NasError(401, 'Sesión caducada', 'auth'); }
      return await raw(method, path, body, tokens().acc, signal);
    }
  }

  function friendly(e) {
    if (!e) return 'Error desconocido';
    if (e.kind === 'network') {
      const u = url();
      if (location.protocol === 'https:' && /^http:/i.test(u))
        return 'La web va por HTTPS y el NAS por HTTP: el navegador lo bloquea. Pon la dirección HTTPS del NAS.';
      return e.message + '. ¿Estás en la wifi de casa o con Tailscale? Si lo estás, revisa que el NAS tenga CORS y HTTPS.';
    }
    if (e.status === 401) return 'Email o contraseña incorrectos';
    if (e.status === 403) return e.detail || 'El NAS no permite esta acción (¿registro cerrado?)';
    if (e.status === 409) return e.detail || 'Ese email ya tiene cuenta';
    if (e.status === 422) return e.detail || 'Datos no válidos';
    if (e.status === 429) return 'Demasiados intentos. Espera un poco.';
    return e.message;
  }

  // ── Entrenos ──
  function loadSet(k) { return new Set(ls.get(k, [])); }
  function saveSet(k, s) { ls.set(k, [...s]); }

  /* Asegura que el entreno cumple lo que exige la API (id y fecha). Devuelve el motivo si no se puede subir. */
  function prepare(w) {
    if (!w.id || !ID_RE.test(String(w.id))) w.id = 'w_' + String(w.date || '').replace(/[^0-9]/g, '') + '_' + uid();
    if (!w.date || !DATE_RE.test(w.date)) w.date = new Date().toISOString().slice(0, 10);
    if (!Array.isArray(w.exercises)) w.exercises = [];
    const size = JSON.stringify(w).length;
    if (size > MAX_PAYLOAD) return 'demasiado grande (' + Math.round(size / 1024) + ' KB)';
    return null;
  }

  async function flushDeletes() {
    const dels = loadSet(K.dels);
    if (!dels.size) return;
    const hashes = ls.get(K.hashes, {});
    for (const id of [...dels]) {
      try { await api('DELETE', '/workouts/' + encodeURIComponent(id)); }
      catch (e) { if (e.status !== 404) throw e; }
      dels.delete(id); delete hashes[id];
      saveSet(K.dels, dels); ls.set(K.hashes, hashes);
    }
  }

  async function flushPushes() {
    const hashes = ls.get(K.hashes, {});
    const rejected = loadSet(K.rejected);
    let changedIds = false;
    const dirty = [];
    for (const w of workouts) {
      const before = w.id;
      const why = prepare(w);
      if (w.id !== before) changedIds = true;
      if (why) { rejected.add(w.id); continue; }
      const h = hash(w);
      if (hashes[w.id] !== h) dirty.push([w, h]);
    }
    if (changedIds) { remoteApply = true; try { saveWorkouts(); } finally { remoteApply = false; } }
    for (let i = 0; i < dirty.length; i += BULK) {
      const chunk = dirty.slice(i, i + BULK);
      try {
        await api('PUT', '/workouts', { workouts: chunk.map(([w]) => w) });
        chunk.forEach(([w, h]) => { hashes[w.id] = h; rejected.delete(w.id); });
      } catch (e) {
        if (e.status !== 422 && e.status !== 413) throw e;
        // Algun entreno del bloque no vale: se suben de uno en uno para apartar solo los malos.
        for (const [w, h] of chunk) {
          try { await api('PUT', '/workouts/' + encodeURIComponent(w.id), w); hashes[w.id] = h; rejected.delete(w.id); }
          catch (e2) { if (e2.status === 422 || e2.status === 413) rejected.add(w.id); else throw e2; }
        }
      }
      ls.set(K.hashes, hashes);
    }
    ls.set(K.hashes, hashes);
    saveSet(K.rejected, rejected);
  }

  async function pullAll() {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const page = await api('GET', '/workouts?limit=500&offset=' + offset);
      if (!Array.isArray(page) || !page.length) break;
      all.push(...page);
      if (page.length < 500) break;
    }
    const hashes = ls.get(K.hashes, {});
    const remoteIds = new Set(all.map(w => w.id));
    const merged = all.slice();
    for (const w of workouts) {
      if (remoteIds.has(w.id)) continue;
      if (hashes[w.id]) { delete hashes[w.id]; continue; } // estaba subido y ya no esta: se borro en otro dispositivo
      merged.push(w);                                     // aun no subido (o rechazado): se conserva
    }
    all.forEach(w => { hashes[w.id] = hash(w); });
    ls.set(K.hashes, hashes);
    merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (stable(merged) !== stable(workouts)) {
      workouts = merged;
      remoteApply = true;
      try { saveWorkouts(); } finally { remoteApply = false; }
      try { if (typeof renderDash === 'function') renderDash(); } catch (e) {}
      try { if (typeof renderHistory === 'function') renderHistory(); } catch (e) {}
    }
  }

  // ── Perfil, rutinas guardadas y peso (un item de la API) ──
  function localBlob() {
    return { name: STORE.get('name') || '', perfil: STORE.get('perfil') || {}, customTpl: STORE.get('customTpl') || [], weights: STORE.get('weights') || [] };
  }
  function applyBlob(b) {
    if (!b || typeof b !== 'object') return;
    if (b.perfil) STORE.set('perfil', b.perfil);
    if (Array.isArray(b.customTpl)) STORE.set('customTpl', b.customTpl);
    if (Array.isArray(b.weights)) {
      STORE.set('weights', b.weights);
      try { weightLogs = b.weights; } catch (e) {}
    }
    if (typeof b.name === 'string' && b.name) STORE.set('name', b.name);
    try { if (typeof updateGreeting === 'function') updateGreeting(); } catch (e) {}
    try { if (typeof renderProfile === 'function') renderProfile(); } catch (e) {}
    try { if (typeof renderTplList === 'function') renderTplList(); } catch (e) {}
  }
  function parseNotes(item) { try { return JSON.parse(item.notes || 'null'); } catch (e) { return null; } }
  async function findProfileItem() {
    for (let offset = 0; ; offset += 100) {
      const page = await api('GET', '/items?limit=100&offset=' + offset);
      if (!Array.isArray(page) || !page.length) return null;
      const it = page.find(x => x.title === ITEM_TITLE);
      if (it) return it;
      if (page.length < 100) return null;
    }
  }
  async function syncProfile() {
    const mine = localBlob();
    const hLocal = hash(mine);
    const last = localStorage.getItem(K.profHash);
    let id = localStorage.getItem(K.profId);
    if (!id) {
      const it = await findProfileItem();
      if (it) {
        id = it.id; localStorage.setItem(K.profId, id);
        const remote = parseNotes(it);
        // Primera vez en este dispositivo: manda lo que ya hay en el NAS.
        if (remote) { applyBlob(remote); localStorage.setItem(K.profHash, hash(localBlob())); return; }
      } else {
        const created = await api('POST', '/items', { title: ITEM_TITLE, notes: JSON.stringify(mine) });
        localStorage.setItem(K.profId, created.id); localStorage.setItem(K.profHash, hLocal);
        return;
      }
    }
    try {
      if (hLocal !== last) {
        await api('PATCH', '/items/' + id, { notes: JSON.stringify(mine) });
        localStorage.setItem(K.profHash, hLocal);
      } else {
        const it = await api('GET', '/items/' + id);
        const remote = parseNotes(it);
        if (remote && hash(remote) !== last) { applyBlob(remote); localStorage.setItem(K.profHash, hash(localBlob())); }
      }
    } catch (e) {
      if (e.status === 404) { ls.del(K.profId); ls.del(K.profHash); return syncProfile(); }
      throw e;
    }
  }

  // ── Bucle de sincronizacion ──
  async function sync() {
    if (!enabled() || !loggedIn()) return;
    if (busy) { again = true; return; }
    busy = true;
    stSyncing = true;
    emitState();
    try {
      updateSyncStatus('syncing');
      await flushDeletes();
      await flushPushes();
      await pullAll();
      await syncProfile();
      stError = null; stOkMs = Date.now();
      try { localStorage.setItem(K.lastOk, String(stOkMs)); } catch (e) {}
      const rej = loadSet(K.rejected).size;
      if (rej) updateSyncStatus('err', rej + ' entreno(s) no se pueden subir');
      else updateSyncStatus('on');
    } catch (e) {
      console.warn('NAS sync:', e);
      stError = e.kind === 'network' ? 'NAS sin conexión' : (e.message || 'Error NAS');
      if (e.status === 401) return;
      updateSyncStatus('err', e.kind === 'network' ? 'NAS sin conexión' : 'Error NAS');
    } finally {
      busy = false;
      stSyncing = false;
      emitState();
      try { if (typeof renderHistNas === 'function') renderHistNas(); } catch (e) {}
      if (again) { again = false; setTimeout(sync, 300); }
    }
  }
  /* Resumen del estado de la copia: { syncing, lastError, lastOkMs, pending, rejected }.
     pending = entrenos sin subir (hash distinto al guardado) + borrados pendientes. */
  function status() {
    const hashes = ls.get(K.hashes, {});
    let dirty = 0;
    try { (typeof workouts !== 'undefined' ? workouts : []).forEach(w => { if (!w.id || hashes[w.id] !== hash(w)) dirty++; }); } catch (e) {}
    const forgot = loadSet(K.forgot);
    const rejectedIds = [...loadSet(K.rejected)].filter(id => !forgot.has(id));
    return { syncing: stSyncing, lastError: stError, lastOkMs: stOkMs, pending: dirty + loadSet(K.dels).size, rejected: loadSet(K.rejected).size, rejectedIds };
  }
  /* "Entendido, quitar el aviso": el entreno rechazado deja de listarse en el Perfil (sigue en el móvil). */
  function forgetRejected(id) { const f = loadSet(K.forgot); f.add(id); saveSet(K.forgot, f); emitState(); }
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (document.visibilityState === 'visible') sync(); }, POLL_MS);
  }

  /* Cierre forzoso (sesión caducada, cerrada en todos los dispositivos o cuenta borrada): la pantalla de
     entrada muestra un aviso ámbar persistente con el motivo (AuthScreen.kt "auth_closed"). */
  function sessionExpired(motivo) {
    clearSession();
    clearInterval(pollTimer);
    localStorage.removeItem('ko95_sess');
    try { localStorage.setItem(K.closed, motivo || 'el NAS ya no acepta esta sesión'); } catch (e) {}
    updateSyncStatus('off', '🔒 Identifícate');
    const ov = document.getElementById('authOverlay');
    if (ov) ov.classList.add('show');
    if (typeof window.authRenderClosed === 'function') window.authRenderClosed();
  }
  function closedReason() { return localStorage.getItem(K.closed) || ''; }
  function clearClosed() { ls.del(K.closed); if (typeof window.authRenderClosed === 'function') window.authRenderClosed(); }

  function enterSession(user) {
    const prev = localStorage.getItem('ko95_uid');
    if (prev && prev !== 'nas:' + user.id) { clearLocalUserData(); clearSyncState(); }
    localStorage.setItem('ko95_uid', 'nas:' + user.id);
    ls.set(K.user, { id: user.id, email: user.email });
    localStorage.setItem('ko95_sess', '1');
    ls.del(K.closed);
    if (typeof Pro !== 'undefined') Pro.checkAdmin('nas:' + user.id);
    const ov = document.getElementById('authOverlay');
    if (ov) ov.classList.remove('show');
    updateSyncStatus('on', 'NAS: ' + user.email);
    startPolling();
    sync();
  }

  // ── Acciones de la pantalla de entrada (sustituyen a las de Firebase en modo NAS) ──
  /* Entrar/crear cuenta con "Dejar de esperar": una sola señal corta todo el proceso (AuthRepository.kt conTopeDeEntrada). */
  function newAuthCtl() { if (authCtl) { try { authCtl.abort(); } catch (e) {} } authCtl = new AbortController(); return authCtl.signal; }
  function cancelAuth() { if (authCtl) { try { authCtl.abort(); } catch (e) {} authCtl = null; } }
  async function login(email, pass, signal) {
    signal = signal || newAuthCtl();
    const t = await raw('POST', '/auth/login', { email, password: pass }, undefined, signal);
    saveTokens(t);
    const me = await api('GET', '/auth/me', undefined, signal);
    enterSession(me);
  }
  async function register(name, email, pass) {
    const signal = newAuthCtl();
    await raw('POST', '/auth/register', { email, password: pass }, undefined, signal);
    clearLocalUserData();
    clearSyncState();
    await login(email, pass, signal);
    STORE.set('perfil', { ...(STORE.get('perfil') || {}), nombre: name });
    STORE.set('name', name);
    sync();
  }
  /* Cierra la sesión SOLO en este dispositivo. Los entrenos se quedan en el móvil (ProfileScreen.kt:
     "Tus entrenos siguen guardados aquí"); si después entra otra cuenta, enterSession limpia los datos. */
  function logout() {
    clearInterval(pollTimer);
    clearSession(); clearSyncState();
    ls.del(K.closed);
    localStorage.removeItem('ko95_sess'); localStorage.removeItem('ko95_uid');
    location.href = location.pathname;
  }
  /* Cierra la sesión en TODOS los dispositivos (POST /auth/logout anula los tokens en el NAS). */
  async function logoutAll() {
    await api('POST', '/auth/logout');
    logout();
  }
  /* Borra la cuenta y todos sus datos del NAS (DELETE /auth/me). Los entrenos del móvil se quedan y la
     web sigue en modo local, como hace Android. */
  async function deleteAccount() {
    await api('DELETE', '/auth/me');
    clearInterval(pollTimer);
    clearSession(); clearSyncState();
    ls.del(K.closed);
    localStorage.removeItem('ko95_uid');
    localStorage.setItem('ko95_sess', 'local');
    updateSyncStatus('off', 'Modo Local');
    emitState();
  }
  function removeWorkout(id) {
    const dels = loadSet(K.dels);
    dels.add(id); saveSet(K.dels, dels);
    sync();
  }
  async function check(u) {
    const prevUrl = localStorage.getItem(K.url);
    try {
      localStorage.setItem(K.url, cleanUrl(u));
      const h = await raw('GET', '/health');
      return h;
    } finally {
      if (prevUrl == null) localStorage.removeItem(K.url); else localStorage.setItem(K.url, prevUrl);
    }
  }

  return {
    enabled, url, cleanUrl, loggedIn, login, register, logout, removeWorkout, sync, check, friendly, status,
    logoutAll, deleteAccount, cancelAuth, forgetRejected, closedReason, clearClosed,
    get remoteApply() { return remoteApply; },
    setMode(mode, u) {
      if (mode === 'nas') { localStorage.setItem(K.url, cleanUrl(u)); localStorage.setItem(K.mode, 'nas'); }
      else localStorage.setItem(K.mode, 'firebase');
    },
    user() { return ls.get(K.user, null); },
    start() {
      if (!enabled()) return;
      if (loggedIn()) {
        localStorage.setItem('ko95_sess', '1');
        const ov = document.getElementById('authOverlay');
        if (ov) ov.classList.remove('show');
        const u = ls.get(K.user, null);
        if (u && typeof Pro !== 'undefined') Pro.checkAdmin('nas:' + u.id);
        updateSyncStatus('syncing', '');
        startPolling();
        sync().then(() => { if (u) updateSyncStatus('on', 'NAS: ' + u.email); });
      } else if (localStorage.getItem('ko95_sess') !== 'local') {
        localStorage.removeItem('ko95_sess');
        updateSyncStatus('off', '🔒 Identifícate');
        const ov = document.getElementById('authOverlay');
        if (ov) ov.classList.add('show');
      } else {
        updateSyncStatus('off', 'Modo Local');
      }
    },
  };
})();

/* ── Enganche con el resto de la web ──
   En modo NAS, las funciones de la pantalla de entrada y de borrado usan el NAS en vez de Firebase. */
(function () {
  const fb = {
    login: window.authEmailLogin, register: window.authRegister, reset: window.authResetPass,
    logout: window.logoutCloud, remove: window.removeFromFirebase, push: window.forceSyncCloud,
  };

  // ── Pantalla de entrada (paridad con AuthScreen.kt): una tarjeta, pestañas Entrar | Crear cuenta,
  //    errores en rojo e info en verde debajo de los campos, spinner + "Dejar de esperar". ──
  let authTab = 0; // 0 entrar · 1 crear cuenta
  const tr = s => (typeof I18N !== 'undefined' ? I18N.t(s) : s);
  function authMsg(kind, text) {
    const er = $('authError'), inf = $('authInfo');
    if (er) { er.style.display = kind === 'err' && text ? '' : 'none'; if (kind === 'err') er.textContent = text || ''; }
    if (inf) { inf.style.display = kind === 'info' && text ? '' : 'none'; if (kind === 'info') inf.textContent = text || ''; }
    if (!kind) { if (er) er.style.display = 'none'; if (inf) inf.style.display = 'none'; }
  }
  function authBusy(on) {
    const btn = $('btnAuthMain'), w = $('authWaiting'), fg = $('authForgot'), lc = $('authLocalBtn');
    if (btn) { btn.disabled = on; btn.innerHTML = on ? '<span class="auth-spin"></span>' : tr(authTab ? 'Registrarme' : 'Entrar'); }
    if (w) w.style.display = on ? '' : 'none';
    if (fg) fg.disabled = on;
    if (lc) lc.disabled = on;
  }
  window.authToggle = function (isSignup) {
    authTab = isSignup ? 1 : 0;
    const a = $('authTabLogin'), b = $('authTabSignup');
    if (a) a.classList.toggle('on', !authTab);
    if (b) b.classList.toggle('on', !!authTab);
    const nm = $('authNewName'); if (nm) nm.style.display = authTab ? '' : 'none';
    const hint = $('authPassHint'); if (hint) hint.style.display = authTab ? '' : 'none';
    const fg = $('authForgot'); if (fg) fg.style.display = authTab ? 'none' : '';
    const pw = $('authLogPass'); if (pw) pw.setAttribute('autocomplete', authTab ? 'new-password' : 'current-password');
    authMsg(null);
    authBusy(false);
  };
  window.authTogglePass = function () {
    const pw = $('authLogPass'), eye = $('authEye'); if (!pw) return;
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    if (eye) eye.textContent = show ? '🙈' : '👁';
  };
  window.authSubmit = function () { return authTab ? window.authRegister() : window.authEmailLogin(); };
  window.authCancelWait = function () { NAS.cancelAuth(); authBusy(false); authMsg(null); };
  window.authRenderClosed = function () {
    const box = $('authClosed'), txt = $('authClosedTxt'); if (!box) return;
    const why = NAS.closedReason();
    box.style.display = why ? '' : 'none';
    if (txt) txt.textContent = why ? tr('Se ha cerrado la sesión porque') + ' ' + why + '. ' + tr('Vuelve a entrar con tu email y tu contraseña.') : '';
  };
  window.authDismissClosed = function () { NAS.clearClosed(); };

  window.authEmailLogin = async function () {
    if (!NAS.enabled()) return fb.login();
    const email = $('authLogEmail').value.trim();
    const pass = $('authLogPass').value;
    if (!email || !pass) { authMsg('err', tr('Rellena todos los campos')); return; }
    authMsg(null); authBusy(true);
    try {
      await NAS.login(email, pass);
      const remEl = document.getElementById('authRemember');
      if (remEl && remEl.checked) saveCreds(email, pass); else clearCreds();
      authMsg(null);
    } catch (e) {
      if (e && e.kind !== 'cancel') authMsg('err', NAS.friendly(e));
    } finally {
      authBusy(false);
    }
  };

  window.authRegister = async function () {
    if (!NAS.enabled()) return fb.register();
    const name = $('authNewName').value.trim();
    const email = $('authLogEmail').value.trim();
    const pass = $('authLogPass').value;
    if (!name || !email || !pass) { authMsg('err', tr('Rellena todos los campos')); return; }
    if (name.length < 3) { authMsg('err', tr('El nombre es muy corto (mínimo 3 letras)')); return; }
    const bytes = new TextEncoder().encode(pass).length;
    if (bytes < 12 || bytes > 72) { authMsg('err', tr('La contraseña tiene que tener 12 caracteres o más (lo pide la base de datos de casa).')); return; }
    authMsg(null); authBusy(true);
    try {
      await NAS.register(name, email, pass);
      const remEl = document.getElementById('authRemember');
      if (remEl && remEl.checked) saveCreds(email, pass); else clearCreds();
      authMsg(null);
    } catch (e) {
      if (e && e.kind !== 'cancel') authMsg('err', NAS.friendly(e));
      if (e && e.status === 409) authToggle(false);
    } finally {
      authBusy(false);
    }
  };

  /* Mensaje de AuthRepository.kt (resetPassword): no hay recuperación ni cambio desde la app, y NO se
     sugiere crear otra cuenta. */
  window.authResetPass = function () {
    if (!NAS.enabled()) return fb.reset();
    authMsg('err', tr('El NAS de casa no manda correos, así que no hay recuperación automática, y la app no puede cambiar la contraseña por su cuenta.') + '\n\n' +
      tr('Mientras tanto, entra sin cuenta (modo local) y sigue entrenando: tus entrenos se guardan en el móvil y no se pierde nada.') + '\n\n' +
      tr('Para recuperar el acceso hay que cambiar la contraseña en el propio NAS desde el ordenador: está explicado paso a paso en el dosier, en docs/06-operacion-diaria.md, apartado 7.3. La contraseña nueva tiene que tener 12 caracteres o más.') + '\n\n' +
      tr('No crees otra cuenta para esto: los entrenos que ya están en el NAS son de la cuenta de siempre y no aparecerían en una cuenta nueva.'));
  };

  window.logoutCloud = function () {
    if (!NAS.enabled()) return fb.logout();
    toast('Cerrando sesión...', 'ok');
    NAS.logout();
  };

  window.removeFromFirebase = function (id) {
    if (!NAS.enabled()) return fb.remove(id);
    NAS.removeWorkout(id);
  };

  window.forceSyncCloud = function () { return NAS.enabled() ? NAS.sync() : (fb.push ? fb.push() : undefined); };

  // Guardado: en modo NAS, cada cambio local se sube (con un pequeño retraso para agrupar).
  const _prevSave = saveWorkouts;
  saveWorkouts = function () {
    _prevSave();
    if (NAS.enabled() && NAS.loggedIn() && !NAS.remoteApply) {
      clearTimeout(window._nasDebounce);
      window._nasDebounce = setTimeout(() => NAS.sync(), 1500);
    }
  };

  window.addEventListener('online', () => { if (NAS.enabled()) NAS.sync(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && NAS.enabled()) NAS.sync();
  });

  // ── Selector de servidor en la pantalla de entrada ──
  window.nasToggleServerBox = function () {
    const box = document.getElementById('nasServerBox');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  };
  window.nasRenderServerInfo = function () {
    const info = document.getElementById('nasServerInfo');
    const inp = document.getElementById('nasUrlInp');
    if (inp && !inp.value) inp.value = NAS.url() || '';
    if (info) info.innerHTML = NAS.enabled()
      ? '🏠 <b>Tu NAS</b> · <span style="opacity:.7">' + NAS.url().replace(/^https?:\/\//, '') + '</span>'
      : '☁️ Servidor: <b>Firebase</b>';
    const back = document.getElementById('nasUseFirebase');
    if (back) back.style.display = NAS.enabled() ? 'inline' : 'none';
  };
  window.nasUseNas = async function () {
    const inp = document.getElementById('nasUrlInp');
    const u = NAS.cleanUrl(inp ? inp.value : '');
    if (!u) { toast('Escribe la dirección de tu NAS', 'err'); return; }
    if (location.protocol === 'https:' && /^http:/i.test(u)) {
      toast('Esta web va por HTTPS: la dirección del NAS tiene que empezar por https://', 'err');
      return;
    }
    const btn = document.getElementById('nasUseBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Comprobando...'; }
    try {
      const h = await NAS.check(u);
      if (!h || h.status !== 'ok') throw new Error('El NAS responde pero su base de datos no está lista');
      NAS.setMode('nas', u);
      nasRenderServerInfo();
      toast('NAS conectado ✓', 'good');
      const box = document.getElementById('nasServerBox');
      if (box) box.style.display = 'none';
    } catch (e) {
      toast(e instanceof Error && !e.kind ? e.message : NAS.friendly(e), 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar dirección'; }
    }
  };
  window.nasUseFirebase = function () {
    NAS.setMode('firebase');
    location.href = location.pathname;
  };

  function boot() {
    if (!localStorage.getItem('ko95_backend')) localStorage.setItem('ko95_backend', 'nas');
    nasRenderServerInfo();
    if (typeof window.authToggle === 'function') window.authToggle(false);
    if (typeof window.authRenderClosed === 'function') window.authRenderClosed();
    NAS.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
