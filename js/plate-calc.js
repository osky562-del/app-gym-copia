/* ══════════════════════════════════════════════
   CALCULADORA DE DISCOS — qué discos poner en la barra
   ══════════════════════════════════════════════
   Uso: openPlateCalc(100)  // peso objetivo opcional
   - Elige peso de barra (20/15/10/0)
   - Muestra los discos por lado (descomposición greedy)
   - Avisa si el peso exacto no se puede montar con discos estándar
   ══════════════════════════════════════════════ */
(function () {
  // Discos estándar de gimnasio en kg (de mayor a menor)
  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  // Colores aproximados de disco de gimnasio
  const COLORS = {
    25: '#e23b3b', 20: '#2f6fe0', 15: '#f0b429', 10: '#2dba5a',
    5: '#ededf2', 2.5: '#15151a', 1.25: '#9aa0aa'
  };

  let bar = 20;

  function ensureDOM() {
    if (document.getElementById('pcModal')) return;
    const style = document.createElement('style');
    style.id = 'pcStyle';
    style.textContent = `
      .pc-ov { display:none; position:fixed; inset:0; background:rgba(0,0,0,.88);
        z-index:999; align-items:flex-start; justify-content:center;
        padding-top:max(16px, env(safe-area-inset-top)); padding-right:16px;
        padding-bottom:max(16px, env(safe-area-inset-bottom)); padding-left:16px;
        backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
      .pc-ov.on { display:flex; animation:pcFade .2s ease; }
      @keyframes pcFade { from{opacity:0} to{opacity:1} }
      .pc-modal { background:var(--s1,#131316); border:1.5px solid var(--line2,#2a2a32);
        border-radius:18px; width:100%; max-width:420px;
        max-height:calc(100dvh - max(16px,env(safe-area-inset-top)) - max(16px,env(safe-area-inset-bottom)) - 16px);
        overflow-y:auto; -webkit-overflow-scrolling:touch; animation:pcPop .22s ease; }
      @keyframes pcPop { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      .pc-head { display:flex; justify-content:space-between; align-items:center;
        padding:14px 16px; border-bottom:1px solid var(--line,#1f1f25);
        position:sticky; top:0; background:var(--s1,#131316); z-index:2; }
      .pc-title { font-size:1rem; font-weight:800; }
      .pc-close { min-width:44px; min-height:44px; border-radius:10px;
        background:var(--s3,#222228); border:1px solid var(--line2,#2a2a32);
        color:var(--t1,#fff); font-size:1.15rem; font-weight:700; cursor:pointer;
        display:flex; align-items:center; justify-content:center; -webkit-tap-highlight-color:transparent; }
      .pc-close:active { background:var(--line2,#2a2a32); transform:scale(.96); }
      .pc-body { padding:16px; }
      .pc-lbl { font-size:.68rem; font-weight:800; color:var(--t3,#7a7a86);
        text-transform:uppercase; letter-spacing:.08em; margin:2px 0 8px; }
      .pc-winp { width:100%; background:var(--s3,#222228); border:1.5px solid var(--line2,#2a2a32);
        border-radius:11px; padding:14px; color:var(--t1,#fff); font-size:1.4rem; font-weight:800;
        text-align:center; outline:none; box-sizing:border-box; font-family:var(--fm,monospace); }
      .pc-bars { display:flex; gap:6px; margin:12px 0 4px; }
      .pc-bar { flex:1; padding:9px 4px; border-radius:9px; background:var(--s3,#222228);
        border:1.5px solid var(--line2,#2a2a32); color:var(--t2,#c8c8d0); font-size:.74rem;
        font-weight:700; cursor:pointer; text-align:center; -webkit-tap-highlight-color:transparent; }
      .pc-bar.on { background:var(--ag,rgba(79,140,255,.15)); border-color:var(--a,#4f8cff); color:var(--a,#4f8cff); }
      .pc-result { margin-top:18px; }
      .pc-perside { font-size:.72rem; color:var(--t3,#7a7a86); margin-bottom:10px; text-align:center; }
      .pc-plates { display:flex; flex-wrap:wrap; gap:7px; justify-content:center; align-items:center; min-height:54px; }
      .pc-plate { min-width:46px; height:50px; border-radius:8px; display:flex; align-items:center;
        justify-content:center; font-weight:800; font-size:.9rem; color:#fff;
        box-shadow:0 2px 6px rgba(0,0,0,.3); padding:0 6px; }
      .pc-empty { color:var(--t3,#7a7a86); font-size:.85rem; }
      .pc-note { margin-top:14px; padding:10px 12px; border-radius:9px; font-size:.78rem; line-height:1.4; }
      .pc-note.ok { background:rgba(48,217,152,.10); border:1px solid rgba(48,217,152,.3); color:var(--green,#2dd98a); }
      .pc-note.warn { background:rgba(245,166,35,.10); border:1px solid rgba(245,166,35,.3); color:var(--amber,#f5a623); }
      .pc-note.err { background:rgba(255,77,79,.10); border:1px solid rgba(255,77,79,.3); color:#ff6b6b; }
      .pc-total { text-align:center; font-size:1.1rem; font-weight:800; margin-top:12px; }
    `;
    document.head.appendChild(style);

    const m = document.createElement('div');
    m.className = 'pc-ov';
    m.id = 'pcModal';
    m.onclick = (e) => { if (e.target === m) closeCalc(); };
    m.innerHTML = `
      <div class="pc-modal" onclick="event.stopPropagation()">
        <div class="pc-head">
          <div class="pc-title">🏋 Calculadora de discos</div>
          <button class="pc-close" onclick="closePlateCalc()">✕</button>
        </div>
        <div class="pc-body">
          <div class="pc-lbl">Peso objetivo (kg)</div>
          <input class="pc-winp" id="pcWeight" type="number" inputmode="decimal" min="0" step="0.5" placeholder="—" oninput="__pcRender()">
          <div class="pc-lbl" style="margin-top:14px;">Peso de la barra</div>
          <div class="pc-bars" id="pcBars"></div>
          <div class="pc-result" id="pcResult"></div>
        </div>
      </div>`;
    document.body.appendChild(m);
    renderBars();
  }

  function renderBars() {
    const opts = [{ v: 20, t: '20 kg' }, { v: 15, t: '15 kg' }, { v: 10, t: '10 kg' }, { v: 0, t: 'Sin barra' }];
    document.getElementById('pcBars').innerHTML = opts.map(o =>
      `<div class="pc-bar${o.v === bar ? ' on' : ''}" onclick="__pcSetBar(${o.v})">${o.t}</div>`
    ).join('');
  }

  function compute(target) {
    const perSide = (target - bar) / 2;
    if (perSide < -1e-9) return { error: 'bar' };
    let rem = perSide;
    const used = [];
    for (const p of PLATES) {
      while (rem >= p - 1e-9) { used.push(p); rem = Math.round((rem - p) * 1000) / 1000; }
    }
    return { perSide, used, leftover: Math.round(rem * 1000) / 1000 };
  }

  function render() {
    const el = document.getElementById('pcResult');
    if (!el) return;
    const raw = document.getElementById('pcWeight').value;
    const target = parseFloat(raw);
    if (!raw || isNaN(target) || target <= 0) {
      el.innerHTML = `<div class="pc-perside">Escribe un peso para ver los discos.</div>`;
      return;
    }
    const r = compute(target);
    if (r.error === 'bar') {
      el.innerHTML = `<div class="pc-note err">El peso objetivo (${target} kg) es menor que la barra (${bar} kg).</div>`;
      return;
    }
    const platesHtml = r.used.length
      ? r.used.map(p => {
          const c = COLORS[p] || '#888';
          const dark = p === 5;
          return `<div class="pc-plate" style="background:${c};color:${dark ? '#111' : '#fff'};border:${dark ? '1px solid #ccc' : 'none'};">${p}</div>`;
        }).join('')
      : `<div class="pc-empty">Solo la barra (${bar} kg)</div>`;
    const achieved = bar + (r.perSide - r.leftover) * 2;
    let note;
    if (r.leftover <= 1e-9) {
      note = `<div class="pc-note ok">✓ Peso exacto con discos estándar.</div>`;
    } else {
      note = `<div class="pc-note warn">⚠️ Con discos estándar lo más cercano por debajo es <b>${achieved} kg</b> (faltan ${(r.leftover * 2).toFixed(2)} kg para los ${target} kg).</div>`;
    }
    el.innerHTML = `
      <div class="pc-perside">Por cada lado de la barra:</div>
      <div class="pc-plates">${platesHtml}</div>
      <div class="pc-total">${achieved} kg <span style="font-size:.7rem;color:var(--t3);font-weight:600;">(barra ${bar} + ${(r.perSide - r.leftover).toFixed(2)}×2)</span></div>
      ${note}`;
  }

  function open(prefill) {
    ensureDOM();
    renderBars();
    const inp = document.getElementById('pcWeight');
    if (prefill && +prefill > 0) inp.value = prefill;
    document.getElementById('pcModal').classList.add('on');
    render();
    setTimeout(() => { if (!inp.value) inp.focus(); }, 80);
  }
  function closeCalc() {
    const m = document.getElementById('pcModal');
    if (m) m.classList.remove('on');
  }
  function setBar(v) { bar = v; renderBars(); render(); }

  // API global
  window.openPlateCalc = open;
  window.closePlateCalc = closeCalc;
  window.__pcRender = render;
  window.__pcSetBar = setBar;
})();
