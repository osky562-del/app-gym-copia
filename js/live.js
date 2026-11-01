/* ══ LIVE MODE (paridad con Android: ui/live/LiveScreen.kt + LiveViewModel.kt) ══ */

/* Helper: enviar mensajes al bridge nativo de iOS para la Live Activity */
function _liveActivityCall(name, body) {
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[name]) {
      window.webkit.messageHandlers[name].postMessage(body || {});
    }
  } catch (e) {}
}

/* Sincronizar el estado del JS con el de la Live Activity (cuando vuelve a primer plano) */
window.__onLiveActivitySync = function (state) {
  if (!state) return;
  if (!state.isResting && typeof restInt !== 'undefined' && restInt) {
    if (typeof stopRest === 'function') stopRest();
    if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
    return;
  }
  if (state.isResting && state.restLeftSec != null && typeof restInt !== 'undefined' && restInt) {
    const newLeft = Math.max(0, state.restLeftSec);
    if (newLeft <= 0) {
      if (typeof stopRest === 'function') stopRest();
      if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
      return;
    }
    restTotal = newLeft;
    restStartWall = Date.now();
    restLeft = newLeft;
    if (typeof renderRest === 'function') renderRest();
  }
};

function _lvEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function _lvT(es) { return (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(es) : es; }

function startLiveMode() {
  if (!planExs.length) return;
  // Límite de entrenos del plan Free.
  if (typeof Pro !== 'undefined' && Pro.canAddSession && !Pro.canAddSession()) {
    if (Pro.showUpgradeModal) Pro.showUpgradeModal('unlimited_workouts');
    return;
  }
  if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
  if (typeof unlockAudioContext === 'function') unlockAudioContext();
  if (typeof requestRestNotifPermission === 'function') requestRestNotifPermission();
  // Cada ejercicio del plan se mapea a un ejercicio "live". Si hay historial, se cargan los
  // kg/reps (o min/km) INDIVIDUALES de cada serie de la última vez (LiveViewModel.start).
  liveExs = planExs.map(ex => {
    const n = Math.max(1, +ex.sets || 1);
    const lastDetail = (typeof getLastSetsDetail === 'function') ? getLastSetsDetail(ex.name) : null;
    let sets;
    if (lastDetail && lastDetail.length > 0) {
      sets = Array.from({ length: n }, (_, i) => {
        const src = lastDetail[i] || lastDetail[lastDetail.length - 1];
        if (ex.isCardio) {
          return { kg: '', reps: 0, min: (src && src.min) || ex.min || '', km: (src && src.km) || ex.km || '', done: false, warmup: !!(src && src.warmup), type: 'normal' };
        }
        return {
          kg: (src && src.kg !== undefined && src.kg !== '') ? src.kg : (ex.kg || ''),
          reps: (src && +src.reps > 0) ? src.reps : ex.reps,
          done: false,
          warmup: !!(src && src.warmup),
          type: (src && src.type) || 'normal'
        };
      });
    } else if (ex.isCardio) {
      sets = Array.from({ length: n }, () => ({ kg: '', reps: 0, min: ex.min || '', km: ex.km || '', done: false, warmup: false, type: 'normal' }));
    } else {
      sets = Array.from({ length: n }, () => ({ kg: ex.kg || '', reps: ex.reps, done: false, warmup: false, type: 'normal' }));
    }
    return { name: ex.name, restSec: +ex.restSec || 0, sets, ssLink: !!ex.ssLink, isCardio: !!ex.isCardio };
  });
  liveIdx = 0; liveTotalSec = 0; livePauseSec = 0; liveIsPaused = false; livePauseCnt = 0;
  liveStartWall = Date.now(); livePausedMs = 0; livePauseStartWall = 0;
  $('lvTime').textContent = '00:00'; $('lvTime').className = 'lv-time';
  _setPauseIcon(false);
  stopRest();
  $('planMode').classList.remove('show');
  $('liveMode').classList.add('show');
  clearInterval(liveTotalInt);
  liveTotalInt = setInterval(() => { if (!liveIsPaused) { liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000); $('lvTime').textContent = fmt(liveTotalSec); } }, 1000);
  saveLiveSession(); renderLiveEx();
  const firstEx = liveExs[0];
  if (firstEx) {
    _liveActivityCall('startWorkoutActivity', { exerciseName: firstEx.name, currentSet: 1, totalSets: firstEx.sets.length });
  }
}
/* ✕ → diálogo propio "¿Salir del entreno?" (LiveScreen.kt:236-251). */
function askExitLive() { $('lvExitOv').classList.add('on'); }
function exitLive() {
  $('lvExitOv').classList.remove('on');
  clearInterval(liveTotalInt); clearInterval(livePauseInt); stopRest();
  STORE.set('live_session', null);
  if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
  liveExs = [];
  $('liveMode').classList.remove('show'); $('planMode').classList.add('show');
  _liveActivityCall('endWorkoutActivity', {});
}
function _setPauseIcon(paused) {
  const ico = $('lvPauseIco');
  if (!ico) return;
  ico.innerHTML = paused
    ? '<polygon points="5 3 19 12 5 21 5 3"/>'
    : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  const btn = $('lvPauseBtn'); if (btn) btn.classList.toggle('on', paused);
}
/* Pausa: solo congela el cronómetro y el descanso (se reanudan al seguir). Sin overlay ni toasts. */
function togglePause() {
  liveIsPaused = !liveIsPaused;
  if (liveIsPaused) {
    livePauseCnt++; livePauseStartWall = Date.now();
    $('lvTime').className = 'lv-time paused';
    livePauseInt = setInterval(() => { livePauseSec = Math.floor((Date.now() - livePauseStartWall) / 1000); }, 1000);
  } else {
    livePausedMs += Date.now() - livePauseStartWall;
    clearInterval(livePauseInt);
    $('lvTime').className = 'lv-time';
  }
  _setPauseIcon(liveIsPaused);
  if (typeof restOnPause === 'function') restOnPause(liveIsPaused);
  saveLiveSession();
}
/* Cambiar de ejercicio NO cancela el descanso en curso (como Android). */
function navEx(dir) {
  const n = liveIdx + dir;
  if (n < 0 || n >= liveExs.length) return;
  liveIdx = n;
  renderLiveEx();
  saveLiveSession();
  const ex = liveExs[liveIdx];
  if (ex) {
    const doneSet = ex.sets.filter(s => s.done).length;
    _liveActivityCall('updateWorkoutActivity', { exerciseName: ex.name, currentSet: Math.min(doneSet + 1, ex.sets.length), totalSets: ex.sets.length });
  }
}
/* Devuelve [inicio, fin] del grupo de superserie contiguo que contiene a idx. */
function getLiveGroup(idx) {
  if (!liveExs || !liveExs[idx]) return [idx, idx];
  let a = idx, b = idx;
  while (a > 0 && liveExs[a] && liveExs[a].ssLink) a--;
  while (b < liveExs.length - 1 && liveExs[b + 1] && liveExs[b + 1].ssLink) b++;
  return [a, b];
}

