/* ══════════════════════════════════════════════
   TOUR — tutorial interactivo para nuevos usuarios
   ══════════════════════════════════════════════
   Carrusel de bienvenida que arranca solo la primera vez (tras el
   onboarding de perfil) y se puede repetir desde la guía.
   ══════════════════════════════════════════════ */
(function () {
  const SEEN = 'ko95_tourSeen';
  const SLIDES = [
    { ic: '👋', t: '¡Bienvenido a KO95FIT!', d: 'Tu sistema de entrenamiento. Te enseño lo básico en menos de un minuto.' },
    { ic: '📋', t: 'Crea tu entreno', d: 'Plantilla lista, IA o a tu gusto desde “+ Entreno”. Ponle nombre, marca favoritos ★ y repite tu último entreno (🔁) con un toque.' },
    { ic: '🏋️', t: 'Entrena en directo', d: 'Marca cada serie con ✓ (el descanso y el avance van solos). Mira la técnica en vídeo ▶, calcula discos con 🏋 y toca el número de la serie para elegir su tipo (calentamiento, drop set, al fallo…).' },
    { ic: '🔗', t: 'Superseries', d: 'Encadena ejercicios con 🔗: harás A y B sin descanso entre medias, descansando solo al final del grupo.' },
    { ic: '📊', t: 'Mira tu progreso', d: 'Mapa muscular que se ilumina, tu fuerza estimada y nivel, récords de peso y de reps, y gráficas, en la pestaña Progreso.' },
    { ic: '💡', t: 'Tendencias “Para ti”', d: 'En el inicio verás tarjetas inteligentes: tu volumen y tu fuerza subiendo, tu racha y tu grupo muscular estrella del mes.' },
    { ic: '⌚', t: 'Entrena sin el móvil', d: 'Con iPhone + Apple Watch, marca tus series desde la muñeca con el móvil en el bolsillo.' },
    { ic: '✅', t: '¡Listo para empezar!', d: 'Crea tu primer entreno y a darle. Tienes esta guía completa en Perfil → “Cómo usar la app”.', final: true }
  ];
  let idx = 0;

  function ensureDOM() {
    if (document.getElementById('tourOv')) return;
    const style = document.createElement('style');
    style.textContent = `
      .tour-ov{display:none;position:fixed;inset:0;z-index:1002;
        background:radial-gradient(circle at 50% 0%, rgba(79,140,255,.18), rgba(0,0,0,.92) 60%);
        backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        align-items:center;justify-content:center;
        padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));}
      .tour-ov.on{display:flex;animation:tourFade .25s ease;}
      @keyframes tourFade{from{opacity:0}to{opacity:1}}
      .tour-card{width:100%;max-width:360px;background:var(--s1,#131316);
        border:1.5px solid var(--line2,#2a2a32);border-radius:22px;padding:26px 24px 20px;
        text-align:center;position:relative;animation:tourPop .3s cubic-bezier(.2,.8,.2,1);}
      @keyframes tourPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
      .tour-skip{position:absolute;top:12px;right:14px;background:none;border:none;
        color:var(--t3,#7a7a86);font-size:.8rem;font-weight:700;cursor:pointer;padding:6px;}
      .tour-ic{font-size:3.2rem;line-height:1;margin:6px 0 14px;}
      .tour-t{font-size:1.3rem;font-weight:900;margin-bottom:10px;}
      .tour-d{font-size:.9rem;color:var(--t2,#c8c8d0);line-height:1.55;min-height:84px;}
      .tour-dots{display:flex;gap:7px;justify-content:center;margin:18px 0 16px;}
      .tour-dot{width:7px;height:7px;border-radius:50%;background:var(--line2,#2a2a32);transition:all .2s;}
      .tour-dot.on{background:var(--a,#4f8cff);width:20px;border-radius:4px;}
      .tour-btns{display:flex;gap:8px;}
      .tour-b{flex:1;padding:13px;border-radius:12px;font-weight:800;font-size:.9rem;cursor:pointer;
        border:none;-webkit-tap-highlight-color:transparent;}
      .tour-b.prev{background:var(--s3,#222);color:var(--t2,#c8c8d0);border:1px solid var(--line2,#2a2a32);flex:0 0 88px;}
      .tour-b.next{background:var(--a,#4f8cff);color:#fff;}
      .tour-b.go2{background:var(--s3,#222);color:var(--t2,#c8c8d0);border:1px solid var(--line2,#2a2a32);}
    `;
    document.head.appendChild(style);
    const m = document.createElement('div');
    m.className = 'tour-ov'; m.id = 'tourOv';
    m.innerHTML = `
      <div class="tour-card">
        <button class="tour-skip" id="tourSkip" onclick="__tourEnd()">Saltar ✕</button>
        <div class="tour-ic" id="tourIc"></div>
        <div class="tour-t" id="tourT"></div>
        <div class="tour-d" id="tourD"></div>
        <div class="tour-dots" id="tourDots"></div>
        <div class="tour-btns" id="tourBtns"></div>
      </div>`;
    document.body.appendChild(m);
  }

  function render() {
    const s = SLIDES[idx];
    document.getElementById('tourIc').textContent = s.ic;
    document.getElementById('tourT').textContent = s.t;
    document.getElementById('tourD').textContent = s.d;
    document.getElementById('tourDots').innerHTML = SLIDES.map((_, i) => `<span class="tour-dot${i === idx ? ' on' : ''}"></span>`).join('');
    document.getElementById('tourSkip').style.visibility = s.final ? 'hidden' : 'visible';
    const btns = document.getElementById('tourBtns');
    if (s.final) {
      btns.innerHTML = `
        <button class="tour-b go2" onclick="__tourEnd()">Explorar solo</button>
        <button class="tour-b next" onclick="__tourCreate()">Crear mi primer entreno 💪</button>`;
    } else {
      btns.innerHTML = `
        ${idx > 0 ? `<button class="tour-b prev" onclick="__tourPrev()">← Atrás</button>` : ''}
        <button class="tour-b next" onclick="__tourNext()">Siguiente →</button>`;
    }
  }

  function show() { ensureDOM(); idx = 0; render(); document.getElementById('tourOv').classList.add('on'); if (typeof vib === 'function') vib([20]); }
  function end() { const m = document.getElementById('tourOv'); if (m) m.classList.remove('on'); }
  function next() { if (idx >= SLIDES.length - 1) { end(); return; } idx++; render(); }
  function prev() { if (idx > 0) { idx--; render(); } }
  function create() { end(); if (typeof openPlan === 'function') setTimeout(openPlan, 300); }

  // Auto-arranque: solo la 1ª vez, cuando el usuario ya está dentro (perfil hecho, sin login a la vista).
  function userIsIn() {
    try {
      const auth = document.getElementById('authOverlay');
      const ob = document.getElementById('onboarding');
      const authShown = auth && auth.classList.contains('show');
      const obShown = ob && ob.classList.contains('show');
      const onboarded = (typeof STORE !== 'undefined') && STORE.get('onboarded');
      return !!onboarded && !authShown && !obShown;
    } catch (e) { return false; }
  }
  function poll(tries) {
    if (localStorage.getItem(SEEN)) return;
    if (userIsIn()) { try { localStorage.setItem(SEEN, '1'); } catch (e) {} show(); return; }
    if (tries > 0) setTimeout(() => poll(tries - 1), 1500);
  }
  function autoInit() { if (!localStorage.getItem(SEEN)) setTimeout(() => poll(80), 1800); }

  // API global (los onclick del modal y la repetición desde la guía)
  window.__tourNext = next;
  window.__tourPrev = prev;
  window.__tourEnd = end;
  window.__tourCreate = create;
  window.startFeatureTour = show;   // repetir manualmente (desde la guía)

  if (document.readyState !== 'loading') autoInit();
  else window.addEventListener('DOMContentLoaded', autoInit);
})();
