/* ══ KO95FIT PRO — Plan & Feature Gate System ══

   Tier system:
   - 'free'     → Basic features, limited sessions
   - 'pro'      → Full features, unlimited
   - 'pro_plus' → Everything + AI routines, social, periodization

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
      maxSessions: 15,       // Max stored sessions
      maxHistory: 10,        // Visible history items
      aiCoachPerWeek: 1,     // AI coach queries per week
      aiRutina: false,       // AI routine generator
      advancedAnalytics: false,
      exportImport: true,    // Keep free for user retention
      customThemes: false,   // Only 2 accent colors free
      freeAccents: ['red', 'blue'],
      unlimitedWorkouts: false,
      weeklyComparison: false,
      bodyWeight: true,
      prTable: false,
      heatmap: false,
    },
    pro: {
      name: 'Pro',
      label: 'Pro',
      price: '$4.99/mes',
      maxSessions: Infinity,
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
    },
    pro_plus: {
      name: 'Pro+',
      label: 'Pro+',
      price: '$9.99/mes',
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
      // Pro+ exclusive
      periodization: true,
      socialFeatures: true,
      mealPlans: true,
      videoAnalysis: true,
      prioritySupport: true,
    }
  };

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
    'periodization':      'periodization',
    'social':             'socialFeatures',
    'meal_plans':         'mealPlans',
    'video_analysis':     'videoAnalysis',
    'priority_support':   'prioritySupport',
  };

  /* ── Admin / Owner Emails (auto Pro+) ── */
  const ADMIN_EMAILS = [
    'osky_95@hotmail.com',
  ];

  /* ── State ── */
  let currentPlan = 'free';
  let planExpiry = null;
  let aiUsageThisWeek = 0;
  let aiWeekStart = null;
  let isAdmin = false;

  /* ── Load from storage ── */
  function load() {
    const saved = STORE.get('pro_plan');
    if (saved) {
      currentPlan = saved.plan || 'free';
      planExpiry = saved.expiry ? new Date(saved.expiry) : null;
      aiUsageThisWeek = saved.aiUsage || 0;
      aiWeekStart = saved.aiWeekStart || null;

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
  function checkAdmin(email) {
    if (!email) return;
    isAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
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
      'ai_coach': 'Coach IA ilimitado',
      'ai_rutina': 'Generador de rutinas IA',
      'analytics': 'Analíticas avanzadas',
      'advanced_analytics': 'Analíticas avanzadas',
      'custom_themes': 'Todos los colores',
      'unlimited_workouts': 'Entrenos ilimitados',
      'weekly_comparison': 'Comparativa semanal',
      'pr_table': 'Tabla de récords',
      'heatmap': 'Mapa de actividad',
      'periodization': 'Periodización',
      'social': 'Funciones sociales',
      'meal_plans': 'Planes de comida',
      'video_analysis': 'Análisis de video',
    };

    const label = featureLabels[featureName] || featureName;

    // Remove existing modal
    const old = document.getElementById('proUpgradeModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'proUpgradeModal';
    modal.innerHTML = `
      <div class="pro-modal-overlay" onclick="Pro.closeUpgradeModal()">
        <div class="pro-modal-card" onclick="event.stopPropagation()">
          <div class="pro-modal-badge">⚡ PRO</div>
          <div class="pro-modal-title">Desbloquea ${label}</div>
          <div class="pro-modal-desc">Esta función requiere KO95FIT Pro. Mejora tu plan para acceder a todas las herramientas avanzadas.</div>

          <div class="pro-modal-plans">
            <div class="pro-plan-option" onclick="Pro.selectPlan('pro')">
              <div class="pro-plan-name">Pro</div>
              <div class="pro-plan-price">$4.99<small>/mes</small></div>
              <ul class="pro-plan-features">
                <li>Coach IA ilimitado</li>
                <li>Analíticas avanzadas</li>
                <li>Rutinas IA</li>
                <li>Todos los temas</li>
                <li>Historial ilimitado</li>
              </ul>
            </div>
            <div class="pro-plan-option featured" onclick="Pro.selectPlan('pro_plus')">
              <div class="pro-plan-popular">Más popular</div>
              <div class="pro-plan-name">Pro+</div>
              <div class="pro-plan-price">$9.99<small>/mes</small></div>
              <ul class="pro-plan-features">
                <li>Todo de Pro +</li>
                <li>Periodización</li>
                <li>Planes de comida IA</li>
                <li>Soporte prioritario</li>
              </ul>
            </div>
          </div>

          <button class="pro-modal-close" onclick="Pro.closeUpgradeModal()">Quizás luego</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    if (typeof vib === 'function') vib([30]);
  }

  function closeUpgradeModal() {
    const m = document.getElementById('proUpgradeModal');
    if (m) m.remove();
  }

  function selectPlan(planId) {
    // TODO: Integrate with Stripe / RevenueCat / payment provider
    // For now, this is a placeholder that shows a message
    closeUpgradeModal();
    toast('Pago pendiente de integrar. Plan: ' + (PLANS[planId]?.label || planId), 'ok');

    // DEVELOPMENT: Uncomment to test pro features
    // setPlan(planId, new Date(Date.now() + 30*24*60*60*1000));
  }

  /** Render PRO badges on UI elements */
  function renderProBadges() {
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
    renderProBadges,
    checkAdmin,
    loadFromFirestore,
    saveToFirestore,
    listenSubscription,
    PLANS,
  };

})();
