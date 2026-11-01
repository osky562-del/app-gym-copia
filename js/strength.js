/* ══════════════════════════════════════════════
   FUERZA — 1RM estimado + estándares de nivel
   ══════════════════════════════════════════════
   - estimate1RM(nombre): mejor 1RM estimado (Epley) del historial
   - getBodyweight(): peso corporal (weightLogs más reciente o perfil.peso)
   - renderStrengthCard(): panel "Niveles de fuerza" de Progreso con los 5
     levantamientos principales, su 1RM, ratio ×peso y nivel (Novato→Élite).
     Espejo de domain/Strength.kt + ProgressScreen.kt (Android).
   Estándares = 1RM / peso corporal. Son aproximados y orientativos.
   ══════════════════════════════════════════════ */
(function () {
  // Ratios mínimos de 1RM/peso-corporal para alcanzar cada nivel.
  const STD = {
    hombre: {
      bench:    { Principiante: 0.75, Intermedio: 1.0,  Avanzado: 1.25, 'Élite': 1.5 },
      squat:    { Principiante: 1.0,  Intermedio: 1.25, Avanzado: 1.5,  'Élite': 2.0 },
      deadlift: { Principiante: 1.25, Intermedio: 1.5,  Avanzado: 2.0,  'Élite': 2.5 },
      ohp:      { Principiante: 0.45, Intermedio: 0.6,  Avanzado: 0.8,  'Élite': 1.0 },
      row:      { Principiante: 0.7,  Intermedio: 0.9,  Avanzado: 1.15, 'Élite': 1.4 }
    },
    mujer: {
      bench:    { Principiante: 0.5,  Intermedio: 0.75, Avanzado: 1.0,  'Élite': 1.25 },
      squat:    { Principiante: 0.75, Intermedio: 1.0,  Avanzado: 1.25, 'Élite': 1.5 },
      deadlift: { Principiante: 1.0,  Intermedio: 1.25, Avanzado: 1.5,  'Élite': 2.0 },
      ohp:      { Principiante: 0.35, Intermedio: 0.5,  Avanzado: 0.65, 'Élite': 0.8 },
      row:      { Principiante: 0.5,  Intermedio: 0.65, Avanzado: 0.85, 'Élite': 1.05 }
    }
  };
  const LIFT_LABEL = { bench: 'Press banca', squat: 'Sentadilla', deadlift: 'Peso muerto', ohp: 'Press hombro', row: 'Remo con barra' };
  const LIFT_LABEL_EN = { bench: 'Bench press', squat: 'Squat', deadlift: 'Deadlift', ohp: 'Overhead press', row: 'Barbell row' };
  const LEVEL_COLOR = { 'Novato': '#888', 'Principiante': '#4f8cff', 'Intermedio': '#2dd98a', 'Avanzado': '#f5a623', 'Élite': '#a57aff' };
  const LEVEL_EN = { 'Novato': 'Novice', 'Principiante': 'Beginner', 'Intermedio': 'Intermediate', 'Avanzado': 'Advanced', 'Élite': 'Elite' };
  const ASC = ['Principiante', 'Intermedio', 'Avanzado', 'Élite'];

  const isEn = () => typeof I18N !== 'undefined' && I18N.getLang && I18N.getLang() === 'en';
  const T = s => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(s) : s;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  /* Mapea el nombre de un ejercicio a uno de los levantamientos con estándar (o null). Igual que Strength.kt. */
  function matchLift(name) {
    const n = norm(name);
    if (n.includes('banca') && !n.includes('mancuerna')) return 'bench';
    if (n.includes('sentadilla') && !n.includes('mancuerna') && !n.includes('bulgara')) return 'squat';
    if (n.includes('peso muerto') && !n.includes('rumano') && !n.includes('rigidas')) return 'deadlift';
    if ((n.includes('press de hombro') || n.includes('press hombro') || n.includes('press militar')) && !n.includes('mancuerna')) return 'ohp';
    if (n.includes('remo') && n.includes('barra') && !n.includes('mancuerna')) return 'row';
    return null;
  }

  /* Mejor 1RM estimado (Epley) del historial para un ejercicio. Ignora calentamiento. */
  function estimate1RM(name) {
    let best = 0;
    (typeof workouts !== 'undefined' ? workouts : []).forEach(w => (w.exercises || []).forEach(e => {
      if (e.ex !== name) return;
      if (Array.isArray(e.setsDetail) && e.setsDetail.length) {
        e.setsDetail.forEach(s => {
          if (s.warmup) return;
          const k = +s.kg || 0, r = +s.reps || 1;
          const rm = k * (1 + r / 30);
          if (rm > best) best = rm;
        });
      } else {
        const k = +e.kg || 0, r = +e.reps || 1;
        const rm = k * (1 + r / 30);
        if (rm > best) best = rm;
      }
    }));
    return best > 0 ? Math.round(best * 10) / 10 : 0;
  }

  function getBodyweight() {
    if (typeof weightLogs !== 'undefined' && Array.isArray(weightLogs) && weightLogs.length) {
      const last = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date)).pop();
      if (last && +last.weight) return +last.weight;
    }
    const p = (typeof STORE !== 'undefined' ? STORE.get('perfil') : null) || {};
    if (+p.peso) return +p.peso;
    return 0;
  }

  function getSex() {
    const p = (typeof STORE !== 'undefined' ? STORE.get('perfil') : null) || {};
    return (norm(p.sexo) === 'mujer') ? 'mujer' : 'hombre';
  }

  /* Nivel para un levantamiento dado su 1RM y el peso corporal. */
  function levelFor(key, e1rm, bw, sex) {
    const t = (STD[sex] || STD.hombre)[key];
    if (!t || !bw || !e1rm) return null;
    const ratio = e1rm / bw;
    let level = 'Novato';
    for (let i = ASC.length - 1; i >= 0; i--) { if (ratio >= t[ASC[i]]) { level = ASC[i]; break; } }
    let next = null, toNext = null;
    for (const lv of ASC) { if (ratio < t[lv]) { next = lv; toNext = Math.round((t[lv] * bw - e1rm) * 10) / 10; break; } }
    return { level, ratio: Math.round(ratio * 100) / 100, next, toNext };
  }

  /* Panel "Niveles de fuerza" (ProgressScreen.kt:163-199). Se oculta si no hay ningún levantamiento principal. */
  function renderStrengthCard() {
    const el = document.getElementById('strengthCard');
    if (!el) return;
    const sec = document.getElementById('levelsSec');
    const bw = getBodyweight();
    const sex = getSex();

    // Recopilar los levantamientos principales que el usuario ha hecho.
    const names = new Set();
    (typeof workouts !== 'undefined' ? workouts : []).forEach(w => (w.exercises || []).forEach(e => names.add(e.ex)));
    const byLift = {};
    names.forEach(nm => {
      const key = matchLift(nm);
      if (!key) return;
      const e1 = estimate1RM(nm);
      if (e1 <= 0) return;
      if (!byLift[key] || e1 > byLift[key].e1rm) byLift[key] = { name: nm, e1rm: e1 };
    });

    const order = ['bench', 'squat', 'deadlift', 'ohp', 'row'].filter(k => byLift[k]);
    if (sec) sec.style.display = order.length ? '' : 'none';
    if (!order.length) { el.innerHTML = ''; return; }

    const lvlName = l => isEn() ? (LEVEL_EN[l] || l) : l;
    const rows = order.map(key => {
      const d = byLift[key];
      const lvl = levelFor(key, d.e1rm, bw, sex);
      const level = lvl ? lvl.level : 'Novato';
      const c = LEVEL_COLOR[level] || '#888';
      const ratioTxt = bw ? ` · ${(d.e1rm / bw).toFixed(2)}× ${isEn() ? 'BW' : 'peso'}` : '';
      const badge = `<span class="sl-badge" style="background:${c}2e;color:${c};">${lvlName(level)}</span>`;
      let next = '';
      if (bw && lvl) {
        next = lvl.next
          ? `<div class="sl-next">${T('Faltan')} ${big(lvl.toNext)} kg → ${lvlName(lvl.next)}</div>`
          : `<div class="sl-next" style="color:${c}">${T('¡Nivel máximo! 🔥')}</div>`;
      }
      return `<div class="sl-row">
        <div class="sl-info">
          <div class="sl-n">${esc(isEn() ? LIFT_LABEL_EN[key] : LIFT_LABEL[key])}</div>
          <div class="sl-m">1RM ≈ ${big(d.e1rm)} kg${ratioTxt}</div>
        </div>
        <div class="sl-r">${badge}${next}</div>
      </div>`;
    }).join('');

    const head = bw
      ? `<div class="sec-sub">${T('Según tu peso corporal')} (${big(bw)} kg)</div>`
      : `<div class="sec-sub" style="color:var(--a);">${T('⚠️ Añade tu peso en Perfil para ver tu nivel')}</div>`;
    el.innerHTML = head + rows;
  }

  /* Niveles por levantamiento (para el nivel global del Coach: CoachLevel.overallFrom). */
  function computeLiftLevels() {
    const bw = getBodyweight(), sex = getSex();
    if (!bw) return [];
    const names = new Set();
    (typeof workouts !== 'undefined' ? workouts : []).forEach(w => (w.exercises || []).forEach(e => names.add(e.ex)));
    const byLift = {};
    names.forEach(nm => {
      const key = matchLift(nm); if (!key) return;
      const e1 = estimate1RM(nm); if (e1 <= 0) return;
      if (!byLift[key] || e1 > byLift[key].e1rm) byLift[key] = { name: nm, e1rm: e1 };
    });
    return Object.keys(byLift).map(key => { const lvl = levelFor(key, byLift[key].e1rm, bw, sex); return lvl ? { lift: key, level: lvl.level, ratio: lvl.ratio } : null; }).filter(Boolean);
  }

  // API global
  window.computeLiftLevels = computeLiftLevels;
  window.estimate1RM = estimate1RM;
  window.getBodyweight = getBodyweight;
  window.renderStrengthCard = renderStrengthCard;
})();
