/* ══════════════════════════════════════════════
   EXERCISE VIDEO — Modal con animación + pasos
   ══════════════════════════════════════════════
   Uso: openExerciseVideo("Press banca con barra")
   - Busca en window.EXERCISES_DB (cargado de exercises-db.js)
   - Si encuentra: anima 2 imágenes + muestra pasos en español
   - Si no encuentra: ofrece buscar en YouTube
   ══════════════════════════════════════════════ */

(function () {
  const BASE_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

  // Palabras vacías para el matcher
  const STOP = new Set([
    'de', 'del', 'con', 'y', 'en', 'o', 'para', 'el', 'la', 'los', 'las',
    'un', 'una', 'al', 'a', 'por', 'sobre'
  ]);

  let EX_INDEX = null;       // se construye en el primer uso
  let loopInterval = null;

  function normalize(s) {
    if (!s) return [];
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // sin acentos
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(t => t && !STOP.has(t));
  }

  function buildIndex() {
    if (EX_INDEX) return;
    const db = window.EXERCISES_DB || [];
    EX_INDEX = db.map(e => ({
      data: e,
      tokens: new Set([...normalize(e.name), ...normalize(e.name_en || '')])
    }));
  }

  /** Devuelve el ejercicio que más coincide con `name` (o null si nada > 50% match) */
  function findBest(name) {
    buildIndex();
    if (!EX_INDEX || !EX_INDEX.length) return null;
    const needle = normalize(name);
    if (!needle.length) return null;

    let best = null, bestScore = 0;
    for (const entry of EX_INDEX) {
      let matched = 0;
      for (const t of needle) {
        if (entry.tokens.has(t)) matched++;
      }
      // Penalización si el ejercicio del DB tiene MUCHAS más palabras (preferimos matches específicos)
      const lenPenalty = entry.tokens.size > needle.length * 3 ? 0.85 : 1;
      const score = (matched / needle.length) * lenPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = entry.data;
      }
    }
    return bestScore >= 0.5 ? best : null;
  }

  /** Inyecta el HTML del modal y el CSS si no existen */
  function ensureModalDOM() {
    if (document.getElementById('exVideoModal')) return;

    // CSS
    const style = document.createElement('style');
    style.id = 'exVideoStyle';
    style.textContent = `
      .exv-ov {
        display: none; position: fixed; inset: 0;
        background: rgba(0,0,0,.88); z-index: 999;
        align-items: center; justify-content: center;
        padding: 16px;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      }
      .exv-ov.on { display: flex; animation: exvFade .2s ease; }
      @keyframes exvFade { from { opacity: 0; } to { opacity: 1; } }
      .exv-modal {
        background: var(--s1, #131316);
        border: 1.5px solid var(--line2, #2a2a32);
        border-radius: 18px;
        width: 100%; max-width: 480px; max-height: 92vh;
        overflow-y: auto;
        animation: exvPop .25s ease;
      }
      @keyframes exvPop { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
      .exv-head {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 16px; border-bottom: 1px solid var(--line, #1f1f25); gap: 10px;
      }
      .exv-title { font-size: 1rem; font-weight: 800; line-height: 1.25; flex: 1; min-width: 0; }
      .exv-close {
        background: var(--s3, #222228); border: 1px solid var(--line2, #2a2a32);
        width: 34px; height: 34px; border-radius: 9px;
        color: var(--t1, #fff); font-size: 1.05rem; cursor: pointer; font-weight: 700;
        flex-shrink: 0;
      }
      .exv-video {
        width: 100%; aspect-ratio: 1; background: #fff;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; position: relative;
      }
      .exv-video img {
        width: 100%; height: 100%; object-fit: contain;
        user-select: none; -webkit-user-drag: none;
      }
      .exv-loading {
        color: #666; font-size: .82rem;
        display: flex; flex-direction: column; align-items: center; gap: 10px;
      }
      .exv-spinner {
        width: 26px; height: 26px;
        border: 3px solid #ccc; border-top-color: var(--a, #4f8cff);
        border-radius: 50%; animation: exvSpin .9s linear infinite;
      }
      @keyframes exvSpin { to { transform: rotate(360deg); } }
      .exv-body { padding: 14px 16px 20px; }
      .exv-meta { display: flex; gap: 5px; margin-bottom: 12px; flex-wrap: wrap; }
      .exv-meta span {
        padding: 4px 9px; border-radius: 6px;
        font-size: .68rem; font-weight: 700;
      }
      .exv-steps-title {
        font-size: .68rem; font-weight: 800; color: var(--t3, #7a7a86);
        text-transform: uppercase; letter-spacing: .08em; margin: 14px 0 8px;
      }
      .exv-steps { counter-reset: step; list-style: none; padding: 0; margin: 0; }
      .exv-steps li {
        counter-increment: step;
        padding: 9px 11px 9px 36px;
        background: var(--s2, #1a1a1f);
        border: 1px solid var(--line, #1f1f25);
        border-radius: 9px; margin-bottom: 5px;
        font-size: .8rem; color: var(--t2, #c8c8d0); line-height: 1.5; position: relative;
      }
      .exv-steps li::before {
        content: counter(step); position: absolute; left: 9px; top: 9px;
        width: 20px; height: 20px; border-radius: 5px;
        background: var(--a, #4f8cff); color: #fff;
        font-size: .68rem; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
      }
      .exv-extras { margin-top: 14px; display: flex; gap: 6px; }
      .exv-extra {
        flex: 1; padding: 9px; border-radius: 9px;
        text-decoration: none; text-align: center;
        font-size: .75rem; font-weight: 700;
      }
      .exv-extra.youtube {
        background: rgba(255,68,68,.12); border: 1px solid rgba(255,68,68,.3); color: #ff4444;
      }
      .exv-extra.google {
        background: rgba(79,140,255,.12); border: 1px solid rgba(79,140,255,.3); color: var(--a, #4f8cff);
      }
      /* Botón "▶ Ver técnica" en modo live */
      .lv-ex-video {
        background: rgba(79, 140, 255, 0.14);
        border: 1px solid rgba(79, 140, 255, 0.4);
        color: var(--a, #4f8cff);
        padding: 7px 11px; border-radius: 9px;
        font-size: 1.05rem; font-weight: 800;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        flex-shrink: 0;
        margin-top: 4px;
        transition: background .15s;
      }
      .lv-ex-video:active { background: rgba(79, 140, 255, 0.28); }
    `;
    document.head.appendChild(style);

    // HTML del modal
    const modal = document.createElement('div');
    modal.className = 'exv-ov';
    modal.id = 'exVideoModal';
    modal.onclick = (e) => { if (e.target === modal) closeVideo(); };
    modal.innerHTML = `
      <div class="exv-modal" onclick="event.stopPropagation()">
        <div class="exv-head">
          <div class="exv-title" id="exvTitle">—</div>
          <button class="exv-close" onclick="closeExerciseVideo()">✕</button>
        </div>
        <div class="exv-video" id="exvVideo"></div>
        <div class="exv-body" id="exvBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function openVideo(exerciseName) {
    ensureModalDOM();
    const match = findBest(exerciseName);
    const modal = document.getElementById('exVideoModal');

    if (!match) {
      const ytQuery = encodeURIComponent('cómo hacer ' + exerciseName);
      document.getElementById('exvTitle').textContent = exerciseName;
      document.getElementById('exvBody').innerHTML = `
        <div style="text-align:center; padding:30px 20px;">
          <div style="font-size:2.5rem; margin-bottom:14px;">🔍</div>
          <div style="font-size:.95rem; color:var(--t2, #c8c8d0); margin-bottom:18px; line-height:1.5;">
            No tenemos vídeo demostrativo de este ejercicio aún en nuestra base de datos. Puedes buscarlo en YouTube:
          </div>
          <a href="https://www.youtube.com/results?search_query=${ytQuery}" target="_blank"
             style="display:inline-block; background:#ff4444; color:#fff; padding:11px 20px; border-radius:9px; text-decoration:none; font-weight:800; font-size:.88rem;">
            ▶ Buscar "${exerciseName}" en YouTube
          </a>
        </div>`;
      document.getElementById('exvVideo').innerHTML = '<div class="exv-loading" style="position:absolute;inset:0;justify-content:center;color:#aaa;">📚 Sin demo disponible</div>';
      modal.classList.add('on');
      return;
    }

    document.getElementById('exvTitle').textContent = match.name;

    const meta = [];
    meta.push(`<span style="background:rgba(79,140,255,.18); color:var(--a, #4f8cff);">💪 ${(match.primaryMuscles||[]).join(', ')}</span>`);
    if (match.level) meta.push(`<span style="background:rgba(245,166,35,.15); color:var(--amber, #f5a623);">🎯 ${match.level}</span>`);
    if (match.equipment) meta.push(`<span style="background:var(--s3, #222228); color:var(--t2, #c8c8d0);">🏋 ${match.equipment}</span>`);

    const steps = (match.instructions || []).map(s => `<li>${s}</li>`).join('');

    // Construir URLs de búsqueda si faltan
    const ytSearch = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('como hacer ' + match.name);
    const ggSearch = 'https://www.google.com/search?q=' + encodeURIComponent('como hacer el ejercicio ' + match.name);

    document.getElementById('exvBody').innerHTML = `
      <div class="exv-meta">${meta.join('')}</div>
      <div class="exv-steps-title">Pasos de la técnica</div>
      <ol class="exv-steps">${steps}</ol>
      <div class="exv-extras">
        <a class="exv-extra youtube" href="${ytSearch}" target="_blank" rel="noopener">▶ YouTube</a>
        <a class="exv-extra google" href="${ggSearch}" target="_blank" rel="noopener">🔍 Google</a>
      </div>
    `;

    // Animación de las dos imágenes
    const vid = document.getElementById('exvVideo');
    vid.innerHTML = `<div class="exv-loading"><div class="exv-spinner"></div><div>Cargando…</div></div>`;
    const url0 = BASE_IMG + match.id + '/0.jpg';
    const url1 = BASE_IMG + match.id + '/1.jpg';
    const i0 = new Image(); const i1 = new Image();
    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < 2) return;
      vid.innerHTML = `<img id="exvImg" src="${url0}" alt="">`;
      let toggle = 0;
      if (loopInterval) clearInterval(loopInterval);
      loopInterval = setInterval(() => {
        toggle = 1 - toggle;
        const im = document.getElementById('exvImg');
        if (im) im.src = toggle ? url1 : url0;
      }, 700);
    };
    i0.onload = onLoad; i1.onload = onLoad;
    i0.onerror = () => {
      vid.innerHTML = '<div class="exv-loading" style="color:#c00;">⚠️ Imagen no disponible</div>';
    };
    i1.onerror = i0.onerror;
    i0.src = url0; i1.src = url1;

    modal.classList.add('on');
  }

  function closeVideo() {
    if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
    const m = document.getElementById('exVideoModal');
    if (m) m.classList.remove('on');
  }

  // API global
  window.openExerciseVideo = openVideo;
  window.closeExerciseVideo = closeVideo;
})();
