/* ══ IA COACH ══ */

function updateAiUsageBadge() {
  const el = $('aiUsageBadge');
  if (!el) return;
  if (Pro.isPro()) {
    el.textContent = 'Coach IA ilimitado';
    el.className = 'pro-ai-remaining';
    return;
  }
  const remaining = Pro.aiRemaining();
  el.textContent = remaining > 0
    ? 'Consultas IA: ' + remaining + '/1 esta semana'
    : 'Sin consultas IA — Mejora a Pro';
  el.className = 'pro-ai-remaining' + (remaining === 0 ? ' empty' : remaining <= 1 ? ' warn' : '');
}

function loadPerfil() {
  const p = STORE.get('perfil') || {};
  if ($('pfSexo')) $('pfSexo').value = p.sexo || '';
  if ($('pfEdad')) $('pfEdad').value = p.edad || '';
  if ($('pfPeso')) $('pfPeso').value = p.peso || '';
  if ($('pfAltura')) $('pfAltura').value = p.altura || '';
  if ($('pfNivel')) $('pfNivel').value = p.nivel || '';
  if ($('pfObjetivo')) $('pfObjetivo').value = p.objetivo || '';
  if ($('pfDias')) $('pfDias').value = p.dias || '';
  if ($('pfLesiones')) $('pfLesiones').value = p.lesiones || '';
  // If perfil already saved, show consejos
  if (p.nivel) generarConsejos(p);
  else $('aiConsejos').innerHTML = '<div class="ai-empty"><div class="ai-empty-ic">🤖</div><div class="ai-empty-t">Rellena tu perfil</div><div class="ai-empty-d">Completa los datos de arriba y pulsa el botón para recibir consejos personalizados basados en tus entrenos.</div></div>';
}

function savePerfilAndGenerate() {
  const p = {
    sexo: $('pfSexo').value,
    edad: +$('pfEdad').value || 0,
    peso: +$('pfPeso').value || 0,
    altura: +$('pfAltura').value || 0,
    nivel: $('pfNivel').value,
    objetivo: $('pfObjetivo').value,
    dias: +$('pfDias').value || 0,
    lesiones: $('pfLesiones').value.trim() || 'ninguna',
    grasa: +$('pfGrasa').value || null,
    actividad: $('pfAct').value || 'moderada',
    dieta: $('pfDieta').value || 'omnívoro'
  };
  if (!p.nivel || !p.objetivo) return toast('Selecciona nivel y objetivo mínimo', 'err');
  STORE.set('perfil', p);
  generarConsejosLocal(p);       // Instant local analysis (always free)
  // AI coach gated by Pro plan
  Pro.gate('ai_coach', () => {
    Pro.trackAiUsage();
    generarConsejosIA(p);
  });
  toast('Perfil guardado ✓', 'good');
}

