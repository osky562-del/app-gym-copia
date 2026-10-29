/* ══ PLAN MODE ══ */
/* Encadenar: con esto activo, las plantillas/rutinas/sesiones copiadas se SUMAN al plan en vez de
   reemplazarlo (igual que en Android e iOS). Se apaga al abrir un plan nuevo. */
let planChain = false;
function togglePlanChain() {
  planChain = !planChain;
  if (typeof renderTplList === 'function') renderTplList();
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
  planExs = items;
  if (nameEl && title != null) nameEl.value = title;
  renderPlanList();
  return false;
}
function openPlan() {
  planChain = false;
  planExs = [];
  $('planDate').value = new Date().toISOString().split('T')[0];
  $('planRpe').value = ''; $('planNotes').value = '';
  if ($('planName')) $('planName').value = '';
  rpeMode = 'auto';
  if ($('rpeModeLabel')) { $('rpeModeLabel').textContent = 'AUTO'; $('rpeModeLabel').style.color = 'var(--a)'; }
  if ($('rpeAutoDisplay')) { $('rpeAutoDisplay').style.display = ''; $('rpeAutoDisplay').textContent = '—'; }
  if ($('planRpe')) { $('planRpe').style.display = 'none'; } $('planSearch').value = '';
  $('planAC').classList.remove('show');
  renderPlanList();
  $('planMode').classList.add('show');
  setTimeout(() => $('planSearch').focus(), 300);
}
function closePlan() {
  if (planExs.length > 0 && !confirm('¿Salir sin empezar?')) return;
  $('planMode').classList.remove('show');
}
function renderPlanList() {
  const n = planExs.length;
  $('planSub').textContent = n === 0 ? '0 ejercicios' : n + ' ejercicio' + (n > 1 ? 's' : '') + ' · Listo';
  $('btnEmpezar').disabled = n === 0;
  $('planEmpty').style.display = n === 0 ? 'block' : 'none';
  $('planExList').innerHTML = planExs.map((ex, i) => {
    const lk = getLastKg(ex.name), pr = getPR(ex.name);
    const linked = i > 0 && !!ex.ssLink;
    return `<div class="plan-ex-item${linked ? ' ss-linked' : ''}">
  ${linked ? '<div class="ss-tag">🔗 En superserie con el anterior</div>' : ''}
  <div class="plan-ex-head">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:6px;">
      <button class="plan-ex-del" style="width:28px;height:22px;border-radius:6px;" onclick="moveExUp(${i})" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:12px;height:12px;"><polyline points="18 15 12 9 6 15"/></svg></button>
      <button class="plan-ex-del" style="width:28px;height:22px;border-radius:6px;" onclick="moveExDown(${i})" ${i === planExs.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:12px;height:12px;"><polyline points="6 9 12 15 18 9"/></svg></button>
    </div>
    <div style="flex:1;"><div class="plan-ex-n">${i + 1}. ${ex.name}</div>${lk ? `<div class="plan-ex-hist">Último: ${lk}kg${pr ? ' · PR: ' + pr + 'kg' : ''}</div>` : ''}
    </div>
    ${i > 0 ? `<button class="plan-ex-del ss-btn${linked ? ' on' : ''}" onclick="toggleSSLink(${i})" title="Superserie con el ejercicio anterior">🔗</button>` : ''}
    <button class="plan-ex-del" onclick="planDel(${i})"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>
  <div class="plan-ex-params">
    <div class="plan-param"><div class="plan-param-l">Series</div><input class="plan-param-i" type="number" value="${ex.sets}" min="1" max="20" oninput="planExs[${i}].sets=+this.value||1"></div>
    <div class="plan-param"><div class="plan-param-l">Reps</div><input class="plan-param-i" type="number" value="${ex.reps}" min="1" max="100" oninput="planExs[${i}].reps=+this.value||1"></div>
    <div class="plan-param"><div class="plan-param-l">Kg</div><input class="plan-param-i" type="number" value="${ex.kg}" placeholder="—" min="0" oninput="planExs[${i}].kg=this.value"></div>
    <div class="plan-rest-pill" onclick="openRestPicker(${i})"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${fmtRest(ex.restSec)}</span></div>
  </div>
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
function addPlanEx(name) {
  planExs.push({ name, sets: 3, reps: 10, kg: getLastKg(name) || '', restSec: 90 });
  renderPlanList();
  $('planSearch').value = ''; $('planAC').classList.remove('show');
  setTimeout(() => $('planExList').lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 80);
  vib([30]);
}
function planAcRow(n) {
  const lk = getLastKg(n); const esc = n.replace(/'/g, "\\'");
  return `<div class="plan-ac-item" onclick="addPlanEx('${esc}')"><span>${n}</span><span style="display:flex;align-items:center;gap:6px;flex-shrink:0;">${favStar(n, 'filterAC')}${lk ? `<span class="plan-ac-last">${lk}kg</span>` : ''}</span></div>`;
}
function filterAC() {
  const raw = $('planSearch').value.trim();
  const val = raw.toLowerCase();
  const ac = $('planAC');
  if (!raw) {
    // Con el buscador vacío: favoritos + recientes para añadir rápido.
    const favs = getFavs(), recents = getRecentExs(6).filter(n => favs.indexOf(n) < 0);
    let html = '';
    if (favs.length) html += quickListHeader('★ Favoritos') + favs.slice(0, 8).map(planAcRow).join('');
    if (recents.length) html += quickListHeader('🕐 Recientes') + recents.map(planAcRow).join('');
    if (html) { ac.innerHTML = html; ac.classList.add('show'); } else ac.classList.remove('show');
    return;
  }
  const all = getAllExNames();
  // Sin tildes y por palabras sueltas; favoritos primero (orden estable).
  let m = searchExNames(raw, 40);
  m = m.filter(isFav).concat(m.filter(n => !isFav(n))).slice(0, 8);
  const exactMatch = all.some(n => exFold(n) === exFold(raw));
  const newItem = !exactMatch ? `<div class="plan-ac-item plan-ac-new" onclick="addPlanExCustom('${raw.replace(/'/g, "\\'")}')"><div><span style="color:var(--a);font-weight:800;">+</span> Crear "<b>${raw}</b>"</div><div style="font-size:.62rem;color:var(--amber);">⚠️ Sin vídeo demo</div></div>` : '';
  if (!m.length && !newItem) { ac.classList.remove('show'); return; }
  ac.innerHTML = m.map(planAcRow).join('') + newItem;
  ac.classList.add('show');
}
document.addEventListener('click', e => { if (!e.target.closest('.plan-search-wrap')) $('planAC').classList.remove('show'); });
/* Variante que pide confirmación al usuario antes de crear un ejercicio
   que NO está en la base de datos de ejercicios (sin vídeo demo). */
function addPlanExCustom(name) {
  const msg = `Este ejercicio NO está en nuestra base de datos.\n\n` +
              `Se añadirá igualmente pero NO tendrá vídeo demostrativo cuando pulses "▶ Ver técnica" (verás un botón para buscarlo en YouTube).\n\n` +
              `¿Continuar y añadir "${name}"?`;
  if (!confirm(msg)) return;
  addPlanEx(name);
}

/* Nombre de las plantillas fijas (para el nombre del entreno, como en las apps). */
const TPL_TITLES = { 1: 'Pecho y tríceps', 2: 'Espalda y bíceps', 3: 'Piernas', 4: 'Hombros y core' };
function loadTpl(id) {
  const items = TPL[id].map(t => ({ name: t.ex, sets: t.s, reps: t.r, kg: getLastKg(t.ex) || '', restSec: 90 }));
  const title = TPL_TITLES[id] || (typeof _customTplTitle === 'function' ? _customTplTitle(id) : '');
  if (planLoadOrAppend(items, title)) { toast('Añadida al entreno ✓', 'good'); return; }   // encadenando: la hoja sigue abierta
  closeSheet('shTpl'); toast('Rutina cargada ✓');
}
function openCopy() {
  if (!workouts.length) return toast('No hay sesiones anteriores', 'err');
  $('copyList').innerHTML = workouts.slice(0, 15).map(w => `<div class="sh-card" onclick="doCopy('${w.id}')"><div class="sh-ct">${w.date}${w.duration ? ' · ⏱ ' + w.duration + 'min' : ''}</div><div class="sh-cd">${(w.exercises || []).map(e => e.ex).join(' · ')}</div></div>`).join('');
  $('shCopy').classList.add('on');
}
function doCopy(id) {
  const w = workouts.find(x => x.id === id); if (!w) return;
  const items = (w.exercises || []).map(e => ({ name: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: getLastKg(e.ex) || e.kg || '', restSec: 90 }));
  const appended = planLoadOrAppend(items, w.name || '');
  closeSheet('shCopy'); toast(appended ? 'Añadida al entreno ✓' : 'Copiado ✓');
}
/* Repetir el último entreno: carga sus ejercicios y nombre en el planificador. */
function repeatLastWorkout() {
  if (!workouts.length) return toast('Aún no tienes entrenos para repetir', 'err');
  const w = workouts[0];
  openPlan();
  planExs = (w.exercises || []).map(e => ({ name: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: getLastKg(e.ex) || e.kg || '', restSec: 90 }));
  if ($('planName')) $('planName').value = w.name || '';
  renderPlanList();
  toast('Último entreno cargado ✓', 'good');
}
/* Valores del selector de descanso, en el mismo orden que las opciones del HTML (#rpOv). */
const REST_PICK_VALS = [0, 30, 60, 90, 120, 150, 180, 240, 300];

/* Durante el entreno: pone el descanso del ejercicio actual en TODOS los ejercicios de fuerza. */
function applyRestToAll() {
  if (typeof liveExs === 'undefined' || !liveExs[liveIdx]) return;
  const sec = liveExs[liveIdx].restSec || 0;
  liveExs.forEach(ex => { if (!ex.isCardio) ex.restSec = sec; });
  if (typeof saveLiveSession === 'function') saveLiveSession();
  if (typeof renderLiveEx === 'function') renderLiveEx();
  $('rpOv').classList.remove('on');
  toast('Descanso ' + fmtRestPill(sec) + ' en todos ✓', 'good');
}

/* restPickerMode: 'plan' (planificación) o 'live' (entrenando) */
let restPickerMode = 'plan';

function openRestPicker(idx) {
  restPickerMode = 'plan';
  restSelIdx = idx;
  const cur = planExs[idx].restSec;
  const vals = REST_PICK_VALS;
  if ($('rpAllBtn')) $('rpAllBtn').style.display = 'none';
  document.querySelectorAll('.rp-opt').forEach((el, i) => el.classList.toggle('on', vals[i] === cur));
  const inp = document.getElementById('rpCustomInp');
  if (inp) inp.value = (vals.includes(cur) ? '' : cur);
  $('rpOv').classList.add('on');
}

/* Abrir el selector de descanso desde el modo entrenamiento (cambia el descanso del ejercicio actual) */
function openLiveRestPicker() {
  if (typeof liveExs === 'undefined' || !liveExs[liveIdx]) return;
  restPickerMode = 'live';
  const cur = liveExs[liveIdx].restSec || 0;
  const vals = REST_PICK_VALS;
  if ($('rpAllBtn')) $('rpAllBtn').style.display = '';
  document.querySelectorAll('.rp-opt').forEach((el, i) => el.classList.toggle('on', vals[i] === cur));
  const inp = document.getElementById('rpCustomInp');
  if (inp) inp.value = (vals.includes(cur) ? '' : cur);
  $('rpOv').classList.add('on');
}

function pickRest(sec, btn) {
  document.querySelectorAll('.rp-opt').forEach(e => e.classList.remove('on'));
  btn.classList.add('on');
  if (restPickerMode === 'live' && typeof liveExs !== 'undefined' && liveExs[liveIdx]) {
    liveExs[liveIdx].restSec = sec;
    if (typeof saveLiveSession === 'function') saveLiveSession();
    if (typeof renderLiveEx === 'function') renderLiveEx();
    toast('Descanso: ' + (sec === 0 ? 'Sin pausa' : fmtRestPill(sec)) + ' ✓', 'good');
  } else if (restSelIdx >= 0) {
    planExs[restSelIdx].restSec = sec;
    renderPlanList();
  }
  $('rpOv').classList.remove('on');
}

function pickRestCustom() {
  const inp = document.getElementById('rpCustomInp');
  const v = parseInt(inp && inp.value, 10);
  if (!v || v < 1 || v > 900) {
    toast('Pon un valor entre 1 y 900 segundos', 'err');
    return;
  }
  if (restPickerMode === 'live' && typeof liveExs !== 'undefined' && liveExs[liveIdx]) {
    liveExs[liveIdx].restSec = v;
    if (typeof saveLiveSession === 'function') saveLiveSession();
    if (typeof renderLiveEx === 'function') renderLiveEx();
  } else if (restSelIdx >= 0) {
    planExs[restSelIdx].restSec = v;
    renderPlanList();
  }
  document.querySelectorAll('.rp-opt').forEach(e => e.classList.remove('on'));
  $('rpOv').classList.remove('on');
  toast('Descanso: ' + v + 's ✓', 'good');
}

/* Formatea segundos a "Off / 90s / 1m 30s / 3m" */
function fmtRestPill(sec) {
  if (!sec) return 'Off';
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? (m + 'm ' + s + 's') : (m + 'm');
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
