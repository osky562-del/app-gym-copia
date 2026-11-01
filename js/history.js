/* ══ HISTORY ══
   Espejo de la pestaña Historial de la app Android (ui/history/HistoryScreen.kt):
   fila de estado del NAS (si hay sesión), meses colapsables (solo el primero abierto), tarjeta
   siempre expandida con chips de ejercicios, "Repetir", Compartir y Borrar. Sin buscador ni límite Free. */
let histOpenMonths = null; // null → solo el primer mes abierto

const histT = s => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(s) : s;
const histEsc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const histVol = w => typeof workoutVolume === 'function' ? workoutVolume(w) : (w.exercises || []).reduce((s, e) => s + (e.cardio ? 0 : (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1)), 0);

/* Estado de la copia en el NAS (NasEstado.kt: resumenNas). Solo si hay sesión y nas-sync.js expone status(). */
function renderHistNas() {
  const el = document.getElementById('histNas');
  if (!el) return;
  const N = (typeof NAS !== 'undefined') ? NAS : null;
  if (!N || !N.status || !N.enabled() || !N.loggedIn()) { el.innerHTML = ''; return; }
  const s = N.status();
  const pend = (s.pending || 0);
  let txt, color = 'var(--t1)';
  if (s.syncing) txt = histT('Copiando al NAS…');
  else if (s.lastError) { txt = histT('No se ha podido copiar en el NAS') + (pend > 0 ? ' · ' + histT('Pendiente de copiar') + ': ' + pend : ''); color = 'var(--amber)'; }
  else if (pend > 0) txt = histT('Pendiente de copiar') + ': ' + pend;
  else if (s.rejected > 0) { txt = histT('Algún entreno no se ha podido copiar'); color = 'var(--amber)'; }
  else if (!s.lastOkMs) { txt = histT('Sin copiar todavía'); color = 'var(--t3)'; }
  else txt = histT('Todo copiado en el NAS ✓');
  el.innerHTML = `<div class="hist-nas" style="color:${color}" onclick="goPage('profile')">${histEsc(txt)}  ·  ${histEsc(histT('toca para ver'))}</div>`;
}

function renderHist() {
  const list = $('histList');
  renderHistNas();
  if (!workouts.length) {
    histOpenMonths = null;
    list.innerHTML = `<div class="card prog-empty"><div class="prog-empty-ic">📋</div><div class="prog-empty-t">Aún no hay entrenos</div><div class="prog-empty-d">Cuando completes un entreno aparecerá aquí.</div></div>`;
    return;
  }
  const loc = (typeof I18N !== 'undefined' && I18N.locale) ? I18N.locale() : 'es-ES';
  // Agrupar por mes (los entrenos vienen ordenados por fecha descendente)
  const groups = []; let cur = null;
  workouts.forEach((w, i) => {
    const key = /^\d{4}-\d{2}/.test(w.date || '') ? w.date.slice(0, 7) : '—';
    if (!cur || cur.key !== key) {
      let label = key;
      if (key !== '—') {
        const d = new Date(key + '-01T00:00:00');
        label = d.toLocaleDateString(loc, { month: 'long' });
        label = label.charAt(0).toUpperCase() + label.slice(1) + ' ' + key.slice(0, 4);
      }
      cur = { key, label, items: [] };
      groups.push(cur);
    }
    cur.items.push({ w, i });
  });
  const open = histOpenMonths || new Set(groups.length ? [groups[0].key] : []);
  const exShort = histT('ej.');
  const card = (w) => {
    const vol = histVol(w);
    const exs = w.exercises || [];
    const meta = [w.date, w.duration ? '⏱ ' + w.duration + 'min' : '', w.rpe ? 'RPE ' + Math.trunc(+w.rpe) : '', big(vol) + ' kg', exs.length + ' ' + exShort].filter(Boolean).join(' · ');
    const chips = exs.length ? `<div class="hc-chips">${exs.slice(0, 6).map(e => `<span class="hc-chip">${histEsc(e.ex)}</span>`).join('')}</div>` : '';
    return `<div class="hc">
      <div class="hc-top">
        <div class="hc-info">
          <div class="hc-name">${histEsc((w.name || '').trim() || histT('Entreno'))}</div>
          <div class="hc-meta">${histEsc(meta)}</div>
          ${w.notes ? `<div class="hc-notes">📝 ${histEsc(w.notes)}</div>` : ''}
        </div>
        <button class="hc-ic" title="Compartir" aria-label="Compartir" onclick="shareHistWorkout('${w.id}')"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg></button>
        <button class="hc-ic" title="Borrar" aria-label="Borrar" onclick="delId='${w.id}';document.getElementById('shDel').classList.add('on')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div>
      ${chips}
      <button class="hc-repeat" onclick="startFromHistory('${w.id}')">▶ Repetir este entreno</button>
    </div>`;
  };
  list.innerHTML = groups.map(g => {
    const isOpen = open.has(g.key);
    const vol = g.items.reduce((s, it) => s + histVol(it.w), 0);
    return `<div class="hist-month2" onclick="togHistMonth('${g.key}')"><span class="hm2-t">${histEsc(g.label)}</span><span class="hm2-n">${g.items.length} · ${big(vol)} kg</span><span class="hm2-chev">${isOpen ? '▼' : '▶'}</span></div>`
      + (isOpen ? g.items.map(it => card(it.w)).join('') : '');
  }).join('');
}
function togHistMonth(key) {
  if (!histOpenMonths) {
    const first = workouts.length && /^\d{4}-\d{2}/.test(workouts[0].date || '') ? workouts[0].date.slice(0, 7) : '—';
    histOpenMonths = new Set([first]);
  }
  if (histOpenMonths.has(key)) histOpenMonths.delete(key); else histOpenMonths.add(key);
  renderHist();
}
/* Compartir texto plano del entreno (formato de HistoryScreen.kt: shareWorkout). */
async function shareHistWorkout(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  const exs = w.exercises || [];
  let text = '💪 ' + ((w.name || '').trim() || 'Entreno') + ' — ' + w.date + '\n';
  text += exs.length + ' ejercicios · ' + big(histVol(w)) + ' kg';
  if (w.duration) text += ' · ' + w.duration + ' min';
  text += '\n\n';
  exs.slice(0, 12).forEach(e => {
    text += '• ' + e.ex;
    if (+e.kg > 0) text += ' — ' + big(+e.kg) + 'kg × ' + (e.reps || 0);
    text += '\n';
  });
  text += '\nKO95FIT PRO';
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); toast(histT('Entreno copiado al portapapeles ✓'), 'good'); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  toast(histT('No se ha podido compartir'), 'err');
}
/* Cargar un entreno del historial en el planificador para repetirlo. */
function startFromHistory(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  if (typeof openPlan === 'function') openPlan();
  planExs = (typeof _workoutToPlanItems === 'function') ? _workoutToPlanItems(w) : (w.exercises || []).map(e => ({ name: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: getLastKg(e.ex) || e.kg || '', restSec: 90 }));
  if ($('planName')) $('planName').value = w.name || '';
  if (typeof renderPlanList === 'function') renderPlanList();
}
$('cancelDel').addEventListener('click', () => closeSheet('shDel'));
$('confirmDel').addEventListener('click', () => {
  if (delId) {
    workouts = workouts.filter(w => w.id !== delId);
    saveWorkouts();
    if (typeof removeWorkoutCloud === 'function') removeWorkoutCloud(delId);
    renderHist();
    renderDash();
    toast(histT('Entreno borrado'));
  }
  closeSheet('shDel');
});
