/* ══════════════════════════════════════════════
   EXERCISE VIDEO — "Ver técnica" (TechniqueDialog.kt de Android)
   ══════════════════════════════════════════════
   Uso: openExerciseVideo("Press banca con barra")
   - Resuelve el ejercicio en window.EXERCISES_DB: primero por nombre EXACTO, luego difuso
   - Anima las imágenes (cadencia 1,1 s) y muestra los "Pasos"
   - Botón "Buscar en YouTube" siempre visible; sin datos → aviso
   ══════════════════════════════════════════════ */

(function () {
  const BASE_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
  window.EX_IMG_BASE = BASE_IMG;
  const t = (es) => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(es) : es;

  const STOP = new Set(['de', 'del', 'con', 'y', 'en', 'o', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'al', 'a', 'por', 'sobre']);

  let EX_INDEX = null;
  let loopInterval = null;

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function normalize(s) { return fold(s).split(' ').filter(tk => tk && !STOP.has(tk)); }

  function buildIndex() {
    if (EX_INDEX) return;
    const db = window.EXERCISES_DB || [];
    EX_INDEX = db.map(e => ({ data: e, tokens: new Set([...normalize(e.name), ...normalize(e.name_en || '')]) }));
  }

  /** Exacto por nombre (o alias / nombre antiguo) antes que difuso (ExerciseDb.findByName). */
  function findBest(name) {
    buildIndex();
    if (!EX_INDEX || !EX_INDEX.length) return null;
    const q = fold(name);
    if (!q) return null;
    const exact = EX_INDEX.find(en => fold(en.data.name) === q || fold(en.data.name_en) === q
      || (en.data.aliases || []).some(a => fold(a) === q) || (en.data.old || []).some(a => fold(a) === q));
    if (exact) return exact.data;
    const needle = normalize(name);
    if (!needle.length) return null;
    let best = null, bestScore = 0;
    for (const entry of EX_INDEX) {
      let matched = 0;
      for (const tk of needle) if (entry.tokens.has(tk)) matched++;
      const lenPenalty = entry.tokens.size > needle.length * 3 ? 0.85 : 1;
      const score = (matched / needle.length) * lenPenalty;
      if (score > bestScore) { bestScore = score; best = entry.data; }
    }
    return bestScore >= 0.5 ? best : null;
  }
  window.findExerciseInDb = findBest;

  function ensureModalDOM() {
    if (document.getElementById('exVideoModal')) return;
    const style = document.createElement('style');
    style.id = 'exVideoStyle';
    style.textContent = `
      .exv-ov { display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:999; align-items:center; justify-content:center; padding:20px; }
      .exv-ov.on { display:flex; animation:exvFade .2s ease; }
      @keyframes exvFade { from{opacity:0} to{opacity:1} }
      .exv-modal { background:var(--s2,#16161b); border-radius:20px; width:100%; max-width:460px; max-height:min(560px, calc(100dvh - 40px)); display:flex; flex-direction:column; overflow:hidden; animation:exvPop .25s ease; }
      @keyframes exvPop { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
      .exv-head { display:flex; align-items:center; gap:10px; padding:14px 8px 6px 18px; }
      .exv-kicker { font-size:.68rem; font-weight:600; color:var(--a,#4f8cff); }
      .exv-title { font-size:1.1rem; font-weight:800; line-height:1.25; color:var(--t1,#fff); }
      .exv-close { background:none; border:none; min-width:44px; min-height:44px; color:var(--t3,#7a7a86); font-size:1.2rem; cursor:pointer; flex-shrink:0; -webkit-tap-highlight-color:transparent; }
      .exv-body { padding:0 18px; overflow-y:auto; -webkit-overflow-scrolling:touch; flex:1; }
      .exv-video { width:100%; height:210px; background:#fff; border-radius:14px; display:flex; align-items:center; justify-content:center; overflow:hidden; margin-bottom:14px; }
      .exv-video img { width:100%; height:100%; object-fit:contain; user-select:none; -webkit-user-drag:none; }
      .exv-loading { color:#666; font-size:.82rem; }
      .exv-steps-title { font-size:.88rem; font-weight:800; color:var(--t1,#fff); margin-bottom:8px; }
      .exv-step { display:flex; gap:10px; padding:5px 0; }
      .exv-step-n { width:22px; height:22px; border-radius:50%; flex-shrink:0; background:rgba(79,140,255,.18); color:var(--a,#4f8cff); font-size:.68rem; font-weight:800; display:flex; align-items:center; justify-content:center; }
      .exv-step-t { font-size:.82rem; color:var(--t3,#c8c8d0); line-height:1.4; }
      .exv-nodata { font-size:.82rem; color:var(--t3,#7a7a86); }
      .exv-yt { margin:14px 18px 18px; background:var(--s3,#1d1d23); border:none; border-radius:12px; padding:12px; color:var(--t1,#fff); font-weight:600; font-size:.88rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; -webkit-tap-highlight-color:transparent; }
      .exv-yt:active { opacity:.8; }
      .exv-yt i { font-style:normal; color:#ff4444; font-size:1.1rem; }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.className = 'exv-ov';
    modal.id = 'exVideoModal';
    modal.onclick = (e) => { if (e.target === modal) closeVideo(); };
    modal.innerHTML = `
      <div class="exv-modal" onclick="event.stopPropagation()">
        <div class="exv-head">
          <div style="flex:1;min-width:0;"><div class="exv-kicker">${t('Ver técnica')}</div><div class="exv-title" id="exvTitle">—</div></div>
          <button class="exv-close" onclick="closeExerciseVideo()">✕</button>
        </div>
        <div class="exv-body" id="exvBody"></div>
        <button class="exv-yt" id="exvYt"><i>▶</i><span>${t('Buscar en YouTube')}</span></button>
      </div>`;
    document.body.appendChild(modal);
  }

  function openVideo(exerciseName) {
    ensureModalDOM();
    if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
    const match = findBest(exerciseName);
    const modal = document.getElementById('exVideoModal');
    document.getElementById('exvTitle').textContent = (match && match.name) || exerciseName;
    document.getElementById('exvYt').onclick = () => {
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(exerciseName + ' técnica ejercicio'), '_blank', 'noopener');
    };

    const steps = (match && match.instructions) || [];
    const images = (match && match.images) || [];
    const stepsHtml = steps.length
      ? `<div class="exv-steps-title">${t('Pasos')}</div>` + steps.map((s, i) => `<div class="exv-step"><div class="exv-step-n">${i + 1}</div><div class="exv-step-t">${s}</div></div>`).join('')
      : `<div class="exv-nodata">${t('No hay instrucciones para este ejercicio.')}</div>`;
    document.getElementById('exvBody').innerHTML =
      (images.length ? `<div class="exv-video" id="exvVideo"><div class="exv-loading">${t('Cargando…')}</div></div>` : '') + stepsHtml + '<div style="height:14px"></div>';

    if (images.length) {
      const vid = document.getElementById('exvVideo');
      const urls = images.map(p => BASE_IMG + p);
      const first = new Image();
      first.onload = () => {
        vid.innerHTML = `<img id="exvImg" src="${urls[0]}" alt="">`;
        if (urls.length > 1) {
          let frame = 0;
          loopInterval = setInterval(() => {
            frame = (frame + 1) % urls.length;
            const im = document.getElementById('exvImg');
            if (im) im.src = urls[frame];
          }, 1100);
        }
      };
      first.onerror = () => { vid.innerHTML = '<div class="exv-loading">⚠️</div>'; };
      first.src = urls[0];
    }
    modal.classList.add('on');
  }

  function closeVideo() {
    if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
    const m = document.getElementById('exVideoModal');
    if (m) m.classList.remove('on');
  }

  window.openExerciseVideo = openVideo;
  window.closeExerciseVideo = closeVideo;
})();
