/* ══ LOGROS — paridad con AchievementsScreen.kt / Achievements.kt ══ */
function awardsStats() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d7 = new Date(today); d7.setDate(d7.getDate() - 7);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  let v30 = 0, totalVol = 0, totalSets = 0;
  const exTypes = new Set(), wd7 = new Set(), muscles7 = new Set();
  workouts.forEach(w => {
    const dd = new Date(String(w.date) + 'T00:00:00');
    const ok = !isNaN(dd);
    (w.exercises || []).forEach(e => {
      const sets = +e.sets > 0 ? +e.sets : 1, reps = +e.reps > 0 ? +e.reps : 1;
      const v = (+e.kg || 0) * sets * reps;
      totalVol += v; totalSets += sets; exTypes.add(e.ex);
      if (ok && dd >= d30) v30 += v;
      if (ok && dd >= d7) { wd7.add(w.date); muscles7.add(getMuscle(e.ex)); }
    });
  });
  // Disciplina: 4 semanas seguidas (lunes → domingo) con 3+ sesiones.
  const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  let consist = true;
  for (let i = 0; i < 4; i++) {
    const start = new Date(mon); start.setDate(start.getDate() - 7 * i);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const cnt = workouts.filter(w => { const d = new Date(String(w.date) + 'T00:00:00'); return !isNaN(d) && d >= start && d < end; }).length;
    if (cnt < 3) { consist = false; break; }
  }
  // Récords: veces que el kg supera el máximo previo de ese ejercicio (Achievements.kt).
  const maxSoFar = {}; let prCount = 0;
  [...workouts].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(w => (w.exercises || []).forEach(e => {
    const kg = +e.kg || 0;
    if (kg > 0 && kg > (maxSoFar[e.ex] || 0)) { prCount++; maxSoFar[e.ex] = kg; }
  }));
  return { tot: workouts.length, ms: calcMaxStreak(), wd7: wd7.size, muscles7: muscles7.size, v30, totalVol, exTypes: exTypes.size, consistency4w: consist, prCount, totalSets };
}

