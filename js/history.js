/* ══ HISTORY ══ */
function renderHist() {
  const list = $('histList');
  if (!workouts.length) { list.innerHTML = `<div class="empty"><div class="empty-ic">📋</div><div class="empty-t">Sin historial todavía</div><div class="empty-d">Cada sesión que completes aparecerá aquí con todos los detalles y estadísticas.</div></div>`; return; }
  const limit = Pro.historyLimit();
  const visible = limit === Infinity ? workouts : workouts.slice(0, limit);
  const mxv = Math.max(...visible.map(w => (w.exercises || []).reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0)), 1);
  const loc = (typeof I18N !== 'undefined' && I18N.locale) ? I18N.locale() : 'es-ES';
  // Agrupar por mes (los entrenos vienen ordenados por fecha descendente)
  const groups = []; let cur = null;
  visible.forEach((w, i) => {
    const d = new Date((w.date || '') + 'T00:00:00');
    const mk = isNaN(d.getTime()) ? '—' : d.getFullYear() + '-' + d.getMonth();
    if (!cur || cur.mk !== mk) {
      let ml = isNaN(d.getTime()) ? '—' : d.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
      ml = ml.charAt(0).toUpperCase() + ml.slice(1);
      cur = { mk, label: ml, items: [] };
      groups.push(cur);
    }
    cur.items.push({ w, i });
  });
  const itemHtml = (w, i) => {
    const vol = (w.exercises || []).reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0);
    return `<div class="hi"><div class="hi-h" onclick="togH(${i})"><div class="hi-dot"></div><div class="hi-info"><div class="hi-date">${w.name || w.date}</div><div class="hi-meta">${[w.name ? w.date : '', w.duration ? '⏱ ' + w.duration + 'min' : '', w.calories ? '🔥 ' + w.calories + ' kcal' : '', w.rpe ? 'RPE ' + w.rpe : '', big(vol) + ' kg', (w.exercises || []).length + ' ej.'].filter(Boolean).join(' · ')}</div></div><div class="hi-r"><button class="hi-del" onclick="event.stopPropagation();delId='${w.id}';document.getElementById('shDel').classList.add('on')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button><div class="hi-chev" id="hc${i}"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div></div><div class="hi-body" id="hb${i}"><div class="hi-vbar"><div class="hi-vfill" style="width:${Math.round(vol / mxv * 100)}%"></div></div>${w.notes ? `<div class="hi-notes">${w.notes}</div>` : ''} ${(w.exercises || []).map(e => `<div class="hi-ex"><span class="hi-en">${e.ex}</span><div class="hi-er"><span class="hi-es">${e.sets}×${e.reps}</span><span class="hi-et">${e.kg || '—'} kg</span></div></div>`).join('')}<button onclick="event.stopPropagation();startFromHistory('${w.id}')" style="width:100%;margin-top:11px;padding:11px;border-radius:11px;background:var(--ag);border:1px solid rgba(255,59,48,.4);color:var(--a);font-weight:800;font-size:.85rem;cursor:pointer;-webkit-tap-highlight-color:transparent;">▶ Repetir este entreno</button></div></div>`;
  };
  let html = groups.map(g => `<div class="hist-month"><span>${g.label}</span><span class="hist-month-line"></span><span class="hist-month-n">${g.items.length}</span></div>` + g.items.map(it => itemHtml(it.w, it.i)).join('')).join('');
  if (limit !== Infinity && workouts.length > limit) {
    html += `<div style="text-align:center;padding:20px 16px;"><div style="font-size:.85rem;color:var(--t3);margin-bottom:10px;">+${workouts.length - limit} sesiones ocultas</div><button onclick="Pro.showUpgradeModal('unlimited_workouts')" style="background:var(--a);color:#000;border:none;border-radius:8px;padding:10px 20px;font-weight:700;font-size:.85rem;cursor:pointer;">Ver historial completo — Pro</button></div>`;
  }
  list.innerHTML = html;
}
function togH(i) { const b = $('hb' + i), c = $('hc' + i); const o = b.classList.toggle('open'); if (c) c.classList.toggle('open', o); }
/* Cargar un entreno del historial en el planificador para repetirlo. */
function startFromHistory(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;
  if (typeof openPlan === 'function') openPlan();
  planExs = (w.exercises || []).map(e => ({ name: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: getLastKg(e.ex) || e.kg || '', restSec: 90 }));
  if ($('planName')) $('planName').value = w.name || '';
  if (typeof renderPlanList === 'function') renderPlanList();
  const msg = (typeof I18N !== 'undefined' && I18N.t) ? I18N.t('Entreno cargado ✓') : 'Entreno cargado ✓';
  if (typeof toast === 'function') toast(msg, 'good');
}
$('cancelDel').addEventListener('click', () => closeSheet('shDel'));
$('confirmDel').addEventListener('click', () => { 
  if (delId) { 
    workouts = workouts.filter(w => w.id !== delId); 
    saveWorkouts(); 
    if (typeof removeFromFirebase === 'function') removeFromFirebase(delId);
    renderHist(); 
    renderDash(); 
    toast('Sesión eliminada'); 
  } 
  closeSheet('shDel'); 
});

/* ══ HISTORY SEARCH ══ */
function filterHistory() {
  const q = document.getElementById('histSearch')?.value?.toLowerCase?.() || '';
  document.querySelectorAll('.hi').forEach(el => {
    const txt = el.textContent.toLowerCase();
    el.style.display = !q || txt.includes(q) ? '' : 'none';
  });
  // Ocultar la cabecera de un mes si no le queda ninguna sesión visible.
  document.querySelectorAll('.hist-month').forEach(h => {
    let n = h.nextElementSibling, any = false;
    while (n && !n.classList.contains('hist-month')) {
      if (n.classList.contains('hi') && n.style.display !== 'none') { any = true; break; }
      n = n.nextElementSibling;
    }
    h.style.display = any ? '' : 'none';
  });
}
