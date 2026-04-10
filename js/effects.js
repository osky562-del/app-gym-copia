/* ══ CONFETTI ══ */
function launchConfetti(n = 55) {
  const colors = ['#4f8cff', '#2dd98a', '#ffa040', '#a57aff', '#ff6eb4', '#ffd060', '#ff453a'];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'cfp';
    const size = 6 + Math.random() * 7;
    el.style.cssText = [
      `left:${Math.random() * 100}vw`,
      `top:${-10 - Math.random() * 40}px`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `width:${size}px`,
      `height:${size}px`,
      `border-radius:${Math.random() > .5 ? '50%' : '2px'}`,
      `animation-duration:${1.6 + Math.random() * 2}s`,
      `animation-delay:${Math.random() * 0.7}s`,
    ].join(';');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
}


/* ══ AMBIENT PARTICLES ══ */
(function spawnParticles() {
  const container = document.body;
  setInterval(() => {
    if (document.hidden) return;
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.bottom = '-4px';
    p.style.animationDuration = (6 + Math.random() * 8) + 's';
    p.style.animationDelay = Math.random() * 2 + 's';
    p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
    container.appendChild(p);
    setTimeout(() => p.remove(), 16000);
  }, 2500);
})();
