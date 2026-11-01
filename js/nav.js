/* ══ NAV ══ */
/* Entreno es una pestaña más, como en las apps: al cambiar de pestaña el plan se conserva. */
function openPlanTab() {
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('on'));
  const t = $('t-add'); if (t) t.classList.add('on');
  if (planExs.length) { $('planMode').classList.add('show'); return; }
  openPlan();
}
/* Desde Entreno, abre el generador de rutinas (está al final del Coach). */
function openPlanGenerator() {
  goPage('ai');
  setTimeout(() => { const b = $('btnGenRutina'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
}
function goPage(p) {
  const pm = $('planMode'); if (pm) pm.classList.remove('show');
  document.querySelectorAll('.page').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('on'));
  const map = { dash: 'pageDash', awards: 'pageAwards', prog: 'pageProg', hist: 'pageHist', profile: 'pageProf', ai: 'pageAI' };
  if (map[p]) { const el = $(map[p]); if (el) el.classList.add('on'); }
  // Coach cuelga de Inicio y Logros de Progreso, como en las apps.
  const t = $('t-' + ({ ai: 'dash', awards: 'prog' }[p] || p)); if (t) t.classList.add('on');
  $('mainScroll').scrollTop = 0;
  if (p === 'prog') renderProgress();
  if (p === 'hist') renderHist();
  if (p === 'dash') { renderDash(); updateXpBar(); }
  if (p === 'profile') { renderProfile(); if (typeof Admin !== 'undefined') Admin.onProfileVisible(); }
  if (p === 'ai') { loadPerfil(); updateAiUsageBadge(); }
  if (p === 'awards') renderAwards();
}
