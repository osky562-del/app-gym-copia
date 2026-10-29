/* ══ COACH SIN IA (motor local basado en evidencia) ══
   Port de EvidenceCoach.kt (Android) / EvidenceCoach.swift (iOS): misma logica en las tres apps.
   Genera rutinas y consejos a partir del historial y el perfil, sin red ni creditos.

   Los umbrales codifican recomendaciones publicadas (simplificacion practica, no un diagnostico):
    - Volumen: >=10 series/semana por grupo se asocia a mas hipertrofia (Schoenfeld, Ogborn y Krieger 2017).
    - Frecuencia: 2 veces/semana por grupo supera a 1 (Schoenfeld, Ogborn y Krieger 2016).
    - Rangos de repeticiones por objetivo (ACSM 2009; Schoenfeld et al. 2021).
    - Descansos largos en basicos (Schoenfeld et al. 2016).
    - Proteina 1,6-2,2 g/kg/dia (Morton et al. 2018).
    - Ritmo de perdida 0,5-1 % del peso/semana (Helms et al. 2014).
    - Sueno >=7 h (Watson et al. 2015). */
(function () {
  const LEVELS = ['novato', 'principiante', 'intermedio', 'avanzado', 'elite'];
  const LEVEL_ES = { novato: 'Novato', principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado', elite: 'Élite' };

  const AREA = {
    pecho: { es: 'pecho', major: true }, espalda: { es: 'espalda', major: true }, hombros: { es: 'hombros', major: true },
    cuadriceps: { es: 'cuádriceps', major: true }, posterior: { es: 'isquios y glúteos', major: true },
    biceps: { es: 'bíceps', major: false }, triceps: { es: 'tríceps', major: false },
    gemelos: { es: 'gemelos', major: false }, core: { es: 'core', major: false },
  };
  const MAJOR = Object.keys(AREA).filter(a => AREA[a].major);

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function has(n, words) { return words.some(w => n.includes(w)); }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); }

  function goalOf(text) {
    const n = norm(text);
    if (has(n, ['fuerza', 'strength'])) return 'fuerza';
    if (has(n, ['grasa', 'perd', 'defin', 'adelg', 'fat', 'lose'])) return 'grasa';
    if (has(n, ['resist', 'endur'])) return 'resistencia';
    return 'hipertrofia';
  }

  function fineGroup(primary) {
    switch (norm(primary)) {
      case 'pecho': return 'pecho';
      case 'dorsales': return 'dorsal';
      case 'espalda media': case 'espalda': return 'espaldaMedia';
      case 'hombros': return 'hombro';
      case 'biceps': return 'biceps';
      case 'triceps': return 'triceps';
      case 'cuadriceps': case 'piernas': return 'cuads';
      case 'isquiotibiales': return 'isquios';
      case 'gluteos': return 'gluteos';
      case 'gemelos': return 'gemelos';
      case 'abdominales': return 'core';
      case 'lumbar': return 'lumbar';
      case 'trapecios': return 'trapecio';
      default: return 'otro';
    }
  }
  function areaOf(g) {
    switch (g) {
      case 'pecho': return 'pecho';
      case 'dorsal': case 'espaldaMedia': case 'trapecio': return 'espalda';
      case 'hombro': return 'hombros';
      case 'biceps': return 'biceps';
      case 'triceps': return 'triceps';
      case 'cuads': return 'cuadriceps';
      case 'isquios': case 'gluteos': case 'lumbar': return 'posterior';
      case 'gemelos': return 'gemelos';
      case 'core': return 'core';
      default: return null;
    }
  }
  /* Grupo por palabras clave para ejercicios con nombre propio (no estan en la base). */
  function keywordGroup(name) {
    const n = norm(name);
    if (has(n, ['banca', 'inclinado', 'apertura', 'pec ', 'contractora', 'cruce de poleas', 'flexiones'])) return 'pecho';
    if (has(n, ['dominada', 'jalon', 'pull-over', 'pullover'])) return 'dorsal';
    if (has(n, ['remo', 'encogimiento'])) return 'espaldaMedia';
    if (has(n, ['peso muerto', 'rumano', 'femoral', 'buenos dias'])) return 'isquios';
    if (has(n, ['hip thrust', 'gluteo', 'abductor', 'puente'])) return 'gluteos';
    if (has(n, ['sentadilla', 'prensa', 'zancada', 'estocada', 'cuadriceps', 'extensiones de piernas', 'bulgara'])) return 'cuads';
    if (has(n, ['gemelo', 'pantorrilla'])) return 'gemelos';
    if (has(n, ['militar', 'hombro', 'lateral', 'frontal', 'pajaro', 'arnold', 'face pull'])) return 'hombro';
    if (has(n, ['curl', 'bicep'])) return 'biceps';
    if (has(n, ['tricep', 'frances', 'fondos'])) return 'triceps';
    if (has(n, ['crunch', 'plancha', 'abdominal', 'rueda', 'elevacion de piernas'])) return 'core';
    return null;
  }

  function isCompound(name) {
    const n = norm(name);
    if (has(n, ['frances', 'triceps acostado', 'brazos rectos'])) return false;
    return has(n, ['press', 'sentadilla', 'peso muerto', 'remo', 'dominadas', 'jalon al pecho', 'fondos',
      'estocada', 'zancada', 'prensa', 'flexiones', 'buenos dias', 'hip thrust', 'subidas al cajon']);
  }

  function equipmentOk(equipment, equipo) {
    const eq = norm(equipment);
    const none = !eq || eq === 'null';
    switch (norm(equipo)) {
      case 'peso corporal': return eq.includes('peso corporal') || none;
      case 'mancuernas': case 'casa': return eq.includes('mancuerna') || eq.includes('peso corporal') || eq.includes('kettlebell') || none;
      default: return true;
    }
  }

  /* Palabras clave (sin acentos) de ejercicios a EVITAR por zona dolorida. */
  const PAIN_AVOID = {
    'hombro': ['press de hombros', 'press militar', 'press arnold', 'press sentado', 'fondos', 'remo al menton', 'frontal', 'press de banca agarre ancho', 'push press'],
    'codo': ['frances', 'triceps acostado', 'extension de triceps', 'fondos', 'curl predicador', 'press de banca agarre cerrado'],
    'muneca': ['curl de muneca', 'flexiones', 'press frances', 'curl con barra'],
    'espalda baja': ['peso muerto', 'rack pull', 'buenos dias', 'remo con barra', 'remo inclinado', 'hiperextensiones', 'sentadilla con barra', 'sentadilla profunda', 'sentadilla frontal'],
    'rodilla': ['sentadilla', 'estocada', 'zancada', 'extensiones de cuadriceps', 'subidas al cajon', 'saltar'],
    'cadera': ['peso muerto', 'estocada', 'zancada', 'buenos dias', 'sentadilla profunda'],
    'cuello': ['encogimiento', 'remo al menton', 'press militar', 'remo vertical'],
    'tobillo': ['gemelos', 'pantorrillas', 'saltar', 'estocada', 'zancada'],
  };
  function painBlocks(name, pains) {
    const n = norm(name);
    return pains.some(p => p.severidad >= 3 && has(n, PAIN_AVOID[norm(p.zona)] || []));
  }

  /* La web guarda las molestias como texto libre en el perfil ("lesiones"): se detectan las zonas. */
  function painsFromText(text) {
    const n = norm(text);
    if (!n || n === 'ninguna') return [];
    const map = [['hombro', 'Hombro'], ['codo', 'Codo'], ['muneca', 'Muñeca'], ['lumbar', 'Espalda baja'], ['espalda baja', 'Espalda baja'],
      ['rodilla', 'Rodilla'], ['cadera', 'Cadera'], ['cuello', 'Cuello'], ['cervical', 'Cuello'], ['tobillo', 'Tobillo']];
    const out = [];
    map.forEach(([k, zona]) => { if (n.includes(k) && !out.some(p => p.zona === zona)) out.push({ zona, severidad: 3 }); });
    return out;
  }

  /* Nivel: el que puso el usuario en su perfil, con techo por experiencia (no se es avanzado con
     pocos entrenos). Mismo techo que las apps nativas. */
  function levelOf(perfilNivel, sessions) {
    const cap = sessions < 8 ? 0 : sessions < 20 ? 1 : sessions < 50 ? 2 : sessions < 100 ? 3 : 4;
    const want = { principiante: 1, intermedio: 2, avanzado: 3, elite: 4 }[norm(perfilNivel)];
    return LEVELS[want == null ? cap : Math.min(want, cap)];
  }

  // ── Historial ──
  function db() { return (window.EXERCISES_DB || []); }
  function nameIndex() {
    const m = {};
    db().forEach(ex => (ex.old || []).forEach(o => { if (!m[o]) m[o] = ex; }));
    db().forEach(ex => { m[ex.name] = ex; });
    return m;
  }
  function isCardioEntry(e) { return !!(e.isCardio || e.cardio); }
  function hardSets(e) {
    if (Array.isArray(e.setsDetail) && e.setsDetail.length) return e.setsDetail.filter(s => !s.warmup).length;
    return Math.max(+e.sets || 0, 0);
  }
  function epley(kg, reps) { return kg <= 0 ? 0 : kg * (1 + Math.min(Math.max(reps || 1, 1), 15) / 30); }
  function best1RM(e) {
    if (Array.isArray(e.setsDetail) && e.setsDetail.length) {
      let b = 0;
      e.setsDetail.forEach(s => { if (!s.warmup) b = Math.max(b, epley(parseFloat(String(s.kg || '').replace(',', '.')) || 0, +s.reps || 0)); });
      return b;
    }
    return epley(+e.kg || 0, +e.reps || 0);
  }
  function parseDay(d) { const t = new Date(String(d) + 'T00:00:00'); return isNaN(t) ? null : t; }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function streakOf(workouts) {
    const days = [...new Set(workouts.map(w => w.date))].sort().reverse();
    let s = 0, cur = new Date(); cur.setHours(0, 0, 0, 0);
    for (const x of days) { const wd = parseDay(x); if (!wd) continue; if (daysBetween(wd, cur) <= 1) { s++; cur = wd; } else break; }
    return s;
  }

  function stats(workouts, today) {
    today = today || new Date(); today.setHours(0, 0, 0, 0);
    const byName = nameIndex();
    const dated = workouts.map(w => ({ d: parseDay(w.date), w })).filter(x => x.d).sort((a, b) => a.d - b.d);
    const recent = dated.filter(x => { const k = daysBetween(x.d, today); return k >= 0 && k <= 27; });

    const sets = {};
    recent.forEach(({ w }) => (w.exercises || []).forEach(e => {
      if (isCardioEntry(e)) return;
      const ex = byName[e.ex];
      const g = ex ? fineGroup((ex.primaryMuscles || [])[0]) : keywordGroup(e.ex);
      const a = g && areaOf(g);
      if (a) sets[a] = (sets[a] || 0) + hardSets(e);
    }));
    const weeklySets = {};
    Object.keys(sets).forEach(a => { weeklySets[a] = sets[a] / 4; });

    // Estancamiento: el 1RM estimado de las 2 ultimas veces no supera al de las anteriores (8 semanas).
    const series = {};
    dated.forEach(({ d, w }) => {
      const k = daysBetween(d, today);
      if (k < 0 || k > 55) return;
      (w.exercises || []).forEach(e => {
        if (isCardioEntry(e)) return;
        const v = best1RM(e);
        if (v > 0) (series[e.ex] = series[e.ex] || []).push({ d, v });
      });
    });
    const stalled = Object.entries(series).filter(([, l]) =>
      l.length >= 4 && daysBetween(l[0].d, l[l.length - 1].d) >= 14 &&
      Math.max(...l.slice(-2).map(x => x.v)) <= Math.max(...l.slice(0, -2).map(x => x.v))
    ).sort((a, b) => b[1].length - a[1].length).map(([n]) => n);

    // Semanas seguidas entrenando (para proponer descarga).
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    let weeks = 0;
    for (let back = 0; back < 16; back++) {
      const start = new Date(mon); start.setDate(start.getDate() - 7 * back);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      const trained = dated.some(x => x.d >= start && x.d < end);
      if (trained) weeks++; else if (back > 0) break;
    }

    const rpes = dated.slice(-5).map(x => +x.w.rpe).filter(v => v > 0);
    const st = {
      sessions28: recent.length, perWeek: recent.length / 4, weeklySets, stalled, weeksInRow: weeks,
      daysSinceLast: dated.length ? daysBetween(dated[dated.length - 1].d, today) : null,
      rpeAvg: rpes.length >= 3 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
      streak: streakOf(workouts),
    };
    st.pushSets = (weeklySets.pecho || 0) + (weeklySets.hombros || 0);
    st.pullSets = weeklySets.espalda || 0;
    st.lowerSets = (weeklySets.cuadriceps || 0) + (weeklySets.posterior || 0);
    st.weakest = MAJOR.reduce((best, a) => (best == null || (weeklySets[a] || 0) < (weeklySets[best] || 0)) ? a : best, null);
    return st;
  }

  // ── Generador de rutinas ──
  const S = (groups, c) => ({ groups, compound: c === undefined ? null : c });
  const FULL_A = { t: 'Cuerpo completo A', slots: [S(['cuads'], true), S(['pecho'], true), S(['espaldaMedia'], true), S(['hombro'], true), S(['isquios']), S(['core'])] };
  const FULL_B = { t: 'Cuerpo completo B', slots: [S(['isquios', 'lumbar'], true), S(['dorsal'], true), S(['pecho'], true), S(['cuads'], true), S(['hombro'], false), S(['triceps'])] };
  const FULL_C = { t: 'Cuerpo completo C', slots: [S(['cuads'], true), S(['pecho'], true), S(['dorsal'], true), S(['gluteos', 'isquios']), S(['biceps']), S(['triceps'])] };
  const UPPER_A = { t: 'Torso A', slots: [S(['pecho'], true), S(['espaldaMedia'], true), S(['hombro'], true), S(['dorsal'], true), S(['triceps']), S(['biceps'])] };
  const UPPER_B = { t: 'Torso B', slots: [S(['dorsal'], true), S(['pecho'], true), S(['espaldaMedia'], true), S(['hombro'], false), S(['biceps']), S(['triceps'])] };
  const LOWER_A = { t: 'Pierna A', slots: [S(['cuads'], true), S(['isquios', 'lumbar'], true), S(['cuads']), S(['isquios'], false), S(['gemelos']), S(['core'])] };
  const LOWER_B = { t: 'Pierna B', slots: [S(['isquios', 'lumbar'], true), S(['cuads'], true), S(['gluteos', 'cuads']), S(['isquios'], false), S(['gemelos']), S(['core'])] };
  const PUSH = { t: 'Empuje', slots: [S(['pecho'], true), S(['hombro'], true), S(['pecho']), S(['hombro'], false), S(['triceps']), S(['triceps'])] };
  const PULL = { t: 'Tirón', slots: [S(['dorsal'], true), S(['espaldaMedia'], true), S(['dorsal']), S(['trapecio', 'espaldaMedia']), S(['biceps']), S(['biceps'])] };
  const LEGS = { t: 'Pierna', slots: [S(['cuads'], true), S(['isquios', 'lumbar'], true), S(['cuads']), S(['isquios'], false), S(['gemelos']), S(['core'])] };
  function split(dias) {
    switch (Math.min(Math.max(dias, 1), 6)) {
      case 1: return [FULL_A];
      case 2: return [FULL_A, FULL_B];
      case 3: return [FULL_A, FULL_B, FULL_C];
      case 4: return [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
      case 5: return [UPPER_A, LOWER_A, PUSH, PULL, LEGS];
      default: return [PUSH, PULL, LEGS, PUSH, PULL, LEGS];
    }
  }
  function dose(goal, level, compound) {
    const base = level === 'novato' ? (compound ? 3 : 2) : level === 'principiante' ? 3
      : (level === 'intermedio' || level === 'avanzado') ? (compound ? 4 : 3) : 4;
    switch (goal) {
      case 'fuerza': return compound ? { sets: Math.min(base + 1, 5), reps: 5, rest: '3-5 min' } : { sets: Math.min(base, 3), reps: 10, rest: '90 s' };
      case 'grasa': return compound ? { sets: base, reps: 10, rest: '2 min' } : { sets: base, reps: 12, rest: '60 s' };
      case 'resistencia': return compound ? { sets: Math.min(base, 3), reps: 15, rest: '45-60 s' } : { sets: Math.min(base, 3), reps: 20, rest: '30-45 s' };
      default: return compound ? { sets: base, reps: 8, rest: '2-3 min' } : { sets: base, reps: 12, rest: '60-90 s' };
    }
  }
  function rir(level) { return level === 'novato' ? 'RIR 3' : level === 'principiante' ? 'RIR 2-3' : 'RIR 1-2'; }

  /* Rutina semanal: SOLO ejercicios del historial del usuario (toda la base si aun no hay historial),
     filtrados por equipo y molestias, dosis por objetivo y nivel, y una serie extra para el grupo
     mas flojo. Devuelve { nombre, dias: [{ titulo, ejercicios: [{ ex, sets, reps, nota }] }] } o null. */
  function buildRoutine(opts) {
    const dias = opts.dias, history = opts.history || [], pains = opts.pains || [];
    const goal = goalOf(opts.enfoque), level = opts.level;
    const beginner = level === 'novato' || level === 'principiante';
    const known = nameIndex();
    const done = [];
    history.forEach(w => (w.exercises || []).forEach(e => {
      if (!isCardioEntry(e) && e.ex && !done.includes(e.ex)) done.push(e.ex);
    }));
    let source = [];
    if (!done.length) {
      db().forEach(ex => { if (norm(ex.category) === 'fuerza') source.push({ name: ex.name, group: fineGroup((ex.primaryMuscles || [])[0]), equipment: ex.equipment, level: ex.level, tier: ex.tier || 2 }); });
    } else {
      done.forEach(n => {
        const ex = known[n];
        if (ex) {
          if (norm(ex.category) !== 'fuerza' || source.some(c => c.name === ex.name)) return;
          source.push({ name: ex.name, group: fineGroup((ex.primaryMuscles || [])[0]), equipment: ex.equipment, level: ex.level, tier: ex.tier || 2 });
        } else {
          const g = keywordGroup(n);
          if (g) source.push({ name: n, group: g, equipment: '', level: '', tier: 2 });
        }
      });
    }
    const familiar = new Set(done.map(n => (known[n] && known[n].name) || n));
    const pool = source.filter(c => equipmentOk(c.equipment, opts.equipo) && !painBlocks(c.name, pains) && !(beginner && norm(c.level) === 'avanzado'));
    if (!pool.length) return null;

    const weak = history.length >= 4 ? stats(history).weakest : null;
    const perDay = level === 'novato' ? 5 : 6;
    const minFill = Math.min(perDay, 4);
    const uses = {};
    const tpls = split(dias);
    const titleCount = {};
    const out = [];

    tpls.forEach((tpl, i) => {
      const picked = [];
      const taken = c => picked.some(p => p.c.name === c.name);
      // Menos repetido en la semana; a igualdad, el de mejor resultado (tier); luego uno ya conocido.
      const pick = cands => cands.filter(c => !taken(c)).sort((a, b) =>
        ((uses[a.name] || 0) - (uses[b.name] || 0)) || (a.tier - b.tier) || ((familiar.has(a.name) ? 0 : 1) - (familiar.has(b.name) ? 0 : 1)))[0];
      tpl.slots.forEach(slot => {
        if (picked.length >= perDay) return;
        const inGroup = pool.filter(c => slot.groups.includes(c.group));
        const want = slot.compound === true;
        const ex = pick(inGroup.filter(c => isCompound(c.name) === want)) || pick(inGroup);
        if (!ex) return;
        picked.push({ c: ex, compound: slot.compound === true && isCompound(ex.name) });
        uses[ex.name] = (uses[ex.name] || 0) + 1;
      });
      // Con poco material pueden quedar huecos: se rellenan con lo disponible.
      const dayGroups = new Set(tpl.slots.flatMap(s => s.groups));
      while (picked.length < minFill) {
        // Con historial, el relleno no sale del tipo de dia (no se mete pecho en un dia de pierna).
        const cands = pool.filter(c => !taken(c) && (!done.length || dayGroups.has(c.group)));
        if (!cands.length) break;
        cands.sort((a, b) =>
          (picked.filter(p => p.c.group === a.group).length - picked.filter(p => p.c.group === b.group).length) ||
          ((dayGroups.has(a.group) ? 0 : 1) - (dayGroups.has(b.group) ? 0 : 1)) ||
          ((uses[a.name] || 0) - (uses[b.name] || 0)));
        picked.push({ c: cands[0], compound: false });
        uses[cands[0].name] = (uses[cands[0].name] || 0) + 1;
      }
      if (!picked.length) return;

      const ejercicios = picked.map(({ c, compound }) => {
        const d = dose(goal, level, compound);
        const prio = weak != null && areaOf(c.group) === weak;
        let reps = d.reps;
        // Sin carga externa no tiene sentido pautar 5 repeticiones: minimo 8 (12 en core).
        if (c.group === 'core') reps = Math.max(reps, 12);
        else if (norm(c.equipment).includes('peso corporal')) reps = Math.max(reps, 8);
        return { ex: c.name, sets: d.sets + (prio ? 1 : 0), reps, nota: (prio ? 'Prioridad · ' : '') + rir(level) + ' · descanso ' + d.rest };
      });
      // Si el mismo tipo de dia se repite (p.ej. Empuje x2), se numera A/B.
      const n = (titleCount[tpl.t] || 0) + 1; titleCount[tpl.t] = n;
      const repeated = tpls.filter(t => t.t === tpl.t).length > 1;
      out.push({ titulo: 'Día ' + (i + 1) + ' · ' + tpl.t + (repeated ? ' ' + (n === 1 ? 'A' : 'B') : ''), ejercicios });
    });
    if (!out.length) return null;
    const goalName = { fuerza: 'fuerza', hipertrofia: 'hipertrofia', grasa: 'pérdida de grasa', resistencia: 'resistencia' }[goal];
    return { nombre: 'Plan ' + goalName + ' ' + out.length + 'd', dias: out };
  }

  // ── Analisis y consejo ──
  function painAdvice(p) {
    const pautas = {
      'hombro': 'evita press por encima de la cabeza y fondos; usa agarre neutro y elevaciones laterales ligeras sin dolor',
      'codo': 'evita extensiones de tríceps pesadas y press francés; prioriza polea con cargas moderadas',
      'muneca': 'usa mancuernas o agarre neutro y evita flexiones con la mano extendida',
      'espalda baja': 'cambia peso muerto y buenos días por prensa, curl femoral y remo con apoyo en el pecho',
      'rodilla': 'reduce sentadilla profunda, estocadas y extensiones; trabaja prensa en rango sin dolor, curl femoral y puente de glúteo',
      'cadera': 'evita peso muerto y estocadas pesadas; mantén prensa y curl femoral en rango cómodo',
      'cuello': 'evita encogimientos, remo al mentón y press militar; cuida la postura en jalones',
      'tobillo': 'evita saltos, gemelos y estocadas; usa máquinas sentado',
    };
    const pauta = pautas[norm(p.zona)] || 'reduce la carga en esa zona y trabaja solo en rango sin dolor';
    const pro = p.severidad >= 4 ? ' Con dolor ' + p.severidad + '/5, consulta a un profesional sanitario antes de seguir cargando la zona.' : '';
    return p.zona + ': ' + pauta + '.' + pro;
  }

  function analyze(workouts, pains, weightKg, goalText, level, maxAlerts) {
    const goal = goalOf(goalText);
    const st = stats(workouts);
    const alerts = [];
    const add = (tipo, prioridad, titulo, detalle) => alerts.push({ tipo, prioridad, titulo, detalle });

    if (pains.length) add('molestia', 'alta', 'Molestias: adapta el entreno', pains.map(painAdvice).join(' '));
    if (!workouts.length) {
      add('consejo', 'media', 'Empieza con 2-3 días', 'Aún no hay entrenos registrados. Para empezar, 2-3 sesiones de cuerpo completo por semana con ejercicios básicos es lo que recomienda el ACSM para principiantes.');
    } else {
      const gap = st.daysSinceLast || 0;
      if (gap >= 10) add('racha', 'alta', 'Llevas ' + gap + ' días sin entrenar', 'Retoma con una sesión de cuerpo completo y un 10-20 % menos de peso que la última vez; en 1-2 semanas vuelves a tus cargas.');
      if (st.sessions28 >= 4 && st.lowerSets === 0) add('desequilibrio', 'alta', 'No has entrenado pierna en 4 semanas', 'Añade al menos un día de pierna (sentadilla o prensa, peso muerto rumano o curl femoral). Es la mitad de tu masa muscular.');
      if (st.stalled.length) add('estancamiento', st.stalled.length >= 3 ? 'alta' : 'media', 'Estancado en ' + st.stalled.slice(0, 2).join(', '), 'Tu 1RM estimado no sube en las últimas sesiones. Usa doble progresión (sube repeticiones dentro del rango y luego el peso), cambia el rango de repeticiones 4 semanas o haz una semana de descarga.');
      if (st.rpeAvg != null && st.rpeAvg >= 9) add('sobrecarga', 'media', 'RPE medio ' + f1(st.rpeAvg) + ': vas muy al límite', 'Deja 1-3 repeticiones en reserva en la mayoría de series y reserva el fallo para la última serie de ejercicios accesorios. Llegar siempre al fallo añade fatiga sin más ganancia.');
      if (st.sessions28 >= 4) {
        const weak = st.weakest, w = weak ? (st.weeklySets[weak] || 0) : 0;
        const legAlready = (weak === 'cuadriceps' || weak === 'posterior') && st.lowerSets === 0;
        if (weak && w < 8 && goal !== 'resistencia' && !legAlready) {
          const extra = Math.min(Math.max(Math.round(10 - w), 2), 8);
          add('desequilibrio', w < 3 ? 'alta' : 'media', 'Poco volumen de ' + AREA[weak].es, 'Haces ~' + f1(w) + ' series/semana de ' + AREA[weak].es + '. A partir de unas 10 series semanales por grupo se observa más hipertrofia (Schoenfeld 2017). Añade ' + extra + ' series repartidas en 2 días.');
        }
        if (st.pushSets >= 6 && st.pushSets > st.pullSets * 1.5) add('desequilibrio', 'media', 'Más empuje que tirón', 'Haces ' + f1(st.pushSets) + ' series/semana de pecho y hombro frente a ' + f1(st.pullSets) + ' de espalda. Como pauta práctica, iguala las series de tirón (remos y jalones) a las de empuje.');
        const top = Object.entries(st.weeklySets).filter(([, v]) => v > 25).sort((a, b) => b[1] - a[1])[0];
        if (top) add('sobrecarga', 'media', 'Volumen muy alto de ' + AREA[top[0]].es, '~' + f1(top[1]) + ' series/semana de ' + AREA[top[0]].es + '. Por encima de unas 20 el beneficio extra es pequeño y la fatiga sube; prueba a bajar a 15-20 de más calidad.');
      }
      if (st.weeksInRow >= 6) add('deload', 'media', st.weeksInRow + ' semanas seguidas: toca descarga', 'Haz una semana con la mitad de series y un 10-20 % menos de peso. Es una pauta práctica para disipar fatiga antes de seguir progresando.');
      if (gap < 10 && st.perWeek < 2) add('consejo', 'media', 'Entrenas ' + f1(st.perWeek) + ' días/semana', 'Con 2 sesiones semanales por grupo muscular se progresa más que con 1 (Schoenfeld 2016). Intenta llegar a 2-3 días.');
      if (st.streak >= 3 && gap < 10) add('racha', 'baja', 'Racha de ' + st.streak + ' días', 'La constancia es lo que más pesa en el resultado a largo plazo. Sigue así.');
    }
    if (weightKg > 0) add('consejo', 'baja', 'Proteína diaria', 'Apunta a ' + Math.round(weightKg * 1.6) + '-' + Math.round(weightKg * 2.2) + ' g de proteína al día (1,6-2,2 g/kg; Morton 2018).');

    const rank = { alta: 0, media: 1, baja: 2 };
    const sorted = alerts.map((a, i) => ({ a, i })).sort((x, y) => (rank[x.a.prioridad] - rank[y.a.prioridad]) || (x.i - y.i)).map(x => x.a).slice(0, Math.max(maxAlerts || 4, 1));

    let resumen;
    if (!workouts.length) resumen = 'Todavía no hay entrenos que analizar.';
    else {
      resumen = 'Nivel ' + LEVEL_ES[level] + '. ' + st.sessions28 + ' sesiones en las últimas 4 semanas (' + f1(st.perWeek) + '/semana).';
      const top = Object.entries(st.weeklySets).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 0) resumen += ' Lo que más trabajas: ' + AREA[top[0]].es + ' (~' + f1(top[1]) + ' series/semana).';
    }
    return { resumen, alertas: sorted, stats: st };
  }

  /* Consejo en texto con secciones (🎯 💪 🥗 😴 ⚡): lo pinta el mismo render que usaba la IA. */
  function advice(workouts, perfil) {
    perfil = perfil || {};
    const goalText = perfil.objetivo || '';
    const goal = goalOf(goalText);
    const level = levelOf(perfil.nivel, workouts.length);
    const pains = painsFromText(perfil.lesiones);
    const weightKg = +perfil.peso || 0, heightCm = +perfil.altura || 0;
    const a = analyze(workouts, pains, 0, goalText, level, 4);
    const d = dose(goal, level, true), acc = dose(goal, level, false);
    let out = '🎯 DIAGNÓSTICO\n' + a.resumen + '\n';
    if (weightKg > 0 && heightCm > 0) out += 'IMC ' + f1(weightKg / Math.pow(heightCm / 100, 2)) + ' (orientativo: no distingue músculo de grasa).\n';
    out += '\n💪 ENTRENAMIENTO\n';
    out += 'Para tu objetivo y nivel: básicos ' + d.sets + 'x' + d.reps + ' con ' + d.rest + ' de descanso, accesorios ' + acc.sets + 'x' + acc.reps + ', a ' + rir(level) + '.\n';
    a.alertas.filter(x => x.tipo !== 'racha').forEach(x => { out += '• ' + x.titulo + ': ' + x.detalle + '\n'; });
    out += '\n🥗 NUTRICIÓN\n';
    out += weightKg > 0
      ? 'Proteína: ' + Math.round(weightKg * 1.6) + '-' + Math.round(weightKg * 2.2) + ' g/día (1,6-2,2 g/kg).\n'
      : 'Proteína: 1,6-2,2 g por kg de peso al día. Añade tu peso en el perfil para verlo en gramos.\n';
    out += goal === 'grasa' ? 'Déficit moderado: perder un 0,5-1 % del peso por semana conserva mejor el músculo. Mantén las cargas altas.\n'
      : goal === 'resistencia' ? 'Asegura hidratos suficientes alrededor del entreno para sostener el volumen.\n'
        : 'Come en ligero superávit o mantenimiento; ganar músculo en déficit es mucho más lento.\n';
    out += '\n😴 RECUPERACIÓN\nDuerme al menos 7 horas y deja ~48 h antes de repetir el mismo grupo con intensidad.\n';
    out += '\n⚡ RETO\n';
    const st = a.stats;
    if (!workouts.length) out += 'Completa 3 sesiones esta semana.';
    else if (st.stalled.length) out += 'Suma 1 repetición a tu mejor serie de ' + st.stalled[0] + ' en la próxima sesión.';
    else if (st.perWeek < 3) out += 'Haz ' + Math.min(Math.round(st.perWeek) + 1, 4) + ' sesiones esta semana.';
    else out += 'Sube peso o repeticiones en al menos 2 ejercicios esta semana.';
    out += '\n\nBasado en: Schoenfeld 2016/2017/2021, ACSM 2009, Morton 2018, Helms 2014. No sustituye a un profesional sanitario.';
    return out;
  }

  window.EvidenceCoach = {
    goalOf, levelOf, painsFromText, stats, analyze, advice,
    /* Atajo para la web: rutina con los datos del perfil guardado. */
    routine(dias, enfoque, equipo, history, perfil) {
      perfil = perfil || {};
      return buildRoutine({
        dias, enfoque, equipo, history,
        level: levelOf(perfil.nivel, (history || []).length),
        pains: painsFromText(perfil.lesiones),
      });
    },
  };
})();