/* ── Tipos de serie (SetTypes.kt): emoji, nombre, descripción y color ── */
const SET_TYPES = {
  normal:    { emoji: '▫️', label: 'Normal',     color: 'var(--t1)', desc: 'Serie de trabajo con esfuerzo controlado, dejando 1-2 repeticiones en reserva.' },
  drop:      { emoji: '🔻', label: 'Drop set',   color: '#4F8CFF', desc: 'Al llegar al fallo, baja el peso ~20% y sigue sin descanso para exprimir el músculo.' },
  failure:   { emoji: '💥', label: 'Al fallo',   color: '#FF4D4F', desc: 'Hasta que no puedas hacer ni una repetición más con buena técnica.' },
  restpause: { emoji: '⏸', label: 'Rest-pause', color: '#9B72F5', desc: 'Llega al fallo, descansa 10-15s y saca algunas repeticiones más con el mismo peso.' },
  amrap:     { emoji: '🔁', label: 'AMRAP',      color: '#F5A623', desc: 'Máximas repeticiones posibles en esa serie (sin dejar reserva).' }
};
const WARMUP_DESC = 'Series ligeras para preparar el músculo; no cuentan para el volumen ni los récords.';

function renderLiveEx() {
  const ex = liveExs[liveIdx];
  if (!ex) return;
  $('lvExName').textContent = ex.name;
  $('lvExCtr').textContent = _lvT('Ejercicio') + ' ' + (liveIdx + 1) + '/' + liveExs.length;
  const g = getLiveGroup(liveIdx), ss = g[1] > g[0];
  const badge = $('lvSsBadge');
  badge.style.display = ss ? '' : 'none';
  badge.textContent = ss ? `🔗 ${_lvT('Superserie')} ${liveIdx - g[0] + 1}/${g[1] - g[0] + 1}` : '';
  const restPill = $('lvRestPill');
  if (restPill) restPill.textContent = '⏱ ' + fmtRestPill(ex.restSec || 0);
  $('lvNavP').disabled = liveIdx === 0; $('lvNavN').disabled = liveIdx === liveExs.length - 1;
  const activeSet = ex.sets.findIndex(s => !s.done && !s.warmup);
  const canRemove = ex.sets.length > 1;
  let realNum = 0;
  $('lvSetsEl').innerHTML = ex.sets.map((s, si) => {
    if (!s.warmup) realNum++;
    const st = (!s.warmup && s.type && SET_TYPES[s.type]) ? SET_TYPES[s.type] : SET_TYPES.normal;
    const typed = !s.warmup && s.type && s.type !== 'normal' && SET_TYPES[s.type];
    const cls = s.done ? ' done' : s.warmup ? ' warmup' : si === activeSet ? ' active' : '';
    const numStyle = typed ? ` style="color:${st.color};background:${st.color}44;"` : '';
    const label = s.warmup ? '🔥' : (typed ? st.emoji : realNum);
    const inputs = ex.isCardio
      ? `<div class="lv-set-grp"><div class="lv-set-lbl">Min</div><input class="lv-inp" type="number" inputmode="decimal" value="${_lvEsc(s.min || '')}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].min=this.value;saveLiveSession()"></div>
       <div class="lv-set-grp"><div class="lv-set-lbl">Km</div><input class="lv-inp" type="number" inputmode="decimal" value="${_lvEsc(s.km || '')}" placeholder="—" min="0" step="0.1" oninput="liveExs[${liveIdx}].sets[${si}].km=this.value;saveLiveSession()"></div>`
      : `<div class="lv-set-grp"><div class="lv-set-lbl">Kg</div><input class="lv-inp" type="number" inputmode="decimal" value="${_lvEsc(s.kg || '')}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].kg=this.value;saveLiveSession()"></div>
       <div class="lv-set-grp"><div class="lv-set-lbl">Reps</div><input class="lv-inp" type="number" inputmode="numeric" value="${_lvEsc(s.reps || '')}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].reps=Math.min(100,Math.max(0,+this.value||0));saveLiveSession()"></div>`;
    return `<div class="lv-set${cls}" id="lvs${si}">
  <div class="lv-set-body">
    <button class="lv-set-num" onclick="openSetTypePicker(${si})" title="${_lvT('Modo de serie')}"${numStyle}>${label}</button>
    <div class="lv-set-inps">${inputs}</div>
    <button class="lv-set-ic warm${s.warmup ? ' on' : ''}" onclick="toggleWarmup(${si})" title="${_lvT('Calentamiento')}">🔥</button>
    ${canRemove ? `<button class="lv-set-ic" onclick="removeLiveSetAt(${si})" title="${_lvT('Quitar serie')}">🗑</button>` : ''}
    <button class="lv-check${s.done ? ' done' : ''}" onclick="toggleSet(${si})"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button>
  </div>
</div>`;
  }).join('') + `<button class="lv-set-add" onclick="addLiveSet()"><span class="lv-set-add-plus">+</span> ${_lvT('Añadir serie')}</button>`;
  updateLvStats();
}
function addLiveSet() {
  const ex = liveExs[liveIdx];
  const last = ex.sets[ex.sets.length - 1];
  if (ex.isCardio) ex.sets.push({ kg: '', reps: 0, min: last?.min || '', km: last?.km || '', done: false, warmup: false, type: 'normal' });
  else ex.sets.push({ kg: last?.kg || '', reps: last?.reps || 10, done: false, warmup: false, type: 'normal' });
  renderLiveEx(); saveLiveSession();
}
/* Quita ESA serie (no se muestra si solo queda una). */
function removeLiveSetAt(si) {
  const ex = liveExs[liveIdx];
  if (!ex || ex.sets.length <= 1 || !ex.sets[si]) return;
  ex.sets.splice(si, 1);
  renderLiveEx(); saveLiveSession();
}
/* Marcar/desmarcar una serie como calentamiento (también si ya está hecha, como Android). */
function toggleWarmup(si) {
  const ex = liveExs[liveIdx];
  if (!ex || !ex.sets[si]) return;
  ex.sets[si].warmup = !ex.sets[si].warmup;
  renderLiveEx(); saveLiveSession();
  if (typeof vib === 'function') vib([20]);
}
/* ── Diálogo "Modo de serie" (LiveScreen.kt:137-173) ── */
let _setTypeIdx = -1;
function openSetTypePicker(si) {
  const ex = liveExs[liveIdx];
  if (!ex || !ex.sets[si]) return;
  _setTypeIdx = si;
  renderSetTypeOverlay(ex.sets[si]);
  $('stOv').classList.add('on');
}
function renderSetTypeOverlay(cur) {
  let m = document.getElementById('stOv');
  if (!m) {
    m = document.createElement('div');
    m.id = 'stOv';
    m.className = 'lv-dlg-ov';
    m.onclick = (e) => { if (e.target === m) closeSetType(); };
    document.body.appendChild(m);
  }
  const canPro = typeof Pro !== 'undefined' && Pro.can && Pro.can('set_types');
  const row = (emoji, name, desc, color, selected, locked, onclick) => `<button class="lv-mode-row${selected ? ' sel' : ''}" onclick="${onclick}">
  <span class="lv-mode-emoji">${emoji}</span>
  <span class="lv-mode-txt"><span class="lv-mode-n" style="color:${locked ? 'var(--t3)' : color};">${name}${locked ? ' <em class="lv-mode-lock">🔒 Pro</em>' : ''}</span><span class="lv-mode-d">${desc}</span></span>
  ${selected ? '<span class="lv-mode-check">✓</span>' : ''}
</button>`;
  let html = row('🔥', _lvT('Calentamiento'), _lvT(WARMUP_DESC), '#F5A623', !!cur.warmup, false, "setSetType('warmup')");
  Object.keys(SET_TYPES).forEach(id => {
    const st = SET_TYPES[id];
    const locked = id !== 'normal' && !canPro;
    const selected = !cur.warmup && (cur.type || 'normal') === id;
    html += row(st.emoji, _lvT(st.label), _lvT(st.desc), st.color, selected, locked, `setSetType('${id}')`);
  });
  m.innerHTML = `<div class="lv-dlg lv-dlg-modes">
  <div class="lv-dlg-t">${_lvT('Modo de serie')}</div>
  <div class="lv-mode-list">${html}</div>
  <div class="lv-dlg-acts"><button class="lv-dlg-btn" onclick="closeSetType()">${_lvT('Cerrar')}</button></div>
</div>`;
}
function closeSetType() { const m = document.getElementById('stOv'); if (m) m.classList.remove('on'); }
function setSetType(type) {
  const ex = liveExs[liveIdx];
  if (!ex || !ex.sets[_setTypeIdx]) { closeSetType(); return; }
  if (type !== 'normal' && type !== 'warmup' && typeof Pro !== 'undefined' && Pro.can && !Pro.can('set_types')) {
    closeSetType();
    if (Pro.showUpgradeModal) Pro.showUpgradeModal('set_types');
    return;
  }
  const s = ex.sets[_setTypeIdx];
  if (type === 'warmup') { s.warmup = true; s.type = 'normal'; }
  else { s.warmup = false; s.type = type; }
  closeSetType();
  renderLiveEx(); saveLiveSession();
  if (typeof vib === 'function') vib([20]);
}
window.openSetTypePicker = openSetTypePicker;
window.closeSetType = closeSetType;
window.setSetType = setSetType;

