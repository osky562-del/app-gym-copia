/* ══ STORAGE — triple redundancy para iPhone PWA ══
   1. localStorage  (principal)
   2. sessionStorage (respaldo sesión)
   3. Cookie        (persiste aunque Safari limpie localStorage)
   4. IndexedDB     (máxima persistencia en iOS)
══════════════════════════════════════════════ */

/* ── Cookie helpers (duran 1 año) ── */
function setCookie(k, v) {
  try {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    // Cookies tienen límite de 4KB, guardamos solo datos críticos
    const str = JSON.stringify(v);
    if (str.length < 3800) document.cookie = k + '=' + encodeURIComponent(str) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  } catch (e) { }
}
function getCookie(k) {
  try {
    const m = document.cookie.match('(?:^|; )' + k + '=([^;]*)');
    return m ? JSON.parse(decodeURIComponent(m[1])) : null;
  } catch (e) { return null; }
}

/* ── IndexedDB helper ── */
let idb = null;
function openIDB() {
  return new Promise(res => {
    try {
      const req = indexedDB.open('ko95fit', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('data');
      req.onsuccess = e => { idb = e.target.result; res(idb); };
      req.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbSet(k, v) {
  if (!idb) return;
  try { idb.transaction('data', 'readwrite').objectStore('data').put(v, k); } catch (e) { }
}
function idbGet(k) {
  return new Promise(res => {
    if (!idb) return res(null);
    try {
      const req = idb.transaction('data').objectStore('data').get(k);
      req.onsuccess = e => res(e.target.result ?? null);
      req.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}

/* ── STORE principal ── */
const STORE = {
  get(k) {
    try {
      // Intenta localStorage primero
      const ls = localStorage.getItem('ko95_' + k);
      if (ls && ls !== 'null') return JSON.parse(ls);
      // Fallback sessionStorage
      const ss = sessionStorage.getItem('ko95_' + k);
      if (ss && ss !== 'null') return JSON.parse(ss);
      // Fallback cookie
      const ck = getCookie('ko95_' + k);
      if (ck !== null) return ck;
    } catch (e) { }
    return null;
  },
  set(k, v) {
    const str = JSON.stringify(v);
    try { localStorage.setItem('ko95_' + k, str); } catch (e) { }
    try { sessionStorage.setItem('ko95_' + k, str); } catch (e) { }
    setCookie('ko95_' + k, v);
    idbSet('ko95_' + k, v);
  }
};

/* ── Inicializar IDB al arrancar ── */
openIDB().then(async () => {
  // Si localStorage está vacío pero IDB tiene datos, restaurar
  if (!localStorage.getItem('ko95_workouts')) {
    const idbW = await idbGet('ko95_workouts');
    if (idbW && Array.isArray(idbW) && idbW.length > 0) {
      localStorage.setItem('ko95_workouts', JSON.stringify(idbW));
      workouts = idbW;
      renderDash();
      toast('Datos restaurados desde respaldo 💾', 'good');
    }
  }
});

/* ══ LOAD DATA ══ */
let workouts = STORE.get('workouts') || [];
let weightLogs = STORE.get('weights') || [];
let bonusXp = STORE.get('bonusXp') || 0;

function recalculateBonusXp() {
  let count = 0;
  let historyPRs = {};
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach(w => {
    (w.exercises || []).forEach(e => {
      const kg = +e.kg || 0;
      if (kg > 0) {
        if (!historyPRs[e.ex] || kg > historyPRs[e.ex]) {
          count++;
          historyPRs[e.ex] = kg;
        }
      }
    });
  });
  bonusXp = count * (XP.pr || 100);
  STORE.set('bonusXp', bonusXp);
}

function saveWorkouts() { 
  recalculateBonusXp();
  STORE.set('workouts', workouts); 
}
function saveWeights() { STORE.set('weights', weightLogs); }
