/* ══ PROGRESS ══
   Espejo de la pestaña Progreso de la app Android (ui/progress/ProgressScreen.kt + ProgressViewModel.kt).
   Orden: Volumen · Músculos · [Free: banner Pro] · Fuerza estimada · Niveles · Mapa · Balance · Actividad · Récords.
   Free solo ve Volumen y Músculos; el resto se oculta y un único banner abre el modal Pro (advanced_analytics). */
function getMuscle(ex) { const lc = ex.toLowerCase(); const k = Object.keys(MM).find(k => lc.includes(k)); return k ? MM[k] : 'Otros'; }

const progT = s => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(s) : s;
const progEn = () => typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en';
const progEsc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Fecha local YYYY-MM-DD (sin desfases de zona horaria). */
function progISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
/* Lunes de la semana actual a medianoche (java LocalDate.now().with(MONDAY)). */
function progThisMonday() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function progShow(id, on) { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; }
function progVol(e) { return typeof exerciseVolume === 'function' ? exerciseVolume(e) : ((e.cardio ? 0 : (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1))); }

function renderProgress() {
  const empty = !workouts.length;
  progShow('progEmpty', empty);
  progShow('progBody', !empty);
  if (empty) return;

  renderVolChart();
  renderMuscleChart();

  const isPro = typeof Pro !== 'undefined' && Pro.isPro && Pro.isPro();
  progShow('progPro', isPro);
  if (!isPro) {
    // Igual que Android: banner solo si hay algo que desbloquear (fuerza, actividad o récords).
    const hasAdvanced = workouts.some(w => (w.exercises || []).some(e => +e.kg > 0)) || progHeatmapCounts().some(c => c > 0);
    const lock = document.getElementById('progLock');
    if (lock) {
      lock.style.display = hasAdvanced ? '' : 'none';
      lock.innerHTML = hasAdvanced ? `<div class="pro-lock-banner" onclick="Pro.showUpgradeModal('advanced_analytics')">
        <span class="pro-lock-ic">🔒</span>
        <div class="pro-lock-tx"><div class="pro-lock-t">Analíticas avanzadas</div><div class="pro-lock-d">toca para desbloquear</div></div>
        <span class="pro-sec-badge">PRO</span></div>` : '';
    }
    return;
  }
  progShow('progLock', false);
  renderStrengthEstimate();
  if (typeof renderStrengthCard === 'function') renderStrengthCard();
  const mm = (typeof recentMuscles === 'function') ? recentMuscles(30) : {};
  delete mm.Otros;
  const hasMap = Object.values(mm).some(v => v > 0);
  progShow('mapSec', hasMap);
  progShow('radarSec', hasMap);
  if (hasMap) {
    if (typeof renderMuscleMap === 'function') renderMuscleMap('muscleMap', mm);
    renderMuscleRadar(mm);
  }
  renderHeatmap();
  renderPRTimeline();
}

/* ── Volumen · 8 semanas (lunes a lunes), barras CSS como en Android ── */
function renderVolChart() {
  const el = document.getElementById('volChart');
  if (!el) return;
  const mon = progThisMonday();
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(mon); start.setDate(mon.getDate() - w * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const s = progISO(start), e = progISO(end);
    let v = 0;
    workouts.forEach(x => { if (x.date >= s && x.date < e) v += (x.exercises || []).reduce((a, ex) => a + progVol(ex), 0); });
    weeks.push({ w, v });
  }
  const maxV = Math.max(1, ...weeks.map(x => x.v));
  const total = workouts.reduce((a, x) => a + (x.exercises || []).reduce((b, ex) => b + progVol(ex), 0), 0);
  const sub = document.getElementById('volSub');
  if (sub) sub.textContent = `${progT('Total')} ${big(total)} kg · ${workouts.length} ${progT('entrenos')}`;
  el.innerHTML = weeks.map(x => {
    const isThis = x.w === 0;
    const label = isThis ? progT('Esta') : x.w + (progEn() ? 'w' : 's');
    const h = x.v > 0 ? Math.max(4, Math.round(x.v / maxV * 100)) : 0;
    return `<div class="vol8-col"><div class="vol8-track"><div class="vol8-bar${isThis ? ' on' : ''}" style="height:${h}%"></div></div><div class="vol8-l${isThis ? ' on' : ''}">${label}</div></div>`;
  }).join('');
}

