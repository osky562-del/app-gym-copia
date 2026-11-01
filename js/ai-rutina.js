/* ══ RUTINA IA ══ */
let rutinaGenerada = null; // {nombre, dias:[{titulo, ejercicios:[{ex,sets,reps,kg,nota}]}]}

/* El generador es local e instantáneo: sin pasos simulados (paridad con Android). */
function _stopRutinaProgress() { }

async function generarRutinaIA() {
  if (!Pro.requirePro('ai_rutina')) return;

  const btn = $('btnGenRutina');
  const stat = $('genStatus');
  const perfil = STORE.get('perfil') || {};
  const dias = +$('rDias').value || 4;
  const enfoque = $('rEnfoque').value || 'hipertrofia';
  const equipo = $('rEquipo').value || 'gimnasio completo';
  const nivel = perfil.nivel || 'intermedio';
  const objetivo = perfil.objetivo || enfoque;
  const lesiones = perfil.lesiones && perfil.lesiones !== 'ninguna' ? perfil.lesiones : null;

  btn.disabled = true;
  $('rutinaResult').innerHTML = '';
  stat.style.display = 'block';
  stat.style.background = '';
  stat.style.color = '';

  // Sin IA: rutina calculada en el navegador con reglas basadas en evidencia (js/evidence-coach.js).
  // Usa solo ejercicios de tu historial (toda la base si aun no hay historial).
  let lastError = null;
  let parsedRutina = null;
  try {
    parsedRutina = EvidenceCoach.routine(dias, enfoque, equipo, workouts, perfil);
  } catch (e) {
    lastError = e;
  }

  try {
    if (!parsedRutina) {
      throw lastError || new Error('Todos los intentos fallaron');
    }
    rutinaGenerada = parsedRutina;
    const diasReales = rutinaGenerada.dias.length;
    _stopRutinaProgress();
    renderRutinaResult();
    stat.textContent = diasReales === dias
      ? 'Rutina Generada ✓'
      : `⚠ Rutina con ${diasReales}/${dias} días — Pulsa otra vez para reintentar`;
    stat.style.background = diasReales === dias ? 'var(--gg)' : 'var(--ag)';
    stat.style.color = diasReales === dias ? 'var(--green)' : 'var(--amber)';
    setTimeout(() => stat.style.display = 'none', diasReales === dias ? 3000 : 6000);
  } catch (e) {
    _stopRutinaProgress();
    stat.textContent = 'No se pudo generar la rutina con tu equipo y molestias';
    stat.style.background = 'var(--rg)';
    stat.style.color = 'var(--red)';
  } finally {
    _stopRutinaProgress();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-wand-sparkles"></i> Generar Rutina Personalizada`;
  }
}

function renderRutinaResult() {
  if (!rutinaGenerada) return;
  const el = $('rutinaResult');
  const totalEx = rutinaGenerada.dias.reduce((s, d) => s + (d.ejercicios || []).length, 0);

  el.innerHTML = `
<div style="background:linear-gradient(135deg,#0d1a2e,#0a0a0a);border:1px solid rgba(79,140,255,.25);border-radius:var(--r);padding:16px 16px 10px;margin-bottom:10px;">
  <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--a);margin-bottom:5px;">Plan generado ✦</div>
  <div style="font-size:1.2rem;font-weight:800;letter-spacing:-.02em;margin-bottom:4px;">${rutinaGenerada.nombre}</div>
  <div style="font-size:.75rem;color:var(--t3);font-family:var(--fm);">${rutinaGenerada.dias.length} días · ${totalEx} ejercicios</div>
  <button onclick="guardarTodasRutinas()" style="margin-top:12px;width:100%;height:46px;background:var(--green);border:none;border-radius:9px;color:#000;font-size:.88rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    Guardar todos los días en Rutinas
  </button>
</div>
${rutinaGenerada.dias.map((dia, di) => `
  <div class="rutina-dia-card">
    <div class="rutina-dia-head">
      <div>
        <div class="rutina-dia-title">${dia.titulo}</div>
        <div class="rutina-dia-meta">${(dia.ejercicios || []).length} ejercicios</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-guardar-rutina" onclick="guardarDiaRutina(${di})">+ Rutinas</button>
        <button class="btn-usar-rutina" onclick="usarDiaRutina(${di})">Usar ahora ▶</button>
      </div>
    </div>
    ${(dia.ejercicios || []).map((ex, ei) => `
      <div class="rutina-ex-row">
        <div class="rutina-ex-num">${ei + 1}</div>
        <div class="rutina-ex-info">
          <div class="rutina-ex-name">${ex.ex}</div>
          <div class="rutina-ex-detail">${ex.sets}×${ex.reps} reps${ex.nota ? ' · ' + ex.nota : ''}</div>
        </div>
      </div>`).join('')}
  </div>`).join('')}
  `;
}

