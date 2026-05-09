/* ══ ONBOARDING ══ */
let obIdx = 0;
const OB_N = 5;

function showOnboarding() {
  $('onboarding').classList.add('show');
  obUpdateSlides();
}
function obSkip() {
  obSaveData();
  $('onboarding').classList.remove('show');
  STORE.set('onboarded', '1');
}
function obNext() {
  if (obIdx === 1) {
    const n = $('obName').value.trim();
    if (!n) { $('obName').focus(); toast('Escribe tu nombre', 'err'); return; }
  }
  if (obIdx >= OB_N - 1) { obSkip(); return; }
  obIdx++;
  obUpdateSlides();
}
function obUpdateSlides() {
  document.querySelectorAll('.ob-slide').forEach((s, i) => {
    s.style.transform = `translateX(${(i - obIdx) * 100}%)`;
  });
  document.querySelectorAll('.ob-dot-n').forEach((d, i) => d.classList.toggle('on', i === obIdx));
  $('obNextBtn').textContent = obIdx >= OB_N - 1 ? '¡Empezar! 🚀' : 'Continuar →';
}
function obSaveData() {
  const n = $('obName')?.value.trim();
  const s = $('obSexo')?.value;
  const e = $('obEdad')?.value;
  const obj = $('obObj')?.value;
  const nv = $('obNivel')?.value;
  if (n) STORE.set('name', n);
  const p = STORE.get('perfil') || {};
  if (s) p.sexo = s;
  if (e) p.edad = +e;
  if (obj) p.objetivo = obj;
  if (nv) p.nivel = nv;
  STORE.set('perfil', p);
  updateGreeting();
}
(function () {
  if (!STORE.get('onboarded')) setTimeout(showOnboarding, 2500);
})();
