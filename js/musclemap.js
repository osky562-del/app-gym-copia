/* ══════════════════════════════════════════════
   MAPA MUSCULAR — figura que se ilumina según el volumen trabajado
   ══════════════════════════════════════════════
   renderMuscleMap(containerId, muscles): muscles = { Pecho: vol, ... }
   recentMuscles(days): agrega el volumen por músculo de los últimos N días (sin cardio).
   Espejo de ui/common/MuscleMap.kt (Android): al tocar un grupo en la leyenda se resalta
   (los demás ×0.15) y se muestra su volumen, % y hasta 8 ejercicios de los últimos 30 días.
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
  const T = s => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(s) : s;
  const bigKg = v => (typeof big === 'function' ? big(v) : Math.round(v)) + ' kg';

  function opacityFor(m, muscles, maxV) {
    const v = muscles[m] || 0;
    if (v <= 0) return 0;
    const base = Math.min(0.95, Math.max(0.5, 0.5 + 0.45 * (v / maxV)));
    // Si hay un musculo seleccionado, mantiene su opacidad base y atenua los demas (MuscleMap.kt:91).
    if (selected && m !== selected) return base * 0.15;
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
      return `<button class="mm-chip${on ? ' on' : ''}" style="${on ? 'background:' + colorOf(m) : ''}" onclick="mmSelect('${m}')"><i style="background:${colorOf(m)}"></i>${esc(T(m))} ${Math.round(v / total * 100)}%</button>`;
    }).join('') + `</div>`;
  }

  /* Ejercicios (sin cardio) del grupo en los últimos 30 días, en orden de aparición (como el LinkedHashSet de Android). */
  function exercisesFor(group) {
    if (typeof workouts === 'undefined') return [];
    const cut = new Date(); cut.setDate(cut.getDate() - 30); cut.setHours(0, 0, 0, 0);
    const seen = new Set(), out = [];
    workouts.forEach(w => {
      if (new Date(w.date + 'T00:00:00') < cut) return;
      (w.exercises || []).forEach(e => {
        if (e.cardio || e.isCardio || getMuscle(e.ex) !== group || seen.has(e.ex)) return;
        seen.add(e.ex); out.push(e.ex);
      });
    });
    return out;
  }

  function detail(muscles) {
    if (!selected) return '';
    const g = selected, c = colorOf(g), vol = muscles[g] || 0;
    const total = Object.values(muscles).reduce((a, b) => a + (+b || 0), 0) || 1;
    const exs = exercisesFor(g);
    const rows = exs.length
      ? `<div class="mm-exh">${T('Ejercicios (30 días)')}</div>` + exs.slice(0, 8).map(n => `<div class="mm-ex"><span>• ${esc(n)}</span></div>`).join('')
      : '';
    return `<div class="mm-detail" style="background:color-mix(in srgb, ${c} 10%, transparent)">
      <div class="mm-dh"><i style="background:${c}"></i><strong>${esc(T(g))} · ${bigKg(vol)} · ${Math.round(vol / total * 100)}%</strong></div>${rows}</div>`;
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