/* Texto "qué viene después" para la notificación nativa (iOS/Apple Watch). */
function getNextUpText() {
  if (typeof liveExs === 'undefined' || !Array.isArray(liveExs) || !liveExs.length) return '';
  const ex = liveExs[liveIdx];
  if (!ex) return '';
  const realSets = ex.sets.filter(s => !s.warmup);
  const nextRealIdx = realSets.findIndex(s => !s.done);
  if (nextRealIdx !== -1) return `A por la serie ${nextRealIdx + 1} de ${realSets.length} · ${ex.name}`;
  if (liveIdx < liveExs.length - 1) {
    const next = liveExs[liveIdx + 1];
    return next ? `Siguiente ejercicio: ${next.name}` : '';
  }
  return '¡Último esfuerzo! Entreno casi completo 🔥';
}
function toggleSet(si) {
  const ex = liveExs[liveIdx], s = ex.sets[si]; s.done = !s.done;
  if (s.done) {
    vib([60]);
    if (!s.warmup) {
      // Arrastrar el peso a la siguiente serie pendiente que no tenga kg (LiveViewModel.kt:466-470).
      if (!ex.isCardio) {
        const next = ex.sets.findIndex((t, j) => j > si && !t.done && !t.warmup);
        if (next !== -1 && !String(ex.sets[next].kg || '').trim()) ex.sets[next].kg = s.kg;
      }
      // Superserie: si otro ejercicio del grupo tiene ESTA misma serie pendiente, saltar a él SIN descanso.
      const g = getLiveGroup(liveIdx);
      if (g[1] > g[0] && liveIdx < g[1]) {
        let nextEx = -1;
        for (let j = liveIdx + 1; j <= g[1]; j++) {
          const t = liveExs[j].sets[si];
          if (t && !t.done && !t.warmup) { nextEx = j; break; }
        }
        if (nextEx !== -1) {
          navEx(nextEx - liveIdx);
          setTimeout(() => {
            const el = document.getElementById('lvs' + si);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('.lv-inp'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } } }
          }, 150);
          return;
        }
      }
    }
    // El descanso (y el avance) salta TAMBIÉN tras una serie de calentamiento; puedes saltarlo.
    if (ex.restSec) {
      startRest(ex.restSec, '', (typeof getNextUpText === 'function') ? getNextUpText() : '');
    } else {
      renderLiveEx(); saveLiveSession();
      autoAdvanceAfterRest();
      return;
    }
    // Respaldo por wall-clock por si el setInterval del descanso no dispara (app en background).
    const wait = ex.restSec * 1000 + 80;
    setTimeout(() => {
      if (typeof liveIsPaused !== 'undefined' && liveIsPaused) return;
      if (restInt) return;                       // el descanso sigue (p. ej. se alargó)
      if (liveExs[liveIdx] !== ex) return;
      if (!ex.sets[si] || !ex.sets[si].done) return;
      if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
    }, wait);
  }
  renderLiveEx(); saveLiveSession();
  if (!s.done && typeof __syncWorkoutToNative === 'function') __syncWorkoutToNative(true);
}
function updateLvStats() {
  let done = 0, totalReal = 0;
  liveExs.forEach(ex => ex.sets.forEach(s => {
    if (s.warmup) return;
    totalReal++;
    if (s.done) done++;
  }));
  $('lvProg').style.width = (totalReal ? Math.round(done / totalReal * 100) : 0) + '%';
  $('lvProgTxt').textContent = done + ' / ' + totalReal + ' ' + _lvT('series');
}
/* Tras el descanso (o al saltarlo): siguiente serie pendiente o siguiente ejercicio. Sin toasts. */
function autoAdvanceAfterRest() {
  if (typeof liveExs === 'undefined' || !Array.isArray(liveExs) || !liveExs.length) return;
  const ex = liveExs[liveIdx];
  if (!ex) return;
  const g = getLiveGroup(liveIdx);
  if (g[1] > g[0]) {
    for (let j = g[0]; j <= g[1]; j++) {
      const k = liveExs[j].sets.findIndex(s => !s.done && !s.warmup);
      if (k !== -1) {
        if (j !== liveIdx) navEx(j - liveIdx);
        setTimeout(() => {
          const el = document.getElementById('lvs' + k);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('.lv-inp'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } } }
        }, j !== liveIdx ? 200 : 150);
        return;
      }
    }
    if (g[1] < liveExs.length - 1) navEx(g[1] + 1 - liveIdx);
    return;
  }
  const nextSetIdx = ex.sets.findIndex(s => !s.done && !s.warmup);
  if (nextSetIdx === -1) {
    if (liveIdx < liveExs.length - 1) navEx(1);
    return;
  }
  setTimeout(() => {
    const setEl = document.getElementById('lvs' + nextSetIdx);
    if (setEl) setEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inp = setEl ? setEl.querySelector('.lv-inp') : null;
    if (inp) try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
  }, 150);
}

