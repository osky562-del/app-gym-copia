/* ══ RUTINA IA ══ */
let rutinaGenerada = null; // {nombre, dias:[{titulo, ejercicios:[{ex,sets,reps,kg,nota}]}]}
let _rutinaProgressInt = null;

function _rutinaParamsHash(params) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(params)))).slice(0, 24);
}

function _showRutinaProgress(stat, dias) {
  const steps = [
    'Analizando tu perfil físico…',
    'Estudiando tu historial de entrenos…',
    'Identificando músculos a priorizar…',
    `Diseñando día 1 de ${dias}…`,
    `Diseñando día 2 de ${dias}…`,
    dias >= 3 ? `Diseñando día 3 de ${dias}…` : null,
    dias >= 4 ? `Diseñando día 4 de ${dias}…` : null,
    dias >= 5 ? `Diseñando día 5 de ${dias}…` : null,
    dias >= 6 ? `Diseñando día 6 de ${dias}…` : null,
    'Optimizando series y repeticiones…',
    'Aplicando técnicas avanzadas…',
    'Casi listo…'
  ].filter(Boolean);
  let i = 0;
  stat.textContent = steps[0];
  _rutinaProgressInt = setInterval(() => {
    i = (i + 1) % steps.length;
    stat.textContent = steps[i];
  }, 2200);
}

function _stopRutinaProgress() {
  if (_rutinaProgressInt) { clearInterval(_rutinaProgressInt); _rutinaProgressInt = null; }
}

async function generarRutinaIA() {
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

  const cacheKey = 'rutinaCache_' + _rutinaParamsHash({ perfil, dias, enfoque, equipo, nivel, objetivo, lesiones });
  const cached = STORE.get(cacheKey);
  if (cached && cached.ts && (Date.now() - cached.ts) < 30 * 60 * 1000) {
    rutinaGenerada = cached.rutina;
    renderRutinaResult();
    stat.style.display = 'block';
    stat.textContent = 'Rutina cargada ✓ (caché < 30 min)';
    stat.style.background = 'var(--gg)';
    stat.style.color = 'var(--green)';
    setTimeout(() => stat.style.display = 'none', 2500);
    return;
  }

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
  const prs = Object.entries(exMax).sort((a,b) => b[1]-a[1]).slice(0,3).map(([x,k]) => `${x}:${k}kg`).join(',');
  const musMenos = Object.entries(volMus).sort((a,b)=>a[1]-b[1])[0]?.[0] || '';

  // ── 3 prompts de respaldo (completo → medio → mínimo) para reintentar si timeout ──
  const ejemploDias = Array.from({ length: dias }, (_, i) =>
    `{"titulo":"Día ${i + 1} - Grupo muscular","ejercicios":[{"ex":"Ejercicio","sets":4,"reps":10,"nota":"breve"}]}`
  ).join(',');
  const ejemploMin = Array.from({ length: dias }, (_, i) =>
    `{"titulo":"Día ${i + 1}","ejercicios":[{"ex":"Ej","sets":4,"reps":10}]}`
  ).join(',');

  const promptFull = `Responde EN ESPAÑOL con SOLO JSON puro (sin markdown ni explicaciones). REGLA CRÍTICA: el array "dias" DEBE contener EXACTAMENTE ${dias} días, ni uno menos. Cada día con 5 ejercicios distintos.
Perfil: ${perfil.sexo||'h'}, ${perfil.edad||25}a, nivel ${nivel}, objetivo ${objetivo}, enfoque ${enfoque}, equipo ${equipo}${lesiones ? ', lesiones: '+lesiones : ''}. ${prs ? 'PRs históricos: '+prs+'.' : ''} ${musMenos ? 'Priorizar músculo débil: '+musMenos+'.' : ''}
Estructura JSON OBLIGATORIA — devuelve EXACTAMENTE ${dias} elementos en "dias":
{"nombre":"Plan ${enfoque} ${dias}d","dias":[${ejemploDias}]}`;

  const promptMedium = `JSON puro EN ESPAÑOL. Rutina ${dias} días, 5 ejercicios cada día. ${nivel}, ${enfoque}, ${equipo}. Devuelve EXACTAMENTE ${dias} días en "dias":
{"nombre":"Plan ${enfoque}","dias":[${ejemploDias}]}`;

  const promptShort = `JSON ${dias} dias rutina ${enfoque} ${equipo}. EXACTO ${dias} elementos:
{"nombre":"Plan","dias":[${ejemploMin}]}`;

  const intentos = [
    { prompt: promptFull,   timeout: 45000, maxTokens: 2200, label: null },
    { prompt: promptMedium, timeout: 30000, maxTokens: 1800, label: 'Reintentando con prompt más corto…' },
    { prompt: promptShort,  timeout: 20000, maxTokens: 1500, label: 'Último intento con prompt mínimo…' }
  ];

  btn.disabled = true;
  $('rutinaResult').innerHTML = '';
  stat.style.display = 'block';
  stat.style.background = '';
  stat.style.color = '';
  _showRutinaProgress(stat, dias);

  let lastError = null;
  let parsedRutina = null;

  for (let i = 0; i < intentos.length; i++) {
    const att = intentos[i];
    if (att.label) {
      _stopRutinaProgress();
      stat.textContent = att.label;
      await new Promise(r => setTimeout(r, 600));
      _showRutinaProgress(stat, dias);
    }
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), att.timeout);
      const r = await fetch(CONSEJOS_WORKER, {
        method: 'POST',
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: att.prompt }],
          temperature: 0.5,
          max_tokens: att.maxTokens
        })
      });
      clearTimeout(tid);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      if (txt.includes('{')) {
        const clean = txt.substring(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
        const parsed = JSON.parse(clean);
        if (parsed && parsed.dias && parsed.dias.length > 0) {
          parsedRutina = parsed;
          break;
        }
      }
      throw new Error('JSON inválido');
    } catch (e) {
      lastError = e;
      console.warn(`Intento ${i + 1}/${intentos.length} falló:`, e.message);
    }
  }

  try {
    if (!parsedRutina) {
      throw lastError || new Error('Todos los intentos fallaron');
    }
    rutinaGenerada = parsedRutina;
    const diasReales = rutinaGenerada.dias.length;
    if (diasReales === dias) {
      try { STORE.set(cacheKey, { rutina: rutinaGenerada, ts: Date.now() }); } catch(e) {}
    }
    _stopRutinaProgress();
    renderRutinaResult();
    stat.textContent = diasReales === dias
      ? 'Rutina Generada ✓'
      : `⚠ Rutina con ${diasReales}/${dias} días — Pulsa otra vez para reintentar`;
    stat.style.background = diasReales === dias ? 'var(--gg)' : 'var(--ag)';
    stat.style.color = diasReales === dias ? 'var(--green)' : 'var(--amber)';
    setTimeout(() => stat.style.display = 'none', diasReales === dias ? 3000 : 6000);
  } catch (e) {
    _stopRutinaProgress();
    stat.textContent = 'IA no disponible ahora — Inténtalo en 1-2 min';
    stat.style.background = 'var(--rg)';
    stat.style.color = 'var(--red)';
  } finally {
    _stopRutinaProgress();
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
