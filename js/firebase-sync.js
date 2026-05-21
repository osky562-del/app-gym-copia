/* ══ FIREBASE CLOUD SYNC & OFFLINE MODE ══ */
/* FIREBASE_CONFIG se carga desde firebase-config.js (excluido del repo) */

let fbApp = null, fbDb = null, fbUser = null, fbUnsub = null;
let syncEnabled = false;
let isSyncing = false;
let isRemoteUpdate = false; // Flag para evitar ciclo push↔snapshot

if (typeof firebase === 'undefined') {
  console.error("KO95FIT Error: Firebase SDK no cargado. Revisa la conexión.");
}
const _pendingDeletes = new Set(); // IDs borrados intencionalmente por el usuario

// Detector de conexión para re-sincronizar automáticamente
window.addEventListener('online', () => {
  console.log('🌐 Conexión recuperada. Sincronizando pendiente...');
  if (syncEnabled) pushToFirebase();
});

function initFirebase() {
  try {
    // Firebase no funciona desde file:// — activar modo local automáticamente
    if (location.protocol === 'file:') {
      console.warn('KO95FIT: Protocolo file:// detectado. Modo local activado.');
      updateSyncStatus('off', 'Modo Local');
      
      // Mostrar aviso crítico en el login
      const sub = document.querySelector('.auth-sub');
      if (sub) {
        sub.innerHTML = '<span style="color:var(--red);font-weight:bold;display:block;margin-bottom:10px;">⚠️ ESTÁS EN MODO LOCAL (file://)</span>Para usar la NUBE y SINCRONIZAR, debes ejecutar <b>servir_app.cmd</b> y entrar desde http://localhost:3000';
        sub.style.color = 'var(--t1)';
      }
      return;
    }

    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes('TU_API_KEY')) {
      console.warn("KO95FIT: Configuración de Firebase incompleta o por defecto.");
      updateSyncStatus('err', 'Config Error');
      $('authOverlay').classList.add('show');
      return;
    }

    // Evitar inicializar dos veces si ya existe
    if (firebase.apps.length > 0) {
      fbApp = firebase.app();
    } else {
      fbApp = firebase.initializeApp(FIREBASE_CONFIG);
      console.log("KO95FIT: Firebase Initialized (v4) ✓");
    }

    // Persistencia de Auth: LOCAL (localStorage) para mantener sesión entre cierres
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});

    fbDb = firebase.firestore();

    // Persistencia offline de Firestore (IndexedDB)
    try {
      fbDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
        console.warn("Dato: Persistencia local limitada", err.code);
      });
    } catch(e) { console.warn("Dato: Saltando persistencia"); }

    firebase.auth().onAuthStateChanged(user => {
      // CRÍTICO: cualquier cambio de auth-state debe cortar el listener anterior.
      // Si no lo hacemos y el usuario cambia de cuenta sin pasar por logoutCloud,
      // el listener antiguo sigue activo y trae workouts de la cuenta vieja,
      // que se MEZCLAN con los de la cuenta nueva (los suma).
      if (fbUnsub) {
        try { fbUnsub(); } catch (e) {}
        fbUnsub = null;
      }

      if (user && !user.isAnonymous) {
        const prevUid = localStorage.getItem('ko95_uid');
        const isNewUserOnDevice = prevUid && prevUid !== user.uid;
        if (isNewUserOnDevice) {
          console.log('KO95FIT: usuario distinto detectado, limpiando datos del anterior');
          clearLocalUserData();
        }
        localStorage.setItem('ko95_uid', user.uid);

        fbUser = user;
        syncEnabled = true;
        localStorage.setItem('ko95_sess', '1');
        updateSyncStatus('on', 'Élite: ' + (user.displayName || user.email));
        document.getElementById('authOverlay').classList.remove('show');

        Pro.checkAdmin(user.uid);

        if (!isNewUserOnDevice && workouts.length > 0) pushToFirebase();
        listenRemoteWorkouts();

        // Si era un cambio de usuario, refrescar TODA la UI: saludo, dashboard,
        // perfil y bloquear el panel admin (no debe quedar abierto al cambiar de cuenta).
        if (isNewUserOnDevice) {
          try { sessionStorage.removeItem('ko95_admin_unlocked'); } catch (e) {}
          setTimeout(() => {
            if (typeof updateGreeting === 'function') updateGreeting();
            if (typeof renderDash === 'function') renderDash();
            if (typeof renderProfile === 'function') renderProfile();
            if (typeof Admin !== 'undefined' && Admin.refreshPanelVisibility) Admin.refreshPanelVisibility();
          }, 100);
        }
      } else {
        fbUser = null;
        syncEnabled = false;
        // Solo mostrar overlay si NO estamos en modo local explícito
        if (localStorage.getItem('ko95_sess') !== 'local') {
          localStorage.removeItem('ko95_sess');
          updateSyncStatus('off', '🔒 Identifícate');
          document.getElementById('authOverlay').classList.add('show');
        } else {
          updateSyncStatus('off', 'Modo Local');
        }
        if (user && user.isAnonymous) firebase.auth().signOut();
      }
    });
  } catch (e) {
    console.error('Error Crítico Firebase:', e);
    // Forzamos mostrar el login si algo falla para no bloquear al usuario
    $('authOverlay').classList.add('show');
    toast('Error de conexión con la nube', 'err');
  }
}

