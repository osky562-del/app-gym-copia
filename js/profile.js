/* ══ PERFIL — paridad con ProfileScreen.kt (Android) ══
   Orden: identidad · Hazte PRO · Ayuda · Color de la app · Personalización · Tus datos ·
   Peso corporal · Idioma · Salud y reloj · Copia en el NAS · Cerrar sesión. */
function getUserName() { return STORE.get('name') || ''; }
function updateGreeting() {
  const n = getUserName();
  const g = $('greetName'); if (g) g.textContent = n || 'Atleta';
}

/* ── Preferencias de personalización (mismas claves que UserPrefs en Android) ── */
const AVATARS = ['💪', '🔥', '🏋️', '🦁', '🐺', '⚡️', '🥇', '👑', '🦍', '🚀', '🎯', '🧠'];
const PREF_DEFAULTS = { pureBlack: false, haptics: true, restSound: true, coachProactive: true, startTab: 0 };
function prefGet(k) { const v = STORE.get(k); return (v === null || v === undefined) ? PREF_DEFAULTS[k] : v; }
function prefSet(k, v) {
  STORE.set(k, v);
  if (k === 'pureBlack') applyPureBlack();
  renderPersonal();
}
function getAvatar() { return STORE.get('avatar') || '💪'; }
function setAvatar(e) { STORE.set('avatar', e); renderProfile(); }
function applyPureBlack() {
  const root = document.documentElement;
  if (prefGet('pureBlack')) root.style.setProperty('--bg', '#000000'); else root.style.removeProperty('--bg');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', prefGet('pureBlack') ? '#000000' : '#0a0a0a');
}
applyPureBlack();

/* Email de la cuenta del NAS o null en modo local. */
function profileEmail() {
  try {
    if (typeof NAS !== 'undefined' && NAS.enabled() && NAS.loggedIn()) { const u = NAS.user(); if (u && u.email) return u.email; }
  } catch (e) { }
  return null;
}
function isLocalSession() { return localStorage.getItem('ko95_sess') === 'local' || !profileEmail(); }

/* ── Render completo de la pestaña ── */
function renderProfile() {
  if (!$('npName')) return;
  const n = getUserName(), email = profileEmail();
  $('npAv').textContent = getAvatar();
  $('npName').textContent = n || email || I18N.t('Modo local (sin cuenta)');
  $('npSub').textContent = email || '';
  $('npSub').style.display = email ? '' : 'none';

  renderAccentGrid();
  renderPersonal();

  // Tus datos
  const p = STORE.get('perfil') || {};
  if ($('pfNombre')) $('pfNombre').value = n;
  if ($('pfAltura')) $('pfAltura').value = p.altura || '';
  if ($('pfObjetivo')) $('pfObjetivo').value = p.objetivo || '';
  renderSexPills(p.sexo || '');
  const sb = $('pfSaveBtn'); if (sb) { sb.textContent = I18N.t('Guardar'); sb.classList.remove('saved'); }

  renderWeight();
  renderNasCard();

  // Sesión
  const local = isLocalSession();
  const lo = $('profLogoutTxt'); if (lo) lo.textContent = I18N.t(local ? 'Salir del modo local' : 'Cerrar sesión');
  const acc = $('profAccountSec'); if (acc) acc.style.display = local ? 'none' : '';
}

