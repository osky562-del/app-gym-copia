/* ══ REST ══ */
const LRC = 2 * Math.PI * 17;
function startRest(sec, msg) { if (!sec || liveIsPaused) return; stopRest(); restLeft = restTotal = sec; $('lrrN').textContent = sec; $('lvRestSub').textContent = msg || 'Prepárate'; $('lvRest').classList.add('show'); updRing(); restInt = setInterval(() => { restLeft--; $('lrrN').textContent = restLeft; updRing(); if (restLeft <= 0) { stopRest(); toast('¡Listo! 💪', 'good'); vib([100, 60, 120]); } }, 1000); }
function updRing() { $('lrrProg').style.strokeDashoffset = LRC * (1 - restLeft / restTotal); }
function stopRest() { clearInterval(restInt); restInt = null; $('lvRest').classList.remove('show'); }
function skipRest() { stopRest(); }
