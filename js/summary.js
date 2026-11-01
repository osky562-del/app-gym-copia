/* ══ POST-WORKOUT SUMMARY (SummaryOverlay de LiveScreen.kt:643-713) ══ */
function showSummary(wk, xpGained, newPRs) {
  window.__lastSummaryWk = wk;   // para el botón "Compartir imagen"
  const t = (es) => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(es) : es;
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const exs = wk.exercises || [];
  const name = (wk.name || '').trim();
  $('sumTitle').textContent = name ? name + ' ✓' : t('Entreno completado');
  const totalSets = exs.reduce((s, e) => s + (+e.sets || 0), 0);
  const totalVol = exs.reduce((s, e) => s + (+e.kg || 0) * Math.max(1, +e.sets || 1) * Math.max(1, +e.reps || 1), 0);
  const dur = (+wk.duration || 0) + 'min';
  const cal = wk.calories != null ? wk.calories : (+wk.duration || 0) * 6;

  $('sumStats').innerHTML = [
    { v: dur, l: 'Duración' },
    { v: exs.length, l: 'Ejercicios' },
    { v: totalSets, l: 'Series' },
    { v: big(totalVol) + 'kg', l: 'Volumen' },
    { v: cal, l: 'Calorías' },
  ].map(s => `<div class="sum-stat"><div class="sum-stat-v">${s.v}</div><div class="sum-stat-l">${t(s.l)}</div></div>`).join('');

  const prs = newPRs || [];
  $('sumPR').innerHTML = prs.length ? `<div class="sum-pr">
  <div class="sum-pr-t">${prs.length} ${t('récords personales 🏆')}</div>
  ${prs.slice(0, 5).map(p => `<div class="sum-pr-s">${esc(p)}</div>`).join('')}
</div>` : '';

  $('sumXP').textContent = `+${xpGained} ${t('XP ganados')}`;

  const conCuenta = typeof NAS !== 'undefined' && NAS.enabled && NAS.enabled() && NAS.loggedIn && NAS.loggedIn();
  const saved = $('sumSaved');
  saved.textContent = conCuenta ? t('Guardado en el móvil · se copia al NAS') : t('Guardado en este dispositivo');
  saved.classList.toggle('ok', !!conCuenta);

  $('summaryMode').classList.add('show');
  setTimeout(launchConfetti, 350);   // confeti siempre, como Android
  vib([80, 40, 200]);
}
function closeSummary() {
  $('summaryMode').classList.remove('show');
  renderDash(); goPage('dash');
}
