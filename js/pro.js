/* ══ KO95FIT PRO — Plan & Feature Gate System ══

   Tier system:
   - 'free'     → Basic features, limited sessions
   - 'pro'      → Full features, unlimited
   - 'pro_plus' → Everything + routines, social, periodization

   Usage in any module:
     if (Pro.can('ai_coach'))    { ... }
     if (Pro.can('analytics'))   { ... }
     Pro.gate('ai_rutina', () => { ...pro code... });
     Pro.requirePro('feature_name');  // shows upgrade modal if free
══════════════════════════════════════════════════ */

const Pro = (function () {

  /* ── Plan Definitions ── */
  const PLANS = {
    free: {
      name: 'Free',
      label: 'Gratuito',
      maxSessions: 5,        // Máx. entrenos guardados (plan Free)
      maxHistory: 5,         // Visible history items
      aiCoachPerWeek: 1,     // AI coach queries per week
      aiRutina: false,       // Routine generator
      advancedAnalytics: false,
      exportImport: true,    // Keep free for user retention
      customThemes: false,   // Only 2 accent colors free
      freeAccents: ['red', 'blue'],
      unlimitedWorkouts: false,
      weeklyComparison: false,
      bodyWeight: true,
      prTable: false,
      heatmap: false,
      // Funciones nuevas limitadas a Pro
      muscleMap: false,
      insights: false,
      strengthLevels: false,
      prTimeline: false,
      setTypes: false,
    },
    pro: {
      name: 'Pro',
      label: 'Pro',
      price: '5 €/mes',
      maxSessions: 5,        // Pro.kt: Gratis y Pro 5 entrenos; Pro+ y Élite ilimitado
      maxHistory: Infinity,
      aiCoachPerWeek: Infinity,
      aiRutina: true,
      advancedAnalytics: true,
      exportImport: true,
      customThemes: true,
      freeAccents: null, // all colors
      unlimitedWorkouts: true,
      weeklyComparison: true,
      bodyWeight: true,
      prTable: true,
      heatmap: true,
      muscleMap: true,
      insights: true,
      strengthLevels: true,
      prTimeline: true,
      setTypes: true,
    },
    pro_plus: {
      name: 'Pro+',
      label: 'Pro+',
      price: '9,99 €/mes',
      maxSessions: Infinity,
      maxHistory: Infinity,
      aiCoachPerWeek: Infinity,
      aiRutina: true,
      advancedAnalytics: true,
      exportImport: true,
      customThemes: true,
      freeAccents: null,
      unlimitedWorkouts: true,
      weeklyComparison: true,
      bodyWeight: true,
      prTable: true,
      heatmap: true,
      muscleMap: true,
      insights: true,
      strengthLevels: true,
      prTimeline: true,
      setTypes: true,
      // Pro+ exclusive
      periodization: true,
      socialFeatures: true,
      mealPlans: true,
      videoAnalysis: true,
      prioritySupport: true,
    },
    elite: {
      name: 'Élite',
      label: 'Élite',
      price: '15 €/mes',
      maxSessions: Infinity,
      maxHistory: Infinity,
      aiCoachPerWeek: Infinity,
      aiRutina: true,
      advancedAnalytics: true,
      exportImport: true,
      customThemes: true,
      freeAccents: null,
      unlimitedWorkouts: true,
      weeklyComparison: true,
      bodyWeight: true,
      prTable: true,
      heatmap: true,
      muscleMap: true,
      insights: true,
      strengthLevels: true,
      prTimeline: true,
      setTypes: true,
      periodization: true,
      socialFeatures: true,
      mealPlans: true,
      videoAnalysis: true,
      prioritySupport: true,
    }
  };

  /* ── Niveles de la pantalla de planes (ProScreen.kt) ── */
  const TIERS = [
    { id: 'free', name: 'Gratis', price: '0 €', ads: true, trial: 0, features: ['Entrenos (máx. 5 guardados)', 'Progreso y mapa muscular', 'Sin Coach'] },
    { id: 'pro', name: 'Pro', price: '5 €/mes', ads: true, trial: 7, features: ['Coach: 6 análisis + 3 rutinas al mes', 'Analítica avanzada, temas y tipos de serie', 'Registro de molestias', 'Máx. 5 entrenos guardados · con anuncios'] },
    { id: 'pro_plus', name: 'Pro+', price: '9,99 €/mes', ads: false, trial: 7, best: true, features: ['Sin anuncios · entrenos ilimitados', 'Coach: 25 análisis + 15 rutinas al mes', 'Análisis automático tras cada entreno'] },
    { id: 'elite', name: 'Élite', price: '15 €/mes', ads: false, trial: 3, features: ['Todo SIN límites', 'Coach y rutinas ilimitadas', 'Análisis tras cada entreno, adaptado a tus dolores'] },
  ];

  /* ── Feature → Plan Key Mapping ── */
  const FEATURE_MAP = {
    'ai_coach':           'aiCoachPerWeek',
    'ai_rutina':          'aiRutina',
    'analytics':          'advancedAnalytics',
    'advanced_analytics': 'advancedAnalytics',
    'export':             'exportImport',
    'import':             'exportImport',
    'custom_themes':      'customThemes',
    'unlimited_workouts': 'unlimitedWorkouts',
    'weekly_comparison':  'weeklyComparison',
    'body_weight':        'bodyWeight',
    'pr_table':           'prTable',
    'heatmap':            'heatmap',
    'muscle_map':         'muscleMap',
    'insights':           'insights',
    'strength_levels':    'strengthLevels',
    'pr_timeline':        'prTimeline',
    'set_types':          'setTypes',
    'periodization':      'periodization',
    'social':             'socialFeatures',
    'meal_plans':         'mealPlans',
    'video_analysis':     'videoAnalysis',
    'priority_support':   'prioritySupport',
  };

  /* ── Admin / Owner UIDs (auto Pro+) ── */
  const ADMIN_UIDS = [
    'sQCUoNHTPmWo2Nf42xICmE3FZAT2',
  ];

  /* ── State ── */
  let currentPlan = 'free';
  let planExpiry = null;
  let aiUsageThisWeek = 0;
  let aiWeekStart = null;
  let isAdmin = false;
  let trialEnd = 0;            // ms; 0 = sin prueba gratis en curso (Pro.kt trialEnd)

  /* ── Load from storage ── */
  function load() {
    const saved = STORE.get('pro_plan');
    if (saved) {
      currentPlan = PLANS[saved.plan] ? saved.plan : 'free';
      planExpiry = saved.expiry ? new Date(saved.expiry) : null;
      aiUsageThisWeek = saved.aiUsage || 0;
      aiWeekStart = saved.aiWeekStart || null;
      trialEnd = +saved.trialEnd || 0;
      // Prueba acabada sin cancelar: el plan se mantiene (cobro simulado) y se limpia la marca.
      if (trialEnd && Date.now() > trialEnd) trialEnd = 0;

      // Check expiry (admins never expire)
      if (!isAdmin && planExpiry && new Date() > planExpiry) {
        currentPlan = 'free';
        planExpiry = null;
        save();
      }

      // Reset weekly AI counter
      resetAiWeeklyIfNeeded();
    }
  }

  function save() {
    STORE.set('pro_plan', {
      plan: currentPlan,
      expiry: planExpiry ? planExpiry.toISOString() : null,
      aiUsage: aiUsageThisWeek,
      aiWeekStart: aiWeekStart,
      trialEnd: trialEnd || 0,
    });
  }

  function resetAiWeeklyIfNeeded() {
    const now = new Date();
    const weekStart = getWeekStartDate(now);
    if (!aiWeekStart || aiWeekStart !== weekStart) {
      aiUsageThisWeek = 0;
      aiWeekStart = weekStart;
      save();
    }
  }

  function getWeekStartDate(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().split('T')[0];
  }

  /* ── Firestore Sync (source of truth) ── */

  /** Load plan from Firestore — this is the REAL validation */
  async function loadFromFirestore() {
    if (!fbDb || !fbUser) return;
    try {
      const doc = await fbDb.collection('users').doc(fbUser.uid)
        .collection('subscription').doc('plan').get();

      if (doc.exists) {
        const data = doc.data();
        const serverPlan = data.plan || 'free';
        const serverExpiry = data.expiry ? data.expiry.toDate() : null;

        // Check server-side expiry
        if (serverExpiry && new Date() > serverExpiry) {
          currentPlan = 'free';
          planExpiry = null;
        } else {
          currentPlan = PLANS[serverPlan] ? serverPlan : 'free';
          planExpiry = serverExpiry;
        }
        save(); // Cache locally
        renderProBadges();
      } else if (!isAdmin) {
        // No subscription doc exists → free plan
        // (Unless admin, which writes it below)
        currentPlan = 'free';
        planExpiry = null;
        save();
        renderProBadges();
      }
    } catch (e) {
      console.warn('Pro: Firestore read failed, using local cache:', e.message);
      // Fallback: keep whatever was loaded from localStorage
      // This ensures offline mode still works
    }
  }

  /** Write plan to Firestore (admin only — rules enforce this) */
  async function saveToFirestore() {
    if (!fbDb || !fbUser) return;
    try {
      await fbDb.collection('users').doc(fbUser.uid)
        .collection('subscription').doc('plan').set({
          plan: currentPlan,
          expiry: planExpiry || null,
          grantedBy: isAdmin ? 'admin' : 'payment',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          email: fbUser.email,
        });
    } catch (e) {
      console.warn('Pro: Firestore write failed:', e.message);
      // If not admin, this WILL fail — that's the security working
    }
  }

  /** Listen for real-time subscription changes (e.g., payment webhook) */
  let subUnsub = null;
  function listenSubscription() {
    if (!fbDb || !fbUser || subUnsub) return;
    subUnsub = fbDb.collection('users').doc(fbUser.uid)
      .collection('subscription').doc('plan')
      .onSnapshot(snap => {
        if (!snap.exists) return;
        const data = snap.data();
        if (snap.metadata.hasPendingWrites) return; // Skip local echoes
        const serverPlan = data.plan || 'free';
        const serverExpiry = data.expiry ? data.expiry.toDate() : null;

        if (serverExpiry && new Date() > serverExpiry) {
          currentPlan = 'free';
          planExpiry = null;
        } else {
          currentPlan = PLANS[serverPlan] ? serverPlan : 'free';
          planExpiry = serverExpiry;
        }
        save();
        renderProBadges();
      }, err => {
        console.warn('Pro: Subscription listener error:', err.message);
      });
  }

  /* ── Admin check ── */
  function checkAdmin(uid) {
    if (!uid) return;
    // El NAS es privado (solo LAN/Tailscale): quien entra ahi es de casa y tiene todo.
    isAdmin = ADMIN_UIDS.includes(uid) || String(uid).startsWith('nas:');
    if (isAdmin) {
      currentPlan = 'pro_plus';
      planExpiry = null; // never expires for admin
      save();
      saveToFirestore(); // Admin writes to Firestore (rules allow it)
      renderProBadges();
    } else {
      // Non-admin: load plan from Firestore (source of truth)
      loadFromFirestore();
    }
    // All users: listen for real-time changes
    listenSubscription();
  }

  /* ── Public API ── */

  /** Get current plan config */
  function getPlan() {
    return PLANS[currentPlan] || PLANS.free;
  }

  /** Get plan name */
  function getPlanName() {
    return currentPlan;
  }

  /** Check if user can use a feature */
  function can(featureName) {
    const plan = getPlan();
    const key = FEATURE_MAP[featureName] || featureName;
    const val = plan[key];

    // Special: AI coach rate limiting
    if (featureName === 'ai_coach' && currentPlan === 'free') {
      resetAiWeeklyIfNeeded();
      return aiUsageThisWeek < (plan.aiCoachPerWeek || 1);
    }

    if (val === undefined) return false;
    if (val === true || val === Infinity) return true;
    if (typeof val === 'number' && val > 0) return true;
    return !!val;
  }

  /** Track AI usage */
  function trackAiUsage() {
    resetAiWeeklyIfNeeded();
    aiUsageThisWeek++;
    save();
  }

  /** Get remaining AI uses this week */
  function aiRemaining() {
    const plan = getPlan();
    if (plan.aiCoachPerWeek === Infinity) return Infinity;
    resetAiWeeklyIfNeeded();
    return Math.max(0, (plan.aiCoachPerWeek || 1) - aiUsageThisWeek);
  }

  /** Gate a feature — run callback if allowed, show upgrade if not */
  function gate(featureName, callback) {
    if (can(featureName)) {
      callback();
    } else {
      showUpgradeModal(featureName);
    }
  }

  /** Require pro — shows modal and returns false if free */
  function requirePro(featureName) {
    if (can(featureName)) return true;
    showUpgradeModal(featureName);
    return false;
  }

  /** Check if accent color is available */
  function isAccentAvailable(color) {
    const plan = getPlan();
    if (!plan.freeAccents) return true; // Pro/Pro+ = all
    return plan.freeAccents.includes(color);
  }

  /** Check session limit */
  function canAddSession() {
    const plan = getPlan();
    if (plan.maxSessions === Infinity) return true;
    return (workouts || []).length < plan.maxSessions;
  }

  /** Get visible history limit */
  function historyLimit() {
    return getPlan().maxHistory;
  }

  /** Set plan (for payment integration or admin grant)
   *  NOTE: For non-admin users, Firestore rules will REJECT the write.
   *  Real payments should use Cloud Functions to write the subscription. */
  function setPlan(planId, expiryDate) {
    if (!PLANS[planId]) return;
    currentPlan = planId;
    planExpiry = expiryDate ? new Date(expiryDate) : null;
    save();
    saveToFirestore(); // Will only succeed if admin or Cloud Function
    renderProBadges();
    toast('¡Plan ' + PLANS[planId].label + ' activado! 🎉', 'good');
  }

  /** Check if user is pro (any paid plan) */
  function isPro() {
    return currentPlan !== 'free';
  }

  /* ── Upgrade Modal ── */
  function showUpgradeModal(featureName) {
    const featureLabels = {
      'ai_coach': 'Coach ilimitado',
      'ai_rutina': 'Generador de rutinas',
      'analytics': 'Analíticas avanzadas',
      'advanced_analytics': 'Analíticas avanzadas',
      'custom_themes': 'Todos los colores',
      'unlimited_workouts': 'Entrenos ilimitados',
      'weekly_comparison': 'Comparativa semanal',
      'pr_table': 'Tabla de récords',
      'heatmap': 'Mapa de actividad',
      'muscle_map': 'Mapa muscular',
      'insights': 'Insights “Para ti”',
      'strength_levels': 'Fuerza estimada y niveles',
      'pr_timeline': 'Historial de récords',
      'set_types': 'Tipos de serie avanzados',
      'periodization': 'Periodización',
      'social': 'Funciones sociales',
      'meal_plans': 'Planes de comida',
      'video_analysis': 'Análisis de video',
    };

    const label = featureLabels[featureName] || featureName;
    const tr = s => (typeof I18N !== 'undefined' ? I18N.t(s) : s);

    // Remove existing modal
    const old = document.getElementById('proUpgradeModal');
    if (old) old.remove();

    // Mismo diálogo que ProUpsellDialog (Android): título, 4 puntos, 4 duraciones de Pro.
    const modal = document.createElement('div');
    modal.id = 'proUpgradeModal';
    modal.innerHTML = `
      <div class="pro-modal-overlay" onclick="Pro.closeUpgradeModal()">
        <div class="pro-modal-card" onclick="event.stopPropagation()">
          <div class="pro-modal-badge">PRO</div>
          <div class="pro-modal-title">${tr('Desbloquea')} ${tr(label)}</div>
          <div class="pro-modal-desc">${tr('Esta función requiere KO95FIT Pro. Mejora tu plan para acceder a todas las herramientas avanzadas.')}</div>

          <ul class="pro-plan-features" style="margin:0 0 14px;">
            <li>${tr('Entrenos ilimitados (sin tope de 5)')}</li>
            <li>${tr('Insights, comparativa semanal y mapa de actividad')}</li>
            <li>${tr('Historial de récords y fuerza estimada')}</li>
            <li>${tr('Coach y rutinas, tipos de serie avanzados')}</li>
          </ul>

          <div class="pro-modal-plans" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="pro-plan-option" onclick="Pro.selectPlan('pro','1m')">
              <div class="pro-plan-name">${tr('1 mes')}</div>
              <div class="pro-plan-price">4,99€<small> /mes</small></div>
            </div>
            <div class="pro-plan-option" onclick="Pro.selectPlan('pro','3m')">
              <div class="pro-plan-name">${tr('3 meses')}</div>
              <div class="pro-plan-price">12,99€<small> 4,33/mes</small></div>
            </div>
            <div class="pro-plan-option" onclick="Pro.selectPlan('pro','6m')">
              <div class="pro-plan-name">${tr('6 meses')}</div>
              <div class="pro-plan-price">21,99€<small> 3,66/mes</small></div>
            </div>
            <div class="pro-plan-option featured" onclick="Pro.selectPlan('pro','1y')">
              <div class="pro-plan-popular">${tr('MEJOR PRECIO')}</div>
              <div class="pro-plan-name">${tr('1 año')}</div>
              <div class="pro-plan-price">34,99€<small> 2,92/mes</small></div>
            </div>
          </div>

          <button class="pro-modal-close" onclick="Pro.closeUpgradeModal()">${tr('Quizás luego')}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    if (typeof vib === 'function') vib([30]);
  }

  function closeUpgradeModal() {
    const m = document.getElementById('proUpgradeModal');
    if (m) m.remove();
    const p = document.getElementById('proPlansModal');
    if (p) p.remove();
  }

  /* Compra simulada, igual que ProUpsellDialog en Android (Pro.activate("pro")). */
  function selectPlan(planId) {
    closeUpgradeModal();
    setPlan(PLANS[planId] ? planId : 'pro');
  }

  /* ── Prueba gratis (Pro.kt: trialDays / activateWithTrial / cancelPlan) ── */
  function trialDays(planId) { return planId === 'pro' || planId === 'pro_plus' ? 7 : planId === 'elite' ? 3 : 0; }
  function isOnTrial() { return currentPlan !== 'free' && trialEnd > Date.now(); }
  function activateWithTrial(planId) {
    if (!PLANS[planId]) return;
    currentPlan = planId; planExpiry = null;
    const d = trialDays(planId);
    trialEnd = d > 0 ? Date.now() + d * 86400000 : 0;
    save(); saveToFirestore(); renderProBadges();
  }
  function cancelPlan() {
    currentPlan = 'free'; planExpiry = null; trialEnd = 0;
    save(); saveToFirestore(); renderProBadges();
  }
  function fmtTrialEnd(ms) { const d = new Date(ms); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }

  /* ── Pantalla de planes (ProScreen.kt): Gratis · Pro · Pro+ · Élite ── */
  let plansJustChanged = false;
  function showPlans() {
    const tr = s => (typeof I18N !== 'undefined' ? I18N.t(s) : s);
    let m = document.getElementById('proPlansModal');
    if (!m) { m = document.createElement('div'); m.id = 'proPlansModal'; document.body.appendChild(m); }
    const cur = currentPlan;
    m.innerHTML = `
      <div class="pro-modal-overlay" onclick="Pro.closePlans()" style="align-items:flex-start;padding:0;">
        <div class="pro-plans" onclick="event.stopPropagation()">
          <div class="pro-plans-h"><button type="button" class="pro-plans-back" onclick="Pro.closePlans()">‹</button><div class="pro-plans-t">KO95FIT PRO</div></div>
          <div class="pro-plans-intro">${tr('Elige tu plan. Los niveles superiores desbloquean más análisis y rutinas. Empieza con días gratis: cancela antes de que acaben y no se cobra nada.')}</div>
          <div class="pro-plans-sim">${tr('(Compra simulada — todavía no cobra nada)')}</div>
          ${TIERS.map(t => {
            const isCur = cur === t.id;
            return `<div class="pro-tier${t.best ? ' best' : ''}${isCur ? ' cur' : ''}">
              <div class="pro-tier-row"><span class="pro-tier-name">${tr(t.name)}</span>${t.best ? `<span class="pro-tier-pop">POPULAR</span>` : ''}<span style="flex:1"></span><span class="pro-tier-price">${t.price}</span></div>
              <div class="pro-tier-meta">${t.ads ? tr('📺 Con anuncios') : ''}${t.ads && t.trial ? ' · ' : ''}${t.trial ? `<span style="color:var(--a);font-weight:600;">🎁 ${t.trial} ${tr('días gratis')}</span>` : ''}</div>
              <div class="pro-tier-feats">${t.features.map(f => `<div class="pro-tier-f"><span>✓</span><span>${tr(f)}</span></div>`).join('')}</div>
              ${isCur && isOnTrial() ? `<div class="pro-tier-trial">🎁 ${tr('En prueba gratis hasta el')} ${fmtTrialEnd(trialEnd)} · ${tr('cancela antes para no pagar')}</div>` : ''}
              <button type="button" class="pro-tier-btn${isCur ? ' cur' : ''}" onclick="Pro.pickTier('${t.id}')">${isCur ? tr('✓ Tu plan actual') : t.id === 'free' ? tr('Cambiar a Gratis') : tr('Probar') + ' ' + t.trial + ' ' + tr('días gratis')}</button>
            </div>`;
          }).join('')}
          ${cur !== 'free' ? `<button type="button" class="pro-plans-cancel" onclick="Pro.pickTier('free')">${tr('Cancelar y volver a Gratis')}</button>` : ''}
          ${plansJustChanged ? `<div class="pro-plans-done">${cur === 'free' ? tr('Plan «Gratis» activado (no se cobra nada)') : '✓ «' + PLANS[cur].label + '» ' + tr('activado · prueba gratis empezada')}</div>` : ''}
          <div style="height:24px"></div>
        </div>
      </div>`;
  }
  function pickTier(id) {
    if (id === 'free') cancelPlan(); else activateWithTrial(id);
    plansJustChanged = true;
    showPlans();
    try { if (typeof renderProfile === 'function') renderProfile(); } catch (e) { }
    try { if (typeof renderDash === 'function') renderDash(); } catch (e) { }
  }
  function closePlans() { plansJustChanged = false; const m = document.getElementById('proPlansModal'); if (m) m.remove(); }

  /** Render PRO badges on UI elements */
  function renderProBadges() {
    // El Inicio nativo depende del plan (badge PRO, anuncio, insights bloqueados): refrescarlo
    try { if (typeof renderNativeHome === 'function' && typeof workouts !== 'undefined') renderNativeHome(); } catch (e) { }
    // Add/remove pro badge in topbar
    const topbar = document.querySelector('.tb-brand');
    if (!topbar) return;

    let badge = document.getElementById('proBadge');
    if (isPro()) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'proBadge';
        badge.className = 'pro-badge';
        badge.textContent = getPlan().name;
        topbar.appendChild(badge);
      } else {
        badge.textContent = getPlan().name;
      }
    } else if (badge) {
      badge.remove();
    }
  }

  /* ── Anti-tamper: validate local cache against Firestore on visibility ── */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && fbDb && fbUser && !isAdmin) {
      // Re-validate from server when tab becomes visible
      loadFromFirestore();
    }
  });

  /* ── Initialize ── */
  load();

  /* ── Return public API ── */
  return {
    can,
    gate,
    requirePro,
    isPro,
    getPlan,
    getPlanName,
    setPlan,
    trackAiUsage,
    aiRemaining,
    isAccentAvailable,
    canAddSession,
    historyLimit,
    showUpgradeModal,
    closeUpgradeModal,
    selectPlan,
    showPlans,
    closePlans,
    pickTier,
    activateWithTrial,
    cancelPlan,
    isOnTrial,
    trialDays,
    renderProBadges,
    checkAdmin,
    loadFromFirestore,
    saveToFirestore,
    listenSubscription,
    PLANS,
  };

})();
