/* ══ REST ══ */
const LRC = 2 * Math.PI * 17;
function startRest(sec, msg) { if (!sec || liveIsPaused) return; stopRest(); restTotal = sec; restMsg = msg || 'Prepárate'; restStartWall = Date.now(); restLeft = sec; $('lrrN').textContent = sec; $('lvRestSub').textContent = restMsg; $('lvRest').classList.add('show'); updRing(); restInt = setInterval(() => { restLeft = restTotal - Math.floor((Date.now() - restStartWall) / 1000); if (restLeft <= 0) { stopRest(); toast('¡Listo! 💪', 'good'); vib([100, 60, 120]); return; } $('lrrN').textContent = restLeft; updRing(); }, 1000); }
function updRing() { $('lrrProg').style.strokeDashoffset = LRC * (1 - restLeft / restTotal); }
function stopRest() { clearInterval(restInt); restInt = null; $('lvRest').classList.remove('show'); }
function skipRest() { stopRest(); }