/* ══ SINCRONIZACIÓN CON EL GESTOR DE ENTRENO NATIVO (iOS) ══ */
function __buildWorkoutSyncPayload() {
  const exercises = liveExs.map(ex => ({ name: ex.name, restSec: ex.restSec || 0, sets: ex.sets.map(s => !!s.warmup) }));
  let completed = 0;
  liveExs.forEach(ex => ex.sets.forEach(s => { if (s.done) completed++; }));
  return { exercises, completed };
}
function __syncWorkoutToNative(force) {
  try {
    if (!(window.webkit && window.webkit.messageHandlers)) return;
    if (Array.isArray(liveExs) && liveExs.some(e => e.ssLink)) {
      if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
      return;
    }
    if (window.webkit.messageHandlers.workoutSyncState && Array.isArray(liveExs) && liveExs.length) {
      const payload = __buildWorkoutSyncPayload();
      payload.force = !!force;
      window.webkit.messageHandlers.workoutSyncState.postMessage(payload);
    }
  } catch (e) {}
}
function __endWorkoutNative() {
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.workoutEnd) {
      window.webkit.messageHandlers.workoutEnd.postMessage({});
    }
  } catch (e) {}
}
window.__pendingWatchCursor = null;
function __applyWatchCursor(targetEx, targetSet) {
  try {
    if (typeof liveExs === 'undefined' || !Array.isArray(liveExs) || !liveExs.length) {
      window.__pendingWatchCursor = { ex: targetEx, set: targetSet };
      return;
    }
    let changed = false;
    for (let i = 0; i < liveExs.length; i++) {
      const sets = liveExs[i].sets;
      for (let j = 0; j < sets.length; j++) {
        const shouldBeDone = (i < targetEx) || (i === targetEx && j < targetSet);
        if (shouldBeDone && !sets[j].done) { sets[j].done = true; changed = true; }
      }
    }
    if (!changed) return;
    let cur = liveExs.findIndex(ex => ex.sets.some(s => !s.done));
    if (cur === -1) cur = liveExs.length - 1;
    liveIdx = cur;
    renderLiveEx(); saveLiveSession();
    try { if (window.forceSyncCloud) window.forceSyncCloud(); } catch (e) {}
  } catch (e) { console.warn('applyWatchCursor:', e); }
}
window.__applyWatchCursor = __applyWatchCursor;

