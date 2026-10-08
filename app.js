const STORAGE_KEY = 'mhnHunterAssistant.v0.1';

const slotNames = {
  weapon: '武器', head: '頭部', chest: '身體', arms: '手部', waist: '腰部', legs: '腿部'
};
const slotIcons = {
  weapon: '⚔️', head: '🪖', chest: '🥋', arms: '🧤', waist: '🪢', legs: '🥾'
};

const defaultState = {
  hunter: { name: 'Hunter', hr: '', weapon: '' },
  equipment: []
};

let state = loadState();
let activeFilter = 'all';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function $(id) { return document.getElementById(id); }

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function goTo(target) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === target));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.target === target));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openDialog(id) {
  const dialog = $(id);
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function closeDialog(id) {
  const dialog = $(id);
  if (dialog.open) dialog.close();
}

function renderHunter() {
  const h = state.hunter || defaultState.hunter;
  $('hunterNameDisplay').textContent = h.name || 'Hunter';
  const hr = h.hr ? `HR ${h.hr}` : 'HR --';
  const weapon = h.weapon ? `主武器 ${h.weapon}` : '主武器未設定';
  $('hunterMeta').textContent = `${hr} ・ ${weapon}`;
}

function renderHome() {
  const count = state.equipment.length;
  $('equipmentCount').textContent = count;

  const capped = Math.min(count, 5);
  const percent = Math.round((capped / 5) * 100);
  $('goalPercent').textContent = `${percent}%`;
  $('goalBar').style.width = `${percent}%`;
  $('goalTitle').textContent = count === 0 ? '先建立第一件裝備' : count < 5 ? `完成第一套裝備庫（${count}/5）` : '第一套裝備庫已建立';
  $('goalHint').textContent = count === 0
    ? '新增裝備後，這裡會顯示你的養成進度。'
    : count < 5
      ? '先把最常用的武器與四件核心防具記錄進來。'
      : '很好，下一版就能開始拿這些資料做素材計算。';

  const recent = $('recentEquipment');
  if (!count) {
    recent.className = 'empty-state';
    recent.textContent = '尚未建立裝備資料。';
    return;
  }
  recent.className = 'recent-list';
  recent.innerHTML = state.equipment.slice(-3).reverse().map(itemCardHtml).join('');
}

function itemCardHtml(item, deletable = false) {
  const safeName = escapeHtml(item.name);
  const safeNote = escapeHtml(item.note || '');
  return `
    <article class="equipment-item">
      <div class="item-top">
        <div class="slot-icon">${slotIcons[item.type] || '⚔️'}</div>
        <div class="item-copy">
          <h4>${safeName}</h4>
          <div class="item-meta">
            <span class="badge">${slotNames[item.type] || item.type}</span>
            <span class="badge">G${item.grade}-${item.level}</span>
            <span class="badge">${escapeHtml(item.element || '無')}</span>
          </div>
          ${safeNote ? `<p class="note">${safeNote}</p>` : ''}
        </div>
        ${deletable ? `<button class="delete-btn" data-delete="${item.id}" aria-label="刪除">✕</button>` : ''}
      </div>
    </article>`;
}

function renderEquipment() {
  const list = $('equipmentList');
  const items = activeFilter === 'all'
    ? state.equipment
    : state.equipment.filter(item => item.type === activeFilter);

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${activeFilter === 'all' ? '還沒有裝備。點「＋ 新增」建立第一件。' : '這個部位目前沒有資料。'}</div>`;
    return;
  }
  list.innerHTML = items.slice().reverse().map(item => itemCardHtml(item, true)).join('');
}

function renderAll() {
  renderHunter();
  renderHome();
  renderEquipment();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fillGradeLevel() {
  $('equipmentGrade').innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $('equipmentGrade').value = '5';
  $('equipmentLevel').innerHTML = Array.from({ length: 5 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
}

function prepHunterForm() {
  $('hunterName').value = state.hunter.name || '';
  $('hunterHr').value = state.hunter.hr || '';
  $('hunterWeapon').value = state.hunter.weapon || '';
  openDialog('hunterDialog');
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mhn-hunter-assistant-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('備份檔已建立');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.equipment) || !parsed.hunter) throw new Error('bad file');
      state = { ...defaultState, ...parsed };
      saveState();
      showToast('備份匯入完成');
    } catch {
      showToast('這不是有效的 MHN 備份檔');
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  document.querySelectorAll('[data-target]').forEach(el => {
    el.addEventListener('click', () => goTo(el.dataset.target));
  });

  document.querySelectorAll('[data-toast]').forEach(el => {
    el.addEventListener('click', () => showToast(el.dataset.toast));
  });

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => closeDialog(el.dataset.close));
  });

  $('addEquipmentBtn').addEventListener('click', () => {
    $('equipmentForm').reset();
    $('equipmentGrade').value = '5';
    $('equipmentLevel').value = '1';
    openDialog('equipmentDialog');
  });

  $('equipmentForm').addEventListener('submit', event => {
    event.preventDefault();
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      type: $('equipmentType').value,
      name: $('equipmentName').value.trim(),
      grade: Number($('equipmentGrade').value),
      level: Number($('equipmentLevel').value),
      element: $('equipmentElement').value,
      note: $('equipmentNote').value.trim(),
      createdAt: new Date().toISOString()
    };
    if (!item.name) return;
    state.equipment.push(item);
    saveState();
    closeDialog('equipmentDialog');
    showToast('裝備已新增');
  });

  $('equipmentList').addEventListener('click', event => {
    const btn = event.target.closest('[data-delete]');
    if (!btn) return;
    const item = state.equipment.find(x => x.id === btn.dataset.delete);
    if (!item) return;
    if (confirm(`要刪除「${item.name}」嗎？`)) {
      state.equipment = state.equipment.filter(x => x.id !== item.id);
      saveState();
      showToast('裝備已刪除');
    }
  });

  $('filterRow').addEventListener('click', event => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    activeFilter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === chip));
    renderEquipment();
  });

  $('editHunterBtn').addEventListener('click', prepHunterForm);
  $('editHunterSettingsBtn').addEventListener('click', prepHunterForm);

  $('hunterForm').addEventListener('submit', event => {
    event.preventDefault();
    state.hunter = {
      name: $('hunterName').value.trim() || 'Hunter',
      hr: $('hunterHr').value.trim(),
      weapon: $('hunterWeapon').value
    };
    saveState();
    closeDialog('hunterDialog');
    showToast('獵人資料已更新');
  });

  $('exportBtn').addEventListener('click', exportData);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', e => importData(e.target.files?.[0]));

  $('clearBtn').addEventListener('click', () => {
    if (!confirm('確定要清除這台裝置上的 MHN Assistant 資料嗎？')) return;
    state = structuredClone(defaultState);
    saveState();
    showToast('本機資料已清除');
  });
}

fillGradeLevel();
bindEvents();
renderAll();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
