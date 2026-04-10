/* ══ POST-WORKOUT SUMMARY ══ */
function showSummary(wk, xpGained, newPRs) {
  const exs = wk.exercises || [];
  const totalSets = exs.reduce((s, e) => s + (+e.sets || 0), 0);
  const totalVol = exs.reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0);
  const dur = wk.duration ? wk.duration + 'min' : '—';

  $('sumStats').innerHTML = [
    { v: dur, l: 'Duración', c: 'var(--a)' },
    { v: exs.length, l: 'Ejercicios', c: 'var(--green)' },
    { v: totalSets, l: 'Series', c: 'var(--purple)' },
    { v: big(totalVol) + 'kg', l: 'Volumen', c: 'var(--amber)' },
  ].map(s => `<div class="sum-stat" style="--sc:${s.c}">
<div class="sum-stat-v">${s.v}</div>
<div class="sum-stat-l">${s.l}</div>
  </div>`).join('');

  $('sumPR').innerHTML = newPRs.length ? `
<div class="sum-pr">
  <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  <div>
    <div class="sum-pr-t">🏆 ${newPRs.length} récord${newPRs.length > 1 ? 's' : ''} personal${newPRs.length > 1 ? 'es' : ''}</div>
    <div class="sum-pr-s">${newPRs.join(' · ')}</div>
  </div>
</div>` : '';

  const xp = calcXp(), lv = getLvl(xp);
  $('sumXP').innerHTML = `
<div class="sum-xp-ic">+${xpGained}</div>
<div>
  <div class="sum-xp-v">+${xpGained} XP ganados</div>
  <div class="sum-xp-s">Nivel ${lv.lvl} · ${lv.title} · Total ${xp.toLocaleString()} XP</div>
</div>`;

  $('sumExs').innerHTML = exs.map(e => `
<div class="sum-ex">
  <div class="sum-ex-n">${e.ex}</div>
  <div class="sum-ex-st">${e.sets}×${e.reps}</div>
  <div class="sum-ex-kg">${e.kg ? e.kg + 'kg' : '—'}</div>
</div>`).join('');

  // Pro insights: muscle breakdown + recovery estimation
  const proInsights = $('sumProInsights');
  if (proInsights) {
    if (Pro.can('advanced_analytics')) {
      const muscles = getWorkoutMuscles(wk);
      const rpe = +wk.rpe || 7;
      const sorted = Object.entries(muscles).sort((a, b) => b[1] - a[1]);
      const totalMVol = sorted.reduce((s, [, v]) => s + v, 0) || 1;

      let html = '<div class="sum-pro-section">';
      html += '<div class="sum-pro-title">Músculos trabajados</div>';
      html += '<div class="sum-pro-muscles">';
      sorted.forEach(([m, v]) => {
        const pct = Math.round(v / totalMVol * 100);
        const color = MC[m] || 'var(--a)';
        html += `<div class="sum-muscle-row">
          <span class="sum-muscle-dot" style="background:${color}"></span>
          <span class="sum-muscle-name">${m}</span>
          <div class="sum-muscle-bar"><div class="sum-muscle-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="sum-muscle-pct">${pct}%</span>
        </div>`;
      });
      html += '</div>';

      // Recovery estimation
      html += '<div class="sum-pro-title" style="margin-top:14px;">Recuperación estimada</div>';
      html += '<div class="sum-pro-recovery">';
      sorted.slice(0, 4).forEach(([m]) => {
        const hrs = estimateRecovery(m, muscles[m], rpe);
        const readyDate = new Date(Date.now() + hrs * 3600000);
        const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][readyDate.getDay()];
        html += `<div class="sum-rec-chip">
          <span class="sum-rec-muscle">${m}</span>
          <span class="sum-rec-time">${hrs}h → ${dayName}</span>
        </div>`;
      });
      html += '</div></div>';
      proInsights.innerHTML = html;
    } else {
      proInsights.innerHTML = `<div class="sum-pro-upsell" onclick="Pro.showUpgradeModal('advanced_analytics')">
        <span>Desbloquea análisis muscular y recuperación</span>
        <span class="sum-pro-upsell-badge">PRO</span>
      </div>`;
    }
  }

  $('summaryMode').classList.add('show');
  if (newPRs.length > 0 || exs.length >= 4) setTimeout(launchConfetti, 350);
  vib([80, 40, 200]);
}
function closeSummary() {
  $('summaryMode').classList.remove('show');
  renderDash(); goPage('dash');
}
