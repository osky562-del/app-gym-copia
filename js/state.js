/* ══ STATE ══ */
let planExs = [], restSelIdx = -1;
let liveExs = [], liveIdx = 0, liveTotalSec = 0, livePauseSec = 0;
let liveTotalInt = null, livePauseInt = null, liveIsPaused = false, livePauseCnt = 0;
let restLeft = 0, restTotal = 0, restInt = null;
let charts = {}, delId = null, cMetric = 'MAX', cTime = 'ALL';
