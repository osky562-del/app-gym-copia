/* ══════════════════════════════════════════════
   FUERZA — 1RM estimado + estándares de nivel
   ══════════════════════════════════════════════
   - estimate1RM(nombre): mejor 1RM estimado (Epley) del historial
   - getBodyweight(): peso corporal (weightLogs más reciente o perfil.peso)
   - renderStrengthCard(): tarjeta en Progreso con los levantamientos
     principales, su 1RM, ratio ×peso y nivel (Novato→Élite)
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
  const LEVEL_COLOR = { 'Novato': '#888', 'Principiante': '#4f8cff', 'Intermedio': '#2dd98a', 'Avanzado': '#f5a623', 'Élite': '#a57aff' };
  const ASC = ['Principiante', 'Intermedio', 'Avanzado', 'Élite'];

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  /* Mapea el nombre de un ejercicio a uno de los levantamientos con estándar (o null). */
  function matchLift(name) {
    const n = norm(name);
    if (n.includes('press de banca') && !n.includes('mancuerna')) return 'bench';
    if (n.includes('sentadilla') && (n.includes('barra') || n.includes('frontal'))) return 'squat';
    if (n.includes('peso muerto') && !n.includes('rumano') && !n.includes('piernas rigidas')) return 'deadlift';
    if ((n.includes('press de hombros') || n.includes('press militar')) && !n.includes('mancuerna')) return 'ohp';
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

  function renderStrengthCard() {
    const el = document.getElementById('strengthCard');
    if (!el) return;
    if (typeof Pro !== 'undefined' && Pro.can && !Pro.can('strength_levels')) {
      el.innerHTML = '<div class="pro-locked-overlay" onclick="Pro.showUpgradeModal(\'strength_levels\')" style="position:relative;min-height:64px;"><div class="pro-locked-icon">🔒</div><div class="pro-locked-text">Fuerza estimada y niveles — Pro</div></div>';
      return;
    }
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

    const keys = Object.keys(byLift);
    if (!keys.length) {
      el.innerHTML = `<div style="color:var(--t3);font-size:.85rem;line-height:1.5;text-align:center;padding:8px 4px;">
        Registra press de banca, sentadilla, peso muerto, press de hombros o remo con barra para ver tu 1RM estimado y tu nivel de fuerza.</div>`;
      return;
    }

    const order = ['bench', 'squat', 'deadlift', 'ohp', 'row'];
    let rows = order.filter(k => byLift[k]).map(key => {
      const d = byLift[key];
      const lvl = levelFor(key, d.e1rm, bw, sex);
      const ratioTxt = bw ? `${(d.e1rm / bw).toFixed(2)}× peso` : '';
      let badge = '', next = '';
      if (lvl) {
        const c = LEVEL_COLOR[lvl.level] || '#888';
        badge = `<span style="background:${c}22;color:${c};border:1px solid ${c}55;padding:3px 9px;border-radius:7px;font-size:.7rem;font-weight:800;white-space:nowrap;">${lvl.level}</span>`;
        next = lvl.next
          ? `<div style="font-size:.64rem;color:var(--t3);margin-top:3px;">Faltan ${lvl.toNext} kg para ${lvl.next}</div>`
          : `<div style="font-size:.64rem;color:#a57aff;margin-top:3px;">¡Nivel máximo! 🔥</div>`;
      } else if (!bw) {
        badge = `<span style="color:var(--t3);font-size:.66rem;">añade tu peso</span>`;
      }
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--line);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:.88rem;font-weight:700;">${LIFT_LABEL[key]}</div>
          <div style="font-size:.7rem;color:var(--t3);font-family:var(--fm);">1RM ≈ ${d.e1rm} kg${ratioTxt ? ' · ' + ratioTxt : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">${badge}${next}</div>
      </div>`;
    }).join('');

    const head = bw
      ? `<div style="font-size:.66rem;color:var(--t3);margin-bottom:8px;">Según tu peso (${bw} kg, ${sex}). 1RM estimado con tu mejor serie.</div>`
      : `<div style="font-size:.7rem;color:var(--amber);margin-bottom:8px;line-height:1.4;">⚠️ Añade tu peso corporal en Perfil para calcular tu nivel.</div>`;
    el.innerHTML = head + rows;
  }

  // API global
  window.estimate1RM = estimate1RM;
  window.getBodyweight = getBodyweight;
  window.renderStrengthCard = renderStrengthCard;
})();