/* Finalizar: sin confirmación (vm.finish de Android). */
function finishLive() {
  clearInterval(liveTotalInt); clearInterval(livePauseInt); stopRest();
  if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
  _liveActivityCall('endWorkoutActivity', {});
  const exercises = liveExs.map(ex => {
    const realSets = ex.sets.filter(s => !s.warmup);
    const detail = ex.sets.map(s => ({ kg: s.kg || '', reps: +s.reps || 0, done: !!s.done, warmup: !!s.warmup, type: s.type || 'normal', min: s.min || '', km: s.km || '' }));
    if (ex.isCardio) {
      return { ex: ex.name, kg: '', sets: realSets.length, reps: 0, isCardio: true, setsDetail: detail };
    }
    const kgs = realSets.map(s => parseFloat(s.kg)).filter(v => isFinite(v) && v > 0);
    const maxKg = kgs.length ? Math.max(...kgs) : 0;
    const firstReps = realSets[0]?.reps || ex.sets[0]?.reps || 10;
    return { ex: ex.name, kg: String(maxKg || ''), sets: realSets.length, reps: firstReps, isCardio: false, setsDetail: detail };
  });
  const _dur = Math.floor(liveTotalSec / 60);
  const _name = (($('planName') && $('planName').value.trim()) || 'Entreno');
  const wk = {
    id: uid(), name: _name, date: new Date().toISOString().split('T')[0], duration: _dur, calories: _dur * 6,
    pauseDuration: livePauseSec ? Math.round(livePauseSec / 60) : '', pauseCount: livePauseCnt,
    rpe: getRpeValue(), notes: ($('planNotes') && $('planNotes').value) || '', exercises
  };
  // Récords: solo de kg (máximo por ejercicio vs histórico).
  const newPRs = [];
  exercises.forEach(ex => {
    const prev = getPR(ex.ex);
    if (+ex.kg > 0 && +ex.kg > prev) newPRs.push(ex.ex + ' ' + ex.kg + 'kg');
  });
  if (typeof Pro !== 'undefined' && Pro.canAddSession && !Pro.canAddSession()) {
    Pro.showUpgradeModal('unlimited_workouts');
  }
  STORE.set('live_session', null);
  workouts.unshift(wk); saveWorkouts();
  try { if (window.forceSyncCloud) window.forceSyncCloud(); } catch (e) { console.warn('Sync start failed:', e); }
  $('liveMode').classList.remove('show');
  planExs = []; liveExs = [];
  updateXpBar();
  const xpGained = XP.session + exercises.reduce((s, e) => s + XP.exercise + XP.series * e.sets, 0) + newPRs.length * XP.pr;
  showSummary(wk, xpGained, newPRs);
}