/* ── LOCAL ANALYSIS (instant) ── */
function generarConsejosLocal(p) {
  const el = $('aiConsejos');

  /* Calcular métricas */
  const imc = (p.peso && p.altura) ? +(p.peso / ((p.altura / 100) ** 2)).toFixed(1) : null;
  const imcCat = !imc ? null : imc < 18.5 ? 'bajo peso' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad';
  const tmb = p.peso && p.altura && p.edad ? (
    p.sexo === 'mujer'
      ? 447.6 + 9.25 * p.peso + 3.1 * p.altura - 4.33 * p.edad
      : 88.36 + 13.4 * p.peso + 4.8 * p.altura - 5.68 * p.edad
  ) : null;
  const factorAct = [1.2, 1.375, 1.55, 1.725, 1.9][[2, 3, 4, 5, 6].indexOf(p.dias)] ?? 1.375;
  const kcalMantenimiento = tmb ? Math.round(tmb * factorAct) : null;
  const kcalObjetivo = kcalMantenimiento ? (
    p.objetivo === 'ganar músculo' ? kcalMantenimiento + 300 :
      p.objetivo === 'perder grasa' ? kcalMantenimiento - 400 :
        p.objetivo === 'ganar fuerza' ? kcalMantenimiento + 200 :
          kcalMantenimiento
  ) : null;
  const proteinaMin = p.peso ? Math.round(p.peso * 1.8) : null;
  const proteinaMax = p.peso ? Math.round(p.peso * 2.2) : null;

  /* Historial */
  const totalSess = workouts.length;
  const streak = calcStreak();
  const maxStreak = calcMaxStreak();
  const semanas = totalSess ? Math.max(1, Math.ceil((new Date() - new Date(workouts[workouts.length - 1].date + 'T00:00:00')) / 604800000)) : 1;
  const sessPorSemana = +(totalSess / semanas).toFixed(1);
  const diasObj = p.dias || 3;
  let volTotal = 0;
  const volPorMus = {};
  const exCount = {};
  workouts.forEach(w => {
    (w.exercises || []).forEach(e => {
      const v = (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1);
      volTotal += v;
      const mus = getMuscle(e.ex);
      volPorMus[mus] = (volPorMus[mus] || 0) + v;
      exCount[e.ex] = (exCount[e.ex] || 0) + 1;
    });
  });
  const musEntries = Object.entries(volPorMus).sort((a, b) => b[1] - a[1]);
  const musMas = musEntries[0]?.[0];
  const musMenos = musEntries[musEntries.length - 1]?.[0];
  const ejercicioFav = Object.entries(exCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const rpeVals = workouts.filter(w => w.rpe).map(w => +w.rpe);
  const rpeMedio = rpeVals.length ? +(rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1) : null;
  const consistencia = diasObj > 0 ? Math.min(100, Math.round((sessPorSemana / diasObj) * 100)) : null;

  /* Cards locales */
  let html = '';
  html += `<div class="consejo-card">
<div class="consejo-header">
  <div class="consejo-icon blue">📊</div>
  <div class="consejo-title">Tu perfil de atleta</div>
  <span class="consejo-badge tip">${p.nivel}</span>
</div>
<div class="consejo-body">
  <ul class="consejo-list">
    ${imc ? `<li><strong>IMC ${imc}</strong> — ${imcCat}${imcCat === 'normal' ? ' ✓' : imcCat === 'sobrepeso' ? ' (considera déficit calórico)' : imcCat === 'bajo peso' ? ' (considera superávit calórico)' : ''}.</li>` : ''}
    ${kcalObjetivo ? `<li><strong>Calorías objetivo: ~${kcalObjetivo} kcal/día</strong> para ${p.objetivo} (mantenimiento ~${kcalMantenimiento} kcal).</li>` : ''}
    ${proteinaMin ? `<li><strong>Proteína: ${proteinaMin}–${proteinaMax}g/día</strong> para tu objetivo.</li>` : ''}
    <li>Llevas <strong>${totalSess} sesiones</strong> — media de <strong>${sessPorSemana} días/semana</strong>.</li>
    ${streak > 0 ? `<li>Racha actual de <strong>${streak} días</strong> — ¡sigue así!</li>` : ''}
  </ul>
</div>
  </div>`;

  /* Card placeholder IA */
  html += `<div class="consejo-card" id="iaAdviceCard" style="border:1px solid rgba(155,114,245,.2);background:linear-gradient(135deg,var(--s1),rgba(155,114,245,.04));">
<div class="consejo-header">
  <div class="consejo-icon purple">🤖</div>
  <div class="consejo-title">Coach IA</div>
  <span class="consejo-badge tip" id="iaAdviceStatus" style="background:var(--pg);color:var(--purple);">Conectando…</span>
</div>
<div class="consejo-body" id="iaAdviceBody">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 0;">
    <div class="sp-orbit" style="width:32px;height:32px;margin:0;"></div>
    <div style="font-size:.82rem;color:var(--t3);">Analizando tu historial con IA…</div>
  </div>
</div>
  </div>`;

  /* Card análisis local */
  if (totalSess > 0) {
    const consBaja = consistencia !== null && consistencia < 70;
    const consAlta = consistencia !== null && consistencia >= 90;
    const rpeAlto = rpeMedio && rpeMedio > 8.5;
    const rpeBajo = rpeMedio && rpeMedio < 5;
    html += `<div class="consejo-card">
  <div class="consejo-header">
    <div class="consejo-icon amber">📈</div>
    <div class="consejo-title">Análisis de entrenos</div>
    <span class="consejo-badge ${consBaja ? 'warn' : 'ok'}">${consistencia !== null ? consistencia + '%' : '—'}</span>
  </div>
  <div class="consejo-body">
    <ul class="consejo-list">
      ${musMas ? `<li>Músculo top: <strong>${musMas}</strong>. ${musMenos && musMenos !== musMas ? `Débil: <strong>${musMenos}</strong> — priorizalo.` : ''}` : ''}
      ${ejercicioFav ? `<li>Ejercicio favorito: <strong>${ejercicioFav}</strong>.</li>` : ''}
      ${rpeMedio ? `<li>RPE medio: <strong>${rpeMedio}/10</strong>. ${rpeAlto ? 'Muy intenso — controla fatiga.' : rpeBajo ? 'Podrías subir intensidad.' : 'Adecuado ✓'}</li>` : ''}
      ${consBaja ? `<li>⚠️ Consistencia ${consistencia}% — entrenas menos de ${diasObj} días/semana planificados.</li>` : ''}
      ${consAlta ? `<li>🔥 ${consistencia}% consistencia — excelente.</li>` : ''}
    </ul>
  </div>
</div>`;
  }
  el.innerHTML = html;
}

/* ── AI-POWERED CONFIG (Unified Backend) ── */
const AI_BRAIN_WORKER = 'https://consejosapp.osky562.workers.dev/';
const PROMPT_WORKER = AI_BRAIN_WORKER;
const CONSEJOS_WORKER = AI_BRAIN_WORKER;

/* ── AI-POWERED CONSEJOS (OpenRouter via Worker) ── */
async function generarConsejosIA(p) {
  const statusEl = $('iaAdviceStatus');
  const bodyEl = $('iaAdviceBody');
  if (!statusEl || !bodyEl) return;

  /* ── Recopilar TODOS los datos del usuario ── */
  const totalSess = workouts.length;
  const streak = calcStreak();
  const maxStreak = calcMaxStreak();
  let volTotal = 0, exCount = {}, exMaxKg = {};
  const volPorMus = {};
  const rpeVals = [];
  const duraciones = [];

  workouts.forEach(w => {
    if (w.rpe) rpeVals.push(+w.rpe);
    if (w.duration) duraciones.push(w.duration);
    (w.exercises || []).forEach(e => {
      const kg = +e.kg || 0, sets = +e.sets || 1, reps = +e.reps || 1;
      const v = kg * sets * reps;
      volTotal += v;
      const mus = getMuscle(e.ex);
      volPorMus[mus] = (volPorMus[mus] || 0) + v;
      exCount[e.ex] = (exCount[e.ex] || 0) + 1;
      if (!exMaxKg[e.ex] || kg > exMaxKg[e.ex]) exMaxKg[e.ex] = kg;
    });
  });

  // Top exercises and PRs
  const topExs = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const prsText = topExs.map(([ex, cnt]) => `${ex}: ${exMaxKg[ex] || 0}kg (${cnt} veces)`).join('\n  ');

  // Muscle balance
  const musTotal = Object.values(volPorMus).reduce((a, b) => a + b, 0) || 1;
  const musBalance = Object.entries(volPorMus).sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `${m}: ${Math.round(v / musTotal * 100)}% (${big(v)}kg)`).join('\n  ');

  // Weekly comparison
  const weekComp = getWeekCompare();

  // RPE stats
  const rpeMedio = rpeVals.length ? +(rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1) : null;
  const rpeMax = rpeVals.length ? Math.max(...rpeVals) : null;
  const rpeMin = rpeVals.length ? Math.min(...rpeVals) : null;

  // Duration stats
  const durMedia = duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : null;

  // Last 5 sessions summary
  const last5 = workouts.slice(0, 5).map(w => {
    const exs = (w.exercises || []).map(e => e.ex).join(', ');
    const vol = (w.exercises || []).reduce((s, e) => s + (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1), 0);
    return `${w.date} — ${w.name || 'Sesión'}: ${exs} (vol: ${big(vol)}kg${w.rpe ? ' RPE:' + w.rpe : ''})`;
  }).join('\n  ');

  // Consistency
  const semanas = totalSess ? Math.max(1, Math.ceil((new Date() - new Date(workouts[workouts.length - 1]?.date + 'T00:00:00')) / 604800000)) : 1;
  const sessPorSemana = +(totalSess / semanas).toFixed(1);
  const consistencia = p.dias > 0 ? Math.min(100, Math.round((sessPorSemana / p.dias) * 100)) : null;

  // Weight history
  const wLogs = weightLogs || [];
  const lastWeight = wLogs.length ? wLogs[wLogs.length - 1] : null;
  const weightTrend = wLogs.length >= 2 ? (wLogs[wLogs.length - 1].kg - wLogs[0].kg).toFixed(1) : null;

  // IMC
  const imc = (p.peso && p.altura) ? +(p.peso / ((p.altura / 100) ** 2)).toFixed(1) : null;

  const prompt = `Coach IA KO95FIT - Entrenador Personal Pro. 
  PERFIL: ${p.sexo||'?'}, ${p.edad||'?'}a, ${p.peso||'?'}kg, ${p.altura||'?'}cm, ${p.grasa ? 'Grasa:'+p.grasa+'%,' : ''} Dieta: ${p.dieta}, Actividad: ${p.actividad}, IMC ${imc||'?'}, nivel ${p.nivel}, objetivo ${p.objetivo}, ${p.dias||3} d/sem, lesiones: ${p.lesiones}. 
  HISTORIAL: ${totalSess} ses, racha ${streak}d, vol ${big(volTotal)}kg, RPE ${rpeMedio||'?'}, consistencia ${consistencia||'?'}%. 
  TOP PRs: ${prsText||'sin datos'}. 
  MUSCULOS: ${musBalance||'sin datos'}. 
  SEMANA: vol ${weekComp.volDelta>=0?'+':''}${weekComp.volDelta}%, ${weekComp.curSess} ses. 
  ULTIMAS: ${last5||'ninguna'}. 
  ANALIZA minuciosamente y RESPONDE con: 🎯DIAGNOSTICO | 💪ENTRENAMIENTO | 🥗NUTRICION (específica para su ${p.dieta}) | 😴RECUPERACION | 🔥MOTIVACION | ⚡RETO. Max 250 palabras, tono profesional y técnico.`;

  statusEl.textContent = 'Coach IA consultando...';
  try {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 45000);
    const r = await fetch(CONSEJOS_WORKER, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75
      })
    });
    clearTimeout(tid);
    
    if (r.ok) {
      const content = await r.text();
      if (content && content.length > 50) {
        statusEl.textContent = 'Coach IA ✓';
        statusEl.style.background = 'var(--gg)';
        statusEl.style.color = 'var(--green)';
        
        // Rich parsing into HTML (Ultra-Premium UI)
        let html = '<div style="display:flex;flex-direction:column;gap:16px;animation:fadeUp .4s ease;margin-bottom:20px;">';
        
        // Header estilo cyberpunk IA
        html += `
          <div style="background:linear-gradient(135deg, rgba(80,130,250,0.1), transparent); border:1px solid rgba(80,130,250,0.2); border-radius:12px; padding:12px; display:flex; gap:12px; align-items:center;">
            <div style="width:40px;height:40px;border-radius:50%;background:rgba(80,130,250,0.2);display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(80,130,250,0.3);flex-shrink:0;">
              <i class="fa-solid fa-robot" style="color:#5082fa;font-size:1.1rem;"></i>
            </div>
            <div>
              <div style="font-size:.7rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:2px;">Cerebro Central IA</div>
              <div style="font-size:.85rem;color:var(--t1);font-weight:600;line-height:1.3;">Análisis táctico completado. Tus datos han sido procesados:</div>
            </div>
          </div>
        `;
        
        const lines = content.split('\n');
        let currentSection = null;

        const themeMap = {
          '🎯': { bg: 'rgba(26,77,255,0.05)', b1: '#1A4DFF', b2: '#00C6FF', t: '#5082fa' },
          '💪': { bg: 'rgba(245,166,35,0.05)', b1: '#F5A623', b2: '#FFD000', t: '#f5a623' },
          '🥗': { bg: 'rgba(0,176,155,0.05)', b1: '#00B09B', b2: '#96C93D', t: '#00b09b' },
          '😴': { bg: 'rgba(142,45,226,0.05)', b1: '#8E2DE2', b2: '#4A00E0', t: '#b06ab3' },
          '🔥': { bg: 'rgba(255,65,108,0.05)', b1: '#FF416C', b2: '#FF4B2B', t: '#ff416c' },
          '⚡': { bg: 'rgba(79,172,254,0.05)', b1: '#4facfe', b2: '#00f2fe', t: '#4facfe' },
          '📊': { bg: 'rgba(26,77,255,0.05)', b1: '#1A4DFF', b2: '#00C6FF', t: '#5082fa' }
        };

        lines.forEach(line => {
          let clean = line.trim();
          if (!clean) return;

          const cleanNoBold = line.replace(/\*|#|_/g, '').trim();
          const isHeaderPattern = /^([🎯💪🥗😴🔥⚡📊🏋💊🧠])/u.test(cleanNoBold) || (/^[A-ZÁÉÍÓÚÑ ]+(:|—|-)/.test(cleanNoBold) && cleanNoBold.length < 50);

          if (isHeaderPattern && cleanNoBold.length < 60) {
            if (currentSection) html += '</div></div></div>'; // Cierra content-wrapper, flex-col, card
            
            const emojiMatch = cleanNoBold.match(/^([\u2700-\u27BF]|[\uD83C-\uD83E][\uDC00-\uDFFF])/u);
            const emoji = emojiMatch ? emojiMatch[0] : '🎯';
            let title = cleanNoBold.replace(/^[\s\u2700-\u27BF\uD83C-\uD83E\uDC00-\uDFFF]+/, '').replace(/[:—\-]+$/, '').trim();
            if(!title) title = "CONSEJO TÁCTICO";

            const theme = themeMap[emoji] || themeMap['🎯'];
            
            html += `
              <div style="background:var(--c2); border:1px solid rgba(255,255,255,0.04); border-radius:14px; position:relative; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.2);">
                <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg, ${theme.b1}, ${theme.b2});box-shadow:0 0 10px ${theme.b1};"></div>
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg, ${theme.bg}, transparent);z-index:0;pointer-events:none;"></div>
                
                <div style="position:relative;z-index:1;padding:16px;">
                  
                  <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed rgba(255,255,255,0.08);">
                    <div style="width:36px;height:36px;border-radius:10px;background:var(--bg);border:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:inset 0 4px 6px rgba(0,0,0,0.3);">
                      ${emoji}
                    </div>
                    <div style="flex:1;">
                      <div style="font-size:1.05rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase;background:linear-gradient(90deg, ${theme.b1}, ${theme.b2});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${title}</div>
                      <div style="font-size:.6rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;font-weight:700;">KO95FIT ENGINE</div>
                    </div>
                  </div>
                  
                  <div style="font-size:.88rem;color:var(--t1);line-height:1.6;display:flex;flex-direction:column;gap:10px;">
            `;
            currentSection = theme;
            return;
          }
          
          clean = clean.replace(/\*\*(.*?)\*\*/g, (match, p1) => {
             let tColor = currentSection ? currentSection.t : 'var(--amber)';
             return `<span style="background:rgba(255,255,255,0.05);padding:1px 6px;border-radius:4px;color:${tColor};font-weight:700;border:1px solid rgba(255,255,255,0.08);">${p1}</span>`;
          });
          
          const isListItem = /^[-•\*]\s+/.test(cleanNoBold);
          let textContent = clean;
          if (isListItem) {
             textContent = textContent.replace(/^(<span[^>]*>)?[-•\*]\s+(<\/span>)?|[-•\*]\s+/, '').trim();
          }
          
          if (currentSection) {
            if (isListItem) {
              html += `
                <div style="display:flex; gap:10px; align-items:flex-start; background:rgba(0,0,0,0.25); border-radius:8px; padding:12px; border:1px solid rgba(255,255,255,0.02);">
                  <div style="margin-top:6px;width:6px;height:6px;border-radius:50%;background:${currentSection.t};box-shadow:0 0 8px ${currentSection.t};flex-shrink:0;"></div>
                  <div style="flex:1;">${textContent}</div>
                </div>
              `;
            } else {
              html += `<div style="color:var(--t2);">${textContent}</div>`;
            }
          } else {
            html += `<div style="font-size:.88rem;color:var(--t2);line-height:1.6;">${clean}</div>`;
          }
        });
        
        if (currentSection) html += '</div></div></div>';
        html += '</div>';
        
        bodyEl.innerHTML = html;
        STORE.set('iaConsejos', { html, ts: Date.now() });
        setTimeout(() => statusEl.style.display = 'none', 3000);
        return;
      }
    }
    throw new Error(`Error ${r.status}`);
  } catch (e) {
    statusEl.textContent = 'Error: ' + (e.name === 'AbortError' ? 'Timeout' : e.message);
    statusEl.style.background = 'var(--rg)';
    statusEl.style.color = 'var(--red)';
    const cached = STORE.get('iaConsejos');
    if (cached?.html) bodyEl.innerHTML = cached.html + '<div style="font-size:.6rem;color:var(--t4);margin-top:8px;">Datos en caché</div>';
  }
}

