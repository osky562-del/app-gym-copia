/* ══ LIVE MODE ══ */
function startLiveMode() {
  if (!planExs.length) return;
  liveExs = planExs.map(ex => ({ name: ex.name, restSec: ex.restSec, sets: Array.from({ length: ex.sets }, () => ({ kg: ex.kg || '', reps: ex.reps, done: false })) }));
  liveIdx = 0; liveTotalSec = 0; livePauseSec = 0; liveIsPaused = false; livePauseCnt = 0;
  liveStartWall = Date.now(); livePausedMs = 0; livePauseStartWall = 0;
  $('lvTime').textContent = '00:00'; $('lvTime').className = 'lv-time';
  $('lvPauseIco').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  $('lvPausedOv').classList.remove('show'); stopRest();
  $('planMode').classList.remove('show');
  $('liveMode').classList.add('show');
  liveTotalInt = setInterval(() => { if (!liveIsPaused) { liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000); $('lvTime').textContent = fmt(liveTotalSec); $('lvClock').textContent = fmt(liveTotalSec); } }, 1000);
  saveLiveSession(); renderLiveEx(); updateLvStats();
}
function backToPlan() {
  if (!confirm('¿Volver a la planificación?')) return;
  clearInterval(liveTotalInt); clearInterval(livePauseInt); stopRest();
  STORE.set('live_session', null);
  $('liveMode').classList.remove('show'); $('planMode').classList.add('show');
}
function togglePause() {
  liveIsPaused = !liveIsPaused;
  if (liveIsPaused) {
    livePauseCnt++; livePauseStartWall = Date.now(); $('lvPauseCnt').textContent = livePauseCnt;
    $('lvPausedOv').classList.add('show'); $('lvTime').className = 'lv-time paused';
    $('lvPauseIco').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    livePauseInt = setInterval(() => { livePauseSec = Math.floor((Date.now() - livePauseStartWall) / 1000); $('lvPauseTime').textContent = fmt(livePauseSec); }, 1000);
    stopRest(); toast('Pausado ⏸');
  } else {
    livePausedMs += Date.now() - livePauseStartWall;
    clearInterval(livePauseInt); $('lvPausedOv').classList.remove('show'); $('lvTime').className = 'lv-time';
    $('lvPauseIco').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    toast('¡Vamos! 💪', 'good');
  }
  saveLiveSession();
}
function navEx(dir) { const n = liveIdx + dir; if (n < 0 || n >= liveExs.length) return; liveIdx = n; stopRest(); renderLiveEx(); saveLiveSession(); }
function renderLiveEx() {
  const ex = liveExs[liveIdx], lk = getLastKg(ex.name), pr = getPR(ex.name);
  $('lvExName').textContent = ex.name;
  $('lvExCtr').textContent = (liveIdx + 1) + ' / ' + liveExs.length;
  let prText = '';
  if (ex.isCardio) {
    prText = '🏃 Cardio';
  } else {
    prText = (lk ? 'Último: ' + lk + 'kg' : '') + ((lk && pr) ? ' · ' : '') + ((pr) ? 'PR: ' + pr + 'kg' : '');
    if (Pro.can('advanced_analytics')) {
      const sug = getSuggestedKg(ex.name);
      if (sug && sug.reason === 'overload') prText += ' · 💡 Sube a ' + sug.kg + 'kg';
    }
  }
  $('lvExPr').textContent = prText;
  $('lvNavP').disabled = liveIdx === 0; $('lvNavN').disabled = liveIdx === liveExs.length - 1;
  const canRemove = ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done;
  $('lvSetsEl').innerHTML = ex.sets.map((s, si) => {
    const isActive = !s.done && ex.sets.slice(0, si).every(p => p.done);
    if (ex.isCardio) {
      return `<div class="lv-set${s.done ? ' done' : isActive ? ' active' : ''}" id="lvs${si}">
  <div class="lv-set-body">
    <div class="lv-set-num">${si + 1}</div>
    <div class="lv-set-inps">
      <div class="lv-set-grp"><div class="lv-set-lbl">Min</div><input class="lv-inp" type="number" value="${s.min || ''}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].min=this.value" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
      <div class="lv-set-grp"><div class="lv-set-lbl">Km</div><input class="lv-inp" type="number" value="${s.km || ''}" placeholder="—" min="0" step="0.1" oninput="liveExs[${liveIdx}].sets[${si}].km=this.value" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
    </div>
    <div class="lv-set-vol"></div>
    <button class="lv-check${s.done ? ' done' : ''}" onclick="toggleSet(${si})"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button>
  </div>
</div>`;
    }
    const isPR = +s.kg > 0 && pr > 0 && +s.kg > pr;
    const vol = +s.kg && +s.reps ? Math.round(+s.kg * +s.reps) : null;
    return `<div class="lv-set${s.done ? ' done' : isActive ? ' active' : ''}" id="lvs${si}">
  <div class="lv-set-body">
    <div class="lv-set-num">${si + 1}</div>
    <div class="lv-set-inps">
      <div class="lv-set-grp"><div class="lv-set-lbl">Kg</div><input class="lv-inp${isPR ? ' pr' : ''}" type="number" value="${s.kg || ''}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].kg=this.value;updVol(${si})" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
      <div class="lv-set-grp"><div class="lv-set-lbl">Reps</div><input class="lv-inp" type="number" value="${s.reps || ''}" placeholder="—" min="1" oninput="liveExs[${liveIdx}].sets[${si}].reps=this.value;updVol(${si})" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
    </div>
    <div class="lv-set-vol${vol ? ' has' : ''}" id="lsv${si}">${vol || '—'}</div>
    <button class="lv-check${s.done ? ' done' : ''}" onclick="toggleSet(${si})"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button>
  </div>
</div>`;
  }).join('') + `<div class="lv-set-actions">
  <button class="lv-set-rm" onclick="removeLiveSet()"${canRemove ? '' : ' disabled'}>− Serie</button>
  <button class="lv-set-add" onclick="addLiveSet()">+ Serie</button>
</div>`;
  $('lvExScroll').scrollTo({ top: 0, behavior: 'smooth' }); updateLvStats();
}
function addLiveSet() {
  const ex = liveExs[liveIdx];
  const last = ex.sets[ex.sets.length - 1];
  if (ex.isCardio) {
    ex.sets.push({ min: last?.min || '', km: last?.km || '', done: false });
  } else {
    ex.sets.push({ kg: last?.kg || '', reps: last?.reps || 10, done: false });
  }
  renderLiveEx(); saveLiveSession();
}
function removeLiveSet() {
  const ex = liveExs[liveIdx];
  if (ex.sets.length <= 1) return;
  if (ex.sets[ex.sets.length - 1].done) { toast('No puedes quitar una serie ya completada', 'err'); return; }
  ex.sets.pop();
  renderLiveEx(); saveLiveSession();
}
function updVol(si) { const s = liveExs[liveIdx].sets[si]; const v = +s.kg && +s.reps ? Math.round(+s.kg * +s.reps) : null; const el = $('lsv' + si); if (el) { el.textContent = v || '—'; el.className = 'lv-set-vol' + (v ? ' has' : ''); } updateLvStats(); }
function toggleSet(si) {
  const ex = liveExs[liveIdx], s = ex.sets[si]; s.done = !s.done;
  if (s.done) {
    setTimeout(updateAutoRpe, 50); vib([60]); showXpFloat(XP.series); const kg = +s.kg || 0, pr = getPR(ex.name); if (kg > 0 && kg > pr) showPR(ex.name, kg); if (ex.restSec) startRest(ex.restSec, ex.sets.every(x => x.done) ? 'Descansa antes del siguiente' : 'Prepárate para la siguiente serie');
  }
  renderLiveEx(); saveLiveSession();
}
function updateLvStats() {
  let done = 0, vol = 0; liveExs.forEach(ex => ex.sets.forEach(s => { if (s.done) { done++; vol += (+s.kg || 0) * (+s.reps || 1); } }));
  const total = liveExs.reduce((s, e) => s + e.sets.length, 0);
  $('lvEx').textContent = (liveIdx + 1) + '/' + liveExs.length;
  $('lvSets').textContent = done; $('lvVol').textContent = big(vol);
  $('lvProg').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
}
function finishLive() {
  const total = liveExs.reduce((s, e) => s + e.sets.length, 0);
  const done = liveExs.reduce((s, e) => s + e.sets.filter(s => s.done).length, 0);
  const pct = total ? Math.round(done / total * 100) : 0;
  if (pct < 100 && !confirm(`Has completado el ${pct}% (${done}/${total} series). ¿Finalizar?`)) return;
  clearInterval(liveTotalInt); clearInterval(livePauseInt); stopRest();
  const exercises = liveExs.map(ex => {
    if (ex.isCardio) return { ex: ex.name, kg: '', sets: ex.sets.length, reps: 0, isCardio: true, setsDetail: ex.sets.map(s => ({ min: s.min || '', km: s.km || '', done: !!s.done })) };
    return { ex: ex.name, kg: String(Math.max(...ex.sets.map(s => +s.kg || 0)) || ''), sets: ex.sets.length, reps: ex.sets[0]?.reps || 10, setsDetail: ex.sets.map(s => ({ kg: s.kg || '', reps: s.reps, done: !!s.done })) };
  });
  const wk = { id: uid(), date: $('planDate').value || new Date().toISOString().split('T')[0], duration: liveTotalSec ? Math.round(liveTotalSec / 60) : '', pauseDuration: livePauseSec ? Math.round(livePauseSec / 60) : '', pauseCount: livePauseCnt, rpe: getRpeValue(), notes: $('planNotes').value || '', exercises };
  // Detect new PRs before saving
  const newPRs = [];
  exercises.forEach(ex => {
    const prev = getPR(ex.ex);
    if (+ex.kg > 0 && +ex.kg > prev) newPRs.push(ex.ex + ' ' + ex.kg + 'kg');
  });

  // Check session storage limit for free users
  if (!Pro.canAddSession()) {
    Pro.showUpgradeModal('unlimited_workouts');
    toast('Límite de sesiones alcanzado. Los datos de esta sesión no se guardarán permanentemente.', 'err');
  }
  STORE.set('live_session', null);
  workouts.unshift(wk); saveWorkouts();
  try {
    if (window.forceSyncCloud) window.forceSyncCloud();
  } catch(e) { console.warn('Sync start failed:', e); }
  $('liveMode').classList.remove('show');
  planExs = []; liveExs = [];
  updateXpBar();

  const xpGained = XP.session + exercises.reduce((s, e) => s + XP.exercise + XP.series * e.sets, 0);
  showXpFloat(xpGained);
  showSummary(wk, xpGained, newPRs);
}