function authToggle(isSignup) {
  $('authSignup').style.display = isSignup ? 'block' : 'none';
  $('authLogin').style.display = isSignup ? 'none' : 'block';
}

function enterLocalMode() {
  syncEnabled = false;
  localStorage.setItem('ko95_sess', 'local'); // Persistir modo local
  document.getElementById('authOverlay').classList.remove('show');
  updateSyncStatus('off', 'Modo Local');
  toast('Modo local activado. Tus datos se guardan en este dispositivo.', 'ok');
}

async function authGoogle() {
  if (location.protocol === 'file:') return toast('La nube requiere un servidor. Usa el archivo servir_app.cmd', 'err');
  try {
    if (firebase.apps.length === 0) initFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
    toast('Bienvenido de nuevo');
  } catch (e) {
    toast('Error Google: ' + e.message, 'err');
  }
}

async function authEmailLogin() {
  if (location.protocol === 'file:') return toast('La nube requiere un servidor. Ejecuta servir_app.cmd', 'err');
  const email = $('authLogEmail').value.trim();
  const pass = $('authLogPass').value.trim();
  const btn = $('btnLogin');
  if (!email || !pass) { toast('Rellena todos los campos', 'err'); return; }

  btn.disabled = true;
  btn.textContent = 'Comprobando...';

  try {
    // Asegurar inicialización si por algún motivo no ocurrió
    if (firebase.apps.length === 0) initFirebase();

    // Timeout de 20s por si la red se queda colgada
    const signInPromise = firebase.auth().signInWithEmailAndPassword(email, pass);
    const timeoutPromise = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Tiempo de espera agotado. Revisa tu conexión.')), 20000)
    );
    await Promise.race([signInPromise, timeoutPromise]);

    // Recordar credenciales si la casilla está marcada
    const remEl = document.getElementById('authRemember');
    if (remEl && remEl.checked) saveCreds(email, pass);
    else clearCreds();

    toast('¡Bienvenido de nuevo! 💪', 'good');
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Entrar';
    console.error('Error Login:', e);
    if (e.code === 'auth/wrong-password') toast('❌ Contraseña incorrecta', 'err');
    else if (e.code === 'auth/user-not-found') toast('❓ Email no registrado', 'err');
    else if (e.code === 'auth/invalid-email') toast('⚠️ Email no válido', 'err');
    else if (e.code === 'auth/too-many-requests') toast('⏳ Bloqueo temporal: Demasiados intentos. Espera unos minutos.', 'err');
    else if (e.code === 'auth/invalid-credential') toast('🔐 Credenciales inválidas. Revisa email y contraseña.', 'err');
    else toast('Error: ' + (e.message || e.code || 'desconocido'), 'err');
  }
}

