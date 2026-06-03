/* ══ LIVE MODE ══ */

/* Helper: enviar mensajes al bridge nativo de iOS para la Live Activity */
function _liveActivityCall(name, body) {
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[name]) {
      window.webkit.messageHandlers[name].postMessage(body || {});
    }
  } catch (e) {}
}

/* Sincronizar el estado del JS con el de la Live Activity (cuando vuelve a primer plano) */
window.__onLiveActivitySync = function(state) {
  if (!state) return;
  // Si la activity dice que NO estamos descansando pero el JS sí, parar el descanso
  if (!state.isResting && typeof restInt !== 'undefined' && restInt) {
    if (typeof stopRest === 'function') stopRest();
    if (typeof toast === 'function') toast('Descanso saltado desde lock screen ✓', 'good');
    if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
    return;
  }
  // Si la activity tiene un restEnd diferente al del JS, ajustar
  if (state.isResting && state.restLeftSec != null && typeof restInt !== 'undefined' && restInt) {
    const newLeft = Math.max(0, state.restLeftSec);
    if (newLeft <= 0) {
      if (typeof stopRest === 'function') stopRest();
      if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
      return;
    }
    // Reajustar restTotal y restStartWall para que el contador siga desde newLeft
    restTotal = newLeft;
    restStartWall = Date.now();
    if (typeof $ === 'function') {
      $('lrrN').textContent = newLeft;
      if (typeof updRing === 'function') updRing();
    }
  }
};