function saveLiveSession() {
  if (!liveExs.length) return;
  STORE.set('live_session', {
    liveExs, liveIdx, liveTotalSec, livePauseSec,
    liveIsPaused, livePauseCnt,
    liveStartWall, livePausedMs, livePauseStartWall,
    restStartWall, restTotal, restMsg: restInt ? restMsg : '',
    planDate: $('planDate') ? $('planDate').value || '' : '',
    planNotes: $('planNotes') ? $('planNotes').value || '' : '',
    ts: Date.now()
  });
}

function restoreLiveSession(saved) {
  liveExs = saved.liveExs;
  liveIdx = saved.liveIdx || 0;
  livePauseSec = saved.livePauseSec || 0;
  liveIsPaused = false;
  livePauseCnt = saved.livePauseCnt || 0;
  livePausedMs = saved.livePausedMs || 0;
  livePauseStartWall = 0;
  // Mantener liveStartWall original para que el tiempo siga corriendo mientras la app estuvo cerrada
  liveStartWall = saved.liveStartWall || (Date.now() - (saved.liveTotalSec || 0) * 1000 - livePausedMs);
  liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000);

  if (saved.planDate && $('planDate')) $('planDate').value = saved.planDate;
  if (saved.planNotes && $('planNotes')) $('planNotes').value = saved.planNotes;

  $('lvTime').textContent = fmt(liveTotalSec); $('lvClock').textContent = fmt(liveTotalSec);
  $('lvTime').className = 'lv-time';
  $('lvPauseCnt').textContent = livePauseCnt;
  $('lvPauseIco').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  $('lvPausedOv').classList.remove('show');
  stopRest();
  $('planMode').classList.remove('show');
  $('liveMode').classList.add('show');
  liveTotalInt = setInterval(() => {
    if (!liveIsPaused) {
      liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000);
      $('lvTime').textContent = fmt(liveTotalSec); $('lvClock').textContent = fmt(liveTotalSec);
    }
  }, 1000);
  renderLiveEx(); updateLvStats();
  // Restaurar descanso si estaba activo
  if (saved.restTotal && saved.restStartWall) {
    const elapsed = Math.floor((Date.now() - saved.restStartWall) / 1000);
    const remaining = saved.restTotal - elapsed;
    if (remaining > 0) {
      startRest(remaining, saved.restMsg || 'Prepárate');
      // Ajustar restStartWall para que el countdown sea correcto desde ahora
      restTotal = saved.restTotal; restStartWall = saved.restStartWall;
    } else {
      toast('El descanso ya terminó 💪', 'good');
    }
  }
  toast('Entreno restaurado 💪', 'good');
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && liveExs.length) saveLiveSession();
});

