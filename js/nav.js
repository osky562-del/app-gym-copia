/* ══ NAV ══ */
function goPage(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('on'));
  const map = { dash: 'pageDash', awards: 'pageAwards', prog: 'pageProg', hist: 'pageHist', profile: 'pageProf', ai: 'pageAI' };
  if (map[p]) { const el = $(map[p]); if (el) el.classList.add('on'); }
  const t = $('t-' + p); if (t) t.classList.add('on');
  $('mainScroll').scrollTop = 0;
  if (p === 'prog') renderProgress();
  if (p === 'hist') renderHist();
  if (p === 'dash') { renderDash(); updateXpBar(); }
  if (p === 'profile') renderProfile();
  if (p === 'ai') { loadPerfil(); updateAiUsageBadge(); }
  if (p === 'awards') renderAwards();
}
