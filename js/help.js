/* ══════════════════════════════════════════════
   AYUDA — "Ayuda y guía" (paridad con HelpScreen.kt de Android)
   ══════════════════════════════════════════════
   openHelp(): abre la guía a pantalla completa. 16 secciones en acordeón (una abierta a la vez),
   en el idioma actual (I18N). Pie: "KO95FIT PRO · Hardcore Training System".
   ══════════════════════════════════════════════ */
(function () {
  // [títuloES, títuloEN, [líneasES], [líneasEN]] — copiado de HelpScreen.kt
  const SECTIONS = [
    ['🚀 Empezar', '🚀 Get started',
      ['Crea tu cuenta con email y contraseña, o entra si ya la tienes. Tus entrenos se guardan en la nube y se sincronizan en todos tus dispositivos.',
        'También puedes usar el «modo local» (sin cuenta): los datos se guardan solo en este móvil.',
        'La primera vez verás un tour interactivo: pulsa los botones resaltados y te enseña la app paso a paso.',
        'En Perfil rellena nombre, peso, altura, sexo y objetivo: se usan para el Coach, tu nivel de fuerza y los cálculos.'],
      ['Create your account with email and password, or sign in if you already have one. Your workouts are saved to the cloud and sync across devices.',
        'You can also use «local mode» (no account): data is saved only on this phone.',
        "The first time you'll see an interactive tour: tap the highlighted buttons and it walks you through the app.",
        'In Profile fill in name, weight, height, sex and goal: used for the Coach, your strength level and calculations.']],
    ['📋 Planificar un entreno', '📋 Plan a workout',
      ['Pulsa Entreno. Busca un ejercicio por nombre y añádelo con +.',
        'Con el buscador vacío aparecen tus ★ favoritos y 🕐 recientes, con el último peso usado. Toca la ★ para marcar favorito.',
        'Plantillas rápidas: rutinas listas (Pecho y tríceps, Espalda y bíceps, Piernas, Hombro).',
        'Copiar sesión anterior, o 🔁 Repetir último desde el inicio: repite un entreno tal cual.',
        'Ajusta series, reps, kg y descanso de cada ejercicio. Reordena con las flechas ↑↓.',
        '📖 en cada ejercicio abre el vídeo de la técnica con los pasos.'],
      ['Tap Workout. Search an exercise by name and add it with +.',
        'With the search empty you get your ★ favorites and 🕐 recents, with the last weight used. Tap the ★ to favorite.',
        'Quick templates: ready routines (Chest & triceps, Back & biceps, Legs, Shoulders).',
        'Copy previous session, or 🔁 Repeat last from home: repeat a workout as-is.',
        'Adjust sets, reps, kg and rest for each exercise. Reorder with ↑↓.',
        '📖 on each exercise opens the technique video with the steps.']],
    ['✦ Generar rutina', '✦ Generate routine',
      ['Pulsa «Generar rutina», elige los días por semana, el enfoque (hipertrofia, fuerza, pérdida de grasa, resistencia) y el equipamiento.',
        'La app crea una rutina según tu nivel, tu objetivo y tus molestias, usando solo ejercicios que ya has hecho.',
        '💾 Guarda todos los días en «Mis rutinas» para entrenar la semana entera, o «Usar ahora» un día concreto.',
        'Tus rutinas guardadas salen como atajos en Planificar; tócalos para cargarlos.',
        'Cada ~2 semanas la app te recomienda variar la rutina para seguir progresando.'],
      ['Tap «Generate routine», choose days per week, focus (hypertrophy, strength, fat loss, endurance) and equipment.',
        'The app builds a routine from your level, goal and aches, using only exercises you have already done.',
        '💾 Save all days to «My routines» to train the whole week, or «Use now» a single day.',
        'Your saved routines appear as shortcuts in Plan; tap them to load them.',
        'Every ~2 weeks the app recommends changing your routine to keep progressing.']],
    ['🏃 Cardio', '🏃 Cardio',
      ['Busca y añade cardios como Cinta de correr, Bicicleta elíptica/estática, Remo, Saltar a la cuerda o Escaladora: todos con vídeo.',
        'Los cardios entran con sus propios parámetros: bloques, minutos y kilómetros (en vez de kg/reps).',
        'También puedes marcar 🏃 en cualquier ejercicio para convertirlo en cardio.'],
      ['Search and add cardio like Treadmill, Elliptical/Stationary bike, Rowing, Jump rope or Stairmaster: all with video.',
        'Cardio uses its own parameters: blocks, minutes and kilometers (instead of kg/reps).',
        'You can also mark 🏃 on any exercise to turn it into cardio.']],
    ['🔗 Superseries', '🔗 Supersets',
      ['En el plan, pulsa 🔗 de un ejercicio para encadenarlo con el de arriba (se ponen morados).',
        'Al entrenar harás una serie de A y saltarás a B sin descanso; el descanso solo llega tras el último del grupo.'],
      ['In the plan, tap 🔗 on an exercise to chain it with the one above (they turn purple).',
        'When training you do a set of A then jump to B with no rest; rest only comes after the last in the group.']],
    ['🎯 Esfuerzo (RPE)', '🎯 Effort (RPE)',
      ['Antes de empezar puedes elegir RPE Auto o Manual.',
        'Auto: la app calcula tu esfuerzo según el % de tu 1RM en cada serie completada.',
        'Manual: lo eliges tú del 1 al 10.'],
      ['Before starting you can choose RPE Auto or Manual.',
        'Auto: the app computes your effort from the %1RM on each completed set.',
        'Manual: you pick it from 1 to 10.']],
    ['🏋️ Entrenar (modo Live)', '🏋️ Train (Live mode)',
      ['Pulsa Empezar. Verás un ejercicio cada vez con sus series.',
        'Haz la serie, escribe kg/reps y pulsa ✓. El descanso arranca solo y al acabar salta a la siguiente.',
        'Memoria por serie: cada serie aparece con el peso y reps de la última vez.',
        '🔥 añade una serie de calentamiento (no cuenta para volumen ni récords).',
        '📖 muestra el vídeo de la técnica. 🧮 abre la calculadora de discos (qué poner en la barra).',
        '🎵 controla tu música (Spotify) sin salir del entreno.',
        'Al terminar pulsa Finalizar: verás el resumen con XP, calorías y récords, con confeti 🎉.'],
      ["Tap Start. You'll see one exercise at a time with its sets.",
        'Do the set, type kg/reps and tap ✓. Rest starts on its own and jumps to the next when done.',
        'Per-set memory: each set shows the weight and reps from last time.',
        "🔥 adds a warm-up set (doesn't count toward volume or records).",
        '📖 shows the technique video. 🧮 opens the plate calculator (what to load on the bar).',
        '🎵 control your music (Spotify) without leaving the workout.',
        'When you finish tap Finish: summary with XP, calories and records, with confetti 🎉.']],
    ['🏷️ Tipos de serie', '🏷️ Set types',
      ['Toca el número de una serie para marcar su tipo (Pro):',
        '🔥 Calentamiento: serie suave previa. No cuenta para volumen ni récords.',
        '🔻 Drop set: bajas el peso y sigues sin descanso.',
        '⏸ Rest-pause: pausas muy cortas (10-15s) con el mismo peso.',
        '🔁 AMRAP: las máximas repeticiones con buena técnica.',
        '💥 Al fallo: hasta que no puedas hacer ni una rep más.'],
      ["Tap a set's number to mark its type (Pro):",
        "🔥 Warm-up: a light prep set. Doesn't count toward volume or records.",
        '🔻 Drop set: lower the weight and keep going without rest.',
        '⏸ Rest-pause: very short pauses (10-15s) with the same weight.',
        '🔁 AMRAP: as many reps as possible with good form.',
        "💥 To failure: until you can't do one more rep."]],
    ['🎵 Música (Spotify)', '🎵 Music (Spotify)',
      ['En el inicio y en el entreno hay un control de música.',
        'Pulsa «Conectar» una vez para dar acceso a notificaciones: así la app puede leer y controlar lo que suena.',
        'Verás la canción actual con play/pausa, anterior y siguiente, sin salir del entreno.',
        'Funciona con Spotify y cualquier reproductor.'],
      ["On home and in the workout there's a music control.",
        'Tap «Connect» once to grant notification access: then the app can read and control what\'s playing.',
        "You'll see the current track with play/pause, previous and next, without leaving the workout.",
        'Works with Spotify and any media player.']],
    ['📊 Progreso', '📊 Progress',
      ['Volumen de tus últimas semanas y mapa de actividad (calendario).',
        'Distribución por grupo muscular y 🫀 mapa muscular (frente y espalda) que se ilumina según lo que trabajas.',
        'Radar de balance muscular: detecta si descuidas algún grupo.',
        '💪 Fuerza estimada: tu 1RM por ejercicio y tu nivel por levantamiento (Novato → Élite) según tu peso corporal.',
        'Récords recientes: cada vez que subes tu máximo de peso.'],
      ['Volume across your recent weeks and activity heatmap (calendar).',
        'Per-muscle-group distribution and 🫀 muscle map (front and back) that lights up by what you train.',
        'Muscle balance radar: spots any group you neglect.',
        '💪 Estimated strength: your 1RM per exercise and your level per lift (Novice → Elite) based on your body weight.',
        'Recent records: every time you raise your max weight.']],
    ['💡 Inicio', '💡 Home',
      ['Tu racha, tu nivel y XP, y cuántas semanas llevas progresando.',
        '✨ Para ti: tarjetas inteligentes con tus tendencias (volumen vs el mes pasado, tu fuerza subiendo, tu grupo estrella, tu racha).',
        '🤖 Coach: análisis y consejos personalizados según tu perfil y tus entrenos hechos.',
        '🏅 Logros: insignias y objetivos que vas desbloqueando.',
        '🪫 Semana de descarga (deload): si llevas semanas fuerte, la app te recomienda bajar la carga para recuperar.'],
      ["Your streak, your level and XP, and how many weeks you've been progressing.",
        '✨ For you: smart cards with your trends (volume vs last month, your strength rising, your star group, your streak).',
        '🤖 Coach: analysis and advice tailored to your profile and completed workouts.',
        '🏅 Achievements: badges and milestones you unlock.',
        "🪫 Deload week: if you've trained hard for weeks, the app suggests lowering the load to recover."]],
    ['⭐ Plan Pro', '⭐ Pro plan',
      ['Free incluye lo básico (hasta 5 entrenos guardados, 1 consulta de Coach a la semana, color rojo o azul).',
        'Pro desbloquea: entrenos ilimitados, generador de rutinas, Coach ilimitado, analíticas avanzadas (mapa muscular, balance, fuerza, récords), tipos de serie, todos los colores y más.',
        'Cámbiate desde Perfil → «Hazte PRO».'],
      ['Free includes the basics (up to 5 saved workouts, 1 Coach query per week, red or blue color).',
        'Pro unlocks: unlimited workouts, routine generator, unlimited Coach, advanced analytics (muscle map, balance, strength, records), set types, all colors and more.',
        'Upgrade from Profile → «Go PRO».']],
    ['👤 Perfil y personalización', '👤 Profile & personalization',
      ['Cambia tu nombre de usuario y el idioma (español / inglés).',
        '🎨 Color de la app: elige el acento y toda la interfaz se recolorea a tu gusto.',
        'Registra tu peso corporal para ver su evolución y calcular tu nivel de fuerza.',
        'Conecta con la app de Salud (Health Connect) para exportar tus entrenos.'],
      ['Change your username and the language (Spanish / English).',
        '🎨 App color: pick the accent and the whole interface recolors to your taste.',
        'Log your body weight to see its evolution and compute your strength level.',
        'Connect to Health Connect to export your workouts.']],
    ['📲 Compartir', '📲 Share',
      ['Al terminar un entreno pulsa 📲 Compartir imagen para generar una tarjeta con tu resumen y compartirla o guardarla.'],
      ['When you finish a workout tap 📲 Share image to generate a card with your summary and share or save it.']],
    ['⌚ Reloj (Wear OS)', '⌚ Watch (Wear OS)',
      ['Cuando acaba el descanso te llega un aviso al reloj diciendo qué serie/ejercicio toca.',
        'Pulsa ✓ Hecho en el reloj para marcar la serie y avanzar sin sacar el móvil.',
        'Requiere el reloj emparejado con la misma app instalada.'],
      ['When rest ends you get a prompt on the watch telling you which set/exercise is next.',
        'Tap ✓ Done on the watch to mark the set and advance without grabbing your phone.',
        'Requires the watch paired with the same app installed.']],
    ['💡 Trucos', '💡 Tips',
      ['Si entrenas sin descanso, al marcar la serie igualmente avanza sola.',
        'Tus entrenos se sincronizan solos; si borras uno, se borra también de la nube.',
        'Toca la ★ junto a un ejercicio para marcarlo como favorito.',
        'Vuelve a esta guía cuando quieras desde Perfil → «Ayuda y guía».'],
      ['If you train with no rest, marking the set still advances on its own.',
        'Your workouts sync automatically; deleting one also deletes it from the cloud.',
        'Tap the ★ next to an exercise to mark it as a favorite.',
        'Come back to this guide anytime from Profile → «Help & Guide».']],
  ];

  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  function ensureDOM() {
    if (document.getElementById('helpModal')) return;
    const style = document.createElement('style');
    style.id = 'helpStyle';
    style.textContent = `
      .hlp-ov{display:none;position:fixed;inset:0;background:var(--bg,#0a0a0a);z-index:1001;flex-direction:column;}
      .hlp-ov.on{display:flex;}
      .hlp-hd{display:flex;align-items:center;gap:6px;padding:max(12px,env(safe-area-inset-top)) 16px 4px 4px;}
      .hlp-back{min-width:44px;min-height:44px;background:none;border:none;color:var(--t1,#fff);font-size:1.6rem;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .hlp-hd-t{font-size:1.35rem;font-weight:700;color:var(--t1,#fff);}
      .hlp-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px max(40px,env(safe-area-inset-bottom));}
      .hlp-sec{background:var(--s2,#16161b);border-radius:14px;margin:5px 0;overflow:hidden;}
      .hlp-sec-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
      .hlp-sec-t{font-size:.95rem;font-weight:700;color:var(--t1,#fff);}
      .hlp-sec-pm{color:var(--t3,#9a9aa3);font-size:1.25rem;font-weight:700;}
      .hlp-sec-c{display:none;padding:0 16px 16px;}
      .hlp-sec.open .hlp-sec-c{display:block;}
      .hlp-li{display:flex;gap:6px;padding:4px 0;font-size:.82rem;line-height:1.5;color:var(--t3,#9a9aa3);}
      .hlp-li b{color:var(--a,#ff3b30);font-weight:400;flex-shrink:0;}
      .hlp-foot{text-align:center;color:var(--t3,#9a9aa3);font-size:.7rem;padding:28px 16px 16px;}
    `;
    document.head.appendChild(style);
    const m = document.createElement('div');
    m.className = 'hlp-ov'; m.id = 'helpModal';
    document.body.appendChild(m);
  }

  function render() {
    const en = (typeof I18N !== 'undefined' && I18N.getLang() === 'en');
    const m = document.getElementById('helpModal');
    m.innerHTML = `
      <div class="hlp-hd"><button class="hlp-back" onclick="closeHelp()" aria-label="back">‹</button><div class="hlp-hd-t">${en ? 'Help & Guide' : 'Ayuda y guía'}</div></div>
      <div class="hlp-body" id="helpBody">
        ${SECTIONS.map((s, i) => `<div class="hlp-sec${i === 0 ? ' open' : ''}">
          <div class="hlp-sec-h" onclick="toggleHelpSec(this.parentNode)"><div class="hlp-sec-t">${esc(en ? s[1] : s[0])}</div><div class="hlp-sec-pm">${i === 0 ? '−' : '+'}</div></div>
          <div class="hlp-sec-c">${(en ? s[3] : s[2]).map(l => `<div class="hlp-li"><b>•</b><span>${esc(l)}</span></div>`).join('')}</div>
        </div>`).join('')}
        <div class="hlp-foot">KO95FIT PRO · Hardcore Training System</div>
      </div>`;
  }
  function toggleHelpSec(sec) {
    const body = document.getElementById('helpBody'); if (!body) return;
    const wasOpen = sec.classList.contains('open');
    body.querySelectorAll('.hlp-sec').forEach(s => { s.classList.remove('open'); const pm = s.querySelector('.hlp-sec-pm'); if (pm) pm.textContent = '+'; });
    if (!wasOpen) { sec.classList.add('open'); const pm = sec.querySelector('.hlp-sec-pm'); if (pm) pm.textContent = '−'; }
  }
  function openHelp() { ensureDOM(); render(); document.getElementById('helpModal').classList.add('on'); const b = document.getElementById('helpBody'); if (b) b.scrollTop = 0; }
  function closeHelp() { const m = document.getElementById('helpModal'); if (m) m.classList.remove('on'); }
  window.openHelp = openHelp;
  window.closeHelp = closeHelp;
  window.toggleHelpSec = toggleHelpSec;
})();
