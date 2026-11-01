/* ══ PLAN MODE (paridad con Android: ui/plan/PlanScreen.kt + PlanViewModel.kt) ══ */
/* Traducción al vuelo (js/i18n.js carga después; por eso se consulta en tiempo de ejecución). */
function _t(es) { return (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(es) : es; }
function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function _escJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/* Presets de descanso que recorre la pastilla al pulsarla (REST_PRESETS de Android). */
const REST_PRESETS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
/* Formatea segundos a "Off / 90s / 1m 30s / 3m" (fmtRest de Android). */
function fmtRestPill(sec) {
  if (!sec) return 'Off';
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? (m + 'm ' + s + 's') : (m + 'm');
}

/* ── Base de ejercicios: búsqueda exacta por nombre (para miniatura, músculos y cardio) ── */
let _exDbByName = null;
function exDbEntry(name) {
  if (!_exDbByName) {
    _exDbByName = new Map();
    (window.EXERCISES_DB || []).forEach(e => { if (e.name) _exDbByName.set(exFold(e.name), e); });
  }
  return _exDbByName.get(exFold(name)) || null;
}
function exIsCardio(name) {
  const e = exDbEntry(name);
  return !!(e && e.category === 'cardio');
}

/* Encadenar: con esto activo, las plantillas/rutinas/sesiones copiadas se SUMAN al plan en vez de
   reemplazarlo (igual que en Android). Se apaga al abrir un plan nuevo. */
let planChain = false;
function togglePlanChain() {
  planChain = !planChain;
  renderPlanTplInline();
  if (typeof vib === 'function') vib([20]);
}
/* Reemplaza el plan o, si se está encadenando y ya hay ejercicios, los añade al final. */
function planLoadOrAppend(items, title) {
  const nameEl = $('planName');
  if (planChain && planExs.length) {
    planExs = planExs.concat(items);
    if (nameEl) {
      const cur = nameEl.value.trim(), add = (title || '').trim();
      nameEl.value = !add ? cur : (!cur ? add : cur + ' + ' + add);
    }
    renderPlanList();
    return true;
  }
  planLoadItems(items, title);
  return false;
}
/* Carga ejercicios desde fuera reemplazando el plan (loadItems de Android). */
function planLoadItems(items, title) {
  planExs = items;
  const nameEl = $('planName');
  if (nameEl && title != null) nameEl.value = title;
  renderPlanList();
}
function openPlan() {
  planChain = false;
  planExs = [];
  if ($('planNotes')) $('planNotes').value = '';
  if ($('planName')) $('planName').value = '';
  if (typeof resetRpe === 'function') resetRpe();
  $('planSearch').value = '';
  renderPlanList();
  filterAC();
  $('planMode').classList.add('show');
}

/* ── Tarjetas Pro: cambia tu rutina / semana de descarga (PlanViewModel.kt:93-147) ── */
function _todayISO() { return new Date().toISOString().split('T')[0]; }
function _daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00'), b = new Date(isoB + 'T00:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
/* Semanas desde el último cambio de rutina (≥2 → recomendar variarla). */
function routineWeeks() {
  if (!workouts.length) return 0;
  let base = STORE.get('lastRoutineChange') || '';
  if (!base) base = workouts.map(w => w.date).filter(Boolean).sort()[0] || '';
  const d = _daysBetween(base, _todayISO());
  if (d == null) return 0;
  return Math.max(0, Math.floor(d / 7));
}
/* ¿Toca semana de descarga? ≥5 semanas seguidas entrenando y ≥28 días desde la última. */
function deloadDue() {
  if (workouts.length < 8) return false;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dow = (now.getDay() + 6) % 7;             // lunes = 0
  const thisMon = new Date(now); thisMon.setDate(now.getDate() - dow);
  const dates = workouts.map(w => new Date((w.date || '') + 'T00:00:00')).filter(d => !isNaN(d));
  let streak = 0;
  for (let back = 0; back < 12; back++) {
    const start = new Date(thisMon); start.setDate(thisMon.getDate() - back * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const trained = dates.some(d => d >= start && d < end);
    if (trained) streak++; else if (back > 0) break;
  }
  const last = STORE.get('lastDeloadDate') || '';
  const since = last ? _daysBetween(last, _todayISO()) : Infinity;
  return streak >= 5 && (since == null ? true : since >= 28);
}
let deloadApplied = false;
/* Aplica una descarga al plan: baja el peso ~45% y quita una serie. */
function applyDeload() {
  if (!planExs.length) {
    const last = workouts[0];
    if (!last) return;
    planLoadItems(_workoutToPlanItems(last), last.name || '');
  }
  planExs.forEach(it => {
    const kgNum = parseFloat(String(it.kg).trim());
    if (!isNaN(kgNum) && kgNum > 0) {
      const v = kgNum * 0.55;
      it.kg = Number.isInteger(v) ? String(v) : v.toFixed(1);
    }
    it.sets = Math.max(1, (+it.sets || 1) - 1);
  });
  STORE.set('lastDeloadDate', _todayISO());
  deloadApplied = true;
  renderPlanList();
}
function renderPlanProCards() {
  const el = $('planProCards');
  if (!el) return;
  const isPro = typeof Pro !== 'undefined' && Pro.isPro && Pro.isPro();
  if (!isPro) { el.innerHTML = ''; return; }
  let html = '';
  if (routineWeeks() >= 2) {
    html += `<div class="plan-pro-card change" onclick="openRoutineGen()">
  <span class="plan-pro-ic">🔄</span>
  <div style="flex:1;min-width:0;">
    <div class="plan-pro-t">Cambia tu rutina</div>
    <div class="plan-pro-d">Llevas semanas con la misma rutina. Genera una nueva adaptada a tus datos para seguir progresando.</div>
  </div>
  <span class="plan-pro-arrow">›</span>
</div>`;
  }
  if (deloadDue() || deloadApplied) {
    html += `<div class="plan-pro-card deload">
  <div style="display:flex;align-items:center;gap:12px;"><span class="plan-pro-ic">🪫</span><div class="plan-pro-t cyan">Semana de descarga recomendada</div></div>
  <div class="plan-pro-d" style="margin-top:6px;">Llevas varias semanas entrenando fuerte. Reduce la carga esta semana para recuperar y crecer.</div>
  <button class="plan-deload-btn${deloadApplied ? ' done' : ''}" onclick="applyDeload()"${deloadApplied ? ' disabled' : ''}>${deloadApplied ? 'Descarga aplicada · −45% carga' : 'Aplicar descarga al plan'}</button>
</div>`;
  }
  el.innerHTML = html;
}

/* Plantillas y "Mis rutinas" a la vista en Entreno, con Encadenar, igual que en Android. */
function renderPlanTplInline() {
  const el = $('planTplInline');
  if (!el) return;
  const fixed = Object.keys(TPL_TITLES).map(k => `<button class="ntpl" onclick="loadTpl(${k})">${TPL_TITLES[k]}</button>`).join('');
  const custom = (STORE.get('customTpl') || []).map(t =>
    `<button class="ntpl mine" onclick="loadTplCustom(${t.key})">${_esc(t.titulo)}<i onclick="event.stopPropagation();deleteCustomTpl(${t.key})">✕</i></button>`).join('');
  el.innerHTML = `<div class="ntpl-h"><span>Plantillas rápidas</span>
      <button class="ntpl-chain${planChain ? ' on' : ''}" onclick="togglePlanChain()">🔗 Encadenar</button></div>
    ${planChain ? '<div class="ntpl-hint">Toca varias plantillas o rutinas: se añaden una detrás de otra en el mismo entreno.</div>' : ''}
    <div class="ntpl-row">${fixed}</div>
    ${custom ? `<div class="ntpl-h"><span>⭐ Mis rutinas</span></div><div class="ntpl-row">${custom}</div>` : ''}`;
}
function renderPlanList() {
  const n = planExs.length;
  $('planSub').textContent = n + ' ' + (n === 1 ? _t('ejercicio') : _t('ejercicios'));
  $('btnEmpezar').disabled = n === 0;
  $('btnEmpezar').textContent = n === 0 ? _t('Añade ejercicios') : _t('Empezar') + ' (' + n + ')';
  renderPlanProCards();
  renderPlanTplInline();
  if ($('planAiLock')) $('planAiLock').style.display = (typeof Pro !== 'undefined' && Pro.can && Pro.can('ai_rutina')) ? 'none' : '';
  $('planEmpty').style.display = n === 0 ? 'block' : 'none';
  if ($('planRpeBlock')) $('planRpeBlock').style.display = n === 0 ? 'none' : 'block';
  if (typeof renderPlanRpe === 'function') renderPlanRpe();
  $('planExList').innerHTML = planExs.map((ex, i) => {
    const linked = i > 0 && !!ex.ssLink;
    const params = ex.isCardio
      ? `<div class="plan-param"><div class="plan-param-l">Bloques</div><input class="plan-param-i" type="number" value="${ex.sets}" min="1" max="20" oninput="planExs[${i}].sets=Math.min(20,Math.max(1,+this.value||1))"></div>
    <div class="plan-param"><div class="plan-param-l">Min</div><input class="plan-param-i" type="number" value="${_esc(ex.min || '')}" placeholder="—" min="0" oninput="planExs[${i}].min=this.value"></div>
    <div class="plan-param"><div class="plan-param-l">Km</div><input class="plan-param-i" type="number" value="${_esc(ex.km || '')}" placeholder="—" min="0" step="0.1" oninput="planExs[${i}].km=this.value"></div>`
      : `<div class="plan-param"><div class="plan-param-l">Series</div><input class="plan-param-i" type="number" value="${ex.sets}" min="1" max="20" oninput="planExs[${i}].sets=Math.min(20,Math.max(1,+this.value||1))"></div>
    <div class="plan-param"><div class="plan-param-l">Reps</div><input class="plan-param-i" type="number" value="${ex.reps}" min="1" max="100" oninput="planExs[${i}].reps=Math.min(100,Math.max(1,+this.value||1))"></div>
    <div class="plan-param"><div class="plan-param-l">Kg</div><input class="plan-param-i" type="number" value="${_esc(ex.kg)}" placeholder="—" min="0" oninput="planExs[${i}].kg=this.value"></div>`;
    return `<div class="plan-ex-item${linked ? ' ss-linked' : ''}">
  ${linked ? '<div class="ss-tag">🔗 En superserie con el anterior</div>' : ''}
  <div class="plan-ex-head">
    <div class="plan-ex-n">${i + 1}. ${_esc(ex.name)}</div>
    <button class="plan-ex-del plan-ex-tech" onclick="openExerciseVideo(planExs[${i}].name)" title="Ver técnica">📖</button>
    <button class="plan-ex-del" onclick="planDel(${i})" title="Quitar"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>
  <div class="plan-ex-params">
    <div class="plan-ex-move">
      <button class="plan-ex-mv" onclick="moveExUp(${i})" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg></button>
      <button class="plan-ex-mv" onclick="moveExDown(${i})" ${i === planExs.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>
    </div>
    ${params}
  </div>
  <div class="plan-ex-pills">
    <button class="plan-rest-pill" onclick="cycleRest(${i})"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${_t('Descanso')} · ${fmtRestPill(ex.restSec)}</span></button>
    <button class="plan-pill${ex.isCardio ? ' on' : ''}" onclick="toggleCardio(${i})">🏃 Cardio</button>
  </div>
  ${i > 0 ? `<div class="plan-ex-pills"><button class="plan-pill wide${linked ? ' on' : ''}" onclick="toggleSSLink(${i})">🔗 Superserie con el anterior</button></div>` : ''}
</div>`;
  }).join('');
}
function planDel(i) { planExs.splice(i, 1); renderPlanList(); }
/* Encadena/desencadena el ejercicio i en superserie con el anterior (i-1). */
function toggleSSLink(i) {
  if (i <= 0) return;
  planExs[i].ssLink = !planExs[i].ssLink;
  renderPlanList();
  if (typeof vib === 'function') vib([20]);
}
/* Pulsar la pastilla de descanso recorre los presets (cycleRest de Android). */
function cycleRest(i) {
  if (!planExs[i]) return;
  const idx = REST_PRESETS.indexOf(+planExs[i].restSec || 0);
  planExs[i].restSec = REST_PRESETS[(idx + 1) % REST_PRESETS.length];
  renderPlanList();
}
/* Cardio por ejercicio: al activarlo, los campos pasan a Bloques/Min/Km y el descanso a 0. */
function toggleCardio(i) {
  if (!planExs[i]) return;
  const now = !planExs[i].isCardio;
  planExs[i].isCardio = now;
  planExs[i].restSec = now ? 0 : 90;
  if (now) { if (planExs[i].min == null) planExs[i].min = ''; if (planExs[i].km == null) planExs[i].km = ''; }
  renderPlanList();
}
function _mkPlanItem(name, sets, reps, kg, cardio) {
  const isCardio = !!cardio || exIsCardio(name);
  return { name, sets: sets || 3, reps: reps || 10, kg: kg == null ? '' : kg, restSec: isCardio ? 0 : 90, isCardio, min: '', km: '' };
}
function addPlanEx(name, cardio) {
  const n = String(name || '').trim();
  if (!n) return;
  planExs.push(_mkPlanItem(n, 3, 10, getLastKg(n) || '', cardio));
  renderPlanList();
  $('planSearch').value = '';
  filterAC();
  setTimeout(() => $('planExList').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  vib([30]);
}
/* Fila del buscador: miniatura + nombre + músculos + Xkg + ★ + 📖 + "+" (SuggestionRow de Android). */
function planAcRow(n) {
  const lk = getLastKg(n), esc = _escJs(n), e = exDbEntry(n);
  const img = (e && e.images && e.images.length && window.EX_IMG_BASE)
    ? `<img class="plan-ac-img" src="${window.EX_IMG_BASE + e.images[0]}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '';
  const musc = (e && e.primaryMuscles && e.primaryMuscles.length) ? `<div class="plan-ac-m">${_esc(e.primaryMuscles.join(', '))}</div>` : '';
  return `<div class="plan-ac-item" onclick="addPlanEx('${esc}')">${img}<div class="plan-ac-txt"><div class="plan-ac-n">${_esc(n)}</div>${musc}</div>${lk ? `<span class="plan-ac-last">${lk}kg</span>` : ''}${favStar(n, 'filterAC')}<span class="plan-ac-tech" onclick="event.stopPropagation();openExerciseVideo('${esc}')" title="Ver técnica">📖</span><span class="plan-ac-add" onclick="event.stopPropagation();addPlanEx('${esc}')">+</span></div>`;
}
function filterAC() {
  const raw = $('planSearch').value.trim();
  const ac = $('planAC');
  if (!raw) {
    // Con el buscador vacío: favoritos + recientes para añadir rápido (siempre visibles).
    const favs = getFavs(), recents = getRecentExs(8).filter(n => favs.indexOf(n) < 0).slice(0, 6);
    let html = '';
    if (favs.length) html += quickListHeader('★ Favoritos') + favs.slice(0, 8).map(planAcRow).join('');
    if (recents.length) html += quickListHeader('🕐 Recientes') + recents.map(planAcRow).join('');
    ac.innerHTML = html;
    ac.classList.toggle('show', !!html);
    return;
  }
  // Sin tildes y por palabras sueltas; favoritos primero (orden estable); máx. 10.
  let m = searchExNames(raw, 40);
  m = m.filter(isFav).concat(m.filter(n => !isFav(n))).slice(0, 10);
  const exactMatch = m.some(n => exFold(n) === exFold(raw));
  const newItem = !exactMatch ? `<div class="plan-ac-item plan-ac-new" onclick="addPlanExCustom('${_escJs(raw)}')"><span class="plan-ac-plus">+</span><div class="plan-ac-txt"><div class="plan-ac-n">${_t('Crear')} "${_esc(raw)}"</div></div></div>` : '';
  ac.innerHTML = m.map(planAcRow).join('') + newItem;
  ac.classList.add('show');
}
/* Crear un ejercicio que no está en la base: se añade directamente (sin confirmación, como Android). */
function addPlanExCustom(name) { addPlanEx(name); }

/* Nombre de las plantillas fijas (para el nombre del entreno, como en las apps). */
const TPL_TITLES = { 1: 'Pecho y tríceps', 2: 'Espalda y bíceps', 3: 'Piernas', 4: 'Hombros y core' };
function loadTpl(id) {
  const items = TPL[id].map(t => _mkPlanItem(t.ex, t.s, t.r, getLastKg(t.ex) || ''));
  const title = TPL_TITLES[id] || (typeof _customTplTitle === 'function' ? _customTplTitle(id) : '');
  planLoadOrAppend(items, title);
}
function _workoutToPlanItems(w) {
  return (w.exercises || []).map(e => {
    const it = _mkPlanItem(e.ex, +e.sets || 3, +e.reps || 10, getLastKg(e.ex) || e.kg || '', !!e.isCardio);
    return it;
  });
}
/* Copiar sesión anterior: diálogo con las últimas 15 (CopySessionDialog de Android). */
function openCopy() {
  const list = $('copyList');
  if (!workouts.length) {
    list.innerHTML = `<div class="plan-copy-empty">${_t('No hay sesiones anteriores')}</div>`;
  } else {
    list.innerHTML = workouts.slice(0, 15).map(w => `<div class="sh-card" onclick="doCopy('${w.id}')"><div class="sh-ct">${_esc(w.name || w.date)}${w.duration ? ' · ⏱ ' + w.duration + 'min' : ''}</div>${(w.exercises || []).length ? `<div class="sh-cd">${_esc((w.exercises || []).map(e => e.ex).join(' · '))}</div>` : ''}</div>`).join('');
  }
  $('shCopy').classList.add('on');
}
function doCopy(id) {
  const w = workouts.find(x => x.id === id); if (!w) return;
  planLoadOrAppend(_workoutToPlanItems(w), w.name || '');
  closeSheet('shCopy');
}
/* Repetir el último entreno: carga sus ejercicios y nombre en el planificador. */
function repeatLastWorkout() {
  if (!workouts.length) return toast('Aún no tienes entrenos para repetir', 'err');
  const w = workouts[0];
  openPlan();
  planLoadItems(_workoutToPlanItems(w), w.name || '');
}

/* ══ REORDER EXERCISES ══ */
function moveExUp(i) {
  if (i <= 0) return;
  [planExs[i - 1], planExs[i]] = [planExs[i], planExs[i - 1]];
  renderPlanList();
  vib([20]);
}
function moveExDown(i) {
  if (i >= planExs.length - 1) return;
  [planExs[i], planExs[i + 1]] = [planExs[i + 1], planExs[i]];
  renderPlanList();
  vib([20]);
}
