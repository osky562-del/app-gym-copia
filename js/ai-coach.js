/* ══ COACH — paridad con CoachScreen.kt / CoachViewModel.kt (Android) ══
   Tarjetas: 🧠 Análisis del Coach (Free: candado; Pro: "✨ Analízame ahora" → EvidenceCoach.analyze),
   🩹 Molestias y dolores (guardadas en STORE 'pains' y pasadas al análisis) y "Tus métricas" (IMC y
   proteína con el peso/altura del Perfil). Sin IA externa, sin caché por horas, resultado instantáneo. */

const PAIN_ZONES = ['Hombro', 'Codo', 'Muñeca', 'Espalda baja', 'Rodilla', 'Cadera', 'Cuello', 'Tobillo', 'Otro'];

function getPains() { return STORE.get('pains') || []; }
function savePains(list) { STORE.set('pains', list); }
/* Molestias de los últimos N días (CoachAnalysisRepository usa 14). */
function painsRecent(days) {
  const lim = new Date(); lim.setDate(lim.getDate() - (days || 14)); lim.setHours(0, 0, 0, 0);
  return getPains().filter(p => { const d = new Date(String(p.date) + 'T00:00:00'); return isNaN(d) || d >= lim; });
}
function todayYmd() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function escH(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* Nivel global como CoachLevel.overallFrom: media de los niveles por levantamiento (estándares de
   strength.js) con techo por nº de entrenos. Devuelve la clave que usa evidence-coach.js. */
function coachOverallLevel() {
  const KEYS = ['novato', 'principiante', 'intermedio', 'avanzado', 'elite'];
  const n = workouts.length;
  const cap = n < 8 ? 0 : n < 20 ? 1 : n < 50 ? 2 : n < 100 ? 3 : 4;
  let lifts = [];
  try { if (typeof computeLiftLevels === 'function') lifts = computeLiftLevels(); } catch (e) { lifts = []; }
  if (!lifts.length) return KEYS[cap];
  const ORD = { 'Novato': 0, 'Principiante': 1, 'Intermedio': 2, 'Avanzado': 3, 'Élite': 4 };
  const avg = lifts.reduce((s, l) => s + (ORD[l.level] || 0), 0) / lifts.length;
  const byStrength = Math.min(Math.max(Math.round(avg), 0), 4);
  return KEYS[Math.min(byStrength, cap)];
}
/* Nº de alertas por plan (Pro.kt coachCadence): Pro 3 · Pro+ 4 · Élite 5. */
function coachMaxAlerts() {
  const p = Pro.getPlanName();
  return p === 'elite' ? 5 : p === 'pro_plus' ? 4 : 3;
}
function coachProfile() {
  const p = STORE.get('perfil') || {};
  const weight = (typeof getBodyweight === 'function' ? getBodyweight() : 0) || +p.peso || 0;
  return { weight, height: +p.altura || 0, goal: p.objetivo || '' };
}

/* ── Render de la pantalla ── */
function renderCoach() {
  const root = $('coachRoot'); if (!root) return;
  const t = I18N.t;
  const pro = Pro.isPro();
  const { weight, height } = coachProfile();
  const imc = (weight > 0 && height > 0) ? Math.round(weight / Math.pow(height / 100, 2) * 10) / 10 : null;
  const pMin = weight > 0 ? Math.round(weight * 1.8) : null, pMax = weight > 0 ? Math.round(weight * 2.2) : null;

  let analysisHtml;
  if (!pro) {
    analysisHtml = `
      <div class="co-lock">🔒 ${t('El Coach es de pago')}</div>
      <div class="co-teaser">⭐ <span>${t('Con un plan de pago, el Coach analiza tus entrenos, te avisa de estancamientos y te propone rutinas adaptadas a tus molestias. Pruébalo gratis unos días.')}</span></div>`;
  } else {
    analysisHtml = `<button class="co-btn" id="coachAnalyzeBtn" onclick="coachAnalyzeNow()">✨ ${t('Analízame ahora')}</button><div id="coachResult"></div>`;
  }

  const pains = getPains();
  const painsHtml = pains.length
    ? pains.map((p, i) => {
      const meta = [p.date, p.nota].filter(Boolean).join(' · ');
      return `<div class="co-pain"><div style="flex:1;min-width:0;"><div class="co-pain-t">${escH(p.zona)} · ${t('dolor')} ${+p.severidad || 0}/5</div>${meta ? `<div class="co-pain-m">${escH(meta)}</div>` : ''}</div><button type="button" class="co-x" onclick="removePain(${i})">✕</button></div>`;
    }).join('')
    : `<div class="co-muted" style="margin-top:10px;">${t('Sin molestias registradas.')}</div>`;

  root.innerHTML = `
    <div class="co-card">
      <div class="co-h"><span class="co-ic">🧠</span><span class="co-t">${t('Análisis del Coach')}</span></div>
      <div class="co-sub">${t('Tu entrenador revisa tu progreso y te avisa de lo importante.')}</div>
      <div style="height:12px"></div>
      ${analysisHtml}
    </div>
    <div class="co-card">
      <div class="co-h"><span class="co-t" style="flex:1">🩹 ${t('Molestias y dolores')}</span><button type="button" class="co-add" onclick="openPainDialog()">+ ${t('Añadir')}</button></div>
      <div class="co-sub">${t('El Coach las tiene en cuenta para ajustar los consejos.')}</div>
      ${painsHtml}
    </div>
    <div class="co-card">
      <div class="co-t">${t('Tus métricas')}</div>
      <div style="height:10px"></div>
      ${(weight > 0 && height > 0)
      ? `<div class="co-metrics"><div class="co-metric"><div class="co-mv">${imc}</div><div class="co-ml">${t('IMC')}</div></div><div class="co-metric"><div class="co-mv">${pMin != null ? pMin + '-' + pMax + ' g' : '—'}</div><div class="co-ml">${t('Proteína/día')}</div></div></div>`
      : `<div class="co-muted">${t('Añade tu peso y altura en el Perfil para métricas más precisas.')}</div>`}
    </div>`;

  // Último análisis guardado (solo planes de pago, como en Android).
  if (pro) { const cached = STORE.get('coachAnalysis'); if (cached && cached.resumen !== undefined) renderCoachAnalysis(cached, !!cached.adopted); }
}

/* ── Análisis ── */
let _coachAnalysis = null;
function coachAnalyzeNow() {
  if (!Pro.isPro()) { Pro.showUpgradeModal('ai_coach'); return; }
  const btn = $('coachAnalyzeBtn'), out = $('coachResult'); if (!out) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="co-spin"></span>'; }
  let a = null;
  try {
    const on = (typeof prefGet === 'function') ? prefGet('coachProactive') !== false : true;
    if (on) {
      const { weight, goal } = coachProfile();
      const level = coachOverallLevel();
      a = EvidenceCoach.analyze(workouts, painsRecent(14), weight, goal, level, coachMaxAlerts(), true);
    }
  } catch (e) { console.warn('Coach:', e); a = null; }
  if (btn) { btn.disabled = false; btn.innerHTML = '✨ ' + I18N.t('Analízame ahora'); }
  if (!a) { out.innerHTML = `<div class="co-err">${I18N.t('No se pudo analizar ahora. Inténtalo de nuevo.')}</div>`; return; }
  const saved = { resumen: a.resumen, alertas: a.alertas, rutinaSugerida: a.rutinaSugerida || null, ts: Date.now(), adopted: false };
  STORE.set('coachAnalysis', saved);
  renderCoachAnalysis(saved, false);
  if (typeof vib === 'function') vib([15]);
}
function renderCoachAnalysis(a, adopted) {
  const out = $('coachResult'); if (!out) return;
  _coachAnalysis = a;
  const t = I18N.t;
  const COL = { alta: '#ff5a5a', media: '#ffb020', baja: 'var(--t3)' };
  let html = '';
  if (a.resumen) html += `<div class="co-resumen">${escH(a.resumen)}</div>`;
  (a.alertas || []).forEach(al => {
    html += `<div class="co-alert"><div class="co-bar" style="background:${COL[al.prioridad] || COL.baja}"></div><div style="flex:1;min-width:0;"><div class="co-at">${escH(al.titulo)}</div>${al.detalle ? `<div class="co-ad">${escH(al.detalle)}</div>` : ''}</div></div>`;
  });
  const r = a.rutinaSugerida;
  if (r && r.dias && r.dias.length) {
    const totalEx = r.dias.reduce((s, d) => s + (d.ejercicios || []).length, 0);
    html += `<div class="co-routine"><div class="co-at">🔁 ${escH(r.nombre)}</div><div class="co-ad">${r.dias.length} ${t('días')} · ${totalEx} ${t('ejercicios')}</div>
      <button class="co-btn co-btn-sm${adopted ? ' done' : ''}" ${adopted ? 'disabled' : ''} onclick="coachAdoptRoutine()">${adopted ? t('✓ Aceptada · cargada en Planificar') : t('✓ Aceptar y usar en el próximo entreno')}</button></div>`;
  }
  html += `<div class="co-disc">${t('El Coach ofrece orientación general y no sustituye a un profesional. Ante dolor persistente, consulta a un especialista.')}</div>`;
  out.innerHTML = html;
}
/* Guarda los días en Mis rutinas y carga el primero en Planificar (como ai-rutina.js). */
function coachAdoptRoutine() {
  const a = _coachAnalysis; const r = a && a.rutinaSugerida;
  if (!r || !r.dias || !r.dias.length) return;
  rutinaGenerada = r;
  r.dias.forEach((_, i) => guardarDiaRutina(i));
  a.adopted = true; STORE.set('coachAnalysis', a);
  renderCoachAnalysis(a, true);
  usarDiaRutina(0);
}

/* ── Molestias: diálogo zona / intensidad 1-5 / nota ── */
let _painZone = PAIN_ZONES[0], _painSev = 3;
function openPainDialog() {
  const t = I18N.t;
  let ov = $('painSheet');
  if (!ov) {
    ov = document.createElement('div'); ov.className = 'sov'; ov.id = 'painSheet';
    document.body.appendChild(ov);
  }
  _painZone = PAIN_ZONES[0]; _painSev = 3;
  ov.innerHTML = `<div class="sh" style="padding:5px 16px 18px;">
    <div class="sh-h"></div>
    <div class="sh-title" style="text-align:left;padding:0;">${t('Registrar molestia')}</div>
    <div class="co-muted" style="margin-bottom:6px;">${t('Zona')}</div>
    <div class="co-zones" id="painZones">${PAIN_ZONES.map(z => `<button type="button" class="co-zone${z === _painZone ? ' on' : ''}" onclick="setPainZone(this)" data-z="${escH(z)}">${t(z)}</button>`).join('')}</div>
    <div class="co-muted" style="margin:14px 0 4px;">${t('Intensidad')}: <span id="painSevTxt">${_painSev}</span>/5</div>
    <input type="range" min="1" max="5" step="1" value="${_painSev}" class="co-range" oninput="_painSev=+this.value;document.getElementById('painSevTxt').textContent=this.value">
    <input type="text" id="painNote" class="co-inp" placeholder="${t('Nota (opcional)')}" maxlength="80">
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button type="button" class="co-btn co-btn-ghost" style="flex:1" onclick="closeSheet('painSheet')">${t('Cancelar')}</button>
      <button type="button" class="co-btn" style="flex:1" onclick="savePainFromDialog()">${t('Guardar')}</button>
    </div>
  </div>`;
  ov.onclick = e => { if (e.target === ov) closeSheet('painSheet'); };
  ov.classList.add('on');
}
function setPainZone(btn) {
  _painZone = btn.dataset.z;
  document.querySelectorAll('#painZones .co-zone').forEach(b => b.classList.toggle('on', b === btn));
}
function savePainFromDialog() {
  const nota = (($('painNote') || {}).value || '').trim();
  const list = getPains();
  list.push({ date: todayYmd(), zona: _painZone, severidad: _painSev, nota });
  savePains(list);
  closeSheet('painSheet');
  renderCoach();
}
function removePain(i) {
  const list = getPains(); list.splice(i, 1); savePains(list); renderCoach();
}