function saveLiveSession() {
  if (!liveExs.length) return;
  STORE.set('live_session', {
    liveExs, liveIdx, liveTotalSec, livePauseSec,
    liveIsPaused, livePauseCnt,
    liveStartWall, livePausedMs, livePauseStartWall,
    restStartWall, restTotal, restMsg: restInt ? (restMsg || '') : '',
    planNotes: $('planNotes') ? $('planNotes').value || '' : '',
    planName: $('planName') ? $('planName').value || '' : '',
    ts: Date.now()
  });
  if (typeof __syncWorkoutToNative === 'function') __syncWorkoutToNative();
}

function restoreLiveSession(saved) {
  liveExs = saved.liveExs;
  liveIdx = saved.liveIdx || 0;
  livePauseSec = saved.livePauseSec || 0;
  liveIsPaused = false;
  livePauseCnt = saved.livePauseCnt || 0;
  livePausedMs = saved.livePausedMs || 0;
  livePauseStartWall = 0;
  liveStartWall = saved.liveStartWall || (Date.now() - (saved.liveTotalSec || 0) * 1000 - livePausedMs);
  liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000);
  if (saved.planNotes && $('planNotes')) $('planNotes').value = saved.planNotes;
  if (saved.planName && $('planName')) $('planName').value = saved.planName;
  $('lvTime').textContent = fmt(liveTotalSec);
  $('lvTime').className = 'lv-time';
  _setPauseIcon(false);
  stopRest();
  $('planMode').classList.remove('show');
  $('liveMode').classList.add('show');
  clearInterval(liveTotalInt);
  liveTotalInt = setInterval(() => {
    if (!liveIsPaused) { liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000); $('lvTime').textContent = fmt(liveTotalSec); }
  }, 1000);
  renderLiveEx();
  if (saved.restTotal && saved.restStartWall) {
    const elapsed = Math.floor((Date.now() - saved.restStartWall) / 1000);
    const remaining = saved.restTotal - elapsed;
    if (remaining > 0) {
      startRest(remaining, saved.restMsg || '');
      restTotal = saved.restTotal; restStartWall = saved.restStartWall;
    }
  }
  if (typeof __syncWorkoutToNative === 'function') __syncWorkoutToNative();
  if (window.__pendingWatchCursor) {
    const c = window.__pendingWatchCursor;
    window.__pendingWatchCursor = null;
    setTimeout(() => { if (typeof __applyWatchCursor === 'function') __applyWatchCursor(c.ex, c.set); }, 400);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && liveExs.length) saveLiveSession();
});

