/* ══ HELPERS ══ */
function getLastKg(name) { for (const w of workouts) { const e = (w.exercises || []).find(e => e.ex === name); if (e && e.kg) return e.kg; } return null; }
function getPR(name) { let pr = 0; workouts.forEach(w => (w.exercises || []).filter(e => e.ex === name).forEach(e => { if (+e.kg > pr) pr = +e.kg; })); return pr; }
/** Devuelve el detalle de series de la última vez que se hizo el ejercicio (null si nunca) */
function getLastSetsDetail(name) {
  for (const w of workouts) {
    const e = (w.exercises || []).find(ex => ex.ex === name && Array.isArray(ex.setsDetail));
    if (e && e.setsDetail.length > 0) return e.setsDetail;
  }
  return null;
}
/* ── Favoritos y recientes ── */
function getFavs() { try { return STORE.get('favExs') || []; } catch (e) { return []; } }
function isFav(name) { return getFavs().indexOf(name) >= 0; }
function toggleFav(name) {
  const f = getFavs(); const i = f.indexOf(name);
  if (i >= 0) f.splice(i, 1); else f.unshift(name);
  STORE.set('favExs', f);
}
/** Ejercicios usados más recientemente (nombres únicos, del historial). */
function getRecentExs(n) {
  const seen = new Set(), out = [];
  for (const w of (typeof workouts !== 'undefined' ? workouts : [])) {
    for (const e of (w.exercises || [])) {
      if (e.ex && !seen.has(e.ex)) { seen.add(e.ex); out.push(e.ex); if (out.length >= (n || 8)) return out; }
    }
  }
  return out;
}
/** HTML de la estrella de favorito (refreshFn = nombre de la función que re-renderiza la lista). */
function favStar(name, refreshFn) {
  const esc = name.replace(/'/g, "\\'");
  const on = isFav(name);
  return `<span onclick="event.stopPropagation();toggleFav('${esc}');${refreshFn}();" style="cursor:pointer;font-size:1rem;padding:2px 5px;${on ? 'color:#f5a623' : 'color:var(--t3)'};">${on ? '★' : '☆'}</span>`;
}
function quickListHeader(txt) {
  return `<div style="font-size:.6rem;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;padding:9px 10px 4px;">${txt}</div>`;
}
/** Récord de repeticiones: máximas reps en una serie (no calentamiento) del historial. */
function getRepPR(name) {
  let max = 0;
  for (const w of (typeof workouts !== 'undefined' ? workouts : [])) {
    for (const e of (w.exercises || [])) {
      if (e.ex !== name) continue;
      if (Array.isArray(e.setsDetail)) {
        e.setsDetail.forEach(s => { if (!s.warmup && +s.reps > max) max = +s.reps; });
      } else if (+e.reps > max) max = +e.reps;
    }
  }
  return max;
}
/** Sugiere un nombre de entreno a partir de los músculos trabajados (ej. "Pecho y tríceps"). */
function suggestWorkoutName(exercises) {
  const cnt = {};
  (exercises || []).forEach(e => {
    const m = (typeof getMuscle === 'function') ? getMuscle(e.ex || e.name || '') : 'Otros';
    cnt[m] = (cnt[m] || 0) + 1;
  });
  const sorted = Object.entries(cnt).filter(([m]) => m !== 'Otros').sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return 'Entreno';
  if (sorted.length === 1) return 'Entreno de ' + sorted[0][0].toLowerCase();
  return sorted[0][0] + ' y ' + sorted[1][0].toLowerCase();
}
/** Estima las calorías quemadas en un entreno de fuerza según duración y peso corporal. */
function estimateCalories(durationMin) {
  const min = +durationMin || 0;
  if (min <= 0) return 0;
  const bw = (typeof getBodyweight === 'function' ? getBodyweight() : 0) || 70;
  // ~0,09 kcal por minuto y kg (≈ 6 MET; ~7 kcal/min a 70 kg)
  return Math.round(min * bw * 0.09);
}
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
/* Lista completa de ejercicios disponibles para añadir/buscar.
   Prioriza la BD de 873 ejercicios (todos con vídeo demo) y mezcla los
   que el usuario ya haya hecho en su historial (para retro-compatibilidad
   con cuentas antiguas que tengan ejercicios con nombres distintos). */
function getAllExNames() {
  const s = new Set();
  // 1) Base de datos de 873 ejercicios (todos con vídeo)
  if (typeof window !== 'undefined' && Array.isArray(window.EXERCISES_DB)) {
    window.EXERCISES_DB.forEach(e => { if (e.name) s.add(e.name); });
  }
  // 2) Plantillas predefinidas
  Object.values(TPL).flat().forEach(e => s.add(e.ex));
  // 3) Ejercicios que el usuario ya usó (aunque no estén en la BD)
  workouts.forEach(w => (w.exercises || []).forEach(e => s.add(e.ex)));
  return [...s].sort((a, b) => a.localeCompare(b, 'es'));
}
function calcStreak() { if (!workouts.length) return 0; const d = [...new Set(workouts.map(w => w.date))].sort().reverse(); let s = 0, cur = new Date(); cur.setHours(0, 0, 0, 0); for (const x of d) { const wd = new Date(x + 'T00:00:00'); if (Math.round((cur - wd) / 86400000) <= 1) { s++; cur = wd; } else break; } return s; }
function calcMaxStreak() { const d = [...new Set(workouts.map(w => w.date))].sort(); let max = 0, cur = 0; for (let i = 0; i < d.length; i++) { cur = i === 0 ? 1 : Math.round((new Date(d[i] + 'T00:00:00') - new Date(d[i - 1] + 'T00:00:00')) / 86400000) <= 1 ? cur + 1 : 1; if (cur > max) max = cur; } return max; }
