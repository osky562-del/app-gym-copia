/* ══════════════════════════════════════════════
   AYUDA — "Cómo usar la app" (guía dentro de la app)
   ══════════════════════════════════════════════
   openHelp(): abre la guía. Secciones desplegables (<details>).
   ══════════════════════════════════════════════ */
(function () {
  function ensureDOM() {
    if (document.getElementById('helpModal')) return;
    const style = document.createElement('style');
    style.id = 'helpStyle';
    style.textContent = `
      .hlp-ov{display:none;position:fixed;inset:0;background:var(--bg,#0a0a0a);z-index:1001;
        flex-direction:column;}
      .hlp-ov.on{display:flex;animation:hlpFade .2s ease;}
      @keyframes hlpFade{from{opacity:0}to{opacity:1}}
      .hlp-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;
        padding:max(14px,env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid var(--line,#1f1f25);
        background:var(--s1,#131316);position:sticky;top:0;z-index:2;}
      .hlp-hd-t{font-size:1.05rem;font-weight:800;}
      .hlp-close{min-width:42px;min-height:42px;border-radius:10px;background:var(--s3,#222);
        border:1px solid var(--line2,#2a2a32);color:#fff;font-size:1.1rem;font-weight:700;cursor:pointer;
        display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;}
      .hlp-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;
        padding:14px 16px max(40px,env(safe-area-inset-bottom));}
      .hlp-intro{color:var(--t2,#c8c8d0);font-size:.85rem;line-height:1.55;margin-bottom:16px;}
      details.hlp-sec{background:var(--s1,#131316);border:1px solid var(--line2,#2a2a32);
        border-radius:14px;margin-bottom:10px;overflow:hidden;}
      details.hlp-sec[open]{border-color:rgba(79,140,255,.4);}
      .hlp-sec summary{padding:15px 16px;font-size:.95rem;font-weight:800;cursor:pointer;
        list-style:none;display:flex;align-items:center;gap:10px;-webkit-tap-highlight-color:transparent;}
      .hlp-sec summary::-webkit-details-marker{display:none;}
      .hlp-sec summary::after{content:'＋';margin-left:auto;color:var(--t3,#7a7a86);font-weight:400;font-size:1.2rem;}
      .hlp-sec[open] summary::after{content:'－';}
      .hlp-sec-c{padding:0 16px 16px;color:var(--t2,#c8c8d0);font-size:.86rem;line-height:1.6;}
      .hlp-sec-c ul{margin:0;padding-left:18px;}
      .hlp-sec-c li{margin-bottom:8px;}
      .hlp-sec-c b{color:var(--t1,#fff);}
      .hlp-k{display:inline-block;background:var(--s3,#222);border:1px solid var(--line2,#2a2a32);
        border-radius:6px;padding:1px 7px;font-size:.8rem;font-weight:700;color:#fff;}
      .hlp-foot{text-align:center;color:var(--t3,#7a7a86);font-size:.72rem;margin-top:18px;line-height:1.5;}
    `;
    document.head.appendChild(style);

    const m = document.createElement('div');
    m.className = 'hlp-ov'; m.id = 'helpModal';
    m.innerHTML = `
      <div class="hlp-hd">
        <div class="hlp-hd-t">📖 Cómo usar KO95FIT</div>
        <button class="hlp-close" onclick="closeHelp()">✕</button>
      </div>
      <div class="hlp-body">
        <div class="hlp-intro">Guía rápida de todo lo que puedes hacer. Toca cada sección para desplegarla.</div>

        <details class="hlp-sec" open><summary>🚀 Empezar</summary><div class="hlp-sec-c"><ul>
          <li><b>Crea tu cuenta</b> con email y contraseña, o entra si ya la tienes. Tus entrenos se guardan en la nube y se sincronizan en todos tus dispositivos.</li>
          <li>Marca <b>"Recordar mis datos"</b> para no tener que escribirlos cada vez.</li>
          <li>La primera vez rellena tu <b>perfil</b> (nombre, sexo, peso, objetivo): se usa para la IA y para calcular tu nivel de fuerza.</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>📋 Planificar un entreno</summary><div class="hlp-sec-c">
          Pulsa <span class="hlp-k">+ Entreno</span> y elige cómo montarlo:
          <ul>
          <li><b>Plantillas rápidas</b>: rutinas listas (Empuje, Tirón, Pierna, Hombro), todas con vídeo en cada ejercicio.</li>
          <li><b>Generar con IA</b>: di los días y el enfoque y la IA te crea la rutina.</li>
          <li><b>Copiar anterior</b>: repite un entreno pasado tal cual.</li>
          <li><b>Buscar y añadir</b>: escribe el nombre; si no está, puedes crearlo igual (sin vídeo demo).</li>
          <li>Ajusta <b>series, reps, kg y descanso</b> de cada ejercicio. Reordena con las flechas ↑↓.</li>
          </ul>
        </div></details>

        <details class="hlp-sec"><summary>🔗 Superseries</summary><div class="hlp-sec-c"><ul>
          <li>En el plan, pulsa el botón <span class="hlp-k">🔗</span> de un ejercicio para <b>encadenarlo con el de arriba</b> (se ponen morados).</li>
          <li>Al entrenar, harás una serie de A y <b>saltarás a B sin descanso</b>; el descanso solo llega tras el último del grupo, y luego vuelves a A para la siguiente ronda.</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>🏋️ Entrenar (modo Live)</summary><div class="hlp-sec-c"><ul>
          <li>Pulsa <b>Empezar</b>. Verás un ejercicio cada vez con sus series.</li>
          <li>Haz la serie, escribe kg/reps y pulsa el <b>✓</b>. Arranca el descanso solo y, al acabar, salta a la siguiente serie o ejercicio.</li>
          <li><b>Memoria por serie</b>: si ya hiciste el ejercicio, cada serie aparece con el peso y reps de la última vez.</li>
          <li><span class="hlp-k">🔥 Calent.</span> añade una serie de calentamiento (no cuenta para volumen ni récords).</li>
          <li><span class="hlp-k">▶</span> muestra el <b>vídeo de la técnica</b> y los pasos del ejercicio.</li>
          <li><span class="hlp-k">🏋 Discos</span> abre la <b>calculadora de discos</b>: te dice qué poner en la barra para un peso.</li>
          <li>Toca el <b>número de una serie</b> para marcarla como calentamiento. Toca el chip del <b>descanso</b> para cambiarlo.</li>
          <li>Puedes <b>pausar</b>, <b>reordenar</b>, <b>cambiar</b>, <b>añadir</b> o <b>quitar</b> ejercicios a mitad del entreno.</li>
          <li>Al terminar pulsa <b>Finalizar</b>: verás el resumen, tu XP y los récords.</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>⌚ Apple Watch (iPhone)</summary><div class="hlp-sec-c"><ul>
          <li>Cuando acaba el descanso te llega una <b>notificación al reloj</b> diciendo qué serie/ejercicio toca, aunque tengas el móvil en el bolsillo.</li>
          <li>Pulsa <span class="hlp-k">✓ Hecho</span> en la notificación del reloj para <b>marcar la serie y avanzar</b> sin sacar el móvil.</li>
          <li>Requiere tener el reloj emparejado y el aviso de notificaciones activado. (En entrenos con superserie esta función se desactiva.)</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>📊 Progreso</summary><div class="hlp-sec-c"><ul>
          <li><b>Mapa de actividad</b> y resumen de tus últimas semanas.</li>
          <li><b>Grupos musculares</b> y <b>balance</b>: detecta si descuidas algún grupo.</li>
          <li><b>💪 Fuerza estimada</b>: tu 1RM por ejercicio y tu nivel (Novato → Élite) según tu peso corporal.</li>
          <li><b>Récords</b> y <b>🏆 Historial de récords</b>: cada vez que subes tu máximo.</li>
          <li><b>Evolución</b>: gráfica de un ejercicio por máximo, 1RM o volumen.</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>👤 Perfil y peso</summary><div class="hlp-sec-c"><ul>
          <li>Cambia tu <b>nombre</b> y el <b>color</b> de la app.</li>
          <li>Registra tu <b>peso corporal</b> para ver su evolución y calcular tu nivel de fuerza.</li>
          <li>Consulta tu <b>plan</b> (Free / Pro) y lo que incluye.</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>📲 Compartir</summary><div class="hlp-sec-c"><ul>
          <li>Al terminar un entreno pulsa <span class="hlp-k">📲 Compartir imagen</span> para generar una tarjeta con tu resumen y compartirla o guardarla.</li>
        </ul></div></details>

        <details class="hlp-sec"><summary>💡 Trucos</summary><div class="hlp-sec-c"><ul>
          <li>Si entrenas sin descanso, al marcar la serie igualmente avanza sola.</li>
          <li>El peso por defecto del calentamiento es ~50% del de trabajo (puedes cambiarlo).</li>
          <li>Tus entrenos se sincronizan solos; si borras uno, se borra también de la nube.</li>
        </ul></div></details>

        <div class="hlp-foot">KO95FIT PRO · Hardcore Training System<br>¿Dudas? Vuelve a esta guía cuando quieras desde tu perfil.</div>
      </div>`;
    document.body.appendChild(m);
  }
  function openHelp() { ensureDOM(); document.getElementById('helpModal').classList.add('on'); document.querySelector('.hlp-body').scrollTop = 0; }
  function closeHelp() { const m = document.getElementById('helpModal'); if (m) m.classList.remove('on'); }
  window.openHelp = openHelp;
  window.closeHelp = closeHelp;
})();
