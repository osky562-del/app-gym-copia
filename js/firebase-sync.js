/* ══ FIREBASE CLOUD SYNC & OFFLINE MODE ══ */
// FIREBASE_CONFIG se carga desde firebase-config.js (no incluido en GitHub)

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
      console.log("KO95FIT: Firebase Initialized ✓");
    }
    fbDb = firebase.firestore();

    // Configuración de persistencia compatible con v8/v9 compat
    try {
      fbDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
        console.warn("Dato: Persistencia local limitada", err.code);
      });
    } catch(e) { console.warn("Dato: Saltando persistencia"); }

    firebase.auth().onAuthStateChanged(user => {
      if (user && !user.isAnonymous) {
        fbUser = user;
        syncEnabled = true;
        localStorage.setItem('ko95_sess', '1'); // Flag de sesión activa
        updateSyncStatus('on', 'Élite: ' + (user.displayName || user.email));
        document.getElementById('authOverlay').classList.remove('show');

        // Check if user is admin → auto Pro+
        Pro.checkAdmin(user.email);
        
        if (workouts.length > 0) pushToFirebase();
        listenRemoteWorkouts();
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
    
    await firebase.auth().signInWithEmailAndPassword(email, pass);
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
    else toast('Error: ' + e.message, 'err');
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

async function logoutCloud() {
  try {
    toast('Cerrando sesión...', 'ok');
    localStorage.removeItem('ko95_sess'); 
    localStorage.removeItem('perfil');
    localStorage.removeItem('workouts');
    if (fbUnsub) fbUnsub();
    await firebase.auth().signOut();
    $('authOverlay').classList.add('show'); // Mostrar antes de salir
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


  async function removeFromFirebase(id) {
if (!syncEnabled || !fbUser || !fbDb) return;
try {
  const userDoc = fbDb.collection('users').doc(fbUser.uid);
  await userDoc.collection('workouts').doc(id).delete();
  console.log('🗑 Workout removed from cloud:', id);
} catch (e) {
  console.error('Failed to remove from cloud:', e);
}
  }

  function listenRemoteWorkouts() {
if (!fbUser || !fbDb) return;
const col = fbDb.collection('users').doc(fbUser.uid).collection('workouts');

fbUnsub = col.onSnapshot(snap => {
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
      // SOLO borrar si fue una eliminación intencional del usuario
      // (evita que writes fallidos borren datos locales)
      if (_pendingDeletes.has(rw.id)) {
        _pendingDeletes.delete(rw.id);
        const oldLen = workouts.length;
        workouts = workouts.filter(w => w.id !== rw.id);
        if (workouts.length !== oldLen) changed = true;
      }
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

// Inicialización inmediata al cargar el script
initFirebase();

// Registro del Service Worker (PWA) — solo desde http/https
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
window.addEventListener('load', () => {
  navigator.serviceWorker.register('sw.js').catch(err => {
    console.warn('SW register failed:', err);
  });
});
  }
