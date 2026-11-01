/* ══ REST (paridad con LiveViewModel.kt: startRest / addRest / skipRest / notifyRestEnd) ══ */

/* Beep corto al terminar el descanso (Web Audio API). Solo si STORE.restSound !== false. */
function playRestEndSound() {
  try {
    if (!window._restAudioCtx) {
      window._restAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = window._restAudioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.5, start + 0.01);
    gain.gain.setValueAtTime(0.5, start + 0.30);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.start(start);
    osc.stop(start + 0.36);
  } catch (e) { console.warn('Audio beep failed:', e); }
}

/* Programa una notificación nativa de iOS con sonido para que se oiga aunque la
   pantalla esté bloqueada. Si no estamos en iOS, se ignora silenciosamente. */
function scheduleNativeRestSound(sec, nextUp) {
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.scheduleRestSound) {
      window.webkit.messageHandlers.scheduleRestSound.postMessage({ delay: sec, nextUp: nextUp || '' });
    }
  } catch (e) {}
}
function cancelNativeRestSound() {
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cancelRestSound) {
      window.webkit.messageHandlers.cancelRestSound.postMessage({});
    }
  } catch (e) {}
}

/* "Despierta" la sesión de audio en el primer toque del usuario.
   iOS exige un gesto de usuario para activar el AudioContext. */
function unlockAudioContext() {
  try {
    if (!window._restAudioCtx) {
      window._restAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = window._restAudioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch (e) {}
}

/* Pide permiso de notificaciones (para "¡Descanso terminado! 💪" con la pantalla apagada). */
function requestRestNotifPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch (e) {}
}

/* Aviso de fin de descanso: vibración 450 ms, beep y notificación, según ajustes (notifyRestEnd). */
function notifyRestEnd() {
  if (STORE.get('haptics') !== false && typeof vib === 'function') vib([450]);
  if (STORE.get('restSound') !== false) playRestEndSound();
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const title = (typeof I18N !== 'undefined' && I18N.t) ? I18N.t('¡Descanso terminado! 💪') : '¡Descanso terminado! 💪';
      const n = new Notification(title, { tag: 'ko95-rest', icon: 'logo.png' });
      setTimeout(() => { try { n.close(); } catch (e) {} }, 8000);
    }
  } catch (e) {}
}

let restPauseWall = 0;   // instante en que se pausó el entreno con un descanso en marcha

function startRest(sec, msg, nextUp) {
  if (!sec) return;
  stopRest();
  restTotal = sec;
  restMsg = msg || '';
  restStartWall = Date.now();
  restLeft = sec;
  restPauseWall = liveIsPaused ? Date.now() : 0;
  renderRest();
  $('lvRest').classList.add('show');

  // iOS: notificación nativa con sonido aunque se bloquee la pantalla.
  scheduleNativeRestSound(sec, nextUp);
  // iOS: actualizar la Live Activity con el descanso en curso
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.startRestActivity) {
      window.webkit.messageHandlers.startRestActivity.postMessage({ sec: sec });
    }
  } catch (e) {}

  restInt = setInterval(() => {
    if (liveIsPaused) return;   // en pausa el descanso se congela (se reanuda al seguir)
    restLeft = restTotal - Math.floor((Date.now() - restStartWall) / 1000);
    if (restLeft <= 0) {
      stopRest();
      notifyRestEnd();
      if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
      return;
    }
    renderRest();
  }, 1000);
}
function renderRest() {
  const left = Math.max(0, restLeft);
  $('lrrN').textContent = typeof fmt === 'function' ? fmt(left) : left;
  const pct = restTotal > 0 ? Math.round(left / restTotal * 100) : 0;
  $('lrrProg').style.width = pct + '%';
}
/* Compatibilidad con el bridge iOS (__onLiveActivitySync). */
function updRing() { renderRest(); }
/* Llamado por togglePause: congela / reanuda el descanso sin cancelarlo. */
function restOnPause(paused) {
  if (!restInt) return;
  if (paused) { restPauseWall = Date.now(); cancelNativeRestSound(); }
  else if (restPauseWall) {
    restStartWall += Date.now() - restPauseWall;
    restPauseWall = 0;
    scheduleNativeRestSound(Math.max(1, restLeft));
  }
}
function stopRest() {
  clearInterval(restInt); restInt = null;
  restPauseWall = 0;
  $('lvRest').classList.remove('show');
  cancelNativeRestSound();
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.stopRestActivity) {
      window.webkit.messageHandlers.stopRestActivity.postMessage({});
    }
  } catch (e) {}
}
/* Ajusta el descanso que está corriendo (−15s, +15s, +1m). Puede llegar a 0 (addRest de Android). */
function bumpRest(delta) {
  if (!restInt) return;
  const left = Math.max(0, restLeft + delta);
  restTotal = Math.max(restTotal + (left - restLeft), left);
  restStartWall = Date.now() - (restTotal - left) * 1000;
  restLeft = left;
  renderRest();
  cancelNativeRestSound();
  if (left > 0) scheduleNativeRestSound(left);
  if (typeof vib === 'function') vib([20]);
  if (left <= 0 && !liveIsPaused) {
    stopRest();
    notifyRestEnd();
    if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
  }
}
function skipRest() {
  stopRest();
  if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
}
