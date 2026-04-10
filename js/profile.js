/* ══ PROFILE ══ */
function getUserName() { return STORE.get('name') || ''; }
function saveName() {
  const n = $('nameInput').value.trim();
  if (!n) return toast('Escribe tu nombre', 'err');
  STORE.set('name', n);
  updateGreeting();
  toast('¡Hola, ' + n + '! 👋', 'good');
}
function updateGreeting() {
  const n = getUserName();
  $('greetName').textContent = n || 'Atleta';
}
function renderPlanCard() {
  const el = $('profilePlanCard');
  if (!el) return;
  const plan = Pro.getPlan();
  const name = Pro.getPlanName();
  const isPro = Pro.isPro();
  const remaining = Pro.aiRemaining();

  if (isPro) {
    el.innerHTML = `
      <div class="plan-card pro-active">
        <div class="plan-card-badge">${plan.name}</div>
        <div class="plan-card-status">Plan activo</div>
        <div class="plan-card-perks">
          <span>Coach IA ilimitado</span><span>Analíticas avanzadas</span><span>Todos los colores</span>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="plan-card" onclick="Pro.showUpgradeModal('unlimited_workouts')">
        <div class="plan-card-row">
          <div>
            <div class="plan-card-badge free">Gratuito</div>
            <div class="plan-card-status">Funciones limitadas</div>
          </div>
          <button class="plan-card-upgrade">Mejorar plan</button>
        </div>
        <div class="plan-card-limits">
          <div class="plan-limit"><span>Coach IA</span><span class="${remaining === 0 ? 'limit-warn' : ''}">${remaining}/1 esta semana</span></div>
          <div class="plan-limit"><span>Sesiones guardadas</span><span>${workouts.length}/${plan.maxSessions}</span></div>
          <div class="plan-limit"><span>Historial visible</span><span>${plan.maxHistory} sesiones</span></div>
          <div class="plan-limit"><span>Colores</span><span>2 de 6</span></div>
        </div>
      </div>`;
  }
}

function renderProfile() {
  const ca = STORE.get('accent') || 'red';
  document.querySelectorAll('.acc-sw').forEach(el => {
    const c = el.dataset.accent;
    el.classList.toggle('on', c === ca);
    // Show lock on premium colors for free users
    if (!Pro.isAccentAvailable(c)) {
      el.classList.add('pro-locked-accent');
      if (!el.querySelector('.acc-lock')) {
        const lock = document.createElement('span');
        lock.className = 'acc-lock';
        lock.textContent = '🔒';
        el.appendChild(lock);
      }
    } else {
      el.classList.remove('pro-locked-accent');
      const lock = el.querySelector('.acc-lock');
      if (lock) lock.remove();
    }
  });
  applyAccent();
  renderPlanCard();
  // Load saved name into input
  const n = getUserName();
  if ($('nameInput')) $('nameInput').value = n;
  let tv = 0, th = 0, sr = 0, rc = 0; workouts.forEach(w => { (w.exercises || []).forEach(e => tv += (+e.kg || 0) * (+e.sets || 1) * (+e.reps || 1)); if (w.duration) th += +w.duration; if (w.rpe) { sr += +w.rpe; rc++; } });
  $('psW').textContent = workouts.length; $('psK').textContent = big(tv); $('psS').textContent = calcMaxStreak(); $('psH').textContent = Math.round(th / 60) + 'h';
  $('irS').textContent = workouts.length; $('irK').textContent = big(tv) + ' kg'; $('irH').textContent = Math.round(th / 60) + 'h'; $('irR').textContent = rc ? (sr / rc).toFixed(1) : '—';
}

/* ══ THEME / ACCENT ══ */
const ACCENTS = {
  blue: { hex: '#4f8cff', rgba: 'rgba(79, 140, 255, 0.12)' },
  green: { hex: '#2dd98a', rgba: 'rgba(45, 217, 138, 0.12)' },
  purple: { hex: '#a57aff', rgba: 'rgba(165, 122, 255, 0.12)' },
  amber: { hex: '#ffa040', rgba: 'rgba(255, 160, 64, 0.12)' },
  red: { hex: '#ff3b30', rgba: 'rgba(255, 59, 48, 0.12)' },
  pink: { hex: '#ff6eb4', rgba: 'rgba(255, 110, 180, 0.12)' }
};

function setAccent(color, el) {
  if (!Pro.isAccentAvailable(color)) {
    Pro.showUpgradeModal('custom_themes');
    return;
  }
  STORE.set('accent', color);
  if (el) {
    document.querySelectorAll('.acc-sw, .ob-color').forEach(sw => sw.classList.remove('on'));
    el.classList.add('on');
  }
  applyAccent();
  toast('Color actualizado', 'good');
}

function obColor(color, btn) {
  setAccent(color, btn);
}

function applyAccent() {
  const color = STORE.get('accent') || 'red';
  const theme = ACCENTS[color] || ACCENTS.red;
  const root = document.documentElement;
  root.style.setProperty('--a', theme.hex);
  root.style.setProperty('--ag', theme.rgba);
  // Update UI elements that might need forced color
  document.querySelectorAll('.p-accent').forEach(e => e.style.color = theme.hex);
}
applyAccent(); // Initial call
$('btnSaveW').addEventListener('click', () => { const w = parseFloat($('bwInput').value); if (!w || w < 20 || w > 300) return toast('Peso inválido', 'err'); const d = new Date().toISOString().split('T')[0]; const idx = weightLogs.findIndex(l => l.date === d); if (idx >= 0) weightLogs[idx].weight = w; else weightLogs.push({ date: d, weight: w }); saveWeights(); toast('Peso guardado ✓', 'good'); $('bwInput').value = ''; });

/* ══ FONT SIZE ══ */
const FS_PX = [14, 16, 19, 22, 26, 30];
const FS_LBL = ['A', 'A+', 'A++', 'A+++', 'A++++', 'A+++++'];
let fsIdx = parseInt(localStorage.getItem('ko95_fs') || '0');
if (isNaN(fsIdx) || fsIdx < 0 || fsIdx >= FS_PX.length) fsIdx = 0;

function applyFontSize() {
  document.documentElement.style.fontSize = FS_PX[fsIdx] + 'px';
  const btn = document.getElementById('tbFsBtn');
  if (btn) btn.textContent = FS_LBL[fsIdx];
}
function cycleFontSize() {
  fsIdx = (fsIdx + 1) % FS_PX.length;
  localStorage.setItem('ko95_fs', String(fsIdx));
  applyFontSize();
  toast('Texto ' + FS_LBL[fsIdx]);
}
applyFontSize();