/* ── Color de la app (Theme.kt: 8 colores + personalizado) ── */
const ACCENTS = {
  red:    { hex: '#ff3b30' },
  blue:   { hex: '#4f8cff' },
  green:  { hex: '#2dd98a' },
  purple: { hex: '#a57aff' },
  orange: { hex: '#ff9f40' },
  pink:   { hex: '#ff5c8a' },
  teal:   { hex: '#22d3d3' },
  gold:   { hex: '#f5a623' },
};
function accentKey() {
  const k = STORE.get('accent') || 'red';
  if (k === 'amber') return 'orange';           // nombre antiguo de la web
  return (k === 'custom' || ACCENTS[k]) ? k : 'red';
}
function accentHex(k) {
  if (k === 'custom') return STORE.get('accentCustom') || ACCENTS.red.hex;
  return (ACCENTS[k] || ACCENTS.red).hex;
}
function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return 'rgba(255,59,48,' + a + ')';
  return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
}
function renderAccentGrid() {
  const grid = $('accentGrid'); if (!grid) return;
  const cur = accentKey();
  const isPro = Pro.isPro();
  let html = '';
  Object.keys(ACCENTS).forEach(k => {
    const sel = cur === k, locked = !Pro.isAccentAvailable(k);
    html += `<div class="acc-sw${sel ? ' on' : ''}" data-accent="${k}" style="background:${ACCENTS[k].hex}" onclick="setAccent('${k}',this)">${locked ? '<span class="acc-lock">🔒</span>' : sel ? '<span class="acc-check">✓</span>' : ''}</div>`;
  });
  const cs = cur === 'custom';
  html += `<div class="acc-sw acc-custom${cs ? ' on' : ''}" style="background:${cs ? accentHex('custom') : 'var(--s3)'}" onclick="pickCustomAccent()">${isPro ? '🎨' : '<span class="acc-lock">🔒</span>'}</div>`;
  html += `<input type="color" id="accentCustomInp" value="${accentHex(cur === 'custom' ? 'custom' : cur)}" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;" oninput="setCustomAccent(this.value)">`;
  grid.innerHTML = html;
  const lim = $('accentLimit');
  if (lim) lim.style.display = isPro ? 'none' : '';
}
function setAccent(color, el) {
  if (color === 'amber') color = 'orange';
  if (!Pro.isAccentAvailable(color)) { Pro.showUpgradeModal('custom_themes'); return; }
  STORE.set('accent', color);
  document.querySelectorAll('.ob-color').forEach(sw => sw.classList.toggle('on', sw.dataset.accent === color));
  applyAccent();
  renderAccentGrid();
}
function pickCustomAccent() {
  if (!Pro.isPro()) { Pro.showUpgradeModal('custom_themes'); return; }
  const inp = $('accentCustomInp'); if (inp) inp.click();
}
function setCustomAccent(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
  STORE.set('accentCustom', hex.toLowerCase());
  STORE.set('accent', 'custom');
  applyAccent();
  const sw = document.querySelector('.acc-custom'); if (sw) { sw.style.background = hex; sw.classList.add('on'); }
  document.querySelectorAll('.acc-sw:not(.acc-custom)').forEach(s => s.classList.remove('on'));
}
function obColor(color, btn) { setAccent(color, btn); }
function applyAccent() {
  const hex = accentHex(accentKey());
  const root = document.documentElement;
  root.style.setProperty('--a', hex);
  root.style.setProperty('--ag', hexToRgba(hex, 0.12));
  document.querySelectorAll('.p-accent').forEach(e => e.style.color = hex);
  const c = $('bwChart'); if (c && c.offsetParent) renderWeight();
}
applyAccent();

/* ── Personalización: avatar, interruptores y pantalla de inicio ── */
function renderPersonal() {
  const av = $('avatarRow');
  if (av) {
    const cur = getAvatar();
    av.innerHTML = AVATARS.map(e => `<button type="button" class="np-avatar${e === cur ? ' on' : ''}" onclick="setAvatar('${e}')">${e}</button>`).join('');
  }
  ['pureBlack', 'haptics', 'restSound', 'coachProactive'].forEach(k => {
    const t = $('tg_' + k); if (t) t.classList.toggle('on', !!prefGet(k));
  });
  const st = +prefGet('startTab') || 0;
  document.querySelectorAll('#startTabRow .np-seg').forEach((b, i) => b.classList.toggle('on', i === st));
}
function togglePref(k) { prefSet(k, !prefGet(k)); if (typeof vib === 'function') vib([10]); }
function setStartTab(i) { prefSet('startTab', Math.min(Math.max(+i || 0, 0), 3)); }