function startLiveMode() {
  if (!planExs.length) return;
  // Empezar de cero en el gestor nativo (descarta cualquier entreno anterior).
  if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
  // Desbloquear el contexto de audio (iOS exige un gesto de usuario para que sea activo)
  if (typeof unlockAudioContext === 'function') unlockAudioContext();
  // Cada ejercicio del plan se mapea a un ejercicio "live". Si ya existe un historial de
  // este ejercicio, se cargan los kg/reps INDIVIDUALES de cada serie de la última vez
  // (no el mismo peso copiado en todas las series). El flag `warmup` se hereda también.
  liveExs = planExs.map(ex => {
    const lastDetail = (typeof getLastSetsDetail === 'function') ? getLastSetsDetail(ex.name) : null;
    let sets;
    if (lastDetail && lastDetail.length > 0) {
      sets = Array.from({ length: ex.sets }, (_, i) => {
        const src = lastDetail[i] || lastDetail[lastDetail.length - 1];
        return {
          kg: (src && src.kg !== undefined && src.kg !== '') ? src.kg : (ex.kg || ''),
          reps: (src && src.reps) ? src.reps : ex.reps,
          done: false,
          warmup: !!(src && src.warmup)
        };
      });
    } else {
      sets = Array.from({ length: ex.sets }, () => ({ kg: ex.kg || '', reps: ex.reps, done: false, warmup: false }));
    }
    return { name: ex.name, restSec: ex.restSec, sets, ssLink: !!ex.ssLink };
  });
  liveIdx = 0; liveTotalSec = 0; livePauseSec = 0; liveIsPaused = false; livePauseCnt = 0;
  liveStartWall = Date.now(); livePausedMs = 0; livePauseStartWall = 0;
  $('lvTime').textContent = '00:00'; $('lvTime').className = 'lv-time';
  $('lvPauseIco').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  $('lvPausedOv').classList.remove('show'); stopRest();
  $('planMode').classList.remove('show');
  $('liveMode').classList.add('show');
  liveTotalInt = setInterval(() => { if (!liveIsPaused) { liveTotalSec = Math.floor((Date.now() - liveStartWall - livePausedMs) / 1000); $('lvTime').textContent = fmt(liveTotalSec); $('lvClock').textContent = fmt(liveTotalSec); } }, 1000);
  saveLiveSession(); renderLiveEx(); updateLvStats();
  // Iniciar Live Activity en iOS (lock screen + Dynamic Island)
  const firstEx = liveExs[0];
  if (firstEx) {
    _liveActivityCall('startWorkoutActivity', {
      exerciseName: firstEx.name,
      currentSet: 1,
      totalSets: firstEx.sets.length
    });
  }
}
function backToPlan() {
  if (!confirm('¿Volver a la planificación?')) return;
  clearInterval(liveTotalInt); clearInterval(livePauseInt); stopRest();
  STORE.set('live_session', null);
  if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
  $('liveMode').classList.remove('show'); $('planMode').classList.add('show');
  _liveActivityCall('endWorkoutActivity', {});
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
function navEx(dir) {
  const n = liveIdx + dir;
  if (n < 0 || n >= liveExs.length) return;
  liveIdx = n;
  stopRest();
  renderLiveEx();
  saveLiveSession();
  // Actualizar Live Activity con el nuevo ejercicio
  const ex = liveExs[liveIdx];
  if (ex) {
    const doneSet = ex.sets.filter(s => s.done).length;
    _liveActivityCall('updateWorkoutActivity', {
      exerciseName: ex.name,
      currentSet: Math.min(doneSet + 1, ex.sets.length),
      totalSets: ex.sets.length
    });
  }
}
/* Devuelve [inicio, fin] del grupo de superserie contiguo que contiene a idx.
   ssLink en un ejercicio significa "encadenado con el anterior". */
function getLiveGroup(idx) {
  if (!liveExs || !liveExs[idx]) return [idx, idx];
  let a = idx, b = idx;
  while (a > 0 && liveExs[a] && liveExs[a].ssLink) a--;
  while (b < liveExs.length - 1 && liveExs[b + 1] && liveExs[b + 1].ssLink) b++;
  return [a, b];
}
function renderLiveEx() {
  const ex = liveExs[liveIdx], lk = getLastKg(ex.name), pr = getPR(ex.name);
  $('lvExName').textContent = ex.name;
  $('lvExCtr').textContent = (liveIdx + 1) + ' / ' + liveExs.length;
  const _g = getLiveGroup(liveIdx), _ss = _g[1] > _g[0];
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
  $('lvExPr').textContent = (_ss ? `🔗 Superserie ${liveIdx - _g[0] + 1}/${_g[1] - _g[0] + 1} · ` : '') + prText;
  // Chip del descanso: muestra el valor actual y permite cambiarlo
  const restPill = $('lvRestPill');
  if (restPill) {
    restPill.textContent = '⏱ Descanso: ' + (typeof fmtRestPill === 'function' ? fmtRestPill(ex.restSec || 0) : ((ex.restSec || 0) + 's'));
  }
  $('lvNavP').disabled = liveIdx === 0; $('lvNavN').disabled = liveIdx === liveExs.length - 1;
  const canRemove = ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done;
  // Numera las series "reales" ignorando las de calentamiento (1, 2, 3...).
  // Las series de calentamiento muestran 🔥 en lugar del número.
  let realSetNum = 0;
  $('lvSetsEl').innerHTML = ex.sets.map((s, si) => {
    const isActive = !s.done && ex.sets.slice(0, si).every(p => p.done);
    if (!s.warmup) realSetNum++;
    const setLabel = s.warmup ? '🔥' : realSetNum;
    const numTitle = s.warmup ? 'Quitar calentamiento' : 'Marcar como calentamiento';
    const warmupCls = s.warmup ? ' warmup' : '';
    if (ex.isCardio) {
      return `<div class="lv-set${warmupCls}${s.done ? ' done' : isActive ? ' active' : ''}" id="lvs${si}">
  <div class="lv-set-body">
    <div class="lv-set-num" onclick="toggleWarmup(${si})" title="${numTitle}" style="cursor:pointer;user-select:none;">${setLabel}</div>
    <div class="lv-set-inps">
      <div class="lv-set-grp"><div class="lv-set-lbl">Min</div><input class="lv-inp" type="number" value="${s.min || ''}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].min=this.value" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
      <div class="lv-set-grp"><div class="lv-set-lbl">Km</div><input class="lv-inp" type="number" value="${s.km || ''}" placeholder="—" min="0" step="0.1" oninput="liveExs[${liveIdx}].sets[${si}].km=this.value" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
    </div>
    <div class="lv-set-vol"></div>
    <button class="lv-check${s.done ? ' done' : ''}" onclick="toggleSet(${si})"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button>
  </div>
</div>`;
    }
    const isPR = !s.warmup && +s.kg > 0 && pr > 0 && +s.kg > pr;
    const vol = !s.warmup && +s.kg && +s.reps ? Math.round(+s.kg * +s.reps) : null;
    return `<div class="lv-set${warmupCls}${s.done ? ' done' : isActive ? ' active' : ''}" id="lvs${si}">
  <div class="lv-set-body">
    <div class="lv-set-num" onclick="toggleWarmup(${si})" title="${numTitle}" style="cursor:pointer;user-select:none;">${setLabel}</div>
    <div class="lv-set-inps">
      <div class="lv-set-grp"><div class="lv-set-lbl">Kg</div><input class="lv-inp${isPR ? ' pr' : ''}" type="number" value="${s.kg || ''}" placeholder="—" min="0" oninput="liveExs[${liveIdx}].sets[${si}].kg=this.value;updVol(${si})" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
      <div class="lv-set-grp"><div class="lv-set-lbl">Reps</div><input class="lv-inp" type="number" value="${s.reps || ''}" placeholder="—" min="1" oninput="liveExs[${liveIdx}].sets[${si}].reps=this.value;updVol(${si})" style="-moz-appearance:textfield;"${s.done ? ' disabled' : ''}></div>
    </div>
    <div class="lv-set-vol${vol ? ' has' : ''}" id="lsv${si}">${s.warmup ? 'Cal' : (vol || '—')}</div>
    <button class="lv-check${s.done ? ' done' : ''}" onclick="toggleSet(${si})"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></button>
  </div>
</div>`;
  }).join('') + `<div class="lv-set-actions">
  <button class="lv-set-rm" onclick="removeLiveSet()"${canRemove ? '' : ' disabled'}>− Serie</button>
  <button class="lv-set-warm" onclick="addLiveWarmupSet()" title="Añadir serie de calentamiento">🔥 Calent.</button>
  <button class="lv-set-add" onclick="addLiveSet()">+ Serie</button>
</div>`;
  $('lvExScroll').scrollTo({ top: 0, behavior: 'smooth' }); updateLvStats();
}
function addLiveSet() {
  const ex = liveExs[liveIdx];
  const last = ex.sets[ex.sets.length - 1];
  if (ex.isCardio) {
    ex.sets.push({ min: last?.min || '', km: last?.km || '', done: false, warmup: false });
  } else {
    ex.sets.push({ kg: last?.kg || '', reps: last?.reps || 10, done: false, warmup: false });
  }
  renderLiveEx(); saveLiveSession();
}
/* Añade una serie de CALENTAMIENTO justo antes de la primera serie sin hacer (o al final
   si ya están todas hechas). El peso por defecto es ~50% del de trabajo como sugerencia. */
function addLiveWarmupSet() {
  const ex = liveExs[liveIdx];
  if (!ex) return;
  const firstPending = ex.sets.findIndex(s => !s.done);
  const insertAt = firstPending === -1 ? ex.sets.length : firstPending;
  const ref = ex.sets[insertAt] || ex.sets[ex.sets.length - 1];
  let newSet;
  if (ex.isCardio) {
    newSet = { min: '', km: '', done: false, warmup: true };
  } else {
    const workKg = +((ref && ref.kg) || 0);
    newSet = { kg: workKg ? Math.round(workKg * 0.5) : '', reps: (ref && ref.reps) || 10, done: false, warmup: true };
  }
  ex.sets.splice(insertAt, 0, newSet);
  renderLiveEx(); saveLiveSession();
  if (typeof vib === 'function') vib([20]);
}
/* Marcar/desmarcar una serie como calentamiento. No se puede modificar una serie ya completada. */
function toggleWarmup(si) {
  const ex = liveExs[liveIdx];
  if (!ex || !ex.sets[si]) return;
  const s = ex.sets[si];
  if (s.done) { toast('No puedes cambiar una serie ya completada', 'err'); return; }
  s.warmup = !s.warmup;
  renderLiveEx();
  saveLiveSession();
  if (typeof vib === 'function') vib([20]);
}
function removeLiveSet() {
  const ex = liveExs[liveIdx];
  if (ex.sets.length <= 1) return;
  if (ex.sets[ex.sets.length - 1].done) { toast('No puedes quitar una serie ya completada', 'err'); return; }
  ex.sets.pop();
  renderLiveEx(); saveLiveSession();
}
function updVol(si) { const s = liveExs[liveIdx].sets[si]; const v = +s.kg && +s.reps ? Math.round(+s.kg * +s.reps) : null; const el = $('lsv' + si); if (el) { el.textContent = v || '—'; el.className = 'lv-set-vol' + (v ? ' has' : ''); } updateLvStats(); }
/* Texto "qué viene después" para la notificación de fin de descanso. Esta notificación
   se refleja en el Apple Watch y vibra, así que de un vistazo sabes qué toca sin sacar
   el móvil. Se calcula al INICIAR el descanso, por lo que describe lo que tocará justo
   cuando el descanso termine. */
function getNextUpText() {
  if (typeof liveExs === 'undefined' || !Array.isArray(liveExs) || !liveExs.length) return '';
  const ex = liveExs[liveIdx];
  if (!ex) return '';
  // ¿Queda alguna serie real (no calentamiento) pendiente en este ejercicio?
  const realSets = ex.sets.filter(s => !s.warmup);
  const nextRealIdx = realSets.findIndex(s => !s.done);
  if (nextRealIdx !== -1) {
    return `A por la serie ${nextRealIdx + 1} de ${realSets.length} · ${ex.name}`;
  }
  // Todas las series reales hechas → siguiente ejercicio si lo hay.
  if (liveIdx < liveExs.length - 1) {
    const next = liveExs[liveIdx + 1];
    return next ? `Siguiente ejercicio: ${next.name}` : '';
  }
  // Era el último ejercicio del entreno.
  return '¡Último esfuerzo! Entreno casi completo 🔥';
}
function toggleSet(si) {
  const ex = liveExs[liveIdx], s = ex.sets[si]; s.done = !s.done;
  if (s.done) {
    vib([60]);
    // Las series de calentamiento NO suman XP ni cuentan para PR ni para el RPE auto.
    // Sí inician descanso normal (puedes saltarlo manualmente si no lo necesitas).
    if (!s.warmup) {
      setTimeout(updateAutoRpe, 50);
      showXpFloat(XP.series);
      const kg = +s.kg || 0, pr = getPR(ex.name);
      if (kg > 0 && kg > pr) showPR(ex.name, kg);
    }
    // ── Superserie: si hay otro ejercicio del grupo con ESTA misma serie pendiente,
    //    saltar a él SIN descanso (alternar A→B). El descanso solo tras el último del grupo. ──
    if (!s.warmup) {
      const g = getLiveGroup(liveIdx);
      if (g[1] > g[0]) {
        let nextEx = -1;
        for (let j = liveIdx + 1; j <= g[1]; j++) {
          if (liveExs[j].sets[si] && !liveExs[j].sets[si].done) { nextEx = j; break; }
        }
        if (nextEx !== -1) {
          navEx(nextEx - liveIdx);   // renderiza + guarda + sincroniza
          setTimeout(() => {
            const el = document.getElementById('lvs' + si);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('.lv-inp'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } } }
          }, 150);
          if (typeof toast === 'function') toast('🔗 Sin descanso · siguiente de la superserie', 'good');
          return;
        }
        // Era el último del grupo en esta ronda → descanso normal; autoAdvance volverá al 1º del grupo.
      }
    }
    // "Todas done" para el mensaje del descanso: ignora las warmup pendientes (el usuario
    // puede tener warmups sin marcar y aun así estar listo para el siguiente ejercicio).
    const allRealDone = ex.sets.every(x => x.warmup || x.done);
    if (ex.restSec) {
      const nextUp = (typeof getNextUpText === 'function') ? getNextUpText() : '';
      startRest(ex.restSec, allRealDone ? 'Descansa antes del siguiente' : 'Prepárate para la siguiente serie', nextUp);
    }
    // Programar el auto-advance INDEPENDIENTEMENTE del callback del descanso.
    // Esto es un respaldo: si por cualquier motivo (app en background, setInterval
    // pausado, callback que no se dispara) el rest.js no llama autoAdvanceAfterRest,
    // este setTimeout lo hace por wall-clock. Es idempotente: si autoAdvance ya
    // se ejecutó (por skipRest o por el callback), esta segunda llamada
    // detecta que el ejercicio ya cambió y no hace nada.
    const wait = (ex.restSec ? ex.restSec * 1000 : 250) + 80;
    setTimeout(() => {
      // Si el usuario navegó manualmente, está pausado, o ya estamos en otro
      // ejercicio, no hacemos nada.
      if (typeof liveIsPaused !== 'undefined' && liveIsPaused) return;
      if (liveExs[liveIdx] !== ex) return;
      if (!ex.sets[si] || !ex.sets[si].done) return;
      if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
    }, wait);
  }
  renderLiveEx(); saveLiveSession();
  // Si se DESMARCÓ una serie (corrección en el móvil), forzar al gestor nativo a
  // adoptar el conteo menor (anula el max() que protege del relanzamiento en frío).
  if (!s.done && typeof __syncWorkoutToNative === 'function') __syncWorkoutToNative(true);
}
function updateLvStats() {
  // El volumen y el contador de series ignoran las series de calentamiento.
  let done = 0, vol = 0, totalReal = 0;
  liveExs.forEach(ex => ex.sets.forEach(s => {
    if (s.warmup) return;
    totalReal++;
    if (s.done) { done++; vol += (+s.kg || 0) * (+s.reps || 1); }
  }));
  $('lvEx').textContent = (liveIdx + 1) + '/' + liveExs.length;
  $('lvSets').textContent = done; $('lvVol').textContent = big(vol);
  $('lvProg').style.width = (totalReal ? Math.round(done / totalReal * 100) : 0) + '%';
}
/* Llamado por rest.js cuando el contador de descanso llega a 0, cuando se salta
   el descanso manualmente, o por toggleSet cuando no hay descanso configurado.
   - Si hay una siguiente serie no completada (no warmup pendiente): scroll + focus a su input.
   - Si todas las series "reales" del ejercicio actual están done: pasa al siguiente ejercicio. */
