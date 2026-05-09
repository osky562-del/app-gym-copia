/* ══ UTILS ══ */
const $ = id => document.getElementById(id);
function toast(msg, t = 'ok') { const e = document.createElement('div'); e.className = 'toast ' + t; e.textContent = msg; $('toasts').appendChild(e); setTimeout(() => { e.style.opacity = '0'; e.style.transition = 'opacity .3s'; setTimeout(() => e.remove(), 320) }, 2800); }
function fmt(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function big(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); }
function vib(p) { if ('vibrate' in navigator) navigator.vibrate(p); }
function closeSheet(id) { $(id).classList.remove('on'); }
function mkChart(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id).getContext('2d'), cfg); }
Chart.defaults.color = 'rgba(244,244,246,.32)'; Chart.defaults.font.family = "'JetBrains Mono',monospace"; Chart.defaults.font.size = 10;
function blueGrad(ctx, h) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(79,140,255,.28)'); g.addColorStop(1, 'rgba(79,140,255,0)'); return g; }
function fmtRest(s) { if (!s) return 'Off'; if (s < 60) return s + 's'; if (s % 60 === 0) return (s / 60) + 'min'; return Math.floor(s / 60) + 'm' + (s % 60) + 's'; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
