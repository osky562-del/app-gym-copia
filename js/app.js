/* ══ KO95FIT — App Entry Point ══ */

/* Apply saved accent */
applyAccent(STORE.get('accent') || 'red');

/* Chart.js improved defaults */
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(28,28,34,.98)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,.12)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 9;
Chart.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono',monospace", size: 11, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono',monospace", size: 11 };
Chart.defaults.animation.duration = 550;
Chart.defaults.animation.easing = 'easeOutQuart';

/* ══ INIT ══ */
updateGreeting();
renderDash();
updateXpBar();
Pro.renderProBadges();

/* Restaurar entreno interrumpido */
(function checkSavedSession() {
  const saved = STORE.get('live_session');
  if (saved && saved.liveExs && saved.liveExs.length > 0) {
    if (confirm('Tienes un entreno en curso. ¿Continuar donde lo dejaste?')) {
      restoreLiveSession(saved);
    } else {
      STORE.set('live_session', null);
    }
  }
})();