function autoAdvanceAfterRest() {
  if (typeof liveExs === 'undefined' || !Array.isArray(liveExs) || !liveExs.length) return;
  const ex = liveExs[liveIdx];
  if (!ex) return;
  // ── Superserie: tras el descanso, volver al PRIMER ejercicio del grupo con una serie
  //    pendiente (siguiente ronda). Si el grupo está completo, seguir tras el grupo. ──
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
    // Grupo de superserie completo → pasar al ejercicio siguiente tras el grupo.
    if (g[1] < liveExs.length - 1) {
      const nextEx = liveExs[g[1] + 1];
      navEx(g[1] + 1 - liveIdx);
      if (typeof toast === 'function' && nextEx) toast('▶ ' + nextEx.name, 'good');
    } else {
      if (typeof toast === 'function') toast('🎉 ¡Entreno completo! Pulsa Finalizar', 'good');
    }
    return;
  }
  // Una serie cuenta como "pendiente" solo si NO es warmup. Las warmup no completadas
  // no bloquean el avance al siguiente ejercicio (el usuario puede haber decidido saltárselas).
  const nextSetIdx = ex.sets.findIndex(s => !s.done && !s.warmup);
  if (nextSetIdx === -1) {
    // Todas las series reales hechas: saltar al siguiente ejercicio si existe.
    if (liveIdx < liveExs.length - 1) {
      const nextEx = liveExs[liveIdx + 1];
      navEx(1);
      if (typeof toast === 'function' && nextEx) {
        toast('▶ ' + nextEx.name, 'good');
      }
    } else {
      // Era el último ejercicio del entreno.
      if (typeof toast === 'function') toast('🎉 ¡Entreno completo! Pulsa Finalizar', 'good');
    }
    return;
  }
  // Hay una siguiente serie pendiente: scroll + focus a su input.
  setTimeout(() => {
    const setEl = document.getElementById('lvs' + nextSetIdx);
    if (setEl) setEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const inp = setEl ? setEl.querySelector('.lv-inp') : null;
    if (inp) try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
  }, 150);
}

