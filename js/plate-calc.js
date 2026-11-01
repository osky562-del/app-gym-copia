/* ══════════════════════════════════════════════
   CALCULADORA DE DISCOS (PlateDialog de LiveScreen.kt + domain/PlateCalc.kt)
   Uso: openPlateCalc(100)  // peso objetivo opcional
   - Barra 20 / 15 kg
   - "Por cada lado:" discos circulares con los colores de PlateCalc.kt
   - "= X kg en total" y "No exacto: faltan Y kg"
   - Si el objetivo ≤ barra → "Solo la barra (20 kg)"
   ══════════════════════════════════════════════ */
(function () {
  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  const COLORS = { 25: '#E53935', 20: '#1E88E5', 15: '#FDD835', 10: '#43A047', 5: '#ECECEC', 2.5: '#8E8E93', 1.25: '#B0BEC5' };
  const t = (es) => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(es) : es;
  const label = (p) => Number.isInteger(p) ? String(p) : String(p);

  let bar = 20;

  function ensureDOM() {
    if (document.getElementById('pcModal')) return;
    const style = document.createElement('style');
    style.id = 'pcStyle';
    style.textContent = `
      .pc-ov { display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:999; align-items:center; justify-content:center; padding:20px; }
      .pc-ov.on { display:flex; animation:pcFade .2s ease; }
      @keyframes pcFade { from{opacity:0} to{opacity:1} }
      .pc-modal { background:var(--s2,#16161b); border-radius:20px; width:100%; max-width:400px; padding:20px 20px 14px; animation:pcPop .22s ease; max-height:calc(100dvh - 40px); overflow-y:auto; }
      @keyframes pcPop { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      .pc-title { font-size:1.05rem; font-weight:800; color:var(--t1,#fff); margin-bottom:14px; }
      .pc-field { position:relative; }
      .pc-lbl { position:absolute; left:12px; top:-7px; background:var(--s2,#16161b); padding:0 4px; font-size:.66rem; color:var(--t3,#7a7a86); font-weight:600; }
      .pc-winp { width:100%; background:var(--s3,#1d1d23); border:1px solid var(--line2,#2a2a32); border-radius:10px; padding:14px; color:var(--t1,#fff); font-size:1.1rem; font-weight:700; outline:none; box-sizing:border-box; -moz-appearance:textfield; }
      .pc-winp:focus { border-color:var(--a,#4f8cff); }
      .pc-winp::-webkit-inner-spin-button, .pc-winp::-webkit-outer-spin-button { -webkit-appearance:none; }
      .pc-bars { display:flex; gap:8px; margin:10px 0 14px; }
      .pc-bar { padding:7px 14px; border-radius:100px; background:var(--s3,#1d1d23); color:var(--t3,#7a7a86); font-size:.76rem; font-weight:600; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .pc-bar.on { background:var(--a,#4f8cff); color:#fff; }
      .pc-perside { font-size:.76rem; color:var(--t3,#7a7a86); margin-bottom:8px; }
      .pc-plates { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none; }
      .pc-plates::-webkit-scrollbar { display:none; }
      .pc-plate { width:42px; height:42px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.76rem; color:#fff; }
      .pc-total { margin-top:12px; font-size:.95rem; font-weight:800; color:var(--a,#4f8cff); }
      .pc-inexact { font-size:.7rem; color:#F5A623; margin-top:2px; }
      .pc-onlybar { font-size:.82rem; color:var(--t3,#7a7a86); }
      .pc-acts { display:flex; justify-content:flex-end; margin-top:14px; }
      .pc-close { background:none; border:none; color:var(--a,#4f8cff); font-weight:700; font-size:.9rem; padding:8px 10px; cursor:pointer; }
    `;
    document.head.appendChild(style);

    const m = document.createElement('div');
    m.className = 'pc-ov';
    m.id = 'pcModal';
    m.onclick = (e) => { if (e.target === m) closeCalc(); };
    m.innerHTML = `
      <div class="pc-modal" onclick="event.stopPropagation()">
        <div class="pc-title">${t('Calculadora de discos')}</div>
        <div class="pc-field"><span class="pc-lbl">${t('Peso objetivo (kg)')}</span>
          <input class="pc-winp" id="pcWeight" type="number" inputmode="decimal" min="0" step="0.5" oninput="__pcRender()"></div>
        <div class="pc-bars" id="pcBars"></div>
        <div class="pc-result" id="pcResult"></div>
        <div class="pc-acts"><button class="pc-close" onclick="closePlateCalc()">${t('Cerrar')}</button></div>
      </div>`;
    document.body.appendChild(m);
    renderBars();
  }

  function renderBars() {
    document.getElementById('pcBars').innerHTML = [20, 15].map(v =>
      `<div class="pc-bar${v === bar ? ' on' : ''}" onclick="__pcSetBar(${v})">${t('Barra')} ${v}</div>`).join('');
  }

  /* calcPlates de PlateCalc.kt */
  function compute(target) {
    if (target <= bar) return { perSide: [], leftover: 0, reachable: bar };
    let perSide = (target - bar) / 2;
    const out = [];
    for (const p of PLATES) {
      while (perSide >= p - 1e-9) { out.push(p); perSide = Math.round((perSide - p) * 1000) / 1000; }
    }
    const reachable = bar + out.reduce((s, p) => s + p, 0) * 2;
    return { perSide: out, leftover: Math.round(perSide * 2 * 1000) / 1000, reachable };
  }

  function render() {
    const el = document.getElementById('pcResult');
    if (!el) return;
    const raw = String(document.getElementById('pcWeight').value || '').replace(',', '.');
    const target = parseFloat(raw) || 0;
    const r = compute(target);
    if (target <= bar) {
      el.innerHTML = `<div class="pc-onlybar">${t('Solo la barra')} (${label(bar)} kg)</div>`;
      return;
    }
    const plates = r.perSide.map(p => {
      const dark = p === 5 || p === 1.25;
      return `<div class="pc-plate" style="background:${COLORS[p] || '#888'};color:${dark ? '#000' : '#fff'};">${label(p)}</div>`;
    }).join('');
    el.innerHTML = `
      <div class="pc-perside">${t('Por cada lado:')}</div>
      <div class="pc-plates">${plates}</div>
      <div class="pc-total">= ${label(Math.round(r.reachable * 100) / 100)} kg ${t('en total')}</div>
      ${r.leftover > 0.01 ? `<div class="pc-inexact">${t('No exacto: faltan')} ${label(r.leftover)} kg</div>` : ''}`;
  }

  function open(prefill) {
    ensureDOM();
    bar = 20;
    renderBars();
    const inp = document.getElementById('pcWeight');
    inp.value = (prefill !== undefined && prefill !== null && prefill !== '') ? prefill : '';
    document.getElementById('pcModal').classList.add('on');
    render();
    setTimeout(() => { if (!inp.value) inp.focus(); }, 80);
  }
  function closeCalc() {
    const m = document.getElementById('pcModal');
    if (m) m.classList.remove('on');
  }
  function setBar(v) { bar = v; renderBars(); render(); }

  window.openPlateCalc = open;
  window.closePlateCalc = closeCalc;
  window.__pcRender = render;
  window.__pcSetBar = setBar;
})();
