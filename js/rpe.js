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

/* ══ AUTO RPE ══ */
// Based on % of estimated 1RM → RPE lookup table (Helms / RTS method)
// 1RM estimated with Epley: 1RM = kg * (1 + reps/30)
// % of 1RM → RPE (simplified Brzycki inverse)
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

function estimateRpe() {
  // Collect all completed sets across all exercises
  let totalRpe = 0, count = 0;
  liveExs.forEach(ex => {
    const pr1RM = calcEx1RM(ex.name); // best historical 1RM for this exercise
    if (!pr1RM) return;
    ex.sets.forEach(s => {
      if (!s.done || !s.kg || !s.reps) return;
      const set1RM = (+s.kg) * (1 + (+s.reps) / 30);
      const pct = Math.round(set1RM / pr1RM * 100);
      // Higher reps at same % = lower RPE (more reps in reserve)
      // Adjust: more reps → slightly lower RPE
      let rpe = pctToRpe(Math.min(pct, 100));
      // Rep adjustment: for every rep above 5, subtract 0.5 from RPE
      if (+s.reps > 5) rpe = Math.max(4, rpe - (+s.reps - 5) * 0.3);
      totalRpe += rpe;
      count++;
    });
  });
  if (!count) return null;
  return Math.round(totalRpe / count * 2) / 2; // round to nearest 0.5
}

function calcEx1RM(name) {
  let best = 0;
  workouts.forEach(w => {
    (w.exercises || []).filter(e => e.ex === name).forEach(e => {
      const est = (+e.kg || 0) * (1 + (+e.reps || 1) / 30);
      if (est > best) best = est;
    });
  });
  return best > 0 ? best : null;
}

// RPE mode: 'auto' or 'manual'
let rpeMode = 'auto';

function toggleRpeMode() {
  rpeMode = rpeMode === 'auto' ? 'manual' : 'auto';
  const lbl = $('rpeModeLabel');
  const inp = $('planRpe');
  const disp = $('rpeAutoDisplay');
  if (rpeMode === 'manual') {
    lbl.textContent = 'MANUAL';
    lbl.style.color = 'var(--amber)';
    disp.style.display = 'none';
    inp.style.display = '';
    inp.focus();
    toast('RPE manual — escríbelo tú', 'ok');
  } else {
    lbl.textContent = 'AUTO';
    lbl.style.color = 'var(--a)';
    disp.style.display = '';
    inp.style.display = 'none';
    inp.value = '';
    updateAutoRpe();
    toast('RPE automático activado', 'good');
  }
}

function updateAutoRpe() {
  if (rpeMode !== 'auto') return;
  const est = estimateRpe();
  const disp = $('rpeAutoDisplay');
  if (disp) {
    disp.textContent = est ? est.toFixed(1) : '—';
    disp.style.color = !est ? 'var(--t3)' :
      est >= 9 ? 'var(--red)' :
        est >= 7 ? 'var(--amber)' : 'var(--green)';
  }
}

function getRpeValue() {
  if (rpeMode === 'manual') {
    return $('planRpe').value || '';
  }
  const est = estimateRpe();
  return est ? est.toFixed(1) : '';
}
