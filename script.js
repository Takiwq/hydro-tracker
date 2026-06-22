/**
 * ГИДРО — Трекер воды v2
 * Pure vanilla JS · localStorage · glass water visualizer
 */

/* ============================================
   CONSTANTS
   ============================================ */
const STORAGE_KEY    = 'hydro_tracker_v1';
const ML_PER_KG      = 40;
const DEFAULT_WEIGHT = 70;
const DAYS_SHORT     = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/* ============================================
   STORAGE
   ============================================ */
function loadData() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.warn('localStorage недоступен:', e); }
}
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ============================================
   STATE
   ============================================ */
function getInitialState() {
  const saved = loadData();
  const today = getTodayKey();
  if (saved) {
    if (!(today in saved.history)) saved.history[today] = 0;
    return saved;
  }
  return { weight: DEFAULT_WEIGHT, history: { [today]: 0 }, lastAction: null };
}
let state = getInitialState();

/* ============================================
   DOM
   ============================================ */
const $ = id => document.getElementById(id);

const elTodayDate      = $('today-date');
const elWeightInput    = $('weight-input');
const elGoalValue      = $('goal-value');
const elGoalFormula    = $('goal-formula');
const elProgressFrac   = $('progress-fraction');
const elProgressRemain = $('progress-remain');
const elGlassPct       = $('glass-pct');
const elWaterRect      = $('water-rect');
const elWavesGroup     = $('waves-group');
const elProgressBarEl  = $('progress-bar-el');
const elLastDot        = $('last-action-dot');
const elLastText       = $('last-action-text');
const elResetBtn       = $('reset-btn');
const elWeekChart      = $('week-chart');
const elWeekAvg        = $('week-avg');
const elCustomAmount   = $('custom-amount');
const elCustomAddBtn   = $('custom-add-btn');
const elToast          = $('toast');
const elModalOverlay   = $('modal-overlay');
const elModalCancel    = $('modal-cancel');
const elModalConfirm   = $('modal-confirm');

/* ============================================
   COMPUTED
   ============================================ */
const getGoal    = () => (state.weight || DEFAULT_WEIGHT) * ML_PER_KG;
const getToday   = () => state.history[getTodayKey()] || 0;
const getPct     = () => Math.min(100, Math.round((getToday() / getGoal()) * 100));

/* ============================================
   RENDER — PROGRESS GLASS
   ============================================ */
// Уровень воды (0%) считается от верхней кромки трапеции стакана (8) до её
// "плоского" дна (200) — так проценты визуально совпадают с рисками 25/50/75%.
// Но сама заливка (water-rect) всегда доходит до 214 — самой нижней точки
// скруглённого дна, — чтобы закруглённая часть стакана не оставалась пустой.
const GLASS_TOP_Y      = 8;
const GLASS_FLAT_BOTTOM_Y = 200;  // уровень "0% воды" — верх скруглённого дна
const GLASS_FILL_BOTTOM_Y = 214;  // нижняя граница заливки — ниже самой выпуклой точки дна (212)
const GLASS_FULL_H     = GLASS_FLAT_BOTTOM_Y - GLASS_TOP_Y; // 192

function updateGlass() {
  const pct    = getPct();
  const amount = getToday();
  const goal   = getGoal();
  const remain = Math.max(0, goal - amount);

  // Числа
  elProgressFrac.textContent = `${amount} / ${goal} мл`;
  elGlassPct.textContent     = `${pct}%`;
  elProgressBarEl.setAttribute('aria-valuenow', pct);

  // Поднимаем воду: верхняя кромка движется от 200 (0%) до 8 (100%),
  // а нижняя граница rect всегда зафиксирована на 214, чтобы скруглённое
  // дно стакана было залито при любом ненулевом проценте.
  if (elWaterRect) {
    if (pct <= 0) {
      elWaterRect.setAttribute('height', '0');
    } else {
      const surfaceY = GLASS_FLAT_BOTTOM_Y - (pct / 100) * GLASS_FULL_H;
      const waterH   = GLASS_FILL_BOTTOM_Y - surfaceY;
      elWaterRect.setAttribute('y', surfaceY.toFixed(2));
      elWaterRect.setAttribute('height', Math.max(0, waterH).toFixed(2));

      // Волны следуют за поверхностью воды
      if (elWavesGroup) {
        elWavesGroup.setAttribute('transform', `translate(0,${(surfaceY - GLASS_FLAT_BOTTOM_Y).toFixed(2)})`);
      }
    }
  }

  // Статус под стаканом
  if (pct >= 100) {
    elProgressRemain.textContent = '✓ норма выполнена!';
    elProgressRemain.classList.add('done');
  } else {
    elProgressRemain.textContent = `осталось ${remain} мл`;
    elProgressRemain.classList.remove('done');
  }
}

