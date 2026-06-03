/* ══════════════════════════════════════════════
   MAPA MUSCULAR — figura que se ilumina según el volumen trabajado
   ══════════════════════════════════════════════
   renderMuscleMap(containerId, muscles): muscles = { Pecho: vol, ... }
   recentMuscles(days): agrega el volumen por músculo de los últimos N días.
   ══════════════════════════════════════════════ */
(function () {
  const SKIN = '#34343d', LINE = '#15151a';

  function fillFor(m, muscles, maxV) {
    const v = muscles[m] || 0;
    if (!v || maxV <= 0) return `fill="#26262e"`;
    const base = (typeof MC !== 'undefined' && MC[m]) || '#4f8cff';
    const op = (0.42 + 0.58 * (v / maxV)).toFixed(2);
    return `fill="${base}" fill-opacity="${op}"`;
  }

  // Dibuja una figura. parts mapea zona->grupo muscular (frente vs espalda difieren).
  function figure(cx, parts, F) {
    const E = (x, y, rx, ry, f) => `<ellipse cx="${cx + x}" cy="${y}" rx="${rx}" ry="${ry}" ${f} stroke="${LINE}" stroke-width="1.4"/>`;
    const R = (x, y, w, h, r, f) => `<rect x="${cx + x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${f} stroke="${LINE}" stroke-width="1.4"/>`;
    const skin = `fill="${SKIN}"`;
    return `
      ${E(0, 20, 12, 13, skin)}                            <!-- cabeza -->
      ${R(-5, 32, 10, 8, 3, skin)}                          <!-- cuello -->
      ${E(-21, 48, 11, 8, F(parts.sh))}                     <!-- hombro izq -->
      ${E(21, 48, 11, 8, F(parts.sh))}                      <!-- hombro der -->
      ${R(-19, 45, 38, (parts.torsoTall ? 30 : 24), 9, F(parts.torso))}  <!-- torso -->
      ${E(-29, 68, 6.5, 15, F(parts.arm))}                  <!-- brazo sup izq -->
      ${E(29, 68, 6.5, 15, F(parts.arm))}                   <!-- brazo sup der -->
      ${E(-32, 94, 5.5, 14, skin)}                          <!-- antebrazo izq -->
      ${E(32, 94, 5.5, 14, skin)}                           <!-- antebrazo der -->
      ${R(-14, (parts.torsoTall ? 76 : 70), 28, 30, 6, F(parts.mid))}    <!-- medio (abs/lumbar) -->
      ${R(-15, 104, 30, 12, 5, skin)}                       <!-- cadera -->
      ${E(-8, 142, 9.5, 28, F(parts.leg))}                  <!-- muslo izq -->
      ${E(8, 142, 9.5, 28, F(parts.leg))}                   <!-- muslo der -->
      ${E(-8, 192, 6.5, 19, F(parts.leg))}                  <!-- gemelo izq -->
      ${E(8, 192, 6.5, 19, F(parts.leg))}                   <!-- gemelo der -->
      ${E(-8, 216, 5, 7, skin)}${E(8, 216, 5, 7, skin)}     <!-- pies -->
    `;
  }

  function buildSVG(muscles) {
    const maxV = Math.max(1, ...Object.values(muscles).map(v => +v || 0));
    const F = m => fillFor(m, muscles, maxV);
    const front = figure(66, { sh: 'Hombros', torso: 'Pecho', arm: 'Bíceps', mid: 'Core', leg: 'Piernas', torsoTall: false }, F);
    const back = figure(194, { sh: 'Hombros', torso: 'Espalda', arm: 'Tríceps', mid: 'Espalda', leg: 'Piernas', torsoTall: true }, F);
    const lbl = `font-size="11" fill="var(--t3,#7a7a86)" text-anchor="middle" font-weight="700"`;
    return `<svg viewBox="0 0 260 240" width="100%" style="max-width:340px;display:block;margin:0 auto;">
      ${front}${back}
      <text x="66" y="236" ${lbl}>Frente</text>
      <text x="194" y="236" ${lbl}>Espalda</text>
    </svg>`;
  }

  function legend(muscles) {
    const order = Object.entries(muscles).filter(([, v]) => +v > 0).sort((a, b) => b[1] - a[1]);
    if (!order.length) return '';
    const total = order.reduce((s, [, v]) => s + v, 0) || 1;
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:12px;">` +
      order.map(([m, v]) => {
        const c = (typeof MC !== 'undefined' && MC[m]) || '#888';
        return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:.68rem;color:var(--t2,#c8c8d0);background:var(--s2,#1a1a1f);border:1px solid var(--line2,#2a2a32);border-radius:7px;padding:3px 8px;"><span style="width:8px;height:8px;border-radius:50%;background:${c};"></span>${m} ${Math.round(v / total * 100)}%</span>`;
      }).join('') + `</div>`;
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
    el.innerHTML = buildSVG(muscles) + legend(muscles);
  }

  window.renderMuscleMap = renderMuscleMap;
  window.recentMuscles = recentMuscles;
})();
