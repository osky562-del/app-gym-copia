/* ══ CONSTANTS ══ */
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MC = { 'Pecho': '#4f8cff', 'Espalda': '#30d998', 'Piernas': '#f5a623', 'Hombros': '#9b72f5', 'Bíceps': '#ff6eb4', 'Tríceps': '#ff4d4f', 'Core': '#4dd4e8', 'Otros': '#888' };
const MM = { banca: 'Pecho', inclinado: 'Pecho', apertura: 'Pecho', fondo: 'Pecho', dominada: 'Espalda', remo: 'Espalda', jalón: 'Espalda', muerto: 'Espalda', sentadilla: 'Piernas', prensa: 'Piernas', femoral: 'Piernas', extensión: 'Piernas', gemelo: 'Piernas', rumano: 'Piernas', militar: 'Hombros', lateral: 'Hombros', frontal: 'Hombros', pájaro: 'Hombros', curl: 'Bíceps', bíceps: 'Bíceps', tríceps: 'Tríceps', francés: 'Tríceps', crunch: 'Core', plancha: 'Core', encogimiento: 'Core', abdominal: 'Core' };
const LEVELS = [{ lvl: 1, title: 'Novato', min: 0, max: 500 }, { lvl: 2, title: 'Guerrero', min: 500, max: 1200 }, { lvl: 3, title: 'Atleta', min: 1200, max: 2500 }, { lvl: 4, title: 'Campeón', min: 2500, max: 5000 }, { lvl: 5, title: 'Élite', min: 5000, max: 10000 }, { lvl: 6, title: 'Maestro', min: 10000, max: 20000 }, { lvl: 7, title: 'Leyenda', min: 20000, max: Infinity }];
const XP = { session: 50, exercise: 10, series: 5, pr: 100 };
recalculateBonusXp();
const TPL = {
  1: [{ ex: "Press banca", s: 4, r: 10 }, { ex: "Press inclinado", s: 3, r: 12 }, { ex: "Aperturas", s: 3, r: 15 }, { ex: "Fondos", s: 3, r: 12 }, { ex: "Extensión tríceps", s: 3, r: 12 }, { ex: "Press francés", s: 3, r: 10 }],
  2: [{ ex: "Dominadas", s: 4, r: 10 }, { ex: "Remo con barra", s: 4, r: 10 }, { ex: "Jalón al pecho", s: 3, r: 12 }, { ex: "Curl bíceps barra", s: 3, r: 10 }, { ex: "Curl alterno", s: 3, r: 12 }, { ex: "Curl concentrado", s: 2, r: 12 }],
  3: [{ ex: "Sentadilla", s: 4, r: 10 }, { ex: "Prensa de piernas", s: 4, r: 12 }, { ex: "Peso muerto rumano", s: 3, r: 10 }, { ex: "Curl femoral", s: 3, r: 12 }, { ex: "Extensión cuádriceps", s: 3, r: 15 }, { ex: "Gemelos", s: 4, r: 15 }],
  4: [{ ex: "Press militar", s: 4, r: 10 }, { ex: "Elevaciones laterales", s: 3, r: 15 }, { ex: "Elevaciones frontales", s: 3, r: 12 }, { ex: "Pájaros", s: 3, r: 15 }, { ex: "Encogimientos", s: 3, r: 15 }, { ex: "Crunch", s: 3, r: 20 }, { ex: "Plancha", s: 3, r: 60 }]
};
