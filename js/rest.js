/* ══ REST ══ */
const LRC = 2 * Math.PI * 17;

/* Reproduce un triple beep ascendente cuando termina el descanso (Web Audio API).
   Funciona con auriculares Bluetooth gracias a la sesión de audio configurada en Swift/Android. */
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

/* Programa una notificación nativa de iOS con sonido para que se oiga aunque la
   pantalla esté bloqueada. Si no estamos en iOS, se ignora silenciosamente. */
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

/* "Despierta" la sesión de audio en el primer toque del usuario.
   iOS exige un gesto de usuario para activar el AudioContext. */
function unlockAudioContext() {
  try {
    if (!window._restAudioCtx) {
      window._restAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = window._restAudioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    // Tono inaudible de 0.01s para confirmar que el contexto está activo
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

  // iOS: programa una notificación nativa con sonido para que suene aunque
  // se bloquee la pantalla y la app pase a segundo plano.
  scheduleNativeRestSound(sec);

  // iOS: actualizar la Live Activity con el descanso en curso
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.startRestActivity) {
      window.webkit.messageHandlers.startRestActivity.postMessage({ sec: sec });
    }
  } catch (e) {}

  restInt = setInterval(() => {
    restLeft = restTotal - Math.floor((Date.now() - restStartWall) / 1000);
    if (restLeft <= 0) {
      stopRest();
      toast('¡Listo! 💪', 'good');
      vib([100, 60, 120]);
      playRestEndSound();   // beep en primer plano (Web Audio)
      // La notificación nativa ya habrá sonado por su cuenta si la app estaba en background
      // Auto-advance: scroll/focus al input de la siguiente serie activa,
      // o pasa al siguiente ejercicio si todas las series están hechas.
      if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
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
  cancelNativeRestSound();   // anular notificación pendiente si se salta o termina antes
  // iOS: parar el descanso en la Live Activity (lock screen)
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.stopRestActivity) {
      window.webkit.messageHandlers.stopRestActivity.postMessage({});
    }
  } catch (e) {}
}
function skipRest() {
  stopRest();
  // Saltar también dispara el auto-advance (mismo comportamiento que cuando termina solo).
  if (typeof autoAdvanceAfterRest === 'function') autoAdvanceAfterRest();
}
