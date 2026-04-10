/* ══ HELPERS ══ */
function getLastKg(name) { for (const w of workouts) { const e = (w.exercises || []).find(e => e.ex === name); if (e && e.kg) return e.kg; } return null; }
function getPR(name) { let pr = 0; workouts.forEach(w => (w.exercises || []).filter(e => e.ex === name).forEach(e => { if (+e.kg > pr) pr = +e.kg; })); return pr; }
/** Progressive overload suggestion: +2.5% rounded to nearest 0.5kg */
function getSuggestedKg(name) {
  const last = getLastKg(name);
  if (!last || +last <= 0) return null;
  const kg = +last;
  // Get last 3 sessions for this exercise to detect trend
  const history = [];
  for (const w of workouts) {
    const e = (w.exercises || []).find(e => e.ex === name);
    if (e && +e.kg > 0) history.push(+e.kg);
    if (history.length >= 3) break;
  }
  // If user did same weight 2+ times → suggest increase
  const sameCount = history.filter(k => k === kg).length;
  if (sameCount >= 2) {
    const bump = Math.max(0.5, Math.round(kg * 0.025 * 2) / 2); // 2.5% rounded to 0.5
    return { kg: +(kg + bump).toFixed(1), reason: 'overload', last: kg };
  }
  // If last was a PR, suggest maintaining
  const pr = getPR(name);
  if (kg >= pr) return { kg, reason: 'maintain', last: kg };
  // Default: use last weight
  return { kg, reason: 'same', last: kg };
}
/** Get muscles worked in a workout */
function getWorkoutMuscles(wk) {
  const muscles = {};
  (wk.exercises || []).forEach(e => {
    const m = getMuscle(e.ex);
    const v = (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1);
    muscles[m] = (muscles[m] || 0) + v;
  });
  return muscles;
}
/** Estimate recovery time (hours) per muscle group */
function estimateRecovery(muscle, volume, rpe) {
  const baseHours = { 'Pierna': 72, 'Espalda': 60, 'Pecho': 48, 'Hombro': 48, 'Bíceps': 36, 'Tríceps': 36, 'Core': 24, 'Otros': 48 };
  let hours = baseHours[muscle] || 48;
  if (rpe >= 9) hours *= 1.2;
  else if (rpe <= 6) hours *= 0.8;
  return Math.round(hours);
}
function getAllExNames() { const s = new Set(); workouts.forEach(w => (w.exercises || []).forEach(e => s.add(e.ex))); Object.values(TPL).flat().forEach(e => s.add(e.ex)); return [...s].sort(); }
function calcStreak() { if (!workouts.length) return 0; const d = [...new Set(workouts.map(w => w.date))].sort().reverse(); let s = 0, cur = new Date(); cur.setHours(0, 0, 0, 0); for (const x of d) { const wd = new Date(x + 'T00:00:00'); if (Math.round((cur - wd) / 86400000) <= 1) { s++; cur = wd; } else break; } return s; }
function calcMaxStreak() { const d = [...new Set(workouts.map(w => w.date))].sort(); let max = 0, cur = 0; for (let i = 0; i < d.length; i++) { cur = i === 0 ? 1 : Math.round((new Date(d[i] + 'T00:00:00') - new Date(d[i - 1] + 'T00:00:00')) / 86400000) <= 1 ? cur + 1 : 1; if (cur > max) max = cur; } return max; }