/* ============================================
   RENDER — GOAL
   ============================================ */
function updateGoal() {
  const goal   = getGoal();
  const weight = state.weight || DEFAULT_WEIGHT;
  elGoalValue.innerHTML = `${goal} <span class="goal-ml">мл</span>`;
  if (elGoalFormula) elGoalFormula.textContent = `${weight} кг × ${ML_PER_KG} мл`;
}

/* ============================================
   RENDER — LAST ACTION
   ============================================ */
function updateLastAction() {
  if (!state.lastAction) {
    elLastDot.classList.add('empty');
    elLastText.textContent = 'Нет записей за сегодня';
    return;
  }
  elLastDot.classList.remove('empty');
  const { text, time } = state.lastAction;
  elLastText.textContent = `${text} в ${time}`;
}

/* ============================================
   RENDER — WEEK CHART
   ============================================ */
function updateWeekChart() {
  const goal  = getGoal();
  const today = new Date();
  const days  = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push({ day: DAYS_SHORT[d.getDay()], ml: state.history[key] || 0, isToday: i === 0 });
  }

  const withData = days.filter(d => d.ml > 0);
  const avg = withData.length
    ? Math.round(withData.reduce((s,d) => s + d.ml, 0) / withData.length)
    : 0;
  elWeekAvg.textContent = avg > 0 ? `Ср: ${avg} мл` : 'Ср: — мл';

  const maxMl = Math.max(goal, ...days.map(d => d.ml), 1);
  elWeekChart.innerHTML = '';

  days.forEach(({ day, ml, isToday }) => {
    const hPct = ml > 0 ? Math.max(5, Math.round((ml / maxMl) * 100)) : 3;
    let barClass = 'week-bar--normal';
    if (!ml)        barClass = 'week-bar--empty';
    else if (ml >= goal) barClass = 'week-bar--goal';
    if (isToday)    barClass = 'week-bar--today';

    const label = ml >= 1000 ? `${(ml/1000).toFixed(1)}л` : ml > 0 ? `${ml}` : '–';

    const wrap = document.createElement('div');
    wrap.className = 'week-bar-wrap';
    wrap.innerHTML = `
      <div class="week-ml">${label}</div>
      <div class="week-bar-col">
        <div class="week-bar ${barClass}" style="height:${hPct}%"></div>
      </div>
      <div class="week-day ${isToday ? 'is-today' : ''}">${day}</div>
    `;
    elWeekChart.appendChild(wrap);
  });
}

/* ============================================
   FULL RENDER
   ============================================ */
function render() {
  updateGoal();
  updateGlass();
  updateLastAction();
  updateWeekChart();
}

/* ============================================
   ADD WATER
   ============================================ */
function addWater(mlRaw, type = 'water') {
  const ml       = Math.round(mlRaw);
  const todayKey = getTodayKey();

  if (!(todayKey in state.history)) state.history[todayKey] = 0;
  state.history[todayKey] += ml;

  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const names = { water: 'Вода', tea: 'Чай', coffee: 'Кофе', custom: 'Добавлено' };

  state.lastAction = { text: `+${ml} мл — ${names[type] || 'Добавлено'}`, time };
  saveData(state);
  render();

  // Toast
  const total = getToday();
  const goal  = getGoal();
  const pct   = Math.min(100, Math.round((total / goal) * 100));
  if (pct >= 100 && total - ml < goal) {
    showToast(`🎉 Норма выполнена! ${total} мл выпито!`);
  } else {
    const icons = { water: '💧', tea: '🍵', coffee: '☕', custom: '💧' };
    showToast(`${icons[type] || '💧'} +${ml} мл · Итого ${total} мл (${pct}%)`);
  }
}