function renderAwards() {
  const xp = calcXp(), lv = getLvl(xp);
  $('awBadge').textContent = I18N.t('Nv.') + ' ' + lv.lvl;
  $('awTitle').textContent = I18N.t(lv.title);
  $('awXp').textContent = xp.toLocaleString(I18N.locale()) + ' XP';
  const pct = lv.max === Infinity ? 100 : Math.round((xp - lv.min) / (lv.max - lv.min) * 100);
  $('awFill').style.width = Math.min(Math.max(pct, 0), 100) + '%';

  const s = awardsStats();
  const badges = [
    { ic: '🥉', n: 'Primer paso', r: '1 sesión', on: s.tot >= 1 },
    { ic: '🥈', n: 'Constancia', r: '10 sesiones', on: s.tot >= 10 },
    { ic: '🥇', n: 'Dedicado', r: '50 sesiones', on: s.tot >= 50 },
    { ic: '💎', n: 'Élite', r: '100 sesiones', on: s.tot >= 100 },
    { ic: '🔥', n: 'Semana llena', r: '4+ días', on: s.wd7 >= 4 },
    { ic: '⚡', n: 'Potencia', r: '+5K kg/mes', on: s.v30 >= 5000 },
    { ic: '🏃', n: 'Racha 7', r: '7 días', on: s.ms >= 7 },
    { ic: '🔑', n: 'Racha 30', r: '30 días', on: s.ms >= 30 },
    { ic: '🦁', n: 'Fuerza', r: '+50K kg total', on: s.totalVol >= 50000 },
    { ic: '🏆', n: 'Veterano', r: '180 días racha', on: s.ms >= 180 },
    { ic: '🌟', n: 'Leyenda', r: '365 días racha', on: s.ms >= 365 },
    { ic: '👑', n: 'PR Machine', r: '10 récords', on: s.prCount >= 10 },
    { ic: '🎯', n: 'Variedad', r: '15 ejercicios', on: s.exTypes >= 15 },
    { ic: '💣', n: 'Destructor', r: '+100K kg total', on: s.totalVol >= 100000 },
    { ic: '🧠', n: 'Completo', r: '5+ músculos/sem', on: s.muscles7 >= 5 },
    { ic: '📅', n: 'Disciplina', r: '4 sem × 3 ses', on: s.consistency4w },
    { ic: '🌋', n: 'Volcánico', r: '+10K kg/mes', on: s.v30 >= 10000 },
    { ic: '⭐', n: 'Centurión', r: '200 sesiones', on: s.tot >= 200 },
  ];
  const unlocked = badges.filter(b => b.on).length;
  $('awBadgesT').textContent = I18N.t('Insignias') + ' (' + unlocked + '/' + badges.length + ')';
  $('badgesGrid').innerHTML = badges.map(b => `<div class="badge-item${b.on ? ' on' : ''}"><div class="badge-ring">${b.on ? b.ic : '🔒'}</div><div class="badge-nm">${I18N.t(b.n)}</div><div class="badge-rq">${I18N.t(b.r)}</div></div>`).join('');

  const mn = (c, m) => Math.min(c, m);
  const milestones = [
    { ic: '💪', n: 'Primera sesión', d: 'Completa tu primer entreno', cur: mn(s.tot, 1), max: 1, xp: 50 },
    { ic: '📅', n: '10 sesiones', d: 'Demuestra constancia', cur: mn(s.tot, 10), max: 10, xp: 100 },
    { ic: '🔥', n: 'Racha de 7 días', d: '7 días seguidos', cur: mn(s.ms, 7), max: 7, xp: 200 },
    { ic: '🏋️', n: '1.000 kg levantados', d: 'Supera la tonelada', cur: mn(Math.round(s.totalVol), 1000), max: 1000, xp: 150 },
    { ic: '⚡', n: '50 series', d: 'Esfuerzo acumulado', cur: mn(s.totalSets, 50), max: 50, xp: 150 },
    { ic: '🏆', n: '5 récords personales', d: 'Supera tus marcas', cur: mn(s.prCount, 5), max: 5, xp: 300 },
    { ic: '🎯', n: '25 sesiones', d: 'Eres constante', cur: mn(s.tot, 25), max: 25, xp: 200 },
    { ic: '🦁', n: '10.000 kg', d: 'Diez toneladas', cur: mn(Math.round(s.totalVol), 10000), max: 10000, xp: 250 },
    { ic: '💎', n: '200 series', d: 'Series veteranas', cur: mn(s.totalSets, 200), max: 200, xp: 300 },
    { ic: '🧠', n: '10 ejercicios distintos', d: 'Variedad en el gym', cur: mn(s.exTypes, 10), max: 10, xp: 150 },
    { ic: '🌋', n: 'Racha de 14 días', d: 'Dos semanas seguidas', cur: mn(s.ms, 14), max: 14, xp: 400 },
    { ic: '👑', n: '15 récords', d: 'Máquina de récords', cur: mn(s.prCount, 15), max: 15, xp: 500 },
  ];
  $('msList').innerHTML = milestones.map(m => {
    const done = m.cur >= m.max, prog = m.cur > 0 && !done, pct = Math.min(Math.round(m.cur / m.max * 100), 100);
    return `<div class="ms"><div class="ms-ic${done ? ' done' : prog ? ' prog' : ' lock'}">${done ? '✅' : prog ? m.ic : '🔒'}</div><div class="ms-info"><div class="ms-n">${I18N.t(m.n)}</div><div class="ms-d">${I18N.t(m.d)}</div>${done ? '' : `<div class="ms-bar"><div class="ms-bar-f" style="width:${pct}%"></div></div>`}</div><div class="ms-r"><div class="ms-xp">+${m.xp} XP</div>${done ? '' : `<div class="ms-pct">${m.cur}/${m.max}</div>`}</div></div>`;
  }).join('');
}
