const STORAGE_KEY = 'mhnHunterAssistant.v0.1';

const slotNames = {
  weapon: '武器', head: '頭部', chest: '身體', arms: '手部', waist: '腰部', legs: '腿部'
};
const slotIcons = {
  weapon: '⚔️', head: '🪖', chest: '🥋', arms: '🧤', waist: '🪢', legs: '🥾'
};

const defaultState = {
  hunter: { name: 'Hunter', hr: '', weapon: '' },
  equipment: [],
  materialPlans: []
};

let state = loadState();
let activeFilter = 'all';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      hunter: { ...defaultState.hunter, ...(parsed.hunter || {}) },
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
      materialPlans: Array.isArray(parsed.materialPlans) ? parsed.materialPlans : []
    };
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
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
  $('materialPlanCount').textContent = state.materialPlans.length;

  const capped = Math.min(count, 5);
  const percent = Math.round((capped / 5) * 100);
  $('goalPercent').textContent = `${percent}%`;
  $('goalBar').style.width = `${percent}%`;
  $('goalTitle').textContent = count === 0 ? '先建立第一件裝備' : count < 5 ? `完成第一套裝備庫（${count}/5）` : '第一套裝備庫已建立';
  $('goalHint').textContent = count === 0
    ? '新增裝備後，這裡會顯示你的養成進度。'
    : count < 5
      ? '先把最常用的武器與四件核心防具記錄進來。'
      : state.materialPlans.length
        ? '裝備庫已建立，接著追蹤素材缺口。'
        : '現在可以替裝備建立素材升級計畫。';

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

function planStats(plan) {
  const rows = Array.isArray(plan.materials) ? plan.materials : [];
  const required = rows.reduce((sum, row) => sum + Math.max(0, Number(row.required) || 0), 0);
  const ownedForProgress = rows.reduce((sum, row) => {
    const need = Math.max(0, Number(row.required) || 0);
    const owned = Math.max(0, Number(row.owned) || 0);
    return sum + Math.min(need, owned);
  }, 0);
  const missing = rows.reduce((sum, row) => {
    const need = Math.max(0, Number(row.required) || 0);
    const owned = Math.max(0, Number(row.owned) || 0);
    return sum + Math.max(0, need - owned);
  }, 0);
  const percent = required ? Math.round((ownedForProgress / required) * 100) : 100;
  return { required, missing, percent };
}