/* ── Tus datos ── */
let _pfSex = '';
function renderSexPills(v) {
  _pfSex = v || '';
  const h = $('pfSexoH'), m = $('pfSexoM');
  if (h) h.classList.toggle('on', _pfSex === 'hombre');
  if (m) m.classList.toggle('on', _pfSex === 'mujer');
}
function setProfileSex(v) {
  renderSexPills(v);
  const p = STORE.get('perfil') || {}; p.sexo = v; STORE.set('perfil', p);
  const sb = $('pfSaveBtn'); if (sb) { sb.textContent = I18N.t('Guardar'); sb.classList.remove('saved'); }
}
function saveProfileData() {
  const name = ($('pfNombre').value || '').trim();
  const p = STORE.get('perfil') || {};
  const h = parseInt($('pfAltura').value, 10);
  p.altura = (h > 0) ? h : 0;
  p.objetivo = ($('pfObjetivo').value || '').trim();
  if (_pfSex) p.sexo = _pfSex;
  if (name) p.nombre = name;
  STORE.set('perfil', p);
  STORE.set('name', name);
  updateGreeting();
  const sb = $('pfSaveBtn'); if (sb) { sb.textContent = I18N.t('Guardado ✓'); sb.classList.add('saved'); }
  renderProfile();
  if (sb) { sb.textContent = I18N.t('Guardado ✓'); sb.classList.add('saved'); }
  try { if (typeof renderDash === 'function') renderDash(); } catch (e) { }
  try { if (typeof NAS !== 'undefined' && NAS.enabled() && NAS.loggedIn()) setTimeout(() => NAS.sync(), 400); } catch (e) { }
}

/* ── Peso corporal: registro + último peso + evolución (gráfica de línea, 70 px) ── */
function addBodyWeight() {
  const inp = $('bwInput');
  const w = parseFloat(String(inp.value).replace(',', '.'));
  if (!w || w < 20 || w > 300) { toast(I18N.t('Peso inválido'), 'err'); return; }
  const d = new Date(); const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const idx = weightLogs.findIndex(l => l.date === ymd);
  if (idx >= 0) weightLogs[idx].weight = w; else weightLogs.push({ date: ymd, weight: w });
  weightLogs.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  saveWeights();
  inp.value = '';
  renderWeight();
  try { if (typeof NAS !== 'undefined' && NAS.enabled() && NAS.loggedIn()) setTimeout(() => NAS.sync(), 400); } catch (e) { }
}
function fmtKg(v) { return (Math.round(v * 10) / 10).toString().replace(/\.0$/, ''); }
function renderWeight() {
  const empty = $('bwEmpty'), data = $('bwData'); if (!empty || !data) return;
  const logs = [...(weightLogs || [])].filter(l => +l.weight > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!logs.length) { empty.style.display = ''; data.style.display = 'none'; return; }
  empty.style.display = 'none'; data.style.display = '';
  const last = +logs[logs.length - 1].weight, first = +logs[0].weight, delta = last - first;
  $('bwLast').textContent = fmtKg(last) + ' kg';
  const de = $('bwDelta');
  if (logs.length > 1) {
    de.style.display = '';
    de.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' kg';
    de.style.color = delta > 0 ? 'var(--a)' : '#2dd98a';
  } else de.style.display = 'none';
  drawWeightChart($('bwChart'), logs);
}
function drawWeightChart(c, logs) {
  if (!c) return;
  const w = c.clientWidth || 300, h = 70, dpr = window.devicePixelRatio || 1;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const kgs = logs.map(l => +l.weight);
  const min = Math.min(...kgs), max = Math.max(...kgs), range = Math.max(max - min, 0.1);
  const n = logs.length;
  const pts = logs.map((l, i) => ({ x: n <= 1 ? w / 2 : i / (n - 1) * (w - 10) + 5, y: h * 0.9 - ((+l.weight - min) / range) * (h * 0.8) }));
  const col = getComputedStyle(document.documentElement).getPropertyValue('--a').trim() || '#ff3b30';
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (pts.length >= 2) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
  pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
}

