/* ══════════════════════════════════════════════
   ADMIN — Panel de control contra la API del NAS
   Quién es admin lo decide el NAS (users.is_admin) y lo comprueba en cada petición a /admin.
   El PIN es una comodidad de este dispositivo, no la seguridad del panel.
   ══════════════════════════════════════════════ */

const Admin = (function() {

  const BROADCAST_LAST_SEEN_KEY = 'ko95_lastBroadcastId';
  /* PIN del panel: SHA-256 del PIN guardado en localStorage. La primera vez hay que elegirlo. */
  const PIN_HASH_KEY = 'ko95_admin_pin_hash';
  /* Flag de "desbloqueado" en sessionStorage → al cerrar la app vuelve a bloquearse. */
  const UNLOCKED_KEY = 'ko95_admin_unlocked';
  const PINES_OBVIOS = ['0000', '1234'];

  function isAdminUser() {
    if (typeof NAS === 'undefined' || !NAS.loggedIn()) return false;
    const u = NAS.user();
    return !!(u && u.is_admin);
  }

  /* Escapa texto para incrustarlo en innerHTML de forma segura (evita XSS almacenado:
     un usuario podría poner HTML/JS en su nombre y ejecutarse en la sesión de admin). */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function isUnlocked() {
    try { return sessionStorage.getItem(UNLOCKED_KEY) === '1'; } catch (e) { return false; }
  }

  /* ── SHA-256 vía Web Crypto API (disponible en iOS WKWebView, Android WebView y web) ── */
  async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function hasPin() { return !!localStorage.getItem(PIN_HASH_KEY); }

  /* Verifica el PIN introducido; si aún no hay ninguno, lo crea. Si OK → desbloquea. */
  async function tryUnlock(pin) {
    if (!pin) return false;
    if (!hasPin()) {
      if (!pinValido(pin)) return false;
      localStorage.setItem(PIN_HASH_KEY, await sha256Hex(pin));
    } else if (localStorage.getItem(PIN_HASH_KEY) !== await sha256Hex(pin)) {
      return false;
    }
    try { sessionStorage.setItem(UNLOCKED_KEY, '1'); } catch (e) {}
    refreshPanelVisibility();
    if (isAdminUser()) {
      loadStats();
      listProUsers();
    }
    return true;
  }

  function pinValido(pin) { return /^\d{4,8}$/.test(pin || '') && !PINES_OBVIOS.includes(pin); }

  /* Bloquea el panel hasta el siguiente PIN correcto. */
  function lockPanel() {
    try { sessionStorage.removeItem(UNLOCKED_KEY); } catch (e) {}
    refreshPanelVisibility();
    if (typeof toast === 'function') toast('Panel bloqueado 🔒', 'good');
  }

  /* Cambia el PIN. Requiere que el panel esté desbloqueado. 4-8 dígitos numéricos. */
  async function changePin(newPin) {
    if (!isAdminUser() || !isUnlocked()) {
      if (typeof toast === 'function') toast('Panel bloqueado', 'err');
      return false;
    }
    if (!pinValido(newPin)) {
      if (typeof toast === 'function') toast('PIN: 4-8 dígitos, y ni 0000 ni 1234', 'err');
      return false;
    }
    const h = await sha256Hex(newPin);
    try { localStorage.setItem(PIN_HASH_KEY, h); } catch (e) {
      if (typeof toast === 'function') toast('No se pudo guardar', 'err');
      return false;
    }
    if (typeof toast === 'function') toast('PIN actualizado ✓', 'good');
    return true;
  }

  /* Lee el input del card "Seguridad" y lanza changePin. */
  async function changePinFromInput() {
    const inp = document.getElementById('admNewPinInp');
    if (!inp) return;
    const newPin = inp.value.trim();
    if (await changePin(newPin)) inp.value = '';
  }

  /* ── Modal del PIN (se inyecta una sola vez) ── */
  function ensurePinModal() {
    if (document.getElementById('admPinModal')) return;
    const m = document.createElement('div');
    m.id = 'admPinModal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;align-items:center;justify-content:center;padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
    m.innerHTML = `
      <div style="background:var(--s1,#131316);border:1.5px solid var(--line2,#2a2a32);border-radius:18px;padding:24px;width:100%;max-width:340px;">
        <div style="font-size:1.1rem;font-weight:800;margin-bottom:8px;text-align:center;">🔒 Panel Admin</div>
        <div id="admPinTxt" style="font-size:.78rem;color:var(--t3,#7a7a86);text-align:center;margin-bottom:18px;">Introduce el PIN para desbloquear</div>
        <input id="admPinInp" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="••••" style="width:100%;background:var(--s3,#222);border:1.5px solid var(--line2,#2a2a32);border-radius:10px;padding:14px;color:var(--t1,#fff);font-size:1.2rem;text-align:center;letter-spacing:.45em;outline:none;box-sizing:border-box;margin-bottom:14px;">
        <div style="display:flex;gap:8px;">
          <button id="admPinCancel" style="flex:1;padding:11px;border-radius:9px;background:var(--s3,#222);border:1px solid var(--line2,#2a2a32);color:var(--t2,#c8c8d0);font-weight:700;cursor:pointer;">Cancelar</button>
          <button id="admPinOk" style="flex:1;padding:11px;border-radius:9px;background:var(--a,#4f8cff);border:none;color:#fff;font-weight:800;cursor:pointer;">Desbloquear</button>
        </div>
        <div id="admPinErr" style="font-size:.7rem;color:#ff4444;text-align:center;margin-top:10px;min-height:14px;"></div>
      </div>
    `;
    document.body.appendChild(m);
    document.getElementById('admPinCancel').addEventListener('click', _closePin);
    document.getElementById('admPinOk').addEventListener('click', _submitPin);
    document.getElementById('admPinInp').addEventListener('keydown', e => {
      if (e.key === 'Enter') _submitPin();
    });
    // Tap fuera = cerrar
    m.addEventListener('click', e => { if (e.target === m) _closePin(); });
  }

  function _openPinPrompt() {
    ensurePinModal();
    document.getElementById('admPinErr').textContent = '';
    document.getElementById('admPinTxt').textContent = hasPin()
      ? 'Introduce el PIN para desbloquear'
      : 'Elige un PIN de 4 a 8 dígitos para este dispositivo';
    document.getElementById('admPinInp').value = '';
    document.getElementById('admPinModal').style.display = 'flex';
    setTimeout(() => { document.getElementById('admPinInp')?.focus(); }, 60);
  }

  function _closePin() {
    const m = document.getElementById('admPinModal');
    if (m) m.style.display = 'none';
  }

  async function _submitPin() {
    const inp = document.getElementById('admPinInp');
    const err = document.getElementById('admPinErr');
    const ok = await tryUnlock(inp.value);
    if (ok) {
      _closePin();
      if (typeof toast === 'function') toast('Panel admin desbloqueado ✓', 'good');
    } else {
      err.textContent = hasPin() ? 'PIN incorrecto' : 'De 4 a 8 dígitos, y ni 0000 ni 1234';
      inp.value = '';
      inp.focus();
      if (typeof vib === 'function') vib([50, 30, 50]);
    }
  }

  /* ── Activador: tap 5× en el avatar de perfil dentro de 2s ── */
  let _tapCount = 0;
  let _tapTimer = null;
  function attachPinTrigger() {
    const av = document.getElementById('npAv');
    if (!av || av._admPinAttached) return;
    av._admPinAttached = true;
    av.style.cursor = 'pointer';
    av.addEventListener('click', () => {
      // Solo para cuentas admin del NAS, y solo si el panel está bloqueado.
      if (!isAdminUser() || isUnlocked()) { _tapCount = 0; return; }
      _tapCount++;
      if (_tapTimer) clearTimeout(_tapTimer);
      _tapTimer = setTimeout(() => { _tapCount = 0; }, 2000);
      if (_tapCount >= 5) {
        _tapCount = 0;
        clearTimeout(_tapTimer);
        _openPinPrompt();
      }
    });
  }

  /* ── Mostrar/ocultar el panel según rol Y desbloqueo ── */
  function refreshPanelVisibility() {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = (isAdminUser() && isUnlocked()) ? 'block' : 'none';
  }

  const PLAN_LABEL = { free: 'Free', pro: 'Pro', pro_plus: 'Pro+', elite: 'Élite' };
  const fmtFecha = iso => new Date(iso).toLocaleDateString('es');
  const msgError = e => (typeof NAS !== 'undefined' && e && e.kind) ? NAS.friendly(e) : (e && e.message) || 'Error';

  function tarjetaUsuario(u) {
    const id = esc(u.id);
    return `
      <div style="background:var(--s2);border:1px solid var(--line2);border-radius:11px;padding:14px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:10px;">
          <div style="min-width:0;">
            <div style="font-size:.9rem;font-weight:800;word-break:break-all;">${esc(u.email)}${u.is_admin ? ' · admin' : ''}</div>
            <div style="font-size:.7rem;color:var(--t3);">${esc(u.workouts)} entrenos · desde ${esc(fmtFecha(u.created_at))}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:.65rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;">Plan</div>
            <div style="font-size:.95rem;font-weight:800;color:${u.plan === 'free' ? 'var(--t2)' : 'var(--green)'};">${esc(PLAN_LABEL[u.plan] || u.plan)}</div>
            ${u.plan_expires_at ? `<div style="font-size:.6rem;color:var(--t3);">hasta ${esc(fmtFecha(u.plan_expires_at))}</div>` : ''}
          </div>
        </div>
        ${u.is_admin ? '' : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <button class="adm-act" onclick="Admin.setPlan('${id}','pro',1)">Pro 1 mes</button>
          <button class="adm-act" onclick="Admin.setPlan('${id}','pro',12)">Pro 1 año</button>
          <button class="adm-act" onclick="Admin.setPlan('${id}','pro_plus',12)">Pro+ 1 año</button>
          <button class="adm-act" onclick="Admin.setPlan('${id}','pro_plus',null)">Pro+ infinito</button>
          <button class="adm-act" onclick="Admin.setPlan('${id}','elite',12)">Élite 1 año</button>
          <button class="adm-act" onclick="Admin.setPlan('${id}','elite',null)">Élite infinito</button>
          <button class="adm-act adm-danger" style="grid-column:1 / -1;" onclick="Admin.setPlan('${id}','free',null)">Quitar a Free</button>
        </div>`}
      </div>`;
  }

  /* ── Buscar usuarios por parte del email ── */
  async function searchUser() {
    if (!isAdminUser()) return;
    const q = document.getElementById('admSearchInp').value.trim();
    const resEl = document.getElementById('admSearchRes');
    if (!q) {
      resEl.innerHTML = '<div style="color:var(--t3);padding:12px;text-align:center;font-size:.82rem;">Escribe parte de un email.</div>';
      return;
    }
    resEl.innerHTML = '<div style="color:var(--t3);padding:12px;text-align:center;font-size:.82rem;">Buscando…</div>';
    try {
      const filas = await NAS.api('GET', '/admin/users?limit=20&q=' + encodeURIComponent(q));
      resEl.innerHTML = filas.length
        ? filas.map(tarjetaUsuario).join('')
        : '<div style="color:var(--red);padding:12px;text-align:center;font-size:.82rem;">No encontrado.</div>';
    } catch (e) {
      console.error('Admin search error:', e);
      resEl.innerHTML = '<div style="color:var(--red);padding:12px;font-size:.78rem;">Error: ' + esc(msgError(e)) + '</div>';
    }
  }

  /* ── Cambiar plan de un usuario ── */
  async function setPlan(id, plan, expiryMonths) {
    if (!isAdminUser()) return;
    const expiryTxt = expiryMonths === null ? 'infinito' : `${expiryMonths} mes(es)`;
    if (!confirm(`¿Cambiar plan de este usuario a ${PLAN_LABEL[plan]} (${plan === 'free' ? 'sin plan' : expiryTxt})?`)) return;
    try {
      await NAS.api('PUT', '/admin/users/' + encodeURIComponent(id) + '/plan', { plan, months: expiryMonths });
      toast(`Plan actualizado a ${PLAN_LABEL[plan]} ✓`, 'good');
      if (document.getElementById('admSearchInp').value.trim()) searchUser();
      listProUsers();
      loadStats();
    } catch (e) {
      console.error('Admin setPlan error:', e);
      toast('Error: ' + msgError(e), 'err');
    }
  }

  /* ── Lista de usuarios con plan de pago activo ── */
  async function listProUsers() {
    if (!isAdminUser()) return;
    const listEl = document.getElementById('admProList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:var(--t3);padding:10px;text-align:center;font-size:.78rem;">Cargando…</div>';
    try {
      const filas = (await NAS.api('GET', '/admin/users?pro=true&limit=200')).filter(u => !u.is_admin);
      if (!filas.length) {
        listEl.innerHTML = '<div style="color:var(--t3);padding:10px;text-align:center;font-size:.78rem;">No hay usuarios Pro activos.</div>';
        return;
      }
      listEl.innerHTML = filas.map(u => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;background:var(--s2);border:1px solid var(--line2);border-radius:9px;margin-bottom:5px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:700;word-break:break-all;">${esc(u.email)}</div>
            <div style="font-size:.65rem;color:var(--t3);">${esc(PLAN_LABEL[u.plan] || u.plan)} · ${u.plan_expires_at ? 'expira ' + esc(fmtFecha(u.plan_expires_at)) : 'infinito'}</div>
          </div>
          <button class="adm-mini" onclick="Admin.setPlan('${esc(u.id)}','free',null)">Quitar</button>
        </div>
      `).join('');
    } catch (e) {
      console.error('Admin listProUsers error:', e);
      listEl.innerHTML = '<div style="color:var(--red);padding:10px;font-size:.78rem;">Error: ' + esc(msgError(e)) + '</div>';
    }
  }

  /* ── Stats globales ── */
  async function loadStats() {
    if (!isAdminUser()) return;
    const el = document.getElementById('admStats');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--t3);padding:10px;text-align:center;font-size:.78rem;">Calculando…</div>';
    const caja = (n, txt, color) => `
          <div style="background:var(--s2);border:1px solid var(--line2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:800;color:${color};">${esc(n)}</div>
            <div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;">${txt}</div>
          </div>`;
    try {
      const st = await NAS.api('GET', '/admin/stats');
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${caja(st.users, 'Usuarios', 'var(--a)')}${caja(st.pro_users, 'Pro Activos', 'var(--green)')}${caja(st.workouts, 'Sesiones', 'var(--amber)')}</div>`;
    } catch (e) {
      console.error('Admin loadStats error:', e);
      el.innerHTML = '<div style="color:var(--red);padding:10px;font-size:.78rem;">Error: ' + esc(msgError(e)) + '</div>';
    }
  }

  /* ── Broadcast: anuncio que ven todos los usuarios ── */
  async function setBroadcast() {
    if (!isAdminUser()) return;
    const inp = document.getElementById('admBroadcastInp');
    const msg = inp.value.trim();
    if (!msg) return toast('Escribe un mensaje', 'err');
    try {
      await NAS.api('PUT', '/admin/broadcast', { message: msg });
      toast('Mensaje enviado a todos ✓', 'good');
      inp.value = '';
    } catch (e) {
      console.error('Admin broadcast error:', e);
      toast('Error: ' + msgError(e), 'err');
    }
  }

  async function clearBroadcast() {
    if (!isAdminUser()) return;
    if (!confirm('¿Borrar el mensaje broadcast actual?')) return;
    try {
      await NAS.api('DELETE', '/admin/broadcast');
      toast('Mensaje borrado ✓', 'good');
    } catch (e) {
      toast('Error: ' + msgError(e), 'err');
    }
  }

  /* ── Para todos los usuarios: mostrar el anuncio una vez al entrar ── */
  async function checkAndShowBroadcast() {
    if (typeof NAS === 'undefined' || !NAS.loggedIn()) return;
    try {
      const data = await NAS.api('GET', '/broadcast');
      if (!data) return;
      const lastSeen = localStorage.getItem(BROADCAST_LAST_SEEN_KEY);
      if (lastSeen && +lastSeen === +data.id) return; // Ya visto
      if (typeof toast === 'function') setTimeout(() => toast('📢 ' + data.message, 'ok'), 1500);
      localStorage.setItem(BROADCAST_LAST_SEEN_KEY, String(data.id));
    } catch (e) {
      // Silencio: sin conexión, o API sin actualizar, el anuncio simplemente no se muestra
    }
  }

  /* ── Inicialización del panel cuando estamos en la pestaña de perfil ── */
  function onProfileVisible() {
    // El trigger del PIN se engancha siempre (no muestra nada para no-admins).
    attachPinTrigger();
    refreshPanelVisibility();
    if (isAdminUser() && isUnlocked()) {
      loadStats();
      listProUsers();
    }
  }

  return {
    isAdminUser,
    isUnlocked,
    refreshPanelVisibility,
    searchUser,
    setPlan,
    listProUsers,
    loadStats,
    setBroadcast,
    clearBroadcast,
    checkAndShowBroadcast,
    onProfileVisible,
    // Seguridad
    lockPanel,
    changePin,
    changePinFromInput,
    // Internos expuestos por el modal (no llamar a mano)
    _cancelPin: _closePin,
    _submitPin
  };
})();