/* ══ SINCRONIZACIÓN CON EL GESTOR DE ENTRENO NATIVO (iOS) ══
   Para entrenar sin coger el móvil: el lado nativo (Swift) lleva la cuenta del entreno
   y maneja la cadena de notificaciones con la app en segundo plano (el WebView congela
   el JS, así que no se puede depender de él en background). Aquí solo:
   - enviamos el plan + cuántas series llevamos hechas (en cada cambio),
   - y aplicamos el cursor que el nativo nos devuelve al volver a primer plano. */

/* Construye el payload para el nativo: lista de ejercicios (nombre, descanso, qué
   series son calentamiento) + total de series ya completadas. */
function __buildWorkoutSyncPayload() {
  const exercises = liveExs.map(ex => ({
    name: ex.name,
    restSec: ex.restSec || 0,
    sets: ex.sets.map(s => !!s.warmup)
  }));
  let completed = 0;
  liveExs.forEach(ex => ex.sets.forEach(s => { if (s.done) completed++; }));
  return { exercises, completed };
}
function __syncWorkoutToNative(force) {
  try {
    if (!(window.webkit && window.webkit.messageHandlers)) return;
    // El bucle nativo del reloj cuenta las series secuencialmente; una superserie
    // (orden intercalado A→B) lo confundiría. En entrenos con superserie desactivamos
    // el gestor nativo (las superseries funcionan en la app; el "✓ Hecho" del reloj no).
    if (Array.isArray(liveExs) && liveExs.some(e => e.ssLink)) {
      if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
      return;
    }
    if (window.webkit.messageHandlers.workoutSyncState && Array.isArray(liveExs) && liveExs.length) {
      const payload = __buildWorkoutSyncPayload();
      payload.force = !!force;  // true = el nativo adopta el conteo aunque sea menor
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

/* Lo llama el lado nativo al volver a primer plano: marca como hechas TODAS las series
   anteriores al cursor (targetEx, targetSet). Es idempotente (solo marca, nunca desmarca),
   así que aplicarlo varias veces no causa problemas. No reinicia descansos: las
   notificaciones siguientes ya las programó el nativo. */
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
    // Posicionar el ejercicio visible en el primero con series pendientes.
    let cur = liveExs.findIndex(ex => ex.sets.some(s => !s.done));
    if (cur === -1) cur = liveExs.length - 1;
    liveIdx = cur;
    if (typeof renderLiveEx === 'function') renderLiveEx();
    if (typeof updateLvStats === 'function') updateLvStats();
    if (typeof saveLiveSession === 'function') saveLiveSession();
    try { if (window.forceSyncCloud) window.forceSyncCloud(); } catch (e) {}
    if (typeof toast === 'function') toast('Series marcadas desde el reloj ✓', 'good');
  } catch (e) { console.warn('applyWatchCursor:', e); }
}
window.__applyWatchCursor = __applyWatchCursor;

function finishLive() {
  // El porcentaje de progreso ignora las series de calentamiento (no son objetivo del entreno).
  const total = liveExs.reduce((s, e) => s + e.sets.filter(x => !x.warmup).length, 0);
  const done = liveExs.reduce((s, e) => s + e.sets.filter(x => x.done && !x.warmup).length, 0);
  const pct = total ? Math.round(done / total * 100) : 0;
  if (pct < 100 && !confirm(`Has completado el ${pct}% (${done}/${total} series). ¿Finalizar?`)) return;
  clearInterval(liveTotalInt); clearInterval(livePauseInt); stopRest();
  if (typeof __endWorkoutNative === 'function') __endWorkoutNative();
  _liveActivityCall('endWorkoutActivity', {});
  const exercises = liveExs.map(ex => {
    if (ex.isCardio) {
      return {
        ex: ex.name, kg: '', sets: ex.sets.filter(s => !s.warmup).length, reps: 0, isCardio: true,
        setsDetail: ex.sets.map(s => ({ min: s.min || '', km: s.km || '', done: !!s.done, warmup: !!s.warmup }))
      };
    }
    // Para el resumen "agregado" (kg / reps / sets) solo contamos las series NO de calentamiento.
    // El detalle por serie sí incluye las warmup con su flag, para reproducirlas la próxima vez.
    const realSets = ex.sets.filter(s => !s.warmup);
    const maxKg = realSets.length ? Math.max(...realSets.map(s => +s.kg || 0)) : 0;
    const firstReps = realSets[0]?.reps || ex.sets[0]?.reps || 10;
    return {
      ex: ex.name,
      kg: String(maxKg || ''),
      sets: realSets.length,
      reps: firstReps,
      setsDetail: ex.sets.map(s => ({ kg: s.kg || '', reps: s.reps, done: !!s.done, warmup: !!s.warmup }))
    };
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
  // Mantener al gestor nativo al día (para el bucle de notificaciones del reloj).
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
  // Reenviar el plan al gestor nativo tras restaurar.
  if (typeof __syncWorkoutToNative === 'function') __syncWorkoutToNative();
  // Si el usuario pulsó "✓ Hecho" en el reloj con la app cerrada, el nativo dejó un
  // cursor pendiente: aplicarlo ahora que la sesión ya está cargada.
  if (window.__pendingWatchCursor) {
    const c = window.__pendingWatchCursor;
    window.__pendingWatchCursor = null;
    setTimeout(() => {
      if (typeof __applyWatchCursor === 'function') __applyWatchCursor(c.ex, c.set);
    }, 400);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && liveExs.length) saveLiveSession();
});

function openReorderSheet() {
  renderReorderList();
  $('shLvReorder').classList.add('on');
}
function renderReorderList() {
  $('lvReorderList').innerHTML = liveExs.map((ex, i) => {
    const done = ex.sets.filter(s => s.done).length;
    const total = ex.sets.length;
    const isCur = i === liveIdx;
    return `<div class="lv-reorder-item${isCur ? ' current' : ''}">
  <div class="lv-reorder-info">
    <div class="lv-reorder-name">${ex.name}</div>
    <div class="lv-reorder-meta">${done}/${total} series${isCur ? ' · Actual' : ''}</div>
  </div>
  <div class="lv-reorder-btns">
    <button class="lv-reorder-btn" onclick="moveLiveEx(${i},-1)"${i === 0 ? ' disabled' : ''}>↑</button>
    <button class="lv-reorder-btn" onclick="moveLiveEx(${i},1)"${i === liveExs.length - 1 ? ' disabled' : ''}>↓</button>
  </div>
</div>`;
  }).join('');
}
function moveLiveEx(idx, dir) {
  const to = idx + dir;
  if (to < 0 || to >= liveExs.length) return;
  [liveExs[idx], liveExs[to]] = [liveExs[to], liveExs[idx]];
  if (liveIdx === idx) liveIdx = to;
  else if (liveIdx === to) liveIdx = idx;
  renderReorderList();
  renderLiveEx();
  saveLiveSession();
}
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
  const raw = $('lvExSearch').value.trim();
  const val = raw.toLowerCase();
  const list = $('lvExAC');
  if (!raw) { list.innerHTML = ''; return; }
  const all = getAllExNames();
  const m = all.filter(n => n.toLowerCase().includes(val)).slice(0, 8);
  const exactMatch = all.some(n => n.toLowerCase() === val);
  // Permitir crear ejercicios fuera de la BD pero con aviso de "sin vídeo demo"
  const newCard = !exactMatch
    ? `<div class="sh-card sh-card-new" onclick="pickLvExCustom('${raw.replace(/'/g, "\\'")}')">
         <div style="display:flex;align-items:center;gap:8px;">
           <span style="color:var(--a);font-weight:800;font-size:1.1rem;">+</span>
           <div style="flex:1;">
             <div>Añadir "<b>${raw}</b>" como nuevo ejercicio</div>
             <div style="font-size:.65rem;color:var(--amber);margin-top:2px;">⚠️ Sin vídeo demo</div>
           </div>
         </div>
       </div>`
    : '';
  list.innerHTML = m.map(n => {
    const lk = getLastKg(n);
    return `<div class="sh-card" onclick="pickLvEx('${n.replace(/'/g, "\\'")}',false)" style="display:flex;justify-content:space-between;align-items:center;"><span>${n}</span>${lk ? `<span style="font-size:.75rem;color:var(--t3);font-family:var(--fm)">${lk}kg</span>` : ''}</div>`;
  }).join('') + newCard;
}
/* Variante que pide confirmación al usuario antes de crear un ejercicio
   que NO está en la base de datos de 873 (sin vídeo demo). */
function pickLvExCustom(name) {
  const msg = `Este ejercicio NO está en nuestra base de datos.\n\n` +
              `Se añadirá igualmente pero NO tendrá vídeo demostrativo cuando pulses "▶ Ver técnica" (verás un botón para buscarlo en YouTube).\n\n` +
              `¿Continuar y añadir "${name}"?`;
  if (!confirm(msg)) return;
  pickLvEx(name, false);
}

function pickLvEx(name, isCardio) {
  closeSheet('shLvEx');
  const lastDetail = getLastSetsDetail(name);
  let sets;
  if (isCardio) {
    sets = lastDetail
      ? lastDetail.map(s => ({ min: s.min || '', km: s.km || '', done: false }))
      : [{ min: '', km: '', done: false }];
  } else if (lastDetail) {
    // Ejercicio ya hecho antes: replicar series, kg y reps de la última vez
    sets = lastDetail.map(s => ({ kg: s.kg || '', reps: s.reps || '', done: false }));
  } else {
    // Ejercicio nuevo (nunca se ha hecho): 3 series vacías para empezar de cero
    sets = Array.from({ length: 3 }, () => ({ kg: '', reps: '', done: false }));
  }
  const ex = { name, isCardio: !!isCardio, restSec: isCardio ? 0 : 90, sets };
  if (lvExMode === 'replace') {
    liveExs[liveIdx] = ex;
  } else {
    liveExs.push(ex);
    liveIdx = liveExs.length - 1;
  }
  stopRest(); renderLiveEx(); updateLvStats(); saveLiveSession();
  const msg = lvExMode === 'replace'
    ? (lastDetail ? 'Cambiado a "' + name + '" — series cargadas de la última vez ✓' : 'Cambiado a "' + name + '" — ejercicio nuevo ✓')
    : (lastDetail ? 'Añadido "' + name + '" — series cargadas de la última vez ✓' : 'Añadido "' + name + '" — ejercicio nuevo ✓');
  toast(msg);
}

/* Eliminar el ejercicio actual del entrenamiento en curso */
function removeLvEx() {
  if (!liveExs || liveExs.length === 0) return;
  const ex = liveExs[liveIdx];
  if (!ex) return;
  if (liveExs.length === 1) {
    toast('No puedes quitar el único ejercicio. Añade otro primero o finaliza el entrenamiento.', 'err');
    return;
  }
  const ok = confirm('¿Quitar "' + ex.name + '" de este entrenamiento?\n\nSe perderán las series no terminadas de este ejercicio.');
  if (!ok) return;
  liveExs.splice(liveIdx, 1);
  if (liveIdx >= liveExs.length) liveIdx = liveExs.length - 1;
  stopRest(); renderLiveEx(); updateLvStats(); saveLiveSession();
  toast('Ejercicio "' + ex.name + '" eliminado ✓', 'ok');
}
