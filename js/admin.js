/* ══════════════════════════════════════════════
   ADMIN — Panel de control (solo visible para UID admin)
   ══════════════════════════════════════════════ */

const Admin = (function() {

  const ADMIN_UIDS = ['sQCUoNHTPmWo2Nf42xICmE3FZAT2'];
  const BROADCAST_LAST_SEEN_KEY = 'ko95_lastBroadcastId';

  function isAdminUser() {
    return fbUser && ADMIN_UIDS.includes(fbUser.uid);
  }

  /* ── Mostrar/ocultar el panel según rol ── */
  function refreshPanelVisibility() {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = isAdminUser() ? 'block' : 'none';
  }

  /* ── Buscar usuario por email O nombre ── */
  async function searchUser() {
    if (!isAdminUser()) return;
    const q = document.getElementById('admSearchInp').value.trim();
    const resEl = document.getElementById('admSearchRes');
    if (!q) {
      resEl.innerHTML = '<div style="color:var(--t3);padding:12px;text-align:center;font-size:.82rem;">Escribe un email o nombre.</div>';
      return;
    }
    resEl.innerHTML = '<div style="color:var(--t3);padding:12px;text-align:center;font-size:.82rem;">Buscando…</div>';
    try {
      let uid = null;
      let userName = null;

      // 1) Si parece email → buscar entre usuarios por perfil.email
      // 2) Si no, buscar por username en /usernames
      if (q.includes('@')) {
        // Buscar por email — recorremos usernames y comparamos perfil.email (lento pero ok para admin)
        const usersSnap = await fbDb.collection('users').get();
        for (const doc of usersSnap.docs) {
          const data = doc.data() || {};
          const perfilEmail = data.perfil?.email || data.email;
          if (perfilEmail && perfilEmail.toLowerCase() === q.toLowerCase()) {
            uid = doc.id;
            userName = data.perfil?.nombre || '';
            break;
          }
        }
      } else {
        const userKey = q.toLowerCase().replace(/\s/g, '');
        const nameDoc = await fbDb.collection('usernames').doc(userKey).get();
        if (nameDoc.exists) {
          uid = nameDoc.data().uid;
          userName = nameDoc.data().name;
        }
      }

      if (!uid) {
        resEl.innerHTML = '<div style="color:var(--red);padding:12px;text-align:center;font-size:.82rem;">No encontrado.</div>';
        return;
      }

      // Cargar el plan actual del usuario
      const subDoc = await fbDb.collection('users').doc(uid).collection('subscription').doc('plan').get();
      const sub = subDoc.exists ? subDoc.data() : null;
      const plan = sub?.plan || 'free';
      const expiry = sub?.expiry ? sub.expiry.toDate() : null;
      const expiryTxt = expiry ? expiry.toLocaleDateString('es') : 'infinito';

      // Cargar perfil del usuario
      const userDoc = await fbDb.collection('users').doc(uid).get();
      const perfil = userDoc.exists ? (userDoc.data().perfil || {}) : {};
      const nombre = userName || perfil.nombre || '—';

      resEl.innerHTML = `
        <div style="background:var(--s2);border:1px solid var(--line2);border-radius:11px;padding:14px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:10px;">
            <div>
              <div style="font-size:.95rem;font-weight:800;">${nombre}</div>
              <div style="font-size:.7rem;color:var(--t3);font-family:var(--fm);word-break:break-all;">${uid}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:.65rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;">Plan</div>
              <div style="font-size:.95rem;font-weight:800;color:${plan==='free'?'var(--t2)':'var(--green)'};">${plan.toUpperCase()}</div>
              ${expiry ? `<div style="font-size:.6rem;color:var(--t3);">hasta ${expiryTxt}</div>` : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
            <button class="adm-act" onclick="Admin.setPlan('${uid}','pro',1)">Pro 1 mes</button>
            <button class="adm-act" onclick="Admin.setPlan('${uid}','pro',12)">Pro 1 año</button>
            <button class="adm-act" onclick="Admin.setPlan('${uid}','pro_plus',12)">Pro+ 1 año</button>
            <button class="adm-act" onclick="Admin.setPlan('${uid}','pro_plus',null)">Pro+ infinito</button>
            <button class="adm-act adm-danger" style="grid-column:1 / -1;" onclick="Admin.setPlan('${uid}','free',null)">Quitar a Free</button>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Admin search error:', e);
      resEl.innerHTML = '<div style="color:var(--red);padding:12px;font-size:.78rem;">Error: ' + e.message + '</div>';
    }
  }

  /* ── Cambiar plan de un usuario ── */
  async function setPlan(uid, plan, expiryMonths) {
    if (!isAdminUser()) return;
    const planLabel = plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Pro+';
    const expiryTxt = expiryMonths === null ? 'infinito' : `${expiryMonths} mes(es)`;
    if (!confirm(`¿Cambiar plan de este usuario a ${planLabel} (${expiryTxt})?`)) return;

    try {
      const expiry = expiryMonths === null
        ? null
        : new Date(Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000);

      await fbDb.collection('users').doc(uid)
        .collection('subscription').doc('plan')
        .set({
          plan,
          expiry: expiry,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          grantedBy: 'admin'
        });
      toast(`Plan actualizado a ${planLabel} ✓`, 'good');
      searchUser(); // refrescar
      listProUsers();
    } catch (e) {
      console.error('Admin setPlan error:', e);
      toast('Error: ' + e.message, 'err');
    }
  }

  /* ── Lista de usuarios Pro activos ── */
  async function listProUsers() {
    if (!isAdminUser()) return;
    const listEl = document.getElementById('admProList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="color:var(--t3);padding:10px;text-align:center;font-size:.78rem;">Cargando…</div>';
    try {
      // Recorremos /users → para cada uno leemos su subscription
      const usersSnap = await fbDb.collection('users').get();
      const proUsers = [];
      for (const userDoc of usersSnap.docs) {
        const subSnap = await fbDb.collection('users').doc(userDoc.id)
          .collection('subscription').doc('plan').get();
        if (!subSnap.exists) continue;
        const sub = subSnap.data();
        if (sub.plan === 'pro' || sub.plan === 'pro_plus') {
          const expiry = sub.expiry ? sub.expiry.toDate() : null;
          // Si ya expiró, no lo mostramos como Pro
          if (expiry && new Date() > expiry) continue;
          const perfil = userDoc.data().perfil || {};
          proUsers.push({
            uid: userDoc.id,
            nombre: perfil.nombre || '—',
            plan: sub.plan,
            expiry
          });
        }
      }
      if (!proUsers.length) {
        listEl.innerHTML = '<div style="color:var(--t3);padding:10px;text-align:center;font-size:.78rem;">No hay usuarios Pro activos.</div>';
        return;
      }
      listEl.innerHTML = proUsers.map(u => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 11px;background:var(--s2);border:1px solid var(--line2);border-radius:9px;margin-bottom:5px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:700;">${u.nombre}</div>
            <div style="font-size:.65rem;color:var(--t3);">${u.plan === 'pro_plus' ? 'Pro+' : 'Pro'} · ${u.expiry ? 'expira ' + u.expiry.toLocaleDateString('es') : 'infinito'}</div>
          </div>
          <button class="adm-mini" onclick="Admin.setPlan('${u.uid}','free',null)">Quitar</button>
        </div>
      `).join('');
    } catch (e) {
      console.error('Admin listProUsers error:', e);
      listEl.innerHTML = '<div style="color:var(--red);padding:10px;font-size:.78rem;">Error: ' + e.message + '</div>';
    }
  }

  /* ── Stats globales ── */
  async function loadStats() {
    if (!isAdminUser()) return;
    const el = document.getElementById('admStats');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--t3);padding:10px;text-align:center;font-size:.78rem;">Calculando…</div>';
    try {
      const usersSnap = await fbDb.collection('users').get();
      let totalSess = 0, totalUsers = usersSnap.size;
      let proCount = 0;
      // Contar Pro y sesiones
      for (const userDoc of usersSnap.docs) {
        const wkSnap = await fbDb.collection('users').doc(userDoc.id).collection('workouts').get();
        totalSess += wkSnap.size;
        const subSnap = await fbDb.collection('users').doc(userDoc.id).collection('subscription').doc('plan').get();
        if (subSnap.exists) {
          const sub = subSnap.data();
          const expiry = sub.expiry ? sub.expiry.toDate() : null;
          if ((sub.plan === 'pro' || sub.plan === 'pro_plus') && (!expiry || new Date() <= expiry)) {
            proCount++;
          }
        }
      }
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:var(--s2);border:1px solid var(--line2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:800;color:var(--a);">${totalUsers}</div>
            <div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;">Usuarios</div>
          </div>
          <div style="background:var(--s2);border:1px solid var(--line2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:800;color:var(--green);">${proCount}</div>
            <div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;">Pro Activos</div>
          </div>
          <div style="background:var(--s2);border:1px solid var(--line2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:800;color:var(--amber);">${totalSess}</div>
            <div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;">Sesiones</div>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Admin loadStats error:', e);
      el.innerHTML = '<div style="color:var(--red);padding:10px;font-size:.78rem;">Error: ' + e.message + '</div>';
    }
  }

  /* ── Broadcast: anuncio que ven todos los usuarios ── */
  async function setBroadcast() {
    if (!isAdminUser()) return;
    const inp = document.getElementById('admBroadcastInp');
    const msg = inp.value.trim();
    if (!msg) return toast('Escribe un mensaje', 'err');
    try {
      await fbDb.collection('admin').doc('broadcast').set({
        msg,
        id: Date.now(),
        createdBy: fbUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      toast('Mensaje enviado a todos ✓', 'good');
      inp.value = '';
    } catch (e) {
      console.error('Admin broadcast error:', e);
      toast('Error: ' + e.message, 'err');
    }
  }

  async function clearBroadcast() {
    if (!isAdminUser()) return;
    if (!confirm('¿Borrar el mensaje broadcast actual?')) return;
    try {
      await fbDb.collection('admin').doc('broadcast').delete();
      toast('Mensaje borrado ✓', 'good');
    } catch (e) {
      toast('Error: ' + e.message, 'err');
    }
  }

  /* ── Para usuarios normales: mostrar broadcast al iniciar sesión ── */
  async function checkAndShowBroadcast() {
    if (!fbDb || !fbUser) return;
    try {
      const snap = await fbDb.collection('admin').doc('broadcast').get();
      if (!snap.exists) return;
      const data = snap.data();
      const lastSeen = localStorage.getItem(BROADCAST_LAST_SEEN_KEY);
      if (lastSeen && +lastSeen === +data.id) return; // Ya visto
      // Mostrar como toast con duración larga
      if (typeof toast === 'function') {
        setTimeout(() => toast('📢 ' + data.msg, 'ok'), 1500);
      }
      localStorage.setItem(BROADCAST_LAST_SEEN_KEY, String(data.id));
    } catch (e) {
      // Silencio: si fallan permisos, el broadcast simplemente no se muestra
    }
  }

  /* ── Inicialización del panel cuando estamos en la pestaña de perfil ── */
  function onProfileVisible() {
    refreshPanelVisibility();
    if (isAdminUser()) {
      loadStats();
      listProUsers();
    }
  }

  return {
    isAdminUser,
    refreshPanelVisibility,
    searchUser,
    setPlan,
    listProUsers,
    loadStats,
    setBroadcast,
    clearBroadcast,
    checkAndShowBroadcast,
    onProfileVisible
  };
})();

// Comprobar broadcast cuando termine de iniciar Firebase
setTimeout(() => {
  if (typeof Admin !== 'undefined' && fbUser) Admin.checkAndShowBroadcast();
}, 2500);
