/* ══ RUTINA IA ══ */
let rutinaGenerada = null; // {nombre, dias:[{titulo, ejercicios:[{ex,sets,reps,kg,nota}]}]}

async function generarRutinaIA() {
  // AI Rutina is Pro-only feature
  if (!Pro.requirePro('ai_rutina')) return;

  const btn = $('btnGenRutina');
  const stat = $('genStatus');
  const perfil = STORE.get('perfil') || {};
  const dias = +$('rDias').value || 4;
  const enfoque = $('rEnfoque').value || 'hipertrofia';
  const equipo = $('rEquipo').value || 'gimnasio completo';
  const nivel = perfil.nivel || 'intermedio';
  const objetivo = perfil.objetivo || enfoque;
  const lesiones = perfil.lesiones && perfil.lesiones !== 'ninguna' ? perfil.lesiones : null;

  const logs = workouts.slice(0, 10); 
  
  // Analizar fortalezas para la rutina
  const exMax = {};
  const volMus = {};
  workouts.slice(0, 20).forEach(w => {
    (w.exercises || []).forEach(e => {
      const kg = +e.kg || 0;
      if (!exMax[e.ex] || kg > exMax[e.ex]) exMax[e.ex] = kg;
      const m = getMuscle(e.ex);
      volMus[m] = (volMus[m] || 0) + (kg * (+e.sets || 1) * (+e.reps || 1));
    });
  });
  const prs = Object.entries(exMax).sort((a,b) => b[1]-a[1]).slice(0,5).map(([x,k]) => `${x} (${k}kg)`).join(', ');
  const totalV = Object.values(volMus).reduce((a,b) => a+b, 0) || 1;
  const musDist = Object.entries(volMus).sort((a,b)=>b[1]-a[1]).map(([m,v]) => `${m} (${Math.round(v/totalV*100)}%)`).join(', ');

  const prompt = `RESPONDE SIEMPRE EN ESPAÑOL. Genera una rutina gym en JSON puro (sin markdown). PERFIL: ${perfil.sexo||'?'}, ${perfil.edad||'?'}a, ${perfil.peso||'?'}kg, nivel ${nivel}, objetivo ${objetivo}, enfoque ${enfoque}, equipo ${equipo}${lesiones ? ', lesiones: '+lesiones : ''}. PRs: ${prs||'ninguno'}. Vol muscular: ${musDist||'equilibrado'}. Genera ${dias} dias, 5-6 ejercicios/dia. JSON exacto: {"nombre":"Plan X","dias":[{"titulo":"Dia 1","ejercicios":[{"ex":"nombre","sets":4,"reps":10,"kg":"","nota":"tecnica"}]}]}`;

  btn.disabled = true;
  $('rutinaResult').innerHTML = '';
  stat.style.display = 'block';
  stat.textContent = 'IA Generando rutina personalizada...';
  
  try {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 60000); 
    const r = await fetch(CONSEJOS_WORKER, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });
    clearTimeout(tid);

    if (!r.ok) throw new Error(`Servidor IA (Error ${r.status})`);
    
    let txt = await r.text();
    if (txt.includes('{')) {
      const clean = txt.substring(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
      rutinaGenerada = JSON.parse(clean);
      if (rutinaGenerada && rutinaGenerada.dias) {
        renderRutinaResult();
        stat.textContent = 'Rutina Generada ✓';
        stat.style.background = 'var(--gg)';
        stat.style.color = 'var(--green)';
        setTimeout(() => stat.style.display = 'none', 3000);
        return;
      }
    }
    throw new Error('Respuesta de IA no válida');
  } catch (e) {
    stat.textContent = 'Error: ' + (e.name === 'AbortError' ? 'Tiempo agotado (60s)' : e.message);
    stat.style.background = 'var(--rg)';
    stat.style.color = 'var(--red)';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-wand-sparkles"></i> Generar Rutina Personalizada`;
  }
}

function renderRutinaResult() {
  if (!rutinaGenerada) return;
  const el = $('rutinaResult');
  const totalEx = rutinaGenerada.dias.reduce((s, d) => s + (d.ejercicios || []).length, 0);

  el.innerHTML = `
<div style="background:linear-gradient(135deg,#0d1a2e,#0a0a0a);border:1px solid rgba(79,140,255,.25);border-radius:var(--r);padding:16px 16px 10px;margin-bottom:10px;">
  <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--a);margin-bottom:5px;">Plan generado por IA ✦</div>
  <div style="font-size:1.2rem;font-weight:800;letter-spacing:-.02em;margin-bottom:4px;">${rutinaGenerada.nombre}</div>
  <div style="font-size:.75rem;color:var(--t3);font-family:var(--fm);">${rutinaGenerada.dias.length} días · ${totalEx} ejercicios</div>
  <button onclick="guardarTodasRutinas()" style="margin-top:12px;width:100%;height:46px;background:var(--green);border:none;border-radius:9px;color:#000;font-size:.88rem;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    Guardar todos los días en Rutinas
  </button>
</div>
${rutinaGenerada.dias.map((dia, di) => `
  <div class="rutina-dia-card">
    <div class="rutina-dia-head">
      <div>
        <div class="rutina-dia-title">${dia.titulo}</div>
        <div class="rutina-dia-meta">${(dia.ejercicios || []).length} ejercicios</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn-guardar-rutina" onclick="guardarDiaRutina(${di})">+ Rutinas</button>
        <button class="btn-usar-rutina" onclick="usarDiaRutina(${di})">Usar ahora ▶</button>
      </div>
    </div>
    ${(dia.ejercicios || []).map((ex, ei) => `
      <div class="rutina-ex-row">
        <div class="rutina-ex-num">${ei + 1}</div>
        <div class="rutina-ex-info">
          <div class="rutina-ex-name">${ex.ex}</div>
          <div class="rutina-ex-detail">${ex.sets}×${ex.reps} reps${ex.nota ? ' · ' + ex.nota : ''}</div>
        </div>
      </div>`).join('')}
  </div>`).join('')}
  `;
}