/* ── generarConsejos (backward compat) ── */
function generarConsejos(p) {
  generarConsejosLocal(p);
  // Load cached AI advice if recent (< 6h)
  const cached = STORE.get('iaConsejos');
  if (cached && cached.html && (Date.now() - cached.ts < 21600000)) {
    setTimeout(() => {
      const s = $('iaAdviceStatus'), b = $('iaAdviceBody');
      if (s && b) { s.textContent = 'En caché'; s.style.background = 'var(--gg)'; s.style.color = 'var(--green)'; b.innerHTML = cached.html; }
    }, 100);
  } else if (Pro.can('ai_coach')) {
    Pro.trackAiUsage();
    generarConsejosIA(p);
  } else {
    setTimeout(() => {
      const s = $('iaAdviceStatus'), b = $('iaAdviceBody');
      if (s && b) {
        s.textContent = 'Límite alcanzado';
        s.style.background = 'var(--rg)';
        s.style.color = 'var(--red)';
        b.innerHTML = '<div style="text-align:center;padding:16px;"><div style="font-size:1.5rem;margin-bottom:8px;">🔒</div><div style="font-size:.85rem;color:var(--t2);margin-bottom:12px;">Has usado tu consulta IA gratuita esta semana.</div><button onclick="Pro.showUpgradeModal(\'ai_coach\')" style="background:var(--a);color:#000;border:none;border-radius:8px;padding:10px 20px;font-weight:700;cursor:pointer;">Desbloquear Coach IA ilimitado</button></div>';
      }
    }, 100);
  }
}
