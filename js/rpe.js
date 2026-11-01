/* ══ IMPROVED CHARTS ══ */
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(28,28,34,.98)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,.12)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 9;
Chart.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono',monospace", size: 11, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono',monospace", size: 11 };
Chart.defaults.animation.duration = 550;
Chart.defaults.animation.easing = 'easeOutQuart';

/* ══ AUTO RPE (réplica de LiveViewModel.kt: % de 1RM → RPE) ══ */
// 1RM estimated with Epley: 1RM = kg * (1 + reps/30)
const PCT_TO_RPE = [
  { pct: 100, rpe: 10 }, { pct: 97, rpe: 9.5 }, { pct: 94, rpe: 9 }, { pct: 92, rpe: 8.5 },
  { pct: 89, rpe: 8 }, { pct: 86, rpe: 7.5 }, { pct: 83, rpe: 7 }, { pct: 81, rpe: 6.5 },
  { pct: 79, rpe: 6 }, { pct: 77, rpe: 5.5 }, { pct: 75, rpe: 5 }, { pct: 70, rpe: 4 },
];

function pctToRpe(pct) {
  for (const row of PCT_TO_RPE) {
    if (pct >= row.pct) return row.rpe;
  }
  return 4;
}

/* RPE medio de la sesión a partir de las series completadas (no calentamiento) vs el 1RM
   histórico. Devuelve un ENTERO 1-10 (como Android) o null si no hay datos. */
function estimateRpe() {
  let totalRpe = 0, count = 0;
  liveExs.forEach(ex => {
    const pr1RM = calcEx1RM(ex.name);
    if (!pr1RM) return;
    ex.sets.forEach(s => {
      if (!s.done || s.warmup || !(+s.kg > 0) || !(+s.reps > 0)) return;
      const set1RM = (+s.kg) * (1 + (+s.reps) / 30);
      const pct = Math.min(100, Math.floor(set1RM / pr1RM * 100));
      let rpe = pctToRpe(pct);
      if (+s.reps > 5) rpe = Math.max(4, rpe - (+s.reps - 5) * 0.3);
      totalRpe += rpe;
      count++;
    });
  });
  if (!count) return null;
  return Math.min(10, Math.max(1, Math.round(totalRpe / count)));
}

function calcEx1RM(name) {
  let best = 0;
  workouts.forEach(w => {
    (w.exercises || []).filter(e => e.ex === name).forEach(e => {
      if (!(+e.kg > 0)) return;
      const est = (+e.kg) * (1 + ((+e.reps || 1)) / 30);
      if (est > best) best = est;
    });
  });
  return best > 0 ? best : null;
}

/* ── Selector RPE del plan: Auto | Manual (PlanScreen.kt:436-480) ── */
let rpeAuto = true;     // por defecto automático
let planRpeVal = 0;     // 0 = sin RPE (manual)

function resetRpe() { rpeAuto = true; planRpeVal = 0; renderPlanRpe(); }
function setRpeMode(auto) { rpeAuto = !!auto; renderPlanRpe(); }
/* Pulsar el mismo número lo desmarca (setRpe de Android). */
function setRpeManual(n) { planRpeVal = planRpeVal === n ? 0 : n; renderPlanRpe(); }

function renderPlanRpe() {
  const body = $('rpeBody');
  if (!body) return;
  const a = $('rpeSegAuto'), m = $('rpeSegMan');
  if (a) a.classList.toggle('on', rpeAuto);
  if (m) m.classList.toggle('on', !rpeAuto);
  if (rpeAuto) {
    body.innerHTML = `<div class="plan-rpe-auto">🤖 ${typeof _t === 'function' ? _t('Se calcula solo según el % de tu 1RM en cada serie') : 'Se calcula solo según el % de tu 1RM en cada serie'}</div>`;
  } else {
    const circles = Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
      `<button class="plan-rpe-c${planRpeVal === n ? ' on' : ''}" onclick="setRpeManual(${n})">${n}</button>`).join('');
    body.innerHTML = `<div class="plan-rpe-hint">Opcional · qué tan duro fue</div><div class="plan-rpe-row">${circles}</div>`;
  }
}

/* Compatibilidad: antes refrescaba un indicador en el plan; en Android no se muestra nada en vivo. */
function updateAutoRpe() {}

function getRpeValue() {
  if (!rpeAuto) return planRpeVal > 0 ? String(planRpeVal) : '';
  const est = estimateRpe();
  return est ? String(est) : '';
}
