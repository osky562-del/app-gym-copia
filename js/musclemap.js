/* ══════════════════════════════════════════════
   MAPA MUSCULAR — figura que se ilumina según el volumen trabajado
   ══════════════════════════════════════════════
   renderMuscleMap(containerId, muscles): muscles = { Pecho: vol, ... }
   recentMuscles(days): agrega el volumen por músculo de los últimos N días.
   ══════════════════════════════════════════════ */
(function () {
  // Mismas imagenes que las apps: cuerpo 3D en gris + una mascara por grupo muscular.
  const MASKS = [
    ['Piernas', 'piernas'], ['Espalda', 'espalda'], ['Pecho', 'pecho'], ['Core', 'core'],
    ['Hombros', 'hombros'], ['Bíceps', 'biceps'], ['Tríceps', 'triceps'],
  ];
  let current = { id: null, muscles: {} };
  let selected = null;

  const colorOf = m => (typeof MC !== 'undefined' && MC[m]) || '#888888';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bigKg = v => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v)) + ' kg';

  function opacityFor(m, muscles, maxV) {
    const v = muscles[m] || 0;
    if (v <= 0) return 0;
    const base = Math.min(0.95, Math.max(0.5, 0.5 + 0.45 * (v / maxV)));
    // Si hay un musculo seleccionado, atenua los demas para destacarlo.
    if (selected) return m === selected ? 0.98 : base * 0.35;
    return base;
  }

  function buildMap(muscles) {
    const maxV = Math.max(1, ...Object.values(muscles).map(v => +v || 0));
    const layers = MASKS.map(([m, file]) => {
      const url = `img/muscle/mask_${file}.png`;
      return `<div class="mm-layer" style="background:${colorOf(m)};opacity:${opacityFor(m, muscles, maxV).toFixed(2)};-webkit-mask-image:url(${url});mask-image:url(${url});"></div>`;
    }).join('');
    return `<div class="mm-body" onclick="mmSelect(null)"><img src="img/muscle/body_base.png" alt="">${layers}</div>
      <div class="mm-sides"><span>Frente</span><span>Espalda</span></div>`;
  }

  function legend(muscles) {
    const order = Object.entries(muscles).filter(([, v]) => +v > 0).sort((a, b) => b[1] - a[1]);
    if (!order.length) return '';
    const total = order.reduce((s, [, v]) => s + v, 0) || 1;
    return `<div class="mm-legend">` + order.map(([m, v]) => {
      const on = selected === m;
      return `<button class="mm-chip${on ? ' on' : ''}" style="${on ? 'background:' + colorOf(m) : ''}" onclick="mmSelect('${m}')"><i style="background:${colorOf(m)}"></i>${esc(m)} ${Math.floor(v / total * 100)}%</button>`;
    }).join('') + `</div>`;
  }

  function exercisesFor(group) {
    if (typeof workouts === 'undefined') return [];
    const cut = new Date(); cut.setDate(cut.getDate() - 30); cut.setHours(0, 0, 0, 0);
    const m = {};
    workouts.forEach(w => {
      if (new Date(w.date + 'T00:00:00') < cut) return;
      (w.exercises || []).forEach(e => {
        if (e.cardio || getMuscle(e.ex) !== group) return;
        m[e.ex] = (m[e.ex] || 0) + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1);
      });
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  function detail(muscles) {
    if (!selected) return '';
    const g = selected, c = colorOf(g), vol = muscles[g] || 0;
    const total = Object.values(muscles).reduce((a, b) => a + (+b || 0), 0) || 1;
    const exs = exercisesFor(g);
    const rows = exs.length
      ? exs.slice(0, 6).map(([n, v]) => `<div class="mm-ex"><span>${esc(n)}</span><b>${bigKg(v)}</b></div>`).join('')
      : `<div class="mm-none">Sin ejercicios en los últimos 30 días.</div>`;
    return `<div class="mm-detail" style="background:color-mix(in srgb, ${c} 10%, transparent)">
      <div class="mm-dh"><i style="background:${c}"></i><strong>${esc(g)}</strong><span style="color:${c}">${bigKg(vol)} · ${Math.floor(vol / total * 100)}%</span></div>${rows}</div>`;
  }

  window.mmSelect = function (m) {
    selected = m && selected !== m ? m : null;
    draw();
  };

  function draw() {
    const el = document.getElementById(current.id);
    if (el) el.innerHTML = buildMap(current.muscles) + legend(current.muscles) + detail(current.muscles);
  }

  function recentMuscles(days) {
    if (typeof workouts === 'undefined') return {};
    const cut = new Date(); cut.setDate(cut.getDate() - (days || 30)); cut.setHours(0, 0, 0, 0);
    const mus = {};
    workouts.forEach(w => {
      if (new Date(w.date + 'T00:00:00') >= cut && typeof getWorkoutMuscles === 'function') {
        const wm = getWorkoutMuscles(w);
        for (const k in wm) mus[k] = (mus[k] || 0) + wm[k];
      }
    });
    return mus;
  }

  function renderMuscleMap(containerId, muscles) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (typeof Pro !== 'undefined' && Pro.can && !Pro.can('muscle_map')) {
      el.innerHTML = '<div class="pro-locked-overlay" onclick="Pro.showUpgradeModal(\'muscle_map\')" style="position:relative;min-height:120px;"><div class="pro-locked-icon">🔒</div><div class="pro-locked-text">Mapa muscular — Pro</div></div>';
      return;
    }
    muscles = muscles || {};
    const total = Object.values(muscles).reduce((a, b) => a + (+b || 0), 0);
    if (!total) {
      el.innerHTML = `<div style="color:var(--t3);font-size:.85rem;text-align:center;padding:14px;">Entrena para ver aquí los músculos que trabajas 💪</div>`;
      return;
    }
    current = { id: containerId, muscles };
    if (selected && !muscles[selected]) selected = null;
    draw();
  }

  window.renderMuscleMap = renderMuscleMap;
  window.recentMuscles = recentMuscles;
})();
