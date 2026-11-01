/* ══ SESIÓN Y ESTADO DE SINCRONIZACIÓN ══
   Lo común a la pantalla de entrada y a la copia en el NAS (nas-sync.js): modo local,
   limpieza al cambiar de cuenta, credenciales recordadas y registro de la PWA. */

let isSyncing = false;

function enterLocalMode() {
  localStorage.setItem('ko95_sess', 'local'); // Persistir modo local
  document.getElementById('authOverlay').classList.remove('show');
  updateSyncStatus('off', 'Modo Local');
  toast('Modo local activado. Tus datos se guardan en este dispositivo.', 'ok');
}

function updateSyncStatus(state, msg = '') {
  let el = $('syncBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncBadge';
    el.style.cssText = 'position:fixed;top:calc(var(--st) + 8px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:all .4s ease;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.1);';
    document.body.appendChild(el);
  }

  el.style.opacity = '1';
  if (state === 'on') {
    isSyncing = false;
    el.style.background = 'rgba(45, 217, 138, 0.15)';
    el.style.color = '#2dd98a';
    el.style.border = '1px solid rgba(45, 217, 138, 0.3)';
    el.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#2dd98a;box-shadow:0 0 8px #2dd98a"></span> NAS Sincronizado';
    setTimeout(() => { if (!isSyncing) el.style.opacity = '0.3'; }, 7000);
  } else if (state === 'syncing') {
    isSyncing = true;
    el.style.background = 'rgba(79, 140, 255, 0.1)';
    el.style.color = '#4f8cff';
    el.style.border = '1px solid rgba(79, 140, 255, 0.2)';
    el.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#4f8cff;animation:pulse 1s infinite"></span> Sincronizando...';
  } else if (state === 'err') {
    isSyncing = false;
    el.style.background = 'rgba(255, 59, 48, 0.15)';
    el.style.color = '#ff3b30';
    el.style.border = '1px solid rgba(255, 59, 48, 0.3)';
    el.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#ff3b30"></span> ${msg || 'Error Sincro'}`;
  } else {
    isSyncing = false;
    el.style.background = 'rgba(255,255,255,0.05)';
    el.style.color = '#888';
    el.style.border = '1px solid rgba(255,255,255,0.1)';
    el.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#888"></span> ${msg || 'Offline'}`;
  }
}

function clearLocalUserData() {
  try {
    STORE.set('workouts', []);
    STORE.set('weightLogs', []);
    STORE.set('perfil', {});
    STORE.set('customTpl', []);
    STORE.set('iaConsejos', null);
    // 'name' es el saludo "Hola X" — sin esto, al cambiar de cuenta seguía
    // mostrándose el nombre del usuario anterior.
    localStorage.removeItem('name');
    localStorage.removeItem('live_session');
    Object.keys(localStorage).filter(k => k.startsWith('rutinaCache_')).forEach(k => localStorage.removeItem(k));
    if (typeof workouts !== 'undefined') workouts.length = 0;
    if (typeof weightLogs !== 'undefined') weightLogs.length = 0;
    // Bloquear panel admin al cambiar de cuenta.
    try { sessionStorage.removeItem('ko95_admin_unlocked'); } catch (e) {}
  } catch (e) { console.warn('clearLocalUserData:', e); }
}

// Mostrar overlay de inmediato si no hay sesión registrada localmente
if (!localStorage.getItem('ko95_sess')) {
  const ov = document.getElementById('authOverlay');
  if (ov) ov.classList.add('show');
}

/* ── Recordar credenciales en el dispositivo (offuscación simple, no es cifrado real) ── */
const _CR_K = 'KO95FIT_2026_K';
function _crObf(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ _CR_K.charCodeAt(i % _CR_K.length));
  try { return btoa(unescape(encodeURIComponent(o))); } catch (e) { return ''; }
}
function _crDeobf(b) {
  try {
    const d = decodeURIComponent(escape(atob(b)));
    let r = '';
    for (let i = 0; i < d.length; i++) r += String.fromCharCode(d.charCodeAt(i) ^ _CR_K.charCodeAt(i % _CR_K.length));
    return r;
  } catch (e) { return ''; }
}
function saveCreds(email, pass) {
  try {
    localStorage.setItem('ko95_em', _crObf(email));
    localStorage.setItem('ko95_pw', _crObf(pass));
  } catch (e) {}
}
function clearCreds() {
  try {
    localStorage.removeItem('ko95_em');
    localStorage.removeItem('ko95_pw');
  } catch (e) {}
}
function loadRememberedCreds() {
  try {
    const em = localStorage.getItem('ko95_em');
    const pw = localStorage.getItem('ko95_pw');
    if (!em || !pw) return;
    const emEl = document.getElementById('authLogEmail');
    const pwEl = document.getElementById('authLogPass');
    const remEl = document.getElementById('authRemember');
    if (emEl) emEl.value = _crDeobf(em);
    if (pwEl) pwEl.value = _crDeobf(pw);
    if (remEl) remEl.checked = true;
  } catch (e) {}
}

// Cargar credenciales recordadas (cuando el DOM esté listo)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadRememberedCreds);
} else {
  loadRememberedCreds();
}

// Registro del Service Worker (PWA) — solo en http/https (ni file:// ni esquemas custom de WebView)
if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW register failed:', err);
    });
  });
}
