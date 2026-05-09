/* ══ REST ══ */
const LRC = 2 * Math.PI * 17;

/* Reproduce un triple beep ascendente cuando termina el descanso (Web Audio API).
   Funciona con auriculares Bluetooth gracias a la sesión de audio. */
function playRestEndSound() {
  try {
    if (!window._restAudioCtx) {
      window._restAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = window._restAudioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    const tones = [{ f: 880, t: 0 }, { f: 1109, t: 0.18 }, { f: 1397, t: 0.36 }];
    tones.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + t;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.5, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.start(start);
      osc.stop(start + 0.20);
    });
  } catch (e) { console.warn('Audio beep failed:', e); }
}

/* Programa una notificación nativa con sonido (solo iOS / WKWebView). */
function scheduleNativeRestSound(sec) {
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.scheduleRestSound) {
      window.webkit.messageHandlers.scheduleRestSound.postMessage({ delay: sec });
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

/* "Despierta" la sesión de audio en el primer toque del usuario (iOS exige gesto). */
function unlockAudioContext() {
  try {
    if (!window._restAudioCtx) {
      window._restAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = window._restAudioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch (e) {}
}

function startRest(sec, msg) {
  if (!sec || liveIsPaused) return;
  stopRest();
  restTotal = sec;
  restMsg = msg || 'Prepárate';
  restStartWall = Date.now();
  restLeft = sec;
  $('lrrN').textContent = sec;
  $('lvRestSub').textContent = restMsg;
  $('lvRest').classList.add('show');
  updRing();

  scheduleNativeRestSound(sec);

  restInt = setInterval(() => {
    restLeft = restTotal - Math.floor((Date.now() - restStartWall) / 1000);
    if (restLeft <= 0) {
      stopRest();
      toast('¡Listo! 💪', 'good');
      vib([100, 60, 120]);
      playRestEndSound();
      return;
    }
    $('lrrN').textContent = restLeft;
    updRing();
  }, 1000);
}
function updRing() { $('lrrProg').style.strokeDashoffset = LRC * (1 - restLeft / restTotal); }
function stopRest() {
  clearInterval(restInt); restInt = null;
  $('lvRest').classList.remove('show');
  cancelNativeRestSound();
}
function skipRest() { stopRest(); }
