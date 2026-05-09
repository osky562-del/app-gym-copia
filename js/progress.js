/* ══ PROGRESS ══ */
function getMuscle(ex) { const lc = ex.toLowerCase(); const k = Object.keys(MM).find(k => lc.includes(k)); return k ? MM[k] : 'Otros'; }
function renderProgress() { renderHeatmap(); renderSummaryStats(); renderMuscleChart(); renderMuscleRadar(); renderVolChart(); renderRpeChart(); renderPRTable(); fillProgSel(); drawExChart(); }
function renderHeatmap() {
  const container = $('hmGrid');
  if (!Pro.can('heatmap')) {
    container.innerHTML = '<div class="pro-locked-overlay" onclick="Pro.showUpgradeModal(\'heatmap\')"><div class="pro-locked-icon">🔒</div><div class="pro-locked-text">Mapa de actividad Pro</div></div>';
    $('hmHdr').innerHTML = '';
    return;
  }
  const today = new Date(), start = new Date(today); start.setDate(today.getDate() - 90);
  const dc = {}; workouts.forEach(w => { dc[w.date] = (dc[w.date] || 0) + 1; });
  let cells = ''; for (let row = 0; row < 7; row++)for (let col = 0; col < 13; col++) { const d = new Date(start); d.setDate(start.getDate() + col * 7 + row); const ds = d.toISOString().split('T')[0]; if (d > today) { cells += '<div class="hm-c"></div>'; continue; } const c = dc[ds] || 0; const lv = c === 0 ? '' : c === 1 ? 'l1' : c === 2 ? 'l2' : c === 3 ? 'l3' : 'l4'; cells += `<div class="hm-c${lv ? ' ' + lv : ''}" title="${ds}"></div>`; }
  container.innerHTML = cells;
  const seen = new Set(); let mh = ''; for (let col = 0; col < 13; col++) { const d = new Date(start); d.setDate(start.getDate() + col * 7); const m = d.toLocaleDateString('es-ES', { month: 'short' }); mh += `<span class="hm-ml">${!seen.has(m) ? m : ''}</span>`; seen.add(m); } $('hmHdr').innerHTML = mh;
}
function renderSummaryStats() {
  $('pTS').textContent = workouts.length;
  const oldest = workouts.length ? workouts[workouts.length - 1].date : null;
  const wks = oldest ? Math.max(1, Math.ceil((new Date() - new Date(oldest + 'T00:00:00')) / 604800000)) : 1;
  $('pAW').textContent = (workouts.length / wks).toFixed(1);
  let tv = 0; workouts.forEach(w => (w.exercises || []).forEach(e => tv += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1)));
  $('pTV').textContent = big(tv); $('pBS').textContent = calcMaxStreak();
}
function renderMuscleChart() {
  const counts = {}; workouts.forEach(w => (w.exercises || []).forEach(e => { const m = getMuscle(e.ex); counts[m] = (counts[m] || 0) + 1; }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const labels = sorted.map(x => x[0]), data = sorted.map(x => x[1]), colors = labels.map(l => MC[l] || MC.Otros);
  mkChart('muscleChart', { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }, options: { cutout: '74%', plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false } });
  $('mlList').innerHTML = sorted.map((x, i) => `<div class="ml-row"><div class="ml-dot" style="background:${colors[i]}"></div><span class="ml-nm">${x[0]}</span><span class="ml-pct">${Math.round(x[1] / total * 100)}%</span></div><div class="ml-bg"><div class="ml-fill" style="width:${Math.round(x[1] / sorted[0][1] * 100)}%;background:${colors[i]}"></div></div>`).join('');
}
function renderVolChart() {
  const weeks = []; for (let w = 11; w >= 0; w--) { const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay() - w * 7); let v = 0; for (let d = 0; d < 7; d++) { const dd = new Date(sun); dd.setDate(sun.getDate() + d); workouts.filter(x => x.date === dd.toISOString().split('T')[0]).forEach(x => (x.exercises || []).forEach(e => v += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1))); } const lbl = new Date(sun); lbl.setDate(lbl.getDate() + 3); weeks.push({ l: lbl.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), v }); }
  mkChart('volChart', { type: 'bar', data: { labels: weeks.map(w => w.l), datasets: [{ data: weeks.map(w => w.v), backgroundColor: weeks.map((_, i) => i === 11 ? 'rgba(79,140,255,.85)' : 'rgba(79,140,255,.22)'), borderRadius: 4, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(244,244,246,.28)', maxRotation: 0 } }, y: { grid: { color: 'rgba(255,255,255,.04)' }, border: { display: false }, ticks: { color: 'rgba(244,244,246,.28)', callback: v => big(v) } } } } });
}
function renderRpeChart() {
  const recent = workouts.filter(w => w.rpe).slice(0, 20).reverse();
  mkChart('rpeChart', { type: 'line', data: { labels: recent.map(w => w.date.substring(5)), datasets: [{ data: recent.map(w => +w.rpe), borderColor: 'rgba(155,114,245,.9)', borderWidth: 2, backgroundColor: 'rgba(155,114,245,.1)', fill: true, pointBackgroundColor: 'rgba(155,114,245,.9)', pointBorderColor: '#111114', pointBorderWidth: 1.5, pointRadius: 3, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(244,244,246,.28)' } }, y: { grid: { color: 'rgba(255,255,255,.04)' }, border: { display: false }, min: 0, max: 11, ticks: { color: 'rgba(244,244,246,.28)', stepSize: 2 } } } } });
}
function renderPRTable() {
  if (!Pro.can('pr_table')) {
    $('prBody').innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;"><div class="pro-locked-overlay" onclick="Pro.showUpgradeModal(\'pr_table\')" style="position:relative;"><div class="pro-locked-icon">🔒</div><div class="pro-locked-text">Tabla de récords Pro</div></div></td></tr>';
    return;
  }
  const exNames = new Set(); workouts.forEach(w => (w.exercises || []).forEach(e => exNames.add(e.ex)));
  const prs = [];
  exNames.forEach(ex => {
    const ss = workouts.filter(w => (w.exercises || []).some(e => e.ex === ex)).sort((a, b) => a.date.localeCompare(b.date));
    let maxKg = 0, max1RM = 0; ss.forEach(w => (w.exercises || []).filter(e => e.ex === ex).forEach(e => { const k = +e.kg || 0, r = +e.reps || 1; if (k > maxKg) maxKg = k; const rm = k * (1 + r / 30); if (rm > max1RM) max1RM = rm; }));
    let trend = 'eq'; if (ss.length >= 2) { const l2 = ss.slice(-2); const v1 = Math.max(...l2[0].exercises.filter(e => e.ex === ex).map(e => +e.kg || 0)); const v2 = Math.max(...l2[1].exercises.filter(e => e.ex === ex).map(e => +e.kg || 0)); trend = v2 > v1 ? 'up' : v2 < v1 ? 'dn' : 'eq'; }
    if (maxKg > 0) prs.push({ ex, maxKg, max1RM: parseFloat(max1RM.toFixed(1)), trend });
  });
  prs.sort((a, b) => b.maxKg - a.maxKg);
  $('prBody').innerHTML = prs.slice(0, 15).map(p => `<tr><td style="font-weight:600">${p.ex}</td><td><span class="pr-tag">${p.maxKg} kg</span></td><td style="font-family:var(--fm);font-size:.78rem;">${p.max1RM} kg</td><td><span class="trend t${p.trend}">${p.trend === 'up' ? '↑' : p.trend === 'dn' ? '↓' : '→'}</span></td></tr>`).join('');
}
function fillProgSel() {
  const s = $('progSel'), cur = s.value;
  s.innerHTML = '<option value="__PESO__">⚖ Peso Corporal</option>';
  const names = new Set(); workouts.forEach(w => (w.exercises || []).forEach(e => names.add(e.ex)));
  [...names].sort().forEach(x => s.add(new Option(x, x)));
  if (cur && [...s.options].some(o => o.value === cur)) s.value = cur;
}
function selPill(v, btn) { document.querySelectorAll('.qp').forEach(e => e.classList.remove('on')); btn?.classList.add('on'); const s = $('progSel'); if (![...s.options].some(o => o.value === v)) s.add(new Option(v, v)); s.value = v; drawExChart(); }
function setMet(m, btn) { cMetric = m;['mMax', 'm1RM', 'mVol'].forEach(id => $(id).classList.remove('on')); btn.classList.add('on'); drawExChart(); }
function setTR(t, btn) { cTime = t; btn.parentNode.querySelectorAll('.seg-b').forEach(e => e.classList.remove('on')); btn.classList.add('on'); drawExChart(); }
function drawExChart() {
  const ex = $('progSel').value; let recs = [], cd = new Date('1970-01-01');
  if (cTime === '1M') { const d = new Date(); d.setMonth(d.getMonth() - 1); cd = d; }
  if (cTime === '3M') { const d = new Date(); d.setMonth(d.getMonth() - 3); cd = d; }
  if (cTime === '6M') { const d = new Date(); d.setMonth(d.getMonth() - 6); cd = d; }
  if (ex === '__PESO__') {
    $('m1RM').disabled = true; $('mVol').disabled = true;
    recs = weightLogs.filter(l => new Date(l.date) >= cd).map(l => ({ date: l.date, val: parseFloat(l.weight) })).sort((a, b) => a.date.localeCompare(b.date));
    $('prMax').textContent = recs.length ? Math.max(...recs.map(r => r.val)) + ' kg' : '—'; $('pr1RM').textContent = '—'; $('prVol').textContent = '—';
  } else {
    $('m1RM').disabled = false; $('mVol').disabled = false;
    let mo = 0, m1 = 0, mv = 0; const dm = {};
    workouts.filter(w => new Date(w.date) >= cd).forEach(w => { const exs = (w.exercises || []).filter(e => e.ex === ex); if (!exs.length) return; let mk = 0, d1 = 0, dv = 0; exs.forEach(e => { const k = +e.kg || 0, s2 = +e.sets || 1, r = +e.reps || 1; if (k > mk) mk = k; const rm = k * (1 + r / 30); if (rm > d1) d1 = rm; dv += k * s2 * r; }); if (mk > mo) mo = mk; if (d1 > m1) m1 = d1; if (dv > mv) mv = dv; dm[w.date] = { MAX: mk, '1RM': parseFloat(d1.toFixed(1)), VOL: dv }; });
    recs = Object.keys(dm).sort().map(d => ({ date: d, val: dm[d][cMetric] }));
    $('prMax').textContent = mo ? mo + ' kg' : '—'; $('pr1RM').textContent = m1 ? parseFloat(m1.toFixed(1)) + ' kg' : '—'; $('prVol').textContent = mv ? big(mv) + ' kg' : '—';
  }
  const ctx = $('exChart').getContext('2d');
  mkChart('exChart', { type: 'line', data: { labels: recs.map(r => r.date.substring(5)), datasets: [{ data: recs.map(r => r.val), borderColor: 'rgba(79,140,255,.9)', borderWidth: 2, backgroundColor: blueGrad(ctx, 220), fill: true, pointBackgroundColor: 'rgba(79,140,255,1)', pointBorderColor: '#111114', pointBorderWidth: 1.5, pointRadius: 4, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(244,244,246,.28)' } }, y: { grid: { color: 'rgba(255,255,255,.04)' }, border: { display: false }, beginAtZero: cMetric === 'VOL', ticks: { color: 'rgba(244,244,246,.28)', callback: v => cMetric === 'VOL' ? big(v) : v } } } } });
}

/* ══ MUSCLE BALANCE RADAR (Pro) ══ */
function renderMuscleRadar() {
  const badge = $('radarProBadge');
  const wrap = $('radarWrap');
  if (!Pro.can('advanced_analytics')) {
    if (badge) badge.style.display = '';
    wrap.innerHTML = '<div class="pro-locked-overlay" onclick="Pro.showUpgradeModal(\'advanced_analytics\')" style="height:100%;"><div class="pro-locked-icon">🔒</div><div class="pro-locked-text">Balance muscular radar — Pro</div></div>';
    return;
  }
  if (badge) badge.style.display = 'none';
  // Restore canvas if it was replaced
  if (!$('muscleRadar')) {
    wrap.innerHTML = '<canvas id="muscleRadar"></canvas>';
  }
  // Calculate muscle volume from last 30 days
  const a30 = new Date(); a30.setDate(a30.getDate() - 30);
  const volByMuscle = {};
  workouts.filter(w => new Date(w.date) >= a30).forEach(w => {
    (w.exercises || []).forEach(e => {
      const m = getMuscle(e.ex);
      volByMuscle[m] = (volByMuscle[m] || 0) + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1);
    });
  });
  const allMuscles = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Core'];
  const maxVol = Math.max(...allMuscles.map(m => volByMuscle[m] || 0), 1);
  const data = allMuscles.map(m => Math.round(((volByMuscle[m] || 0) / maxVol) * 100));
  const colors = allMuscles.map(m => MC[m] || 'var(--a)');

  mkChart('muscleRadar', {
    type: 'radar',
    data: {
      labels: allMuscles,
      datasets: [{
        data,
        backgroundColor: 'rgba(79,140,255,0.15)',
        borderColor: 'rgba(79,140,255,0.8)',
        borderWidth: 2,
        pointBackgroundColor: colors,
        pointBorderColor: '#111114',
        pointBorderWidth: 1.5,
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: 'rgba(244,244,246,0.6)', font: { size: 11, weight: '600' } }
        }
      }
    }
  });
}