/* ── Copia en el NAS (frase según NasEstado.kt) ── */
function fmtDateTime(ms) {
  try { const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); } catch (e) { return ''; }
}
/* Mismo orden que resumenNas(): copiando · falló · pendientes · rechazados · nunca · todo copiado. */
function nasSummary(s) {
  const t = I18N.t;
  const pend = +s.pending || 0;
  const rej = Array.isArray(s.rejectedIds) ? s.rejectedIds.length : (+s.rejected || 0);
  if (s.syncing) return { text: t('Copiando al NAS…'), color: 'var(--t1)' };
  if (s.lastError) return { text: t('No se ha podido copiar en el NAS') + (pend > 0 ? ' · ' + t('Pendiente de copiar') + ': ' + pend : ''), color: '#f5a623' };
  if (pend > 0) return { text: t('Pendiente de copiar') + ': ' + pend, color: 'var(--t1)' };
  if (rej > 0) return { text: t('Hay entrenos que el NAS no aceptó'), color: '#f5a623' };
  if (!s.lastOkMs) return { text: t('Sin copiar todavía'), color: 'var(--t3)' };
  return { text: t('Todo copiado en el NAS ✓') + ' · ' + t('última vez') + ': ' + fmtDateTime(s.lastOkMs), color: '#2dd98a' };
}
function renderNasCard() {
  const sec = $('nasSec'); if (!sec) return;
  const on = typeof NAS !== 'undefined' && NAS.enabled() && NAS.loggedIn() && typeof NAS.status === 'function';
  sec.style.display = on ? '' : 'none';
  if (!on) return;
  const s = NAS.status();
  const r = nasSummary(s);
  const st = $('nasStateTxt'); st.textContent = r.text; st.style.color = r.color;
  const er = $('nasErrTxt'); er.textContent = s.lastError || ''; er.style.display = s.lastError ? '' : 'none';
  const rj = $('nasRejected');
  const ids = Array.isArray(s.rejectedIds) ? s.rejectedIds : [];
  if (ids.length) {
    rj.style.display = '';
    rj.innerHTML = `<div style="font-size:.78rem;font-weight:600;color:var(--t1);margin-top:10px;">${I18N.t('El NAS no ha aceptado estos entrenos (siguen guardados en el móvil):')}</div>` +
      ids.map(id => `<div style="margin-top:6px;"><div style="font-size:.72rem;font-weight:600;color:var(--a);word-break:break-all;">${id}</div><button type="button" class="np-link" onclick="NAS.forgetRejected('${String(id).replace(/'/g, "\\'")}');renderNasCard()">${I18N.t('Entendido, quitar el aviso')}</button></div>`).join('');
  } else { rj.style.display = 'none'; rj.innerHTML = ''; }
}
function nasRetryNow() { try { if (typeof NAS !== 'undefined') { NAS.sync(); if (typeof vib === 'function') vib([10]); } } catch (e) { } }
window.addEventListener('nas-sync', () => { const pg = $('pageProf'); if (pg && pg.classList.contains('on')) renderNasCard(); });

/* ── Sesión ── */
function exitLocalMode() {
  localStorage.removeItem('ko95_sess');
  const ov = $('authOverlay'); if (ov) ov.classList.add('show');
}
function profileSignOut() { if (isLocalSession()) exitLocalMode(); else logoutCloud(); }
function profileLogoutAll() {
  if (typeof NAS === 'undefined' || !NAS.loggedIn()) return;
  if (!confirm(I18N.t('Se cerrará la sesión en este móvil y en cualquier otro aparato (incluido el iPhone). Tendrás que volver a entrar con tu email y contraseña. Tus entrenos no se borran.'))) return;
  NAS.logoutAll().catch(e => showAccountNotice(NAS.friendly(e), true));
}
function profileDeleteAccount() {
  if (typeof NAS === 'undefined' || !NAS.loggedIn()) return;
  if (!confirm(I18N.t('Esto borra tu cuenta y TODOS sus datos del NAS, y no se puede deshacer. Los entrenos guardados en este móvil no se borran.'))) return;
  const typed = prompt(I18N.t('Para confirmar, escribe BORRAR en mayúsculas.'), '');
  if ((typed || '').trim() !== 'BORRAR') return;
  NAS.deleteAccount().then(() => {
    renderProfile();
    showAccountNotice(I18N.t('Cuenta borrada del NAS. Tus entrenos siguen en este móvil.'), false);
  }).catch(e => showAccountNotice(NAS.friendly(e), true));
}
function showAccountNotice(msg, isErr) {
  const el = $('profAccountMsg'); if (!el) return;
  el.style.display = '';
  el.innerHTML = `<div style="font-size:.78rem;color:${isErr ? '#ff5555' : '#2dd98a'};line-height:1.45;">${msg}</div><button type="button" class="np-link" onclick="this.parentNode.style.display='none'">${I18N.t('Cerrar')}</button>`;
}

/* "Tamaño de texto" ya no existe en Perfil (paridad con Android); la barra superior oculta aún lo referencia. */
function cycleFontSize() { }

/* ── Sonido al terminar descanso: respeta el interruptor (rest.js define playRestEndSound) ── */
(function () {
  const prev = window.playRestEndSound;
  if (typeof prev !== 'function') return;
  window.playRestEndSound = function () { if (prefGet('restSound') === false) return; return prev.apply(this, arguments); };
})();