function guardarDiaRutina(diaIdx) {
  if (!rutinaGenerada) return;
  const dia = rutinaGenerada.dias[diaIdx];
  if (!dia) return;

  // Add to TPL with next available key
  const existingKeys = Object.keys(TPL).map(Number);
  const newKey = Math.max(...existingKeys, 100) + 1;
  TPL[newKey] = dia.ejercicios.map(e => ({ ex: e.ex, sets: e.sets, reps: e.reps, kg: '', s: e.sets, r: e.reps }));

  // Save custom tpls to localStorage
  const custom = STORE.get('customTpl') || [];
  custom.push({ key: newKey, titulo: dia.titulo, ejercicios: dia.ejercicios });
  STORE.set('customTpl', custom);

  // Refrescar "Mis rutinas" en Entreno
  renderTplList();
  toast('«' + dia.titulo + '» guardado en Rutinas ✓', 'good');
}

function guardarTodasRutinas() {
  if (!rutinaGenerada) return;
  rutinaGenerada.dias.forEach((_, i) => guardarDiaRutina(i));
  toast('Plan «' + rutinaGenerada.nombre + '» guardado completo ✓', 'good');
}

function usarDiaRutina(diaIdx) {
  if (!rutinaGenerada) return;
  const dia = rutinaGenerada.dias[diaIdx];
  if (!dia) return;
  // Cargar en el plan y abrir Entreno
  openPlan();
  planLoadItems(_rutinaDayItems(dia), dia.titulo || '');
  STORE.set('lastRoutineChange', new Date().toISOString().split('T')[0]);
  if (typeof openPlanTab === 'function') openPlanTab();
}
/* Ejercicios de un día generado → items del plan (cardio automático si lo es en la base). */
function _rutinaDayItems(dia) {
  return (dia.ejercicios || []).map(e => _mkPlanItem(e.ex, +e.sets || 3, +e.reps || 10, getLastKg(e.ex) || ''));
}

/* Título de una rutina guardada (para el nombre del entreno al encadenar). */
function _customTplTitle(key) {
  const t = (STORE.get('customTpl') || []).find(x => x.key === key);
  return t ? t.titulo : '';
}

/* La hoja "Rutinas" ya no existe: las plantillas y "Mis rutinas" se ven en línea en Entreno
   (renderPlanTplInline). Se mantiene el nombre porque la sincronización con el NAS lo llama. */
function renderTplList() {
  if (typeof renderPlanTplInline === 'function') renderPlanTplInline();
}

function loadTplCustom(key) {
  if (!TPL[key]) {
    // Reload from storage
    const custom = STORE.get('customTpl') || [];
    const t = custom.find(x => x.key === key);
    if (!t) return toast('Rutina no encontrada', 'err');
    TPL[key] = t.ejercicios.map(e => ({ ex: e.ex, sets: e.sets, reps: e.reps, kg: '', s: e.sets, r: e.reps }));
  }
  loadTpl(key);
  // Cargar una rutina guardada cuenta como "cambio de rutina" (CustomTemplates.markChanged).
  STORE.set('lastRoutineChange', new Date().toISOString().split('T')[0]);
  if (typeof renderPlanProCards === 'function') renderPlanProCards();
}

