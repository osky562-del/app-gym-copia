/* ══════════════════════════════════════════════
   I18N — idioma Español / English
   ══════════════════════════════════════════════
   Traductor en tiempo de ejecución: recorre los nodos de texto y, si el
   texto (en español) está en el diccionario EN, lo cambia a inglés
   (guardando el original para poder revertir). No requiere etiquetar el
   HTML. El diccionario se amplía poco a poco; lo que no esté, se queda en
   español. Un MutationObserver traduce también el contenido dinámico.
   ══════════════════════════════════════════════ */
(function () {
  let lang = localStorage.getItem('ko95_lang') || 'es';

  // Diccionario español → inglés (núcleo visible de la app).
  const EN = {
    // Navegación
    'Inicio': 'Home', 'Entreno': 'Workout', 'Coach': 'Coach', 'Stats': 'Stats',
    'Historial': 'History', 'Bio Elite': 'Profile',
    // Cabeceras de sección
    'Esta semana': 'This week', 'Sesiones recientes': 'Recent sessions',
    'Insignias': 'Badges', 'Misiones': 'Missions', 'Resumen': 'Summary',
    'Grupos musculares': 'Muscle groups', 'Volumen semanal': 'Weekly volume',
    'Intensidad RPE': 'RPE intensity', 'Récords': 'Records', 'Evolución': 'Progress',
    'Balance muscular': 'Muscle balance', 'Actividad — 13 semanas': 'Activity — 13 weeks',
    'Tu plan': 'Your plan', 'Color de acento': 'Accent color', 'Tu nombre': 'Your name',
    'Peso corporal': 'Body weight', 'Estadísticas': 'Statistics', 'Idioma': 'Language',
    '💡 Para ti': '💡 For you', '💪 Fuerza estimada': '💪 Estimated strength',
    '🏆 Historial de récords': '🏆 Records history',
    // Inicio / hero
    'Nuevo entrenamiento': 'New workout', 'Planifica y empieza': 'Plan and start',
    'Exportar': 'Export', 'Restaurar': 'Restore', 'Repetir último entreno': 'Repeat last workout',
    'Mejor:': 'Best:', 'Sesiones': 'Sessions', 'Volumen': 'Volume', 'Ejercicios': 'Exercises',
    'Total': 'Total', 'Kg totales': 'Total kg', 'Hechos': 'Done',
    // Plan / entreno
    'Planifica tu entreno': 'Plan your workout', 'Empezar ▶': 'Start ▶', 'Empezar': 'Start',
    'Fecha': 'Date', 'Notas': 'Notes', 'Series': 'Sets', 'Reps': 'Reps',
    'Buscar ejercicio…': 'Search exercise…', 'Añadir ejercicio': 'Add exercise',
    'Cambiar ejercicio': 'Change exercise', '+ Añadir ejercicio': '+ Add exercise',
    '+ Serie': '+ Set', '− Serie': '− Set', '🔥 Calent.': '🔥 Warmup', 'Finalizar': 'Finish',
    'Cambiar': 'Change', 'Tipo de serie': 'Set type', 'Normal': 'Normal',
    '🔥 Calentamiento': '🔥 Warmup', '🔻 Drop set': '🔻 Drop set', '⏸ Rest-pause': '⏸ Rest-pause',
    '🔁 AMRAP': '🔁 AMRAP', '💥 Al fallo': '💥 To failure',
    // Auth / login
    'Bienvenido': 'Welcome', 'Entra en tu zona de rendimiento': 'Enter your performance zone',
    'Correo electrónico': 'Email', 'Contraseña': 'Password', 'Entrar': 'Sign in',
    'Registrarme': 'Sign up', '¿Has olvidado la contraseña?': 'Forgot your password?',
    'Recordar mis datos en este dispositivo': 'Remember me on this device',
    '¿No tienes cuenta?': "Don't have an account?", 'Regístrate': 'Sign up',
    'Continuar sin cuenta (modo local)': 'Continue without account (local mode)',
    'Crear cuenta': 'Create account', 'Nombre': 'Name',
    // Perfil / ajustes
    'Cómo usar la app': 'How to use the app', '📖 Cómo usar la app': '📖 How to use the app',
    'Guardar': 'Save', 'Cancelar': 'Cancel', 'Cerrar': 'Close', 'Finalizar Sesión (Desconectar)': 'Log out',
    'Gratuito': 'Free', 'Quizás luego': 'Maybe later',
    // Resumen post-entreno
    'Duración': 'Duration', 'Calorías': 'Calories', 'Volver al inicio 🏠': 'Back home 🏠',
    'Otro entreno ▶': 'Another workout ▶', '📲 Compartir imagen': '📲 Share image',
    // Progreso
    '🫀 Mapa muscular': '🫀 Muscle map', 'Frente': 'Front', 'Espalda': 'Back',
    'Ejercicio': 'Exercise', 'Récord': 'Record', 'Tend.': 'Trend',
    // Días
    'Domingo': 'Sunday', 'Lunes': 'Monday', 'Martes': 'Tuesday', 'Miércoles': 'Wednesday',
    'Jueves': 'Thursday', 'Viernes': 'Friday', 'Sábado': 'Saturday'
  };

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  function translateRoot(root, toEn) {
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let n; while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(node => {
        const raw = node.nodeValue;
        const key = norm(raw);
        if (!key) return;
        if (toEn) {
          if (EN[key] !== undefined && node.__es === undefined) {
            node.__es = raw;
            node.nodeValue = raw.replace(key, EN[key]);
          }
        } else if (node.__es !== undefined) {
          node.nodeValue = node.__es;
          delete node.__es;
        }
      });
    } catch (e) {}
  }

  let observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(muts => {
      if (lang !== 'en') return;
      muts.forEach(m => m.addedNodes && m.addedNodes.forEach(node => {
        if (node.nodeType === 1) translateRoot(node, true);
        else if (node.nodeType === 3) {
          const key = norm(node.nodeValue);
          if (EN[key] !== undefined && node.__es === undefined) { node.__es = node.nodeValue; node.nodeValue = node.nodeValue.replace(key, EN[key]); }
        }
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function applyLang() {
    document.documentElement.lang = lang;
    translateRoot(document.body, lang === 'en');
  }
  function setLang(l) {
    if (l === lang) return;
    lang = l;
    localStorage.setItem('ko95_lang', l);
    applyLang();
    // refrescar el estado visual del selector si existe
    const es = document.getElementById('langEs'), en = document.getElementById('langEn');
    if (es) es.classList.toggle('on', l === 'es');
    if (en) en.classList.toggle('on', l === 'en');
  }
  function getLang() { return lang; }
  function t(es) { if (lang === 'es') return es; const k = norm(es); return EN[k] !== undefined ? EN[k] : es; }

  function init() {
    startObserver();
    if (lang === 'en') applyLang();
    const es = document.getElementById('langEs'), en = document.getElementById('langEn');
    if (es) es.classList.toggle('on', lang === 'es');
    if (en) en.classList.toggle('on', lang === 'en');
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.I18N = { setLang, getLang, t, apply: applyLang };
})();