/* ============================================
   TOAST
   ============================================ */
let toastTimer = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2800);
}

/* ============================================
   PARSE CUSTOM INPUT
   Поддерживает: "250", "-100", "1.5" (литры → мл)
   ============================================ */
function parseCustomInput(raw) {
  const str = raw.trim();
  if (!str) return { ok: false, msg: 'Введи количество мл' };

  // Убираем лишние символы, оставляем цифры, минус, точку/запятую
  const cleaned = str.replace(',', '.').replace(/[^\d.\-]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) return { ok: false, msg: 'Не могу распознать число' };

  let ml = num;
  // Если меньше 10 — возможно, это литры
  if (Math.abs(ml) < 10 && Math.abs(ml) > 0) ml = ml * 1000;
  ml = Math.round(ml);

  if (ml === 0) return { ok: false, msg: 'Ноль мл — это ничего 😄' };
  if (ml < 0) {
    // Вычитание воды
    const current = getToday();
    if (-ml > current) return { ok: false, msg: `Нельзя убрать больше чем выпито (${current} мл)` };
    return { ok: true, ml };
  }
  if (ml > 3000) return { ok: false, msg: 'Максимум 3000 мл за раз' };
  return { ok: true, ml };
}

/* ============================================
   EVENT: DRINK BUTTONS
   ============================================ */
document.querySelectorAll('.drink-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const raw    = parseInt(btn.dataset.amount, 10);
    const type   = btn.dataset.type;
    const ml     = btn.classList.contains('drink-btn--coffee') ? raw * 0.8 : raw;

    btn.classList.remove('tapped');
    void btn.offsetWidth;
    btn.classList.add('tapped');
    btn.addEventListener('animationend', () => btn.classList.remove('tapped'), { once: true });

    addWater(ml, type);
  });
});

/* ============================================
   EVENT: CUSTOM ADD
   ============================================ */
function handleCustomAdd() {
  const result = parseCustomInput(elCustomAmount.value);

  if (!result.ok) {
    elCustomAmount.classList.remove('error');
    void elCustomAmount.offsetWidth;
    elCustomAmount.classList.add('error');
    elCustomAmount.addEventListener('animationend', () => elCustomAmount.classList.remove('error'), { once: true });
    showToast(`⚠️ ${result.msg}`);
    elCustomAmount.focus();
    return;
  }

  addWater(result.ml, 'custom');
  elCustomAmount.value = '';
}

elCustomAddBtn.addEventListener('click', handleCustomAdd);
elCustomAmount.addEventListener('keydown', e => { if (e.key === 'Enter') handleCustomAdd(); });

/* ============================================
   EVENT: WEIGHT INPUT
   ============================================ */
elWeightInput.addEventListener('input', () => {
  const w = parseFloat(elWeightInput.value);
  if (w >= 20 && w <= 300) {
    state.weight = w;
    saveData(state);
    render();
  } else if (!elWeightInput.value) {
    state.weight = DEFAULT_WEIGHT;
    render();
  }
});

/* ============================================
   EVENT: RESET
   ============================================ */
elResetBtn.addEventListener('click', () => elModalOverlay.classList.add('open'));
elModalCancel.addEventListener('click', () => elModalOverlay.classList.remove('open'));
elModalOverlay.addEventListener('click', e => {
  if (e.target === elModalOverlay) elModalOverlay.classList.remove('open');
});
elModalConfirm.addEventListener('click', () => {
  state.history[getTodayKey()] = 0;
  state.lastAction = null;
  saveData(state);
  elModalOverlay.classList.remove('open');
  render();
  showToast('🗑️ Данные за сегодня сброшены');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') elModalOverlay.classList.remove('open');
});

/* ============================================
   INIT
   ============================================ */
function init() {
  elWeightInput.value = state.weight || DEFAULT_WEIGHT;
  // Дата в шапке
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  elTodayDate.textContent = new Date().toLocaleDateString('ru-RU', opts);
  render();
}

init();

/* ============================================
   PWA — РЕГИСТРАЦИЯ SERVICE WORKER
   Без этого браузер не предложит "Установить приложение"
   и офлайн-кеш (sw.js) не будет работать.
   ============================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('Service Worker не зарегистрирован:', err));
  });
}