/* ── Músculos trabajados: todos los grupos (incl. Otros), barra relativa al máximo y ×N ── */
function renderMuscleChart() {
  const counts = {}; workouts.forEach(w => (w.exercises || []).forEach(e => { const m = getMuscle(e.ex); counts[m] = (counts[m] || 0) + 1; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  progShow('musclesSec', sorted.length > 0);
  const list = document.getElementById('mlList');
  if (!list || !sorted.length) return;
  const maxC = Math.max(1, sorted[0][1]);
  list.innerHTML = sorted.map(([m, n]) => {
    const c = MC[m] || MC.Otros;
    return `<div class="ml-row2"><div class="ml-dot" style="background:${c}"></div><span class="ml-nm">${progEsc(progT(m))}</span><div class="ml-bg"><div class="ml-fill" style="width:${Math.round(n / maxC * 100)}%;background:${c}"></div></div><span class="ml-cnt">×${n}</span></div>`;
  }).join('');
}

/* ── Fuerza estimada (1RM Epley): top 8 ejercicios por 1RM = kg·(1+reps/30) ── */
function renderStrengthEstimate() {
  const el = document.getElementById('strengthEst');
  if (!el) return;
  const est = {}, maxKg = {};
  workouts.forEach(w => (w.exercises || []).forEach(e => {
    const k = +e.kg || 0; if (k <= 0) return;
    const r = Math.max(1, +e.reps || 0);
    const e1 = k * (1 + r / 30);
    if (e1 > (est[e.ex] || 0)) est[e.ex] = e1;
    if (k > (maxKg[e.ex] || 0)) maxKg[e.ex] = k;
  }));
  const top = Object.entries(est).sort((a, b) => b[1] - a[1]).slice(0, 8);
  progShow('strengthSec', top.length > 0);
  if (!top.length) return;
  el.innerHTML = top.map(([name, e1]) => `<div class="se-row"><div class="se-n">${progEsc(name)}</div><div class="se-r"><div class="se-v">~${Math.round(e1)} kg</div><div class="se-m">${progT('máx')} ${big(maxKg[name] || 0)} kg</div></div></div>`).join('');
}

/* ── Actividad · 13 semanas: 91 días desde el lunes de hace 12 semanas (lunes→domingo por columna) ── */
function progHeatmapCounts() {
  const dc = {}; workouts.forEach(w => { dc[w.date] = (dc[w.date] || 0) + 1; });
  const mon = progThisMonday(); const start = new Date(mon); start.setDate(mon.getDate() - 12 * 7);
  const out = [];
  for (let i = 0; i < 91; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(dc[progISO(d)] || 0); }
  return out;
}
function renderHeatmap() {
  const container = document.getElementById('hmGrid');
  if (!container) return;
  const counts = progHeatmapCounts();
  // La rejilla CSS rellena por filas (13 columnas): fila = día de la semana (L→D), columna = semana.
  let cells = '';
  for (let row = 0; row < 7; row++) for (let col = 0; col < 13; col++) {
    const c = counts[col * 7 + row] || 0;
    const lv = c <= 0 ? '' : c === 1 ? ' l1' : c === 2 ? ' l2' : ' l3';
    cells += `<div class="hm-c${lv}"></div>`;
  }
  container.innerHTML = cells;
}

/* ── Récords recientes: cada vez que un ejercicio supera su máximo (cronológico), últimos 25, más reciente arriba ── */
function renderPRTimeline() {
  const el = document.getElementById('prTimeline');
  if (!el) return;
  const maxSoFar = {}; const prs = [];
  [...workouts].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(w => {
    (w.exercises || []).forEach(e => {
      const k = +e.kg || 0;
      if (k > 0 && k > (maxSoFar[e.ex] || 0)) { prs.push({ date: w.date, ex: e.ex, kg: k }); maxSoFar[e.ex] = k; }
    });
  });
  const shown = prs.slice(-25).reverse();
  progShow('prSec', shown.length > 0);
  if (!shown.length) return;
  el.innerHTML = shown.map(p => `<div class="pr-row"><span class="pr-d">${progEsc(p.date)}</span><span class="pr-ex">${progEsc(p.ex)}</span><span class="pr-kg">${big(p.kg)} kg</span></div>`).join('');
}

/* ══ BALANCE MUSCULAR (radar) — volumen por grupo de los últimos 30 días, sin cardio ni "Otros" ══ */
function renderMuscleRadar(volByMuscle) {
  const wrap = document.getElementById('radarWrap');
  if (!wrap) return;
  if (!document.getElementById('muscleRadar')) wrap.innerHTML = '<canvas id="muscleRadar"></canvas>';
  volByMuscle = volByMuscle || (typeof recentMuscles === 'function' ? recentMuscles(30) : {});
  const allMuscles = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core'];
  const maxVol = Math.max(...allMuscles.map(m => volByMuscle[m] || 0), 1);
  const data = allMuscles.map(m => Math.round(((volByMuscle[m] || 0) / maxVol) * 100));
  const colors = allMuscles.map(m => MC[m] || '#888');

  mkChart('muscleRadar', {
    type: 'radar',
    data: {
      labels: allMuscles.map(m => progT(m)),
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