/* ✕ en "Mis rutinas": borra directamente, sin confirmación (como Android). */
function deleteCustomTpl(key) {
  const custom = (STORE.get('customTpl') || []).filter(t => t.key !== key);
  STORE.set('customTpl', custom);
  delete TPL[key];
  renderTplList();
}

/* ══ GENERADOR DE RUTINA SOBRE ENTRENO (RoutineScreen.kt) ══
   Hoja/modal que no sale de la pestaña Entreno. "Usar ahora ▶" carga el día en el plan y cierra. */
const RG_FOCUS = ['hipertrofia', 'fuerza', 'perdida de grasa', 'resistencia'];
const RG_FOCUS_LBL = { 'hipertrofia': 'Hipertrofia', 'fuerza': 'Fuerza', 'perdida de grasa': 'Pérdida de grasa', 'resistencia': 'Resistencia' };
const RG_EQUIP = ['gimnasio completo', 'casa', 'mancuernas', 'peso corporal'];
const RG_EQUIP_LBL = { 'gimnasio completo': 'Gimnasio completo', 'casa': 'Casa', 'mancuernas': 'Mancuernas', 'peso corporal': 'Peso corporal' };
let rgState = { dias: 4, enfoque: 'hipertrofia', equipo: 'gimnasio completo', routine: null, savedDays: {}, savedAll: false, failed: false };

