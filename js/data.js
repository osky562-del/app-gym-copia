/* ══ EXPORT / IMPORT ══ */
function exportData() {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    workouts: workouts,
    weightLogs: weightLogs,
    bonusXp: bonusXp
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ko95fit_backup_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Datos exportados ✓', 'good');
}
function importData() {
  $('importFile').click();
}
function doImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.workouts || !Array.isArray(data.workouts)) throw new Error('Formato inválido');
      if (!confirm('¿Importar ' + data.workouts.length + ' sesiones? Se añadirán a los datos actuales.')) return;
      // Merge — avoid duplicates by id
      const existingIds = new Set(workouts.map(w => w.id));
      const newOnes = data.workouts.filter(w => !existingIds.has(w.id));
      workouts = [...workouts, ...newOnes].sort((a, b) => b.date.localeCompare(a.date));
      if (data.weightLogs) weightLogs = data.weightLogs;
      if (data.bonusXp) bonusXp = data.bonusXp;
      saveWorkouts();
      STORE.set('weights', weightLogs);
      STORE.set('bonusXp', bonusXp);
      renderDash(); updateXpBar();
      toast(newOnes.length + ' sesiones importadas ✓', 'good');
    } catch (err) {
      toast('Error al importar: ' + err.message, 'err');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}
