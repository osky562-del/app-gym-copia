/* ══════════════════════════════════════════════
   INSIGHTS — tarjetas inteligentes de progreso
   ══════════════════════════════════════════════
   Tendencias y comparativas automáticas para el inicio:
   volumen mes a mes, tendencia de fuerza, músculo estrella, racha…
   ══════════════════════════════════════════════ */
(function () {
  function monthRange(offset) {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - offset, 1);
    const end = new Date(d.getFullYear(), d.getMonth() - offset + 1, 1);
    return [start, end];
  }
  function inRange(dateStr, r) { const d = new Date(dateStr + 'T00:00:00'); return d >= r[0] && d < r[1]; }
  function monthVolume(offset) {
    const r = monthRange(offset); let v = 0;
    workouts.forEach(w => { if (inRange(w.date, r)) (w.exercises || []).forEach(e => v += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1)); });
    return v;
  }
  function monthCount(offset) { const r = monthRange(offset); return workouts.filter(w => inRange(w.date, r)).length; }

  function mostTrainedExercise() {
    const cnt = {};
    workouts.forEach(w => { const seen = new Set(); (w.exercises || []).forEach(e => { if (e.ex && !seen.has(e.ex)) { seen.add(e.ex); cnt[e.ex] = (cnt[e.ex] || 0) + 1; } }); });
    let best = null, bc = 0;
    for (const k in cnt) if (cnt[k] > bc) { bc = cnt[k]; best = k; }
    return bc >= 3 ? best : null;
  }
  function strengthTrendPerMonth(ex) {
    const pts = [];
    [...workouts].sort((a, b) => a.date.localeCompare(b.date)).forEach(w => {
      const es = (w.exercises || []).filter(e => e.ex === ex);
      if (!es.length) return;
      let d1 = 0; es.forEach(e => { const rm = (+e.kg || 0) * (1 + (+e.reps || 1) / 30); if (rm > d1) d1 = rm; });
      if (d1 > 0) pts.push({ date: w.date, v: d1 });
    });
    if (pts.length < 2) return null;
    const first = pts[0], last = pts[pts.length - 1];
    const months = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 0.5) return null;
    return (last.v - first.v) / months;
  }
  function topMuscleThisMonth() {
    const r = monthRange(0), mus = {};
    workouts.forEach(w => { if (inRange(w.date, r) && typeof getWorkoutMuscles === 'function') { const wm = getWorkoutMuscles(w); for (const k in wm) mus[k] = (mus[k] || 0) + wm[k]; } });
    const sorted = Object.entries(mus).filter(([m]) => m !== 'Otros').sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0][0] : null;
  }

  function computeInsights() {
    const out = [];
    if (typeof workouts === 'undefined' || !workouts.length) return out;

    // Volumen este mes vs mes pasado
    const vThis = monthVolume(0), vLast = monthVolume(1);
    if (vLast > 0 && vThis > 0) {
      const pct = Math.round((vThis - vLast) / vLast * 100);
      if (Math.abs(pct) >= 5) out.push({ ic: pct > 0 ? '📈' : '📉', c: pct > 0 ? '#2dd98a' : '#f5a623', t: `Este mes ${pct > 0 ? '+' : ''}${pct}% de volumen respecto al mes pasado` });
    }
    // Tendencia de fuerza del ejercicio más entrenado
    const ex = mostTrainedExercise();
    if (ex) {
      const tr = strengthTrendPerMonth(ex);
      if (tr !== null && Math.abs(tr) >= 0.6) out.push({ ic: tr > 0 ? '💪' : '📉', c: '#4f8cff', t: `Tu ${ex} ${tr > 0 ? 'sube' : 'baja'} ~${Math.abs(tr).toFixed(1)} kg/mes (1RM est.)` });
    }
    // Músculo estrella del mes
    const tm = topMuscleThisMonth();
    if (tm) out.push({ ic: '🎯', c: (typeof MC !== 'undefined' && MC[tm]) || '#9b72f5', t: `Tu grupo estrella este mes: ${tm}` });
    // Racha
    const streak = (typeof calcStreak === 'function') ? calcStreak() : 0;
    if (streak >= 2) out.push({ ic: '🔥', c: '#ff6b6b', t: `Racha de ${streak} días seguidos. ¡No la rompas!` });
    // Entrenos este mes
    const cThis = monthCount(0);
    if (cThis >= 1) out.push({ ic: '🗓️', c: '#4dd4e8', t: `Llevas ${cThis} entreno${cThis > 1 ? 's' : ''} este mes` });

    return out;
  }

  function renderInsights() {
    const el = document.getElementById('insightsList');
    const sec = document.getElementById('insightsSec');
    if (!el) return;
    const ins = computeInsights().slice(0, 3);
    if (!ins.length) { el.innerHTML = ''; if (sec) sec.style.display = 'none'; return; }
    if (sec) sec.style.display = '';
    el.innerHTML = ins.map(i => `<div style="display:flex;align-items:center;gap:11px;background:var(--s1,#131316);border:1px solid var(--line2,#2a2a32);border-left:3px solid ${i.c};border-radius:12px;padding:12px 13px;margin-bottom:8px;"><span style="font-size:1.3rem;flex-shrink:0;line-height:1;">${i.ic}</span><span style="font-size:.85rem;color:var(--t1,#fff);line-height:1.4;">${i.t}</span></div>`).join('');
  }

  window.renderInsights = renderInsights;
})();
