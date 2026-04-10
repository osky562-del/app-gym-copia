/* ══ AWARDS ══ */
function renderAwards() {
  const xp = calcXp(), lv = getLvl(xp), next = LEVELS.find(l => l.lvl === lv.lvl + 1);
  $('awBadge').textContent = 'Nv.' + lv.lvl; $('awTitle').textContent = lv.title; $('awXp').textContent = xp.toLocaleString();
  $('awCur').textContent = xp.toLocaleString() + ' / ' + (lv.max === Infinity ? 'MAX' : lv.max.toLocaleString()) + ' XP';
  $('awNxt').textContent = next ? 'Próximo: ' + next.title : '¡Nivel máximo! 🎉';
  const pct = lv.max === Infinity ? 100 : Math.round((xp - lv.min) / (lv.max - lv.min) * 100);
  $('awFill').style.width = pct + '%';
  const tot = workouts.length, ms = calcMaxStreak();
  let v30 = 0; const a30 = new Date(); a30.setDate(a30.getDate() - 30);
  workouts.filter(w => new Date(w.date) >= a30).forEach(w => (w.exercises || []).forEach(e => v30 += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1)));
  const a7 = new Date(); a7.setDate(a7.getDate() - 7); const wd = new Set(workouts.filter(w => new Date(w.date) >= a7).map(w => w.date));
  // Extended stats for badges
  const totalVol = workouts.reduce((s, w) => (w.exercises || []).reduce((sv, e) => sv + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), s), 0);
  const totalExTypes = new Set(); workouts.forEach(w => (w.exercises || []).forEach(e => totalExTypes.add(e.ex)));
  const musclesHit = new Set(); workouts.filter(w => new Date(w.date) >= a7).forEach(w => (w.exercises || []).forEach(e => musclesHit.add(getMuscle(e.ex))));
  const hasConsistency4w = (() => { for (let i = 0; i < 4; i++) { const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay() - i * 7); const we = new Date(ws); we.setDate(ws.getDate() + 7); const cnt = workouts.filter(w => { const d = new Date(w.date); return d >= ws && d < we; }).length; if (cnt < 3) return false; } return true; })();

  const badges = [
    { ic: '🥉', n: 'Primer paso', r: '1 sesión', on: tot >= 1 },
    { ic: '🥈', n: 'Constancia', r: '10 sesiones', on: tot >= 10 },
    { ic: '🥇', n: 'Dedicado', r: '50 sesiones', on: tot >= 50 },
    { ic: '💎', n: 'Élite', r: '100 sesiones', on: tot >= 100 },
    { ic: '🔥', n: 'Semana llena', r: '4+ días', on: wd.size >= 4 },
    { ic: '⚡', n: 'Potencia', r: '+5K kg/mes', on: v30 >= 5000 },
    { ic: '🏃', n: 'Racha 7', r: '7 días', on: ms >= 7 },
    { ic: '🔑', n: 'Racha 30', r: '30 días', on: ms >= 30 },
    { ic: '🦁', n: 'Fuerza', r: '+50K kg total', on: totalVol >= 50000 },
    { ic: '🏆', n: 'Veterano', r: '180 días racha', on: ms >= 180 },
    { ic: '🌟', n: 'Leyenda', r: '365 días racha', on: ms >= 365 },
    { ic: '👑', n: 'PR Machine', r: '10 récords', on: bonusXp >= XP.pr * 10 },
    // New badges
    { ic: '🎯', n: 'Variedad', r: '15 ejercicios', on: totalExTypes.size >= 15 },
    { ic: '💣', n: 'Destructor', r: '+100K kg total', on: totalVol >= 100000 },
    { ic: '🧠', n: 'Completo', r: '5+ músculos/sem', on: musclesHit.size >= 5 },
    { ic: '📅', n: 'Disciplina', r: '4 sem × 3 ses', on: hasConsistency4w },
    { ic: '🌋', n: 'Volcánico', r: '+10K kg/mes', on: v30 >= 10000 },
    { ic: '⭐', n: 'Centurión', r: '200 sesiones', on: tot >= 200 },
  ];
  $('badgesGrid').innerHTML = badges.map(b => `<div class="badge-item${b.on ? ' on' : ''}"><div class="badge-ring">${b.on ? b.ic : '🔒'}</div><div class="badge-nm">${b.n}</div><div class="badge-rq">${b.r}</div></div>`).join('');
  const totalSets = workouts.reduce((s, w) => (w.exercises || []).reduce((sv, e) => sv + (+e.sets || 1), s), 0);
  const prCount = Math.round(bonusXp / XP.pr);
  const milestones = [
    { ic: '💪', n: 'Primera sesión', d: 'Completa tu primer entreno', cur: Math.min(tot, 1), max: 1, xp: 50 },
    { ic: '📅', n: '10 sesiones', d: 'Demuestra constancia', cur: Math.min(tot, 10), max: 10, xp: 100 },
    { ic: '🔥', n: 'Racha de 7 días', d: '7 días seguidos', cur: Math.min(ms, 7), max: 7, xp: 200 },
    { ic: '🏋️', n: '1.000 kg levantados', d: 'Supera la tonelada', cur: Math.min(Math.round(totalVol), 1000), max: 1000, xp: 150 },
    { ic: '⚡', n: '50 series', d: 'Esfuerzo acumulado', cur: Math.min(totalSets, 50), max: 50, xp: 150 },
    { ic: '🏆', n: '5 récords personales', d: 'Supera tus marcas', cur: Math.min(prCount, 5), max: 5, xp: 300 },
    // New milestones
    { ic: '🎯', n: '25 sesiones', d: 'Eres constante', cur: Math.min(tot, 25), max: 25, xp: 200 },
    { ic: '🦁', n: '10.000 kg', d: 'Diez toneladas', cur: Math.min(Math.round(totalVol), 10000), max: 10000, xp: 250 },
    { ic: '💎', n: '200 series', d: 'Series veteranas', cur: Math.min(totalSets, 200), max: 200, xp: 300 },
    { ic: '🧠', n: '10 ejercicios distintos', d: 'Variedad en el gym', cur: Math.min(totalExTypes.size, 10), max: 10, xp: 150 },
    { ic: '🌋', n: 'Racha de 14 días', d: 'Dos semanas seguidas', cur: Math.min(ms, 14), max: 14, xp: 400 },
    { ic: '👑', n: '15 récords', d: 'Máquina de récords', cur: Math.min(prCount, 15), max: 15, xp: 500 },
  ];
  $('msList').innerHTML = milestones.map(m => { const done = m.cur >= m.max, prog = m.cur > 0 && !done, pct = Math.min(Math.round(m.cur / m.max * 100), 100); return `<div class="ms"><div class="ms-ic${done ? ' done' : prog ? ' prog' : ' lock'}">${done ? '✅' : prog ? m.ic : '🔒'}</div><div class="ms-info"><div class="ms-n">${m.n}</div><div class="ms-d">${m.d}</div></div><div class="ms-r"><div class="ms-xp">+${m.xp} XP</div>${done ? '<div>✅</div>' : `<div class="ms-bar"><div class="ms-bar-f" style="width:${pct}%"></div></div><div class="ms-pct">${m.cur}/${m.max}</div>`}</div></div>`; }).join('');
}
