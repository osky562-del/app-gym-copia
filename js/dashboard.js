/* ══ DASHBOARD ══ */
function renderDash() {
  renderNativeHome();
  updateGreeting();
  setTimeout(updateStreakAnim, 100);
  if (typeof renderInsights === 'function') renderInsights();
  const now = new Date();
  const _loc = (typeof I18N !== 'undefined' && I18N.locale) ? I18N.locale() : 'es-ES';
  let _wd = now.toLocaleDateString(_loc, { weekday: 'long' });
  _wd = _wd.charAt(0).toUpperCase() + _wd.slice(1);
  $('greetDate').textContent = _wd + ', ' + now.toLocaleDateString(_loc, { day: 'numeric', month: 'long' });
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

/* ══ INICIO (mismo orden y contenido que las apps nativas) ══ */
function nhVol(w) { return (w.exercises || []).reduce((s, e) => s + (e.isCardio ? 0 : (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1)), 0); }
function nhBig(v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)); }
function renderNativeHome() {
  if (!$('nhStreak')) return;
  const xp = calcXp(), lv = getLvl(xp), streak = calcStreak();
  const loc0 = (typeof I18N !== 'undefined' && I18N.locale) ? I18N.locale() : 'es-ES';
  $('nhName').textContent = getUserName() || 'Atleta';
  const now = new Date();
  let wd = now.toLocaleDateString(loc0, { weekday: 'long' }); wd = wd.charAt(0).toUpperCase() + wd.slice(1);
  $('nhDate').textContent = wd + ', ' + now.toLocaleDateString(loc0, { day: 'numeric', month: 'long' });
  // Tarjeta de XP (nivel, titulo, barra) como en Android
  $('nhLvBadge').textContent = 'Nivel ' + lv.lvl;
  $('nhLvl').textContent = lv.title;
  $('nhXp').textContent = xp.toLocaleString() + ' XP';
  const pct = lv.max === Infinity ? 100 : Math.round((xp - lv.min) / (lv.max - lv.min) * 100);
  $('nhXpFill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  $('nhXpPts').textContent = xp.toLocaleString() + ' / ' + (lv.max === Infinity ? 'MAX' : lv.max.toLocaleString()) + ' XP';
  // Racha + semana
  $('nhStreak').textContent = streak;
  $('nhStreak').parentNode.classList.toggle('hot', streak >= 3);
  $('nhStreakN').textContent = streak;
  $('nhFire').style.opacity = streak >= 3 ? 1 : .45;
  $('nhStreakMax').textContent = calcMaxStreak();
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  $('nhWeekStrip').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(t0); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0], hit = workouts.some(w => w.date === ds), isT = i === 6;
    let lbl = d.toLocaleDateString(loc0, { weekday: 'short' }).replace('.', ''); lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    return `<div class="nh-wd"><div class="nh-wdbar${hit ? ' hit' : ''}${isT ? ' today' : ''}"></div><span${isT ? ' class="today"' : ''}>${lbl}</span></div>`;
  }).join('');
  $('nhRepeat').style.display = workouts.length ? '' : 'none';
  let ex = 0, vol = 0, sr = 0, rc = 0;
  workouts.forEach(w => { if (+w.rpe) { sr += +w.rpe; rc++; } ex += (w.exercises || []).length; vol += nhVol(w); });
  $('nhS').textContent = workouts.length;
  $('nhV').textContent = nhBig(vol) + ' kg';
  $('nhE').textContent = ex;
  $('nhR').textContent = rc ? (sr / rc).toFixed(1) : '—';

  // Esta semana: ultimos 7 dias, variacion frente a los 7 anteriores y barras por dia.
  const wk = $('nhWeek');
  wk.style.display = workouts.length ? '' : 'none';
  if (workouts.length) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = [0, 0, 0, 0, 0, 0, 0];
    let thisV = 0, lastV = 0, count = 0;
    workouts.forEach(w => {
      const d = new Date(w.date + 'T00:00:00');
      const diff = Math.round((today - d) / 86400000);
      if (diff >= 0 && diff < 7) { const v = nhVol(w); thisV += v; count++; days[6 - diff] += v; }
      else if (diff >= 7 && diff < 14) lastV += nhVol(w);
    });
    const delta = lastV > 0 ? Math.round((thisV - lastV) / lastV * 100) : 0;
    const mx = Math.max(...days, 1);
    const loc = (typeof I18N !== 'undefined' && I18N.locale) ? I18N.locale() : 'es-ES';
    const bars = days.map((v, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (6 - i));
      const lbl = d.toLocaleDateString(loc, { weekday: 'narrow' }).toUpperCase();
      return `<div class="nh-bar"><i style="height:${Math.max(3, Math.round(v / mx * 46))}px;opacity:${i === 6 ? 1 : .45}"></i><span>${lbl}</span></div>`;
    }).join('');
    wk.innerHTML = `<div class="nh-wh"><div class="nh-ct">Esta semana</div>${delta ? `<div class="nh-delta" style="color:${delta > 0 ? '#2dd98a' : '#ff6b6b'}">${delta > 0 ? '↗' : '↘'} ${Math.abs(delta)}%</div>` : ''}</div>
      <div class="nh-wv">${count} entrenos · ${nhBig(thisV)} kg</div><div class="nh-bars">${bars}</div>`;
  }

  // Recientes
  $('nhRecentTitle').style.display = workouts.length ? '' : 'none';
  $('nhRecent').innerHTML = workouts.length
    ? workouts.slice(0, 5).map(w => {
      const exs = w.exercises || [], sets = exs.reduce((s, e) => s + (+e.sets || 0), 0);
      return `<div class="nh-rec" onclick="goPage('hist')"><div style="min-width:0;flex:1;"><div class="nh-rt">${w.name || 'Entreno'}</div>
        <div class="nh-cs">${w.date} · ${exs.length} ej · ${sets} series</div></div><div class="nh-rv">${nhBig(nhVol(w))} kg</div></div>`;
    }).join('')
    : '<div class="nh-empty">Aún no hay entrenos. ¡Empieza el primero!</div>';
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
          <span>Coach ilimitado${remaining < Infinity ? ' (' + remaining + ' restante)' : ''}</span>
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