/* ── Menú ⋯: Añadir ejercicio / Quitar ejercicio (oculto si solo hay 1) ── */
function openLvExMenu() {
  const list = $('lvExMenuList');
  let html = `<button class="rp-item" onclick="$('lvExMenu').classList.remove('on');openLvExSheet()">${_lvT('Añadir ejercicio')}</button>`;
  if (liveExs.length > 1) html += `<button class="rp-item danger" onclick="$('lvExMenu').classList.remove('on');removeLvEx()">${_lvT('Quitar ejercicio')}</button>`;
  list.innerHTML = html;
  $('lvExMenu').classList.add('on');
}
/* ── Menú del descanso: presets ✓, −15 s, +15 s, usar en todos (LiveScreen.kt:325-358) ── */
function openLiveRestMenu() {
  const ex = liveExs[liveIdx];
  if (!ex) return;
  const cur = ex.restSec || 0;
  let html = REST_PRESETS.map(r => `<button class="rp-item${r === cur ? ' on' : ''}" onclick="liveSetRest(${r});$('rpOv').classList.remove('on')">${r === cur ? '✓ ' : ''}${fmtRestPill(r)}</button>`).join('');
  html += `<button class="rp-item" onclick="liveSetRest(Math.max(0,(liveExs[liveIdx].restSec||0)-15));openLiveRestMenu()">−15 s</button>`;
  html += `<button class="rp-item" onclick="liveSetRest((liveExs[liveIdx].restSec||0)+15);openLiveRestMenu()">+15 s</button>`;
  html += `<button class="rp-item accent" onclick="liveSetRestAll();$('rpOv').classList.remove('on')">${_lvT('Usar')} ${fmtRestPill(cur)} ${_lvT('en todos los ejercicios')}</button>`;
  $('rpList').innerHTML = html;
  $('rpOv').classList.add('on');
}
/* Cambia el descanso del ejercicio actual (se aplica al PRÓXIMO descanso, no al que corre). */
function liveSetRest(sec) {
  const ex = liveExs[liveIdx];
  if (!ex) return;
  ex.restSec = Math.max(0, +sec || 0);
  renderLiveEx(); saveLiveSession();
}
function liveSetRestAll() {
  const ex = liveExs[liveIdx];
  if (!ex) return;
  const sec = ex.restSec || 0;
  liveExs.forEach(e => { if (!e.isCardio) e.restSec = sec; });
  renderLiveEx(); saveLiveSession();
}
/* Discos: prefill = primera serie real con kg (si no, la primera). */
function openLivePlateCalc() {
  const ex = liveExs[liveIdx];
  let pre = '';
  if (ex) {
    const s = ex.sets.find(x => !x.warmup && String(x.kg || '').trim()) || ex.sets[0];
    pre = (s && s.kg) || '';
  }
  if (typeof openPlateCalc === 'function') openPlateCalc(pre);
}