let lvExMode = 'add';
function openLvExSheet(mode) {
  lvExMode = mode;
  $('shLvExTitle').textContent = mode === 'add' ? 'Añadir ejercicio' : 'Cambiar ejercicio';
  $('lvExSearch').value = '';
  $('lvExAC').innerHTML = '';
  $('shLvEx').classList.add('on');
  setTimeout(() => $('lvExSearch').focus(), 350);
}
function filterLvAC() {
  const val = $('lvExSearch').value.trim().toLowerCase();
  const list = $('lvExAC');
  if (!val) { list.innerHTML = ''; return; }
  const m = getAllExNames().filter(n => n.toLowerCase().includes(val)).slice(0, 8);
  list.innerHTML = m.map(n => {
    const lk = getLastKg(n);
    return `<div class="sh-card" onclick="pickLvEx('${n.replace(/'/g, "\\'")}',false)" style="display:flex;justify-content:space-between;align-items:center;"><span>${n}</span>${lk ? `<span style="font-size:.75rem;color:var(--t3);font-family:var(--fm)">${lk}kg</span>` : ''}</div>`;
  }).join('');
}
function pickLvEx(name, isCardio) {
  closeSheet('shLvEx');
  const sets = isCardio
    ? [{ min: '', km: '', done: false }]
    : Array.from({ length: 3 }, () => ({ kg: getLastKg(name) || '', reps: 10, done: false }));
  const ex = { name, isCardio: !!isCardio, restSec: isCardio ? 0 : 90, sets };
  if (lvExMode === 'replace') {
    liveExs[liveIdx] = ex;
  } else {
    liveExs.push(ex);
    liveIdx = liveExs.length - 1;
  }
  stopRest(); renderLiveEx(); updateLvStats(); saveLiveSession();
  toast((lvExMode === 'replace' ? 'Ejercicio cambiado' : 'Ejercicio añadido') + ' ✓');
}
