/* ══ DASHBOARD ══ */
function renderDash() {
  updateGreeting();
  setTimeout(updateStreakAnim, 100);
  const now = new Date();
  $('greetDate').textContent = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()] + ', ' + now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  $('strN').textContent = calcStreak(); $('strMax').textContent = calcMaxStreak();
  $('weekStrip').innerHTML = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const ds = d.toISOString().split('T')[0]; const hit = workouts.some(w => w.date === ds); const isT = i === 6; return `<div class="wd"><div class="wd-bar${hit ? ' hit' : ''}${isT ? ' today' : ''}"></div><div class="wd-l">${DAYS[d.getDay()]}</div></div>`; }).join('');
  const wv = []; for (let w = 6; w >= 0; w--) { const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay() - w * 7); let v = 0; for (let d = 0; d < 7; d++) { const dd = new Date(sun); dd.setDate(sun.getDate() + d); workouts.filter(x => x.date === dd.toISOString().split('T')[0]).forEach(x => (x.exercises || []).forEach(e => v += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1))); } wv.push(v); }
  const mx = Math.max(...wv, 1);
  $('volBars').innerHTML = wv.map((v, i) => `<div class="vb"><div class="vb-bar${i === 6 ? ' now' : ''}" style="height:${Math.max(Math.round(v / mx * 100), v > 0 ? 4 : 0)}%;"></div><div class="vb-l">${['7S', '6S', '5S', '4S', '3S', '2S', 'Esta'][i]}</div></div>`).join('');
  let ex = 0, vol = 0, sr = 0, rc = 0; workouts.forEach(w => { if (w.rpe) { sr += +w.rpe; rc++; } (w.exercises || []).forEach(e => { ex++; vol += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1); }); });
  $('kS').textContent = workouts.length; $('kV').textContent = big(vol); $('kE').textContent = ex; $('kR').textContent = rc ? (sr / rc).toFixed(1) : '—';
  // Weekly comparison badges (Pro feature)
  try {
    if (Pro.can('weekly_comparison')) {
      const wc = getWeekCompare();
      const vSign = wc.volDelta > 0 ? '↑' : wc.volDelta < 0 ? '↓' : '→';
      const vColor = wc.volDelta > 0 ? 'var(--green)' : wc.volDelta < 0 ? 'var(--red)' : 'var(--t3)';
      const sSign = wc.sessDelta > 0 ? '+' : '';
      $('weekCompare').innerHTML = `
    <div style="flex:1;background:var(--s1);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;">
      <div style="font-size:1.1rem;">${wc.volDelta >= 0 ? '📈' : '📉'}</div>
      <div><div style="font-size:.9rem;font-weight:800;color:${vColor}">${vSign} ${Math.abs(wc.volDelta)}%</div><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;">Vol. vs anterior</div></div>
    </div>
    <div style="flex:1;background:var(--s1);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;">
      <div style="font-size:1.1rem;">🏋️</div>
      <div><div style="font-size:.9rem;font-weight:800;color:var(--a)">${wc.curSess} sesiones</div><div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;">${sSign}${wc.sessDelta} vs anterior</div></div>
    </div>`;
    } else {
      $('weekCompare').innerHTML = `<div class="pro-locked-overlay" onclick="Pro.showUpgradeModal('weekly_comparison')" style="flex:1;padding:14px;"><div class="pro-locked-icon" style="font-size:1.1rem;">🔒</div><div class="pro-locked-text">Comparativa semanal — Pro</div></div>`;
    }
  } catch (e) { }
  // Pro upsell card for free users
  renderDashProCard();
  // Muscle frequency chips
  try {
    const topM = getTopMuscles(4);
    if (topM.length) $('muscleChips').innerHTML = topM.map(([m, c]) => `<div style="display:inline-flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--line);border-radius:100px;padding:5px 11px;font-size:.7rem;font-weight:600;color:var(--t2);"><span style="width:7px;height:7px;border-radius:50%;background:${MC[m] || 'var(--a)'};"></span>${m} <span style="font-family:var(--fm);color:var(--t3);">×${c}</span></div>`).join('');
    else $('muscleChips').innerHTML = '';
  } catch (e) { }
  updateXpBar();
  const rl = $('recentList');
  if (!workouts.length) { rl.innerHTML = `<div class="empty"><div class="empty-ic">💪</div><div class="empty-t">Sin sesiones aún</div><div class="empty-d">Registra tu primer entrenamiento y empieza a ver tu progreso aquí.</div><button class="empty-btn" onclick="openPlan()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nuevo entrenamiento</button></div>`; return; }
  const mxv = Math.max(...workouts.map(w => (w.exercises || []).reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0)), 1);
  rl.innerHTML = workouts.slice(0, 5).map(w => { const wv = (w.exercises || []).reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0); return `<div class="sc"><div class="sc-h"><div><div class="sc-date">${w.date}</div><div class="sc-meta">${[w.duration ? '⏱ ' + w.duration + 'min' : '', w.rpe ? 'RPE ' + w.rpe : '', big(wv) + ' kg', (w.exercises || []).length + ' ej.'].filter(Boolean).join(' · ')}</div></div><span class="sc-cnt">${(w.exercises || []).length} ej.</span></div><div class="sc-pills">${(w.exercises || []).slice(0, 5).map(e => `<span class="sc-pill"><strong>${e.ex}</strong>${e.kg ? ' ' + e.kg + 'kg' : ''}</span>`).join('')}</div></div>`; }).join('');
}