async function authResetPass() {
  const email = $('authLogEmail').value.trim();
  if (!email) { toast('Escribe tu email arriba primero', 'err'); return; }
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    toast('Correo de recuperación enviado');
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function authRegister() {
  if (location.protocol === 'file:') return toast('Registro requiere un servidor. Usa servir_app.cmd', 'err');
  const name = $('authNewName').value.trim();
  const email = $('authNewEmail').value.trim();
  const pass = $('authNewPass').value.trim();
  if (!name || !email || !pass) { toast('Rellena todos los campos', 'err'); return; }
  if (name.length < 3) { toast('Nombre corto (mín. 3)', 'err'); return; }
  if (pass.length < 6) { toast('Contraseña corta (mín. 6)', 'err'); return; }

  const btn = $('btnRegister');
  btn.disabled = true;
  btn.textContent = 'Procesando...';

  try {
    if (firebase.apps.length === 0) initFirebase();
    const userKey = name.toLowerCase().replace(/\s/g, '');
    const userRef = fbDb.collection('usernames').doc(userKey);
    const nameDoc = await userRef.get();
    if (nameDoc.exists) {
      btn.disabled = false; btn.textContent = 'Registrarme';
      toast('🚫 El nombre "' + name + '" ya está en uso por otro atleta', 'err');
      return;
    }

    // Limpiar TODOS los datos locales antes de crear cuenta nueva
    try {
      STORE.set('workouts', []);
      STORE.set('weightLogs', []);
      STORE.set('perfil', {});
      STORE.set('customTpl', []);
      STORE.set('iaConsejos', null);
      Object.keys(localStorage).filter(k => k.startsWith('rutinaCache_')).forEach(k => localStorage.removeItem(k));
      if (typeof workouts !== 'undefined') workouts.length = 0;
      if (typeof weightLogs !== 'undefined') weightLogs.length = 0;
    } catch(e) {}

    const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;

    await userRef.set({ uid, name });
    await fbDb.collection('users').doc(uid).set({
      perfil: { nombre: name },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    STORE.set('perfil', { ...STORE.get('perfil'), nombre: name });
    toast('¡Cuenta Élite creada!', 'good');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Registrarme';
    console.error('Error Registro:', e);
    if (e.code === 'auth/email-already-in-use') {
      toast('Ese email ya tiene cuenta. ¡Inicia sesión!', 'err');
      authToggle(false); // Cambiar a la pestaña de login
    } else if (e.code === 'permission-denied') {
      toast('Error de permisos Firebase (Revisa Reglas)', 'err');
    } else {
      toast('Error: ' + e.message, 'err');
    }
  }
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
    el.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#2dd98a;box-shadow:0 0 8px #2dd98a"></span> Nube Sincronizada';
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

async function pushToFirebase() {
  if (!syncEnabled || !fbUser || !fbDb || isSyncing) return;
  isSyncing = true;
  try {
    updateSyncStatus('syncing');
    const userDoc = fbDb.collection('users').doc(fbUser.uid);

    // 1. Sanitizar y asegurar IDs
    const cleanWorkouts = workouts.map(w => {
      // Clonar para no mutar el original antes de limpiar
      const cw = JSON.parse(JSON.stringify(w)); 
      if (!cw.id) cw.id = 'w_' + (cw.date || '').replace(/[^0-9]/g, '') + '_' + uid();
      // Eliminar campos null/undefined que rompen reglas de Firestore
      if (!cw.date) cw.date = new Date().toISOString().split('T')[0];
      if (!cw.exercises) cw.exercises = [];
      return cw;
    });

    // Subir en batches de 450
    const BATCH_SIZE = 450;
    for (let i = 0; i < cleanWorkouts.length; i += BATCH_SIZE) {
      const batch = fbDb.batch();
      const chunk = cleanWorkouts.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(w => {
        const ref = userDoc.collection('workouts').doc(w.id);
        batch.set(ref, w, { merge: true });
      });

      // Intentar commit de entrenos primero
      await batch.commit();

      // Guardar info de perfil por separado para que un error de reglas en el perfil 
      // no bloquee los entrenamientos
      try {
        const perfil = JSON.parse(JSON.stringify(STORE.get('perfil') || {}));
        await userDoc.set({
          perfil,
          lastSync: firebase.firestore.FieldValue.serverTimestamp(),
          client: 'Elite_KO95_v2'
        }, { merge: true });
      } catch(e) { console.warn('Aviso: Perfil no sincronizado, pero entrenos OK.'); }
    }

    if (cleanWorkouts.length === 0) {
      const perfil = JSON.parse(JSON.stringify(STORE.get('perfil') || {}));
      await userDoc.set({
        perfil,
        lastSync: firebase.firestore.FieldValue.serverTimestamp(),
        client: 'Elite_KO95_v2'
      }, { merge: true });
    }

    updateSyncStatus('on');
    console.log('✅ Sincronización completa');
  } catch (e) {
    console.error('❌ Error Sincro:', e.code, e.message);
    const shortMsg = e.code === 'permission-denied' ? 'Sin Permiso' : 
                   (e.code === 'unavailable' || !navigator.onLine) ? 'Sin Red' : 'Error Sincro';
    updateSyncStatus('err', shortMsg);
    // Reintentar en 1 minuto si falla
    clearTimeout(window._syncRetry);
    window._syncRetry = setTimeout(pushToFirebase, 60000);
  } finally {
    isSyncing = false;
  }
}

// Reintentar cuando el usuario vuelve a la app (útil en móviles)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && syncEnabled && !isSyncing) {
    console.log('👀 App visible: comprobando sincro...');
    pushToFirebase();
  }
});


// Exponer pushToFirebase globalmente para forzar sincronización desde otros módulos
window.forceSyncCloud = pushToFirebase;

/* Limpia TODOS los datos personales del dispositivo. Centralizado para que tanto
   el logout como la detección de "usuario distinto" usen la misma lista. */
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

async function logoutCloud() {
  try {
    toast('Cerrando sesión...', 'ok');
    // 1. Cortar listener remoto ANTES de signOut para evitar fugas.
    if (fbUnsub) {
      try { fbUnsub(); } catch (e) {}
      fbUnsub = null;
    }
    // 2. Limpieza completa de localStorage + sessionStorage.
    clearLocalUserData();
    localStorage.removeItem('ko95_sess');
    localStorage.removeItem('ko95_uid');
    // 3. Cerrar sesión Firebase.
    await firebase.auth().signOut();
    $('authOverlay').classList.add('show');
    location.href = location.pathname; // Recarga limpia
  } catch (e) {
    console.error('Logout error:', e);
    location.reload();
  }
}
window.logoutCloud = logoutCloud;

// Mostrar overlay de inmediato si no hay sesión registrada localmente
if (!localStorage.getItem('ko95_sess')) {
  const ov = document.getElementById('authOverlay');
  if (ov) ov.classList.add('show');
}


  /* Set de IDs cuyo borrado en Firestore falló (sin red, error transitorio).
     Se reintenta en background hasta que se confirme. */
  const _failedDeletes = new Set();

  async function removeFromFirebase(id) {
if (!fbUser || !fbDb) {
  // No hay nube: nada que borrar. Si se intentó borrar offline, recordamos
  // el id para reintentarlo cuando haya sesión otra vez.
  _failedDeletes.add(id);
  try { localStorage.setItem('ko95_failedDeletes', JSON.stringify([..._failedDeletes])); } catch (e) {}
  return;
}
try {
  const userDoc = fbDb.collection('users').doc(fbUser.uid);
  await userDoc.collection('workouts').doc(id).delete();
  _failedDeletes.delete(id);
  try { localStorage.setItem('ko95_failedDeletes', JSON.stringify([..._failedDeletes])); } catch (e) {}
  console.log('🗑 Workout borrado en Firebase:', id);
} catch (e) {
  console.error('No se pudo borrar de Firebase:', e);
  _failedDeletes.add(id);
  try { localStorage.setItem('ko95_failedDeletes', JSON.stringify([..._failedDeletes])); } catch (e) {}
  if (typeof toast === 'function') {
    toast('⚠ Sin red: el borrado se aplicará cuando vuelvas online', 'err');
  }
  scheduleRetryFailedDeletes();
}
  }

  /* Reintento periódico mientras haya deletes pendientes. */
  async function retryFailedDeletes() {
if (!_failedDeletes.size || !fbUser || !fbDb) return;
const ids = [..._failedDeletes];
for (const id of ids) {
  try {
    const userDoc = fbDb.collection('users').doc(fbUser.uid);
    await userDoc.collection('workouts').doc(id).delete();
    _failedDeletes.delete(id);
    console.log('🗑 Reintento exitoso:', id);
  } catch (e) {
    console.warn('Reintento falló para', id);
  }
}
try { localStorage.setItem('ko95_failedDeletes', JSON.stringify([..._failedDeletes])); } catch (e) {}
if (_failedDeletes.size > 0) scheduleRetryFailedDeletes();
  }

  function scheduleRetryFailedDeletes() {
clearTimeout(window._failedDeleteRetryTimer);
window._failedDeleteRetryTimer = setTimeout(retryFailedDeletes, 30000);
  }

  /* Restaurar la lista de deletes pendientes al iniciar la app (si en la sesión
     anterior se borraron sin red, se completarán ahora). */
  try {
const saved = JSON.parse(localStorage.getItem('ko95_failedDeletes') || '[]');
if (Array.isArray(saved)) saved.forEach(id => _failedDeletes.add(id));
if (_failedDeletes.size > 0) scheduleRetryFailedDeletes();
  } catch (e) {}

  /* Cuando la app vuelve a foreground y hay deletes pendientes, reintentar al instante. */
  document.addEventListener('visibilitychange', () => {
if (document.visibilityState === 'visible' && _failedDeletes.size > 0) {
  retryFailedDeletes();
}
  });

  function listenRemoteWorkouts() {
if (!fbUser || !fbDb) return;
// Capturamos el uid para el que se creó este listener. Si para cuando llegan los
// snapshots ya hemos cambiado de cuenta, los descartamos. Doble cinturón frente
// a listeners zombies (el primero es el fbUnsub() en onAuthStateChanged).
const listenerUid = fbUser.uid;
const col = fbDb.collection('users').doc(listenerUid).collection('workouts');

fbUnsub = col.onSnapshot(snap => {
  // Si el usuario ya cambió o se ha deslogueado, ignorar este snapshot.
  if (!fbUser || fbUser.uid !== listenerUid) return;
  if (snap.metadata.hasPendingWrites) return;
  let changed = false;
  snap.docChanges().forEach(change => {
    const rw = change.doc.data();
    // Usar el id del documento de Firestore como referencia fiable
    const docId = change.doc.id;
    if (!rw.id) rw.id = docId;

    if (change.type === 'added' || change.type === 'modified') {
      const idx = workouts.findIndex(w => w.id === rw.id);
      if (idx === -1) { workouts.push(rw); changed = true; }
      else if (JSON.stringify(workouts[idx]) !== JSON.stringify(rw)) { workouts[idx] = rw; changed = true; }
    } else if (change.type === 'removed') {
      // Firestore solo emite 'removed' cuando el documento se ha borrado de
      // verdad en el servidor (no por writes fallidos). Por tanto refleja
      // SIEMPRE el borrado en local — esto cubre tanto los borrados desde
      // este dispositivo como los desde otro dispositivo del mismo usuario.
      const oldLen = workouts.length;
      workouts = workouts.filter(w => w.id !== rw.id);
      if (workouts.length !== oldLen) changed = true;
      _pendingDeletes.delete(rw.id);
    }
  });
  if (changed) {
    workouts.sort((a, b) => b.date.localeCompare(a.date));
    isRemoteUpdate = true;
    saveWorkouts();
    isRemoteUpdate = false;
    renderDash();
  }
});
  }

  // Hook de guardado robusto
  const _origSave = saveWorkouts;
  saveWorkouts = function () {
_origSave(); // Guardado local inmediato e infalible
// Solo push si el cambio fue local (no remoto) para evitar ciclo push↔snapshot
if (syncEnabled && !isRemoteUpdate) {
  clearTimeout(window._syncDebounce);
  window._syncDebounce = setTimeout(pushToFirebase, 1500);
}
  };

/* ── Recordar credenciales en el dispositivo (offuscación simple, no es cifrado real) ── */
const _CR_K = 'KO95FIT_2026_K';
function _crObf(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ _CR_K.charCodeAt(i % _CR_K.length));
  try { return btoa(unescape(encodeURIComponent(o))); } catch(e) { return ''; }
}
function _crDeobf(b) {
  try {
    const d = decodeURIComponent(escape(atob(b)));
    let r = '';
    for (let i = 0; i < d.length; i++) r += String.fromCharCode(d.charCodeAt(i) ^ _CR_K.charCodeAt(i % _CR_K.length));
    return r;
  } catch(e) { return ''; }
}
function saveCreds(email, pass) {
  try {
    localStorage.setItem('ko95_em', _crObf(email));
    localStorage.setItem('ko95_pw', _crObf(pass));
  } catch(e) {}
}
function clearCreds() {
  try {
    localStorage.removeItem('ko95_em');
    localStorage.removeItem('ko95_pw');
  } catch(e) {}
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
  } catch(e) {}
}

// Inicialización inmediata al cargar el script
initFirebase();

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
