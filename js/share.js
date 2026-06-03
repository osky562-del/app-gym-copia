/* ══════════════════════════════════════════════
   COMPARTIR ENTRENO COMO IMAGEN
   ══════════════════════════════════════════════
   shareWorkoutImage(wk): genera una tarjeta PNG del entreno y la comparte
   (Web Share API si está disponible) o la muestra para guardar (mantener
   pulsado en iOS) / descargar.
   ══════════════════════════════════════════════ */
(function () {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fmtDate(d) {
    if (!d) return '';
    const p = d.split('-');
    if (p.length !== 3) return d;
    return `${+p[2]} ${MESES[+p[1] - 1] || ''} ${p[0]}`;
  }
  function big(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(Math.round(n)); }

  function drawCard(wk) {
    const exs = wk.exercises || [];
    const totalSets = exs.reduce((s, e) => s + (+e.sets || 0), 0);
    const totalVol = exs.reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0);
    const dur = wk.duration ? wk.duration + ' min' : '—';

    const W = 1080, H = 1350, P = 70;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');

    // Fondo + glow superior
    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(W / 2, -40, 0, W / 2, -40, 760);
    g.addColorStop(0, 'rgba(79,140,255,.28)'); g.addColorStop(1, 'rgba(79,140,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, 460);

    // Cabecera: logo + fecha
    x.textBaseline = 'alphabetic';
    x.textAlign = 'left'; x.font = '900 66px Inter, Arial, sans-serif';
    x.fillStyle = '#fff'; x.fillText('KO95', P, 132);
    const wKo = x.measureText('KO95').width;
    x.fillStyle = '#ff3b30'; x.fillText('FIT', P + wKo, 132);
    x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '600 34px Inter, Arial, sans-serif';
    x.fillText(fmtDate(wk.date), W - P, 124);

    // Título
    x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = '800 58px Inter, Arial, sans-serif';
    x.fillText('Entreno completado', P, 250);

    // 4 cajas de stats (2×2)
    const stats = [
      { v: dur, l: 'DURACIÓN', c: '#4f8cff' },
      { v: String(exs.length), l: 'EJERCICIOS', c: '#2dd98a' },
      { v: String(totalSets), l: 'SERIES', c: '#a57aff' },
      { v: big(totalVol) + ' kg', l: 'VOLUMEN', c: '#f5a623' }
    ];
    const bw = (W - P * 2 - 24) / 2, bh = 150;
    stats.forEach((s, i) => {
      const bx = P + (i % 2) * (bw + 24);
      const by = 300 + Math.floor(i / 2) * (bh + 22);
      roundRect(x, bx, by, bw, bh, 22); x.fillStyle = '#141418'; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 2; x.stroke();
      x.textAlign = 'left';
      x.fillStyle = s.c; x.font = '800 56px Inter, Arial, sans-serif';
      x.fillText(s.v, bx + 30, by + 78);
      x.fillStyle = 'rgba(255,255,255,.45)'; x.font = '700 26px Inter, Arial, sans-serif';
      x.fillText(s.l, bx + 30, by + 120);
    });

    let y = 300 + 2 * (bh + 22) + 26;

    // Ejercicios
    x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '700 28px Inter, Arial, sans-serif';
    x.textAlign = 'left'; x.fillText('EJERCICIOS', P, y); y += 34;
    const maxRows = 11;
    const shown = exs.slice(0, maxRows);
    shown.forEach(e => {
      roundRect(x, P, y, W - P * 2, 64, 14); x.fillStyle = '#121216'; x.fill();
      x.fillStyle = '#fff'; x.font = '600 32px Inter, Arial, sans-serif'; x.textAlign = 'left';
      let nm = e.ex || '';
      while (x.measureText(nm).width > W - P * 2 - 300 && nm.length > 4) nm = nm.slice(0, -2);
      if (nm !== (e.ex || '')) nm += '…';
      x.fillText(nm, P + 24, y + 42);
      x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 30px Inter, Arial, sans-serif';
      const det = `${e.sets || ''}×${e.reps || ''}${e.kg ? '  ·  ' + e.kg + 'kg' : ''}`;
      x.fillText(det, W - P - 24, y + 42);
      y += 76;
    });
    if (exs.length > maxRows) {
      x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '600 28px Inter, Arial, sans-serif';
      x.fillText(`+ ${exs.length - maxRows} ejercicios más`, P, y + 20); y += 50;
    }

    // Pie
    x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.3)'; x.font = '700 30px Inter, Arial, sans-serif';
    x.fillText('KO95FIT · Hardcore Training System', W / 2, H - 60);

    return c;
  }

  function roundRect(x, rx, ry, w, h, r) {
    x.beginPath();
    x.moveTo(rx + r, ry);
    x.arcTo(rx + w, ry, rx + w, ry + h, r);
    x.arcTo(rx + w, ry + h, rx, ry + h, r);
    x.arcTo(rx, ry + h, rx, ry, r);
    x.arcTo(rx, ry, rx + w, ry, r);
    x.closePath();
  }

  function ensureModal() {
    if (document.getElementById('shareImgModal')) return;
    const style = document.createElement('style');
    style.textContent = `
      .si-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:1000;
        align-items:flex-start;justify-content:center;
        padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow-y:auto;}
      .si-ov.on{display:flex;animation:siFade .2s ease;}
      @keyframes siFade{from{opacity:0}to{opacity:1}}
      .si-box{width:100%;max-width:380px;}
      .si-img{width:100%;border-radius:16px;border:1.5px solid var(--line2,#2a2a32);display:block;
        box-shadow:0 10px 40px rgba(0,0,0,.5);}
      .si-hint{color:var(--t3,#7a7a86);font-size:.8rem;text-align:center;margin:12px 0;line-height:1.4;}
      .si-btns{display:flex;gap:8px;}
      .si-btn{flex:1;padding:13px;border-radius:11px;font-weight:800;font-size:.9rem;cursor:pointer;
        text-align:center;text-decoration:none;-webkit-tap-highlight-color:transparent;}
      .si-btn.dl{background:var(--a,#4f8cff);color:#fff;border:none;}
      .si-btn.cl{background:var(--s3,#222228);color:var(--t2,#c8c8d0);border:1px solid var(--line2,#2a2a32);}
    `;
    document.head.appendChild(style);
    const m = document.createElement('div');
    m.className = 'si-ov'; m.id = 'shareImgModal';
    m.onclick = (e) => { if (e.target === m) closeShareImg(); };
    m.innerHTML = `
      <div class="si-box" onclick="event.stopPropagation()">
        <img class="si-img" id="siImg" alt="Resumen del entreno">
        <div class="si-hint">Mantén pulsada la imagen para guardarla o compartirla 📲</div>
        <div class="si-btns">
          <a class="si-btn dl" id="siDownload" download="ko95fit-entreno.png">⬇ Descargar</a>
          <button class="si-btn cl" onclick="closeShareImg()">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }
  function showImageModal(url) {
    ensureModal();
    document.getElementById('siImg').src = url;
    document.getElementById('siDownload').href = url;
    document.getElementById('shareImgModal').classList.add('on');
  }
  function closeShareImg() {
    const m = document.getElementById('shareImgModal');
    if (m) m.classList.remove('on');
  }

  function shareWorkoutImage(wk) {
    if (!wk) { if (typeof toast === 'function') toast('No hay entreno para compartir', 'err'); return; }
    let canvas;
    try { canvas = drawCard(wk); }
    catch (e) { console.warn('share draw:', e); if (typeof toast === 'function') toast('No se pudo generar la imagen', 'err'); return; }
    canvas.toBlob(async (blob) => {
      if (!blob) { if (typeof toast === 'function') toast('No se pudo generar la imagen', 'err'); return; }
      const file = new File([blob], 'ko95fit-entreno.png', { type: 'image/png' });
      // Intentar Web Share API con archivo (móviles modernos)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Mi entreno KO95FIT', text: '💪 Entreno completado con KO95FIT' });
          return;
        } catch (e) { /* cancelado o no soportado → fallback */ }
      }
      // Fallback universal: mostrar la imagen para guardar / descargar
      showImageModal(URL.createObjectURL(blob));
    }, 'image/png');
  }

  window.shareWorkoutImage = shareWorkoutImage;
  window.closeShareImg = closeShareImg;
})();