/* ══ STREAK ANIMATION ══ */
function updateStreakAnim() {
  const chip = document.querySelector('.streak-chip');
  if (chip) chip.classList.toggle('hot', calcStreak() >= 3);
}

/* ══ WEEKLY COMPARISON ══ */
function getWeekData(weeksAgo) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() - weeksAgo * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  let vol = 0, sess = 0;
  workouts.forEach(w => {
    const d = new Date(w.date + 'T12:00:00');
    if (d >= start && d < end) {
      sess++;
      (w.exercises || []).forEach(e => vol += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1));
    }
  });
  return { vol, sess };
}
function getWeekCompare() {
  const cur = getWeekData(0);
  const prev = getWeekData(1);
  const volDelta = prev.vol ? Math.round((cur.vol - prev.vol) / prev.vol * 100) : 0;
  const sessDelta = cur.sess - prev.sess;
  return { volDelta, sessDelta, curVol: cur.vol, curSess: cur.sess };
}

/* ══ DASHBOARD PRO UPSELL CARD ══ */
function renderDashProCard() {
  let el = $('dashProCard');
  if (Pro.isPro()) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'dashProCard';
    const cta = document.querySelector('#pageDash .cta');
    if (cta) cta.parentNode.insertBefore(el, cta);
  }
  const remaining = Pro.aiRemaining();
  const sessCount = workouts.length;
  const limit = Pro.getPlan().maxSessions;
  el.innerHTML = `
    <div class="dash-pro-card" onclick="Pro.showUpgradeModal('unlimited_workouts')">
      <div class="dash-pro-glow"></div>
      <div class="dash-pro-content">
        <div class="dash-pro-badge">PRO</div>
        <div class="dash-pro-title">Desbloquea todo tu potencial</div>
        <div class="dash-pro-features">
          <span>Coach IA ilimitado${remaining < Infinity ? ' (' + remaining + ' restante)' : ''}</span>
          <span>Analíticas avanzadas</span>
          <span>Sesiones ilimitadas${limit < Infinity ? ' (' + sessCount + '/' + limit + ')' : ''}</span>
        </div>
        <div class="dash-pro-price">Desde $4.99/mes</div>
      </div>
      <div class="dash-pro-arrow">›</div>
    </div>`;
}

/* ══ MUSCLE FREQUENCY CHIPS ══ */
function getTopMuscles(n) {
  const counts = {};
  const a7 = new Date(); a7.setDate(a7.getDate() - 7);
  workouts.filter(w => new Date(w.date) >= a7).forEach(w => {
    (w.exercises || []).forEach(e => {
      const m = getMuscle(e.ex);
      counts[m] = (counts[m] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
}