function guardarDiaRutina(diaIdx) {
  if (!rutinaGenerada) return;
  const dia = rutinaGenerada.dias[diaIdx];
  if (!dia) return;

  // Add to TPL with next available key
  const existingKeys = Object.keys(TPL).map(Number);
  const newKey = Math.max(...existingKeys, 100) + 1;
  TPL[newKey] = dia.ejercicios.map(e => ({ ex: e.ex, sets: e.sets, reps: e.reps, kg: '', s: e.sets, r: e.reps }));

  // Save custom tpls to localStorage
  const custom = STORE.get('customTpl') || [];
  custom.push({ key: newKey, titulo: dia.titulo, ejercicios: dia.ejercicios });
  STORE.set('customTpl', custom);

  // Refresh sheet list
  renderTplList();
  toast('«' + dia.titulo + '» guardado en Rutinas ✓', 'good');
}

function guardarTodasRutinas() {
  if (!rutinaGenerada) return;
  rutinaGenerada.dias.forEach((_, i) => guardarDiaRutina(i));
  toast('Plan «' + rutinaGenerada.nombre + '» guardado completo ✓', 'good');
}

function usarDiaRutina(diaIdx) {
  if (!rutinaGenerada) return;
  const dia = rutinaGenerada.dias[diaIdx];
  if (!dia) return;
  // Load into planExs and open plan mode
  planExs = dia.ejercicios.map(e => ({
    name: e.ex,
    sets: +e.sets || 3,
    reps: +e.reps || 10,
    kg: getLastKg(e.ex) || '',
    restSec: 90
  }));
  openPlan();
  // Slight delay to let plan render
  setTimeout(() => {
    renderPlanList();
    toast('«' + dia.titulo + '» cargado ✓', 'good');
  }, 100);
}

function renderTplList() {
  const list = $('tplList');
  if (!list) return;
  // Default templates
  let html = `
<div class="sh-card" onclick="loadTpl(1)"><div class="sh-ct">💪 Día 1 — Pecho + Tríceps</div><div class="sh-cd">Banca · Inclinado · Aperturas · Fondos · Extensión · Francés</div></div>
<div class="sh-card" onclick="loadTpl(2)"><div class="sh-ct">🔗 Día 2 — Espalda + Bíceps</div><div class="sh-cd">Dominadas · Remo · Jalón · Curl barra · Curl alterno · Concentrado</div></div>
<div class="sh-card" onclick="loadTpl(3)"><div class="sh-ct">🦵 Día 3 — Piernas</div><div class="sh-cd">Sentadilla · Prensa · Rumano · Femoral · Extensión · Gemelos</div></div>
<div class="sh-card" onclick="loadTpl(4)"><div class="sh-ct">🛡 Día 4 — Hombros + Core</div><div class="sh-cd">Militar · Laterales · Frontales · Pájaros · Encogimientos · Crunch</div></div>`;
  // Custom (IA generated)
  const custom = STORE.get('customTpl') || [];
  if (custom.length) {
    html += `<div style="padding:8px 12px 4px;font-size:.65rem;font-weight:700;color:var(--a);text-transform:uppercase;letter-spacing:.08em;">✦ Generadas por IA</div>`;
    custom.forEach(t => {
      html += `<div class="sh-card" style="border-color:rgba(79,140,255,.25);" onclick="loadTplCustom(${t.key})">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div class="sh-ct" style="color:var(--a)">${t.titulo}</div>
      <button onclick="event.stopPropagation();deleteCustomTpl(${t.key})" style="background:none;border:none;color:var(--t4);font-size:1rem;cursor:pointer;padding:0 2px;">✕</button>
    </div>
    <div class="sh-cd">${(t.ejercicios || []).map(e => e.ex).join(' · ')}</div>
  </div>`;
    });
  }
  list.innerHTML = html;
}

function loadTplCustom(key) {
  if (!TPL[key]) {
    // Reload from storage
    const custom = STORE.get('customTpl') || [];
    const t = custom.find(x => x.key === key);
    if (!t) return toast('Rutina no encontrada', 'err');
    TPL[key] = t.ejercicios.map(e => ({ ex: e.ex, sets: e.sets, reps: e.reps, kg: '', s: e.sets, r: e.reps }));
  }
  loadTpl(key);
}

function deleteCustomTpl(key) {
  if (!confirm('¿Eliminar esta rutina?')) return;
  const custom = (STORE.get('customTpl') || []).filter(t => t.key !== key);
  STORE.set('customTpl', custom);
  delete TPL[key];
  renderTplList();
  toast('Rutina eliminada');
}

// Load custom tpls into TPL on init
(function loadCustomTplsOnInit() {
  const custom = STORE.get('customTpl') || [];
  custom.forEach(t => {
    TPL[t.key] = t.ejercicios.map(e => ({ ex: e.ex, sets: +e.sets || 3, reps: +e.reps || 10, kg: '', s: +e.sets || 3, r: +e.reps || 10 }));
  });
})();