function openRoutineGen() {
  if (typeof Pro !== 'undefined' && Pro.can && !Pro.can('ai_rutina')) {
    if (Pro.showUpgradeModal) Pro.showUpgradeModal('ai_rutina');
    return;
  }
  renderRoutineGen();
  $('rgOv').classList.add('on');
}
function closeRoutineGen() { $('rgOv').classList.remove('on'); }
function rgSet(k, v) { rgState[k] = v; renderRoutineGen(); }
function renderRoutineGen() {
  const t = (es) => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(es) : es;
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('rgDays').innerHTML = [3, 4, 5, 6].map(n => `<button class="rg-chip${rgState.dias === n ? ' on' : ''}" onclick="rgSet('dias',${n})">${n}</button>`).join('');
  $('rgFocus').innerHTML = RG_FOCUS.map(f => `<button class="rg-chip${rgState.enfoque === f ? ' on' : ''}" onclick="rgSet('enfoque','${f}')">${t(RG_FOCUS_LBL[f])}</button>`).join('');
  $('rgEquip').innerHTML = RG_EQUIP.map(f => `<button class="rg-chip${rgState.equipo === f ? ' on' : ''}" onclick="rgSet('equipo','${f}')">${t(RG_EQUIP_LBL[f])}</button>`).join('');
  $('rgGenBtn').textContent = rgState.routine ? t('Generar otra') : t('Generar rutina personalizada');
  $('rgStatus').textContent = rgState.failed ? t('No se pudo generar la rutina. Inténtalo de nuevo.') : '';
  const r = rgState.routine;
  if (!r) { $('rgResult').innerHTML = ''; return; }
  const totalEx = r.dias.reduce((s, d) => s + (d.ejercicios || []).length, 0);
  const partial = r.dias.length < rgState.dias;
  $('rgResult').innerHTML = `
<div class="rg-done">${partial ? `${r.dias.length}/${rgState.dias} ${t('días generados — pulsa otra vez para reintentar')}` : t('Rutina generada ✓')}</div>
<div class="rg-rname">${esc(r.nombre)}</div>
<div class="rg-rmeta">${r.dias.length} ${t('días por semana').toLowerCase()} · ${totalEx} ${t('ejercicios')}</div>
<button class="rg-saveall${rgState.savedAll ? ' done' : ''}" onclick="rgSaveAll()"${rgState.savedAll ? ' disabled' : ''}>${rgState.savedAll ? t('Guardado en Mis rutinas ✓') : '💾 ' + t('Guardar los días en Mis rutinas')}</button>
${r.dias.map((dia, di) => `
<div class="rg-day">
  <div class="rg-day-head">
    <div style="flex:1;min-width:0;"><div class="rg-day-t">${esc(dia.titulo)}</div><div class="rg-day-m">${(dia.ejercicios || []).length} ${t('ejercicios')}</div></div>
    <button class="rg-day-save" onclick="rgSaveDay(${di})">${rgState.savedDays[di] ? '✓' : '💾'}</button>
    <button class="rg-day-use" onclick="rgUseDay(${di})">${t('Usar ahora')} ▶</button>
  </div>
  ${(dia.ejercicios || []).map((ex, ei) => `<div class="rg-ex"><span class="rg-ex-n">${ei + 1}</span><span>${esc(ex.ex)} · ${ex.sets}×${ex.reps}${ex.nota ? ' · ' + esc(ex.nota) : ''}</span></div>`).join('')}
</div>`).join('')}`;
}
function rgGenerate() {
  if (typeof Pro !== 'undefined' && Pro.can && !Pro.can('ai_rutina')) { closeRoutineGen(); if (Pro.showUpgradeModal) Pro.showUpgradeModal('ai_rutina'); return; }
  const btn = $('rgGenBtn');
  btn.disabled = true;
  btn.textContent = (typeof I18N !== 'undefined' && I18N.t) ? I18N.t('Generando tu rutina…') : 'Generando tu rutina…';
  const perfil = STORE.get('perfil') || {};
  setTimeout(() => {
    let r = null;
    try { r = EvidenceCoach.routine(rgState.dias, rgState.enfoque, rgState.equipo, workouts, perfil); } catch (e) { r = null; }
    btn.disabled = false;
    rgState.failed = !r || !r.dias || !r.dias.length;
    rgState.routine = rgState.failed ? null : r;
    rgState.savedDays = {}; rgState.savedAll = false;
    if (!rgState.failed) rutinaGenerada = r;   // comparte el almacenamiento con guardarDiaRutina
    renderRoutineGen();
  }, 50);
}
function rgSaveDay(di) {
  if (!rgState.routine) return;
  rutinaGenerada = rgState.routine;
  _rgSaveDaySilent(di);
  rgState.savedDays[di] = true;
  renderRoutineGen();
}
function rgSaveAll() {
  if (!rgState.routine) return;
  rutinaGenerada = rgState.routine;
  rgState.routine.dias.forEach((_, i) => { if (!rgState.savedDays[i]) { _rgSaveDaySilent(i); rgState.savedDays[i] = true; } });
  rgState.savedAll = true;
  renderRoutineGen();
}
/* Guarda un día en "Mis rutinas" sin toast (el botón pasa a ✓). */
function _rgSaveDaySilent(di) {
  const dia = rgState.routine.dias[di];
  if (!dia) return;
  const existingKeys = Object.keys(TPL).map(Number);
  const newKey = Math.max(...existingKeys, 100) + 1;
  TPL[newKey] = dia.ejercicios.map(e => ({ ex: e.ex, sets: e.sets, reps: e.reps, kg: '', s: e.sets, r: e.reps }));
  const custom = STORE.get('customTpl') || [];
  custom.push({ key: newKey, titulo: dia.titulo, ejercicios: dia.ejercicios });
  STORE.set('customTpl', custom);
  renderTplList();
}
function rgUseDay(di) {
  const dia = rgState.routine && rgState.routine.dias[di];
  if (!dia) return;
  planLoadItems(_rutinaDayItems(dia), dia.titulo || '');
  STORE.set('lastRoutineChange', new Date().toISOString().split('T')[0]);
  closeRoutineGen();
}

// Load custom tpls into TPL on init
(function loadCustomTplsOnInit() {
  const custom = STORE.get('customTpl') || [];
  custom.forEach(t => {
    TPL[t.key] = t.ejercicios.map(e => ({ ex: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: '', s: +e.sets || 3, r: +e.reps || 10 }));
  });
})();