function materialPlanHtml(plan) {
  const stats = planStats(plan);
  const equipment = state.equipment.find(item => item.id === plan.equipmentId);
  const rows = (plan.materials || []).map((row, index) => {
    const required = Math.max(0, Number(row.required) || 0);
    const owned = Math.max(0, Number(row.owned) || 0);
    const missing = Math.max(0, required - owned);
    return `
      <div class="material-line">
        <div class="material-line-name">
          <strong>${escapeHtml(row.name || '未命名素材')}</strong>
          <small>${missing ? `還缺 ${missing}` : '已足夠 ✓'}</small>
        </div>
        <div class="material-line-counts">
          <label>已有<input type="number" min="0" inputmode="numeric" value="${owned}" data-owned-plan="${plan.id}" data-material-index="${index}" /></label>
          <span>/ ${required}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <article class="material-plan-card">
      <div class="plan-head">
        <div>
          <p class="label">${equipment ? escapeHtml(equipment.name) : '自訂計畫'}</p>
          <h3>${escapeHtml(plan.name)}</h3>
          <p class="plan-level">G${plan.currentGrade}-${plan.currentLevel} → G${plan.targetGrade}-${plan.targetLevel}</p>
        </div>
        <button class="delete-btn" data-delete-plan="${plan.id}" aria-label="刪除計畫">✕</button>
      </div>
      <div class="plan-progress-row">
        <div class="progress plan-progress"><span style="width:${stats.percent}%"></span></div>
        <strong>${stats.percent}%</strong>
      </div>
      <div class="plan-summary">
        <span>總需求 <b>${stats.required}</b></span>
        <span>尚缺 <b>${stats.missing}</b></span>
      </div>
      <div class="material-lines">${rows || '<div class="empty-state compact-empty">沒有素材項目</div>'}</div>
    </article>`;
}

function renderMaterials() {
  const plans = state.materialPlans || [];
  $('materialSummaryPlans').textContent = plans.length;
  $('materialSummaryMissing').textContent = plans.reduce((sum, plan) => sum + planStats(plan).missing, 0);
  $('materialPlanCount').textContent = plans.length;

  const list = $('materialPlanList');
  if (!plans.length) {
    list.innerHTML = '<div class="empty-state">還沒有素材計畫。點「＋ 新計畫」開始追蹤升級素材。</div>';
    return;
  }
  list.innerHTML = plans.slice().reverse().map(materialPlanHtml).join('');
}

function renderAll() {
  renderHunter();
  renderHome();
  renderEquipment();
  renderMaterials();
}

function fillSelectRange(id, max, value = 1) {
  $(id).innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $(id).value = String(value);
}

function fillGradeLevel() {
  fillSelectRange('equipmentGrade', 10, 5);
  fillSelectRange('equipmentLevel', 5, 1);
  fillSelectRange('materialCurrentGrade', 10, 5);
  fillSelectRange('materialCurrentLevel', 5, 1);
  fillSelectRange('materialTargetGrade', 10, 10);
  fillSelectRange('materialTargetLevel', 5, 5);
}

function prepHunterForm() {
  $('hunterName').value = state.hunter.name || '';
  $('hunterHr').value = state.hunter.hr || '';
  $('hunterWeapon').value = state.hunter.weapon || '';
  openDialog('hunterDialog');
}

function populateMaterialEquipmentSelect() {
  const select = $('materialEquipmentId');
  select.innerHTML = '<option value="">不指定裝備</option>' + state.equipment.map(item =>
    `<option value="${item.id}">${escapeHtml(item.name)}（G${item.grade}-${item.level}）</option>`
  ).join('');
}

function materialRowHtml(data = {}) {
  const name = escapeHtml(data.name || '');
  const required = Math.max(0, Number(data.required) || 0);
  const owned = Math.max(0, Number(data.owned) || 0);
  return `
    <div class="material-edit-row">
      <input class="material-name-input" placeholder="素材名稱" maxlength="40" value="${name}" />
      <div class="material-number-grid">
        <label>需要<input class="material-required-input" type="number" min="0" inputmode="numeric" value="${required}" /></label>
        <label>已有<input class="material-owned-input" type="number" min="0" inputmode="numeric" value="${owned}" /></label>
      </div>
      <button type="button" class="material-row-remove" aria-label="移除素材">✕</button>
    </div>`;
}

function addMaterialRow(data = {}) {
  $('materialRows').insertAdjacentHTML('beforeend', materialRowHtml(data));
}

function openMaterialPlanDialog(equipmentId = '') {
  $('materialPlanForm').reset();
  populateMaterialEquipmentSelect();
  $('materialEquipmentId').value = equipmentId;
  $('materialRows').innerHTML = '';
  addMaterialRow();
  addMaterialRow();
  addMaterialRow();

  const equipment = state.equipment.find(item => item.id === equipmentId);
  if (equipment) {
    $('materialPlanName').value = `${equipment.name} 升級計畫`;
    $('materialCurrentGrade').value = String(equipment.grade || 1);
    $('materialCurrentLevel').value = String(equipment.level || 1);
  } else {
    $('materialCurrentGrade').value = '5';
    $('materialCurrentLevel').value = '1';
  }
  $('materialTargetGrade').value = '10';
  $('materialTargetLevel').value = '5';
  openDialog('materialPlanDialog');
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
      state = {
        ...structuredClone(defaultState),
        ...parsed,
        hunter: { ...defaultState.hunter, ...(parsed.hunter || {}) },
        equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
        materialPlans: Array.isArray(parsed.materialPlans) ? parsed.materialPlans : []
      };
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
      id: makeId(),
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

  $('addMaterialPlanBtn').addEventListener('click', () => openMaterialPlanDialog());
  $('addMaterialRowBtn').addEventListener('click', () => addMaterialRow());

  $('materialRows').addEventListener('click', event => {
    const btn = event.target.closest('.material-row-remove');
    if (!btn) return;
    const row = btn.closest('.material-edit-row');
    if ($('materialRows').children.length <= 1) {
      showToast('至少保留一個素材項目');
      return;
    }
    row.remove();
  });

  $('materialPlanForm').addEventListener('submit', event => {
    event.preventDefault();
    const materials = [...document.querySelectorAll('#materialRows .material-edit-row')].map(row => ({
      name: row.querySelector('.material-name-input').value.trim(),
      required: Math.max(0, Number(row.querySelector('.material-required-input').value) || 0),
      owned: Math.max(0, Number(row.querySelector('.material-owned-input').value) || 0)
    })).filter(row => row.name && row.required > 0);

    const name = $('materialPlanName').value.trim();
    if (!name) return;
    if (!materials.length) {
      showToast('至少加入一個有需求數量的素材');
      return;
    }

    state.materialPlans.push({
      id: makeId(),
      equipmentId: $('materialEquipmentId').value,
      name,
      currentGrade: Number($('materialCurrentGrade').value),
      currentLevel: Number($('materialCurrentLevel').value),
      targetGrade: Number($('materialTargetGrade').value),
      targetLevel: Number($('materialTargetLevel').value),
      materials,
      createdAt: new Date().toISOString()
    });
    saveState();
    closeDialog('materialPlanDialog');
    showToast('素材計畫已建立');
  });

  $('materialPlanList').addEventListener('click', event => {
    const deleteBtn = event.target.closest('[data-delete-plan]');
    if (!deleteBtn) return;
    const plan = state.materialPlans.find(x => x.id === deleteBtn.dataset.deletePlan);
    if (!plan) return;
    if (confirm(`要刪除「${plan.name}」嗎？`)) {
      state.materialPlans = state.materialPlans.filter(x => x.id !== plan.id);
      saveState();
      showToast('素材計畫已刪除');
    }
  });

  $('materialPlanList').addEventListener('change', event => {
    const input = event.target.closest('[data-owned-plan]');
    if (!input) return;
    const plan = state.materialPlans.find(x => x.id === input.dataset.ownedPlan);
    if (!plan) return;
    const index = Number(input.dataset.materialIndex);
    if (!plan.materials?.[index]) return;
    plan.materials[index].owned = Math.max(0, Number(input.value) || 0);
    saveState();
    showToast('持有數量已更新');
  });

  $('materialEquipmentId').addEventListener('change', () => {
    const equipment = state.equipment.find(item => item.id === $('materialEquipmentId').value);
    if (!equipment) return;
    if (!$('materialPlanName').value.trim()) $('materialPlanName').value = `${equipment.name} 升級計畫`;
    $('materialCurrentGrade').value = String(equipment.grade || 1);
    $('materialCurrentLevel').value = String(equipment.level || 1);
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
