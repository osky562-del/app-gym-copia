/* ══ AVISOS PUSH DESDE EL NAS ══
   Una web guardada en la pantalla de inicio se congela al bloquear el móvil, así que no puede
   avisar sola del fin del descanso. Lo hace el NAS: al empezar un descanso la web le dice cuándo
   acaba (POST /push/rest) y la API manda el aviso al servicio push del navegador en ese momento.
   El iPhone lo refleja en el Apple Watch como cualquier notificación.

   Requisitos en iPhone: iOS 16.4 o más, web añadida a la pantalla de inicio y permiso concedido
   desde un toque del usuario (botón "Activar" en Perfil). En Android/Chrome funciona también en pestaña. */
const Push = (() => {
  const K_OFF = 'ko95_pushOff';   // el usuario apagó los avisos a propósito

  const hasApi = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const nasOk = () => typeof NAS !== 'undefined' && NAS.enabled() && NAS.loggedIn();
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const t = s => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(s) : s;

  function b64ToBytes(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function registration() {
    if (!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.ready; } catch (e) { return null; }
  }

  /* Estado para la fila de Perfil. */
  async function state() {
    if (!hasApi()) {
      if (isIOS() && !standalone()) return { code: 'ios_tab', text: t('Añade la web a la pantalla de inicio para recibir avisos con el móvil bloqueado.') };
      return { code: 'unsupported', text: t('Este navegador no admite avisos.') };
    }
    if (Notification.permission === 'denied') return { code: 'denied', text: t('Permiso denegado en los ajustes del móvil.') };
    if (!nasOk()) return { code: 'no_session', text: t('Entra con tu cuenta del NAS para activar los avisos.') };
    if (localStorage.getItem(K_OFF) === '1') return { code: 'off', text: t('Desactivados.') };
    const reg = await registration();
    const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
    if (Notification.permission === 'granted' && sub) return { code: 'on', text: t('Activados: te avisará aunque el móvil esté bloqueado.') };
    return { code: 'pending', text: t('Pulsa Activar y acepta el permiso.') };
  }

  /* Pide permiso (hace falta un toque del usuario), se suscribe y guarda la suscripción en el NAS. */
  async function enable() {
    if (!hasApi()) throw new Error(t('Este navegador no admite avisos.'));
    if (!nasOk()) throw new Error(t('Entra con tu cuenta del NAS para activar los avisos.'));
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(t('Permiso denegado en los ajustes del móvil.'));
    const reg = await registration();
    if (!reg) throw new Error(t('No se pudo preparar la web para avisos. Recarga la página.'));
    const { public_key } = await NAS.api('GET', '/push/vapid-public-key');
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Clave del NAS distinta (claves regeneradas): hay que suscribirse de nuevo.
      const cur = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
      const want = b64ToBytes(public_key);
      if (cur && (cur.length !== want.length || cur.some((v, i) => v !== want[i]))) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(public_key) });
    const j = sub.toJSON();
    await NAS.api('PUT', '/push/subscription', { endpoint: j.endpoint, keys: j.keys });
    localStorage.removeItem(K_OFF);
    return true;
  }

  async function disable() {
    localStorage.setItem(K_OFF, '1');
    const reg = await registration();
    const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
    if (sub) {
      try { if (nasOk()) await NAS.api('DELETE', '/push/subscription', { endpoint: sub.endpoint }); } catch (e) {}
      try { await sub.unsubscribe(); } catch (e) {}
    }
  }

  const active = () => hasApi() && nasOk() && Notification.permission === 'granted' && localStorage.getItem(K_OFF) !== '1';

  /* Si ya hay permiso, renueva la suscripción en el NAS sin molestar (p. ej. tras entrar con la cuenta). */
  async function refresh() {
    if (!active()) return;
    try { await enable(); } catch (e) { /* sin conexión: se reintenta la próxima vez */ }
  }

  /* Aviso de prueba, inmediato. */
  async function test() {
    const r = await NAS.api('POST', '/push/test');
    return r;
  }

  /* Enganche con el descanso del modo Live. Si falla, el descanso sigue igual en pantalla. */
  function restStarted(seconds, exercise) {
    if (!active() || !(seconds > 0)) return;
    NAS.api('POST', '/push/rest', { seconds: Math.round(seconds), exercise: exercise || '' }).catch(() => {});
  }
  function restStopped() {
    if (!active()) return;
    NAS.api('DELETE', '/push/rest').catch(() => {});
  }

  /* Notificación local inmediata a través del service worker (iOS no admite new Notification). */
  async function showLocal(title, body) {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await registration();
    if (reg) reg.showNotification(title, { body: body || '', tag: 'ko95-rest', icon: 'logo.png', badge: 'logo.png' }).catch(() => {});
  }

  return { state, enable, disable, refresh, test, active, restStarted, restStopped, showLocal, hasApi, standalone, isIOS };
})();