/* ── Añadir ejercicio en Live: diálogo con buscador; vacío = top 30 por tier ── */
function openLvExSheet() {
  $('lvExSearch').value = '';
  $('shLvEx').classList.add('on');
  filterLvAC();
  setTimeout(() => $('lvExSearch').focus(), 350);
}
function _lvIsCardio(name) {
  if (typeof exIsCardio === 'function') return exIsCardio(name);
  const e = (window.EXERCISES_DB || []).find(x => x.name === name);
  return !!(e && e.category === 'cardio');
}
function lvAcRow(n) {
  const esc = n.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const cardio = _lvIsCardio(n);
  return `<div class="sh-card lv-ac-row" onclick="pickLvEx('${esc}',${cardio})"><span class="lv-ac-n">${_lvEsc(n)}</span>${cardio ? '<span class="lv-ac-cardio">🏃</span>' : ''}<span class="lv-ac-add">+</span></div>`;
}
function filterLvAC() {
  const raw = $('lvExSearch').value.trim();
  const list = $('lvExAC');
  let names;
  if (!raw) {
    const db = (window.EXERCISES_DB || []).slice().sort((a, b) => (a.tier || 2) - (b.tier || 2));
    names = db.slice(0, 30).map(e => e.name);
  } else {
    names = searchExNames(raw, 30);
  }
  list.innerHTML = names.map(lvAcRow).join('');
}
/* Añade el ejercicio al final y salta a él: 3 series vacías ×10 (1 si cardio) (LiveViewModel.kt:418-425). */
function pickLvEx(name, isCardio) {
  closeSheet('shLvEx');
  const sets = isCardio
    ? [{ kg: '', reps: 0, min: '', km: '', done: false, warmup: false, type: 'normal' }]
    : Array.from({ length: 3 }, () => ({ kg: '', reps: 10, done: false, warmup: false, type: 'normal' }));
  liveExs.push({ name, isCardio: !!isCardio, restSec: isCardio ? 0 : 90, sets, ssLink: false });
  liveIdx = liveExs.length - 1;
  renderLiveEx(); saveLiveSession();
}
/* Quitar el ejercicio actual (sin confirmación; nunca deja el entreno vacío). */
function removeLvEx() {
  if (!liveExs || liveExs.length <= 1) return;
  liveExs.splice(liveIdx, 1);
  if (liveIdx >= liveExs.length) liveIdx = liveExs.length - 1;
  renderLiveEx(); saveLiveSession();
}
