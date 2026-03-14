/* =====================================================
   ПАНЕЛЬ УПРАВЛЕНИЯ АУДИТОРА — script.js
   ===================================================== */

/* =================================================
   ЧАСЫ В ШАПКЕ
   ================================================= */
function updateClock() {
  const el = document.getElementById('headerClock');
  if (!el) return;
  const now = new Date();
  const days = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
  const d  = String(now.getDate()).padStart(2,'0');
  const mo = String(now.getMonth()+1).padStart(2,'0');
  const y  = now.getFullYear();
  const h  = String(now.getHours()).padStart(2,'0');
  const mi = String(now.getMinutes()).padStart(2,'0');
  const s  = String(now.getSeconds()).padStart(2,'0');
  el.textContent = `${days[now.getDay()]} ${d}.${mo}.${y} — ${h}:${mi}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();


/* =================================================
   БЛОК 1: СТАТУСЫ В АУДИТОРИИ
   Хранятся в localStorage. При первом запуске
   загружаются дефолтные значения.
   ================================================= */

// Статусы по умолчанию — загружаются если localStorage пуст
const DEFAULT_STATUSES = [
  'Работа с почтой',
  'Выгрузка отчета по аудиту',
  'Работа с БЗ',
  'Выгрузка ЗФ для аудита',
  'Прослушка внешки',
];

/**
 * Читает статусы из localStorage.
 * Если записи нет — возвращает дефолтный список.
 */
function loadStatuses() {
  try {
    const raw = localStorage.getItem('auditor_statuses');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return [...DEFAULT_STATUSES];
}

/**
 * Сохраняет массив статусов в localStorage.
 */
function saveStatuses(list) {
  localStorage.setItem('auditor_statuses', JSON.stringify(list));
}

/**
 * Перерисовывает список статусов в DOM.
 * Вызывается при любом изменении (добавление / удаление).
 */
function renderStatuses() {
  const list = loadStatuses();
  const container = document.getElementById('statusList');
  container.innerHTML = '';

  list.forEach((text, index) => {
    const item = document.createElement('div');
    item.className = 'status-item';

    // Текст статуса
    const span = document.createElement('span');
    span.className = 'status-text';
    span.textContent = text;

    // Кнопка «Копировать»
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy-inline';
    copyBtn.textContent = 'Копировать';
    copyBtn.addEventListener('click', () => copyStatusText(text, copyBtn));

    // Кнопка «Удалить»
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-inline';
    delBtn.title = 'Удалить статус';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteStatus(index));

    item.appendChild(span);
    item.appendChild(copyBtn);
    item.appendChild(delBtn);
    container.appendChild(item);
  });
}

/**
 * Добавляет новый статус из поля ввода.
 */
function addStatus() {
  const input = document.getElementById('statusNewInput');
  const text = input.value.trim();
  if (!text) return;

  const list = loadStatuses();

  // Не добавляем дубликаты
  if (list.includes(text)) {
    input.style.borderColor = 'var(--red)';
    setTimeout(() => input.style.borderColor = '', 1000);
    return;
  }

  list.push(text);
  saveStatuses(list);
  renderStatuses();
  input.value = '';
  input.focus();
}

/**
 * Удаляет статус по индексу.
 */
function deleteStatus(index) {
  const list = loadStatuses();
  list.splice(index, 1);
  saveStatuses(list);
  renderStatuses();
}

/**
 * Копирует текст статуса в буфер.
 */
function copyStatusText(text, btn) {
  const done = () => {
    const orig = btn.textContent;
    btn.textContent = '✓ Скопировано';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1500);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}


/* =================================================
   БЛОК 2: КОНВЕРТАЦИЯ ВРЕМЕНИ NAUMEN
   Вход:  "02.03.2026 09:00"
   Выход: "2026-03-02 09:00:00"

   Автозапуск: при вставке (paste), если формат совпадает.
   Также: Enter в поле.
   ================================================= */

function convertTime() {
  removeError('timeInput');
  const input = document.getElementById('timeInput');
  const val = input.value.trim();
  const match = val.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);

  if (!match) {
    showError('timeInput', 'Формат: ДД.ММ.ГГГГ ЧЧ:ММ (например 02.03.2026 09:00)');
    return;
  }

  const [, dd, mm, yyyy, hh, mi] = match;
  const result = `${yyyy}-${mm}-${dd} ${hh}:${mi}:00`;

  document.getElementById('timeResult').textContent = result;
  document.getElementById('timeResultRow').style.display = 'flex';
  copyToClipboard(result, 'timeToast', null);

  setTimeout(() => {
    input.value = '';
    document.getElementById('timeResultRow').style.display = 'none';
  }, 2000);
}


/* =================================================
   БЛОК 3: ИЗВЛЕЧЕНИЕ ФИО
   Автозапуска нет — пользователь может редактировать
   после вставки.
   ================================================= */

function extractFIO() {
  removeError('fioInput');
  const raw = document.getElementById('fioInput').value;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  let lastName = '', firstName = '', middleName = '';

  lines.forEach(line => {
    if (!lastName && !line.toLowerCase().startsWith('имя') && !line.toLowerCase().startsWith('отчество')) {
      for (const part of line.split('_')) {
        const clean = part.replace(/[^а-яёА-ЯЁa-zA-Z\-]/g, '');
        if (clean && /^[А-ЯЁA-Z]/u.test(clean)) { lastName = clean; break; }
      }
    }
    if (/^имя\s+/i.test(line))      firstName  = line.replace(/^имя\s+/i, '').trim().split(/[\s_]+/)[0];
    if (/^отчество\s+/i.test(line)) middleName = line.replace(/^отчество\s+/i, '').trim().split(/[\s_]+/)[0];
  });

  if (!lastName || !firstName) {
    showError('fioInput', 'Не удалось извлечь ФИО. Проверьте формат текста.');
    return;
  }

  const fio = [lastName, firstName, middleName].filter(Boolean).join(' ');
  document.getElementById('fioResult').textContent = fio;
  document.getElementById('fioResultRow').style.display = 'flex';
  copyToClipboard(fio, 'fioToast', null);

  setTimeout(() => {
    document.getElementById('fioInput').value = '';
    document.getElementById('fioResultRow').style.display = 'none';
  }, 2000);
}


/* =================================================
   БЛОК 4: ИЗВЛЕЧЕНИЕ КЛЮЧА ЗВОНКА
   Автозапуск: всегда при вставке (ссылка всегда
   одного формата, парсить вручную незачем).
   ================================================= */

function extractCallKey(value) {
  removeError('callInput');
  const input = document.getElementById('callInput');
  const val = (value !== undefined ? value : input.value).trim();

  if (!val) { showError('callInput', 'Вставьте ссылку с параметром session_id='); return; }

  const match = val.match(/[?&]session_id=([^&]+)/);
  if (!match) { showError('callInput', 'Параметр session_id не найден в ссылке'); return; }

  const key = match[1];
  document.getElementById('callResult').textContent = key;
  document.getElementById('callResultRow').style.display = 'flex';
  copyToClipboard(key, 'callToast', null);

  setTimeout(() => {
    input.value = '';
    document.getElementById('callResultRow').style.display = 'none';
  }, 2000);
}


/* =================================================
   УТИЛИТЫ
   ================================================= */

function copyToClipboard(text, toastId, callback) {
  const done = () => {
    showToast(toastId);
    if (callback) setTimeout(callback, 600);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, callback) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  if (callback) callback();
}

function showToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

function showError(fieldId, message) {
  removeError(fieldId);
  const field = document.getElementById(fieldId);
  if (!field) return;
  const err = document.createElement('div');
  err.className = 'error-text';
  err.id = fieldId + '_err';
  err.textContent = '⚠ ' + message;
  field.parentNode.insertBefore(err, field.nextSibling);
}

function removeError(fieldId) {
  const old = document.getElementById(fieldId + '_err');
  if (old) old.remove();
}


/* =================================================
   ИНИЦИАЛИЗАЦИЯ + НАВЕШИВАНИЕ СОБЫТИЙ
   ================================================= */
document.addEventListener('DOMContentLoaded', () => {

  // --- Статусы: рендер из localStorage ---
  renderStatuses();

  // Enter в поле нового статуса = добавить
  document.getElementById('statusNewInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addStatus();
  });

  // --- Время: Enter = конвертировать ---
  document.getElementById('timeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') convertTime();
  });

  // --- Время: автозапуск при вставке ---
  // Если формат совпадает — конвертируем сразу.
  // Если нет — вставляем текст в поле И сразу показываем ошибку формата.
  document.getElementById('timeInput').addEventListener('paste', e => {
    const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
    e.preventDefault(); // всегда перехватываем, чтобы управлять полем сами
    document.getElementById('timeInput').value = pasted;
    if (/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/.test(pasted)) {
      setTimeout(() => convertTime(), 0);
    } else {
      // Формат не совпал — сразу показываем ошибку, поле не очищаем
      showError('timeInput', 'Формат: ДД.ММ.ГГГГ ЧЧ:ММ (например 02.03.2026 09:00)');
    }
  });

  // --- ФИО: автозапуск при вставке ---
  // Вставляем текст в textarea и сразу запускаем извлечение
  document.getElementById('fioInput').addEventListener('paste', e => {
    const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
    e.preventDefault();
    document.getElementById('fioInput').value = pasted;
    setTimeout(() => extractFIO(), 0);
  });

  // --- Ключ звонка: Enter = извлечь ---
  document.getElementById('callInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') extractCallKey();
  });

  // --- Ключ звонка: автозапуск при любой вставке ---
  document.getElementById('callInput').addEventListener('paste', e => {
    const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
    e.preventDefault();
    document.getElementById('callInput').value = pasted;
    setTimeout(() => extractCallKey(pasted), 0);
  });

});
