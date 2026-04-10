/* ══ PLAN MODE ══ */
function openPlan() {
  planExs = [];
  $('planDate').value = new Date().toISOString().split('T')[0];
  $('planRpe').value = ''; $('planNotes').value = '';
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
    return `<div class="plan-ex-item">
  <div class="plan-ex-head">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:6px;">
      <button class="plan-ex-del" style="width:28px;height:22px;border-radius:6px;" onclick="moveExUp(${i})" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:12px;height:12px;"><polyline points="18 15 12 9 6 15"/></svg></button>
      <button class="plan-ex-del" style="width:28px;height:22px;border-radius:6px;" onclick="moveExDown(${i})" ${i === planExs.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:12px;height:12px;"><polyline points="6 9 12 15 18 9"/></svg></button>
    </div>
    <div style="flex:1;"><div class="plan-ex-n">${i + 1}. ${ex.name}</div>${lk ? `<div class="plan-ex-hist">Último: ${lk}kg${pr ? ' · PR: ' + pr + 'kg' : ''}</div>` : ''}
    </div>
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
function addPlanEx(name) {
  planExs.push({ name, sets: 3, reps: 10, kg: getLastKg(name) || '', restSec: 90 });
  renderPlanList();
  $('planSearch').value = ''; $('planAC').classList.remove('show');
  setTimeout(() => $('planExList').lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 80);
  vib([30]);
}
function filterAC() {
  const val = $('planSearch').value.trim().toLowerCase();
  const ac = $('planAC');
  if (!val) { ac.classList.remove('show'); return; }
  const m = getAllExNames().filter(n => n.toLowerCase().includes(val)).slice(0, 7);
  if (!m.length) { ac.classList.remove('show'); return; }
  ac.innerHTML = m.map(n => { const lk = getLastKg(n); return `<div class="plan-ac-item" onclick="addPlanEx('${n.replace(/'/g, "\\'")}')"><span>${n}</span>${lk ? `<span class="plan-ac-last">${lk}kg</span>` : ''}</div>`; }).join('');
  ac.classList.add('show');
}
document.addEventListener('click', e => { if (!e.target.closest('.plan-search-wrap')) $('planAC').classList.remove('show'); });
function loadTpl(id) {
  planExs = TPL[id].map(t => ({ name: t.ex, sets: t.s, reps: t.r, kg: getLastKg(t.ex) || '', restSec: 90 }));
  renderPlanList(); closeSheet('shTpl'); toast('Rutina cargada ✓');
}
function openCopy() {
  if (!workouts.length) return toast('No hay sesiones anteriores', 'err');
  $('copyList').innerHTML = workouts.slice(0, 15).map(w => `<div class="sh-card" onclick="doCopy('${w.id}')"><div class="sh-ct">${w.date}${w.duration ? ' · ⏱ ' + w.duration + 'min' : ''}</div><div class="sh-cd">${(w.exercises || []).map(e => e.ex).join(' · ')}</div></div>`).join('');
  $('shCopy').classList.add('on');
}
function doCopy(id) { const w = workouts.find(x => x.id === id); if (!w) return; planExs = (w.exercises || []).map(e => ({ name: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: getLastKg(e.ex) || e.kg || '', restSec: 90 })); renderPlanList(); closeSheet('shCopy'); toast('Copiado ✓'); }
function openRestPicker(idx) { restSelIdx = idx; const cur = planExs[idx].restSec; const vals = [0, 30, 60, 90, 120, 180]; document.querySelectorAll('.rp-opt').forEach((el, i) => el.classList.toggle('on', vals[i] === cur)); $('rpOv').classList.add('on'); }
function pickRest(sec, btn) { document.querySelectorAll('.rp-opt').forEach(e => e.classList.remove('on')); btn.classList.add('on'); if (restSelIdx >= 0) planExs[restSelIdx].restSec = sec; renderPlanList(); $('rpOv').classList.remove('on'); }


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
