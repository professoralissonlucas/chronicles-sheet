const STORAGE_KEY = 'chronicles-sheet-state-v1';

const defaultState = {
  theme: 'field',
  character: {
    name: 'Aelric Vale',
    className: 'Bárbaro',
    level: 3,
    notes: 'Aventureiro de jornada em busca de mapas antigos.',
    hp: { current: 24, max: 30 },
    sanity: { current: 12, max: 20 },
    effort: { current: 4, max: 8 },
    attributes: {
      forca: 16,
      destreza: 12,
      constituicao: 15,
      inteligencia: 9,
      sabedoria: 11,
      carisma: 10,
    },
  },
  inventory: [
    { id: generateId(), name: 'Poção de cura', quantity: 2, description: 'Recupera 8 PV.' },
    { id: generateId(), name: 'Mapa antigo', quantity: 1, description: 'Rota para as ruínas do vale.' },
  ],
  diceHistory: [
    { id: generateId(), result: 'd20 = 15', timestamp: new Date().toISOString() },
  ],
  journal: [
    {
      id: generateId(),
      title: 'Primeira entrada',
      content: 'O grupo chegou ao mercado de Brasa Nua e ouviu rumores de uma armadilha na ponte.',
      tags: ['#Combate', '#Quest'],
      timestamp: new Date().toISOString(),
    },
  ],
};

const state = loadState();

const characterFields = {
  name: document.getElementById('charName'),
  className: document.getElementById('charClass'),
  level: document.getElementById('charLevel'),
  notes: document.getElementById('charNotes'),
};

const hpElements = {
  bar: document.getElementById('hpBar'),
  currentText: document.getElementById('hpCurrentText'),
  maxInput: document.getElementById('hpMaxInput'),
  status: document.getElementById('hpStatus'),
};

const sanityElements = {
  bar: document.getElementById('sanityBar'),
  currentText: document.getElementById('sanityCurrentText'),
  maxInput: document.getElementById('sanityMaxInput'),
  status: document.getElementById('sanityStatus'),
};

const effortElements = {
  bar: document.getElementById('effortBar'),
  currentText: document.getElementById('effortCurrentText'),
  maxInput: document.getElementById('effortMaxInput'),
  status: document.getElementById('effortStatus'),
};

const inventoryForm = document.getElementById('inventoryForm');
const inventoryIdInput = document.getElementById('inventoryId');
const itemNameInput = document.getElementById('itemName');
const itemQtyInput = document.getElementById('itemQty');
const itemDescriptionInput = document.getElementById('itemDescription');
const inventoryList = document.getElementById('inventoryList');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const themeToggleBtn = document.getElementById('themeToggle');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importFile');

const lastRollText = document.getElementById('lastRoll');
const diceHistoryList = document.getElementById('diceHistory');
const clearDiceHistoryBtn = document.getElementById('clearDiceHistoryBtn');

const journalForm = document.getElementById('journalForm');
const journalTitleInput = document.getElementById('journalTitleInput');
const journalTagsInput = document.getElementById('journalTagsInput');
const journalContentInput = document.getElementById('journalContent');
const journalSearchInput = document.getElementById('journalSearch');
const journalTagFilter = document.getElementById('journalTagFilter');

init();

function init() {
  bindCharacterInputs();
  bindHpButtons();
  bindVitalButtons();
  bindVitalMaxInputs();
  bindInventoryForm();
  bindDiceButtons();
  bindDiceHistoryClear();
  bindJournalForm();
  bindThemeToggle();
  bindBackupActions();
  renderAll();
}

function generateId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeState(raw) {
  const safe = JSON.parse(JSON.stringify(defaultState));
  const merged = deepMerge(safe, raw || {});

  if (!merged.character || !merged.character.hp) {
    merged.character = { ...safe.character, ...(merged.character || {}) };
    merged.character.hp = { ...safe.character.hp, ...((merged.character && merged.character.hp) || {}) };
  }

  if (!Array.isArray(merged.inventory)) merged.inventory = safe.inventory;
  if (!Array.isArray(merged.diceHistory)) merged.diceHistory = safe.diceHistory;
  if (!Array.isArray(merged.journal)) merged.journal = safe.journal;

  if (!merged.theme || !['field', 'journal'].includes(merged.theme)) {
    merged.theme = defaultState.theme;
  }

  if (!merged.character.attributes || typeof merged.character.attributes !== 'object') {
    merged.character.attributes = { ...safe.character.attributes };
  }

  return merged;
}

function deepMerge(base, incoming) {
  if (Array.isArray(base) || Array.isArray(incoming)) {
    return incoming ?? base;
  }

  const output = { ...base };
  Object.keys(incoming || {}).forEach((key) => {
    if (incoming[key] && typeof incoming[key] === 'object' && !Array.isArray(incoming[key])) {
      output[key] = deepMerge(base[key] || {}, incoming[key]);
    } else {
      output[key] = incoming[key];
    }
  });
  return output;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.warn('Falha ao carregar estado salvo. Usando estado padrão.', error);
    return structuredClone(defaultState);
  }
}

function bindCharacterInputs() {
  Object.entries(characterFields).forEach(([key, input]) => {
    input.addEventListener('input', (event) => {
      const value = event.target.value;
      if (key === 'level') {
        state.character.level = Number(value) || 1;
      } else if (key === 'name' || key === 'className' || key === 'notes') {
        state.character[key] = value;
      }
      saveState();
      renderCharacterBlock();
    });
  });
}

function bindHpButtons() {
  document.querySelectorAll('.hp-btn[data-stat="hp"]').forEach((button) => {
    button.addEventListener('click', () => {
      const change = Number(button.dataset.change || 0);
      const max = Number(state.character.hp.max || 0);
      const current = Number(state.character.hp.current || 0);
      const next = Math.max(0, Math.min(max, current + change));
      state.character.hp.current = next;
      saveState();
      renderHp();
    });
  });
}

function bindVitalButtons() {
  document.querySelectorAll('.vital-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const stat = button.dataset.stat;
      const change = Number(button.dataset.change || 0);
      const maxKey = stat === 'sanity' ? 'sanity' : 'effort';
      const max = Number(state.character[maxKey]?.max || 0);
      const current = Number(state.character[maxKey]?.current || 0);
      const next = Math.max(0, Math.min(max, current + change));
      state.character[maxKey].current = next;
      saveState();

      if (stat === 'sanity') {
        renderSanity();
      } else {
        renderEffort();
      }
    });
  });
}

function bindVitalMaxInputs() {
  const configs = [
    { key: 'hp', element: hpElements.maxInput, path: 'character.hp' },
    { key: 'sanity', element: sanityElements.maxInput, path: 'character.sanity' },
    { key: 'effort', element: effortElements.maxInput, path: 'character.effort' },
  ];

  configs.forEach(({ key, element, path }) => {
    element.addEventListener('input', () => {
      const nextMax = Math.max(1, Number(element.value) || 1);
      const currentStat = getNestedValue(state, path) || { max: nextMax, current: 0 };

      setNestedValue(state, path, {
        ...currentStat,
        max: nextMax,
        current: currentStat.current,
      });
      saveState();

      if (key === 'hp') renderHp();
      if (key === 'sanity') renderSanity();
      if (key === 'effort') renderEffort();
    });
  });
}

function getNestedValue(object, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], object);
}

function setNestedValue(object, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((acc, key) => acc[key], object);
  target[lastKey] = value;
}

function bindInventoryForm() {
  inventoryForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const id = inventoryIdInput.value;
    const item = {
      id: id || generateId(),
      name: itemNameInput.value.trim(),
      quantity: Math.max(1, Number(itemQtyInput.value) || 1),
      description: itemDescriptionInput.value.trim(),
    };

    if (!item.name) {
      itemNameInput.focus();
      return;
    }

    if (id) {
      const index = state.inventory.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        state.inventory[index] = item;
      }
    } else {
      state.inventory.unshift(item);
    }

    saveState();
    inventoryForm.reset();
    inventoryIdInput.value = '';
    itemQtyInput.value = 1;
    cancelEditBtn.classList.add('hidden');
    document.getElementById('saveItemBtn').textContent = 'Adicionar item';
    renderInventory();
  });

  cancelEditBtn.addEventListener('click', () => {
    clearInventoryForm();
  });
}

function bindDiceButtons() {
  document.querySelectorAll('.dice-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const sides = Number(button.dataset.sides || 20);
      const result = getRandomInt(1, sides);
      const label = `d${sides} = ${result}`;

      state.diceHistory.unshift({
        id: generateId(),
        result: label,
        timestamp: new Date().toISOString(),
      });

      state.diceHistory = state.diceHistory.slice(0, 12);
      lastRollText.textContent = label;
      saveState();
      renderDiceHistory();
    });
  });
}

function bindDiceHistoryClear() {
  clearDiceHistoryBtn.addEventListener('click', () => {
    state.diceHistory = [];
    lastRollText.textContent = 'Nenhuma';
    saveState();
    renderDiceHistory();
  });
}

function bindJournalForm() {
  journalForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = journalTitleInput.value.trim();
    const content = journalContentInput.value.trim();
    const tags = normalizeTags(journalTagsInput.value);

    if (!title || !content) {
      return;
    }

    state.journal.unshift({
      id: generateId(),
      title,
      content,
      tags,
      timestamp: new Date().toISOString(),
    });

    journalForm.reset();
    saveState();
    renderJournal();
  });

  journalSearchInput.addEventListener('input', renderJournal);
  journalTagFilter.addEventListener('change', renderJournal);
}

function bindThemeToggle() {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'field' ? 'journal' : 'field';
    state.theme = nextTheme;
    document.body.dataset.theme = nextTheme;
    themeToggleBtn.textContent = nextTheme === 'field' ? 'Modo Diário Manuscrito' : 'Modo Ficha de Campo';
    saveState();
  });
}

function bindBackupActions() {
  exportBtn.addEventListener('click', () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    link.href = url;
    link.download = `chronicles-sheet-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const nextState = normalizeState(parsed);
      Object.assign(state, nextState);
      saveState();
      renderAll();
      alert('Backup importado com sucesso!');
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      alert('Arquivo inválido. Certifique-se de que o backup é um JSON válido.');
    } finally {
      importInput.value = '';
    }
  });
}

function renderAll() {
  renderTheme();
  renderCharacterBlock();
  renderHp();
  renderSanity();
  renderEffort();
  renderInventory();
  renderDiceHistory();
  renderJournal();
}

function renderTheme() {
  const theme = state.theme || 'field';
  document.body.dataset.theme = theme;
  themeToggleBtn.textContent = theme === 'field' ? 'Modo Diário Manuscrito' : 'Modo Ficha de Campo';
}

function renderCharacterBlock() {
  characterFields.name.value = state.character.name;
  characterFields.className.value = state.character.className;
  characterFields.level.value = state.character.level;
  characterFields.notes.value = state.character.notes;
}

function renderHp() {
  const max = Number(state.character.hp.max || 1);
  const current = Number(state.character.hp.current || 0);
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const critical = current <= 0 || percentage < 25;

  hpElements.bar.style.width = `${percentage}%`;
  hpElements.bar.classList.toggle('critical', critical);
  hpElements.currentText.textContent = current;
  hpElements.maxInput.value = max;

  if (current <= 0) {
    hpElements.status.textContent = 'HP zerado. O personagem caiu e precisa de atenção imediata.';
    hpElements.status.className = 'hp-status critical';
  } else if (percentage < 25) {
    hpElements.status.textContent = 'HP crítico! O personagem está em risco iminente.';
    hpElements.status.className = 'hp-status warning';
  } else {
    hpElements.status.textContent = 'HP está estável.';
    hpElements.status.className = 'hp-status safe';
  }
}

function renderSanity() {
  const max = Number(state.character.sanity?.max || 1);
  const current = Number(state.character.sanity?.current || 0);
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const critical = current <= 0 || percentage < 25;

  sanityElements.bar.style.width = `${percentage}%`;
  sanityElements.bar.classList.toggle('critical', critical);
  sanityElements.currentText.textContent = current;
  sanityElements.maxInput.value = max;

  if (current <= 0) {
    sanityElements.status.textContent = 'Sanidade está instável. O personagem está muito afetado.';
    sanityElements.status.className = 'hp-status critical';
  } else if (percentage < 25) {
    sanityElements.status.textContent = 'Sanidade está instável. O personagem está próximo do limite.';
    sanityElements.status.className = 'hp-status warning';
  } else {
    sanityElements.status.textContent = 'Sanidade está estável.';
    sanityElements.status.className = 'hp-status safe';
  }
}

function renderEffort() {
  const max = Number(state.character.effort?.max || 1);
  const current = Number(state.character.effort?.current || 0);
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const critical = current <= 0 || percentage < 25;

  effortElements.bar.style.width = `${percentage}%`;
  effortElements.bar.classList.toggle('critical', critical);
  effortElements.currentText.textContent = current;
  effortElements.maxInput.value = max;

  if (current <= 0) {
    effortElements.status.textContent = 'Esforço está instável. Sem pontos disponíveis.';
    effortElements.status.className = 'hp-status critical';
  } else if (percentage < 25) {
    effortElements.status.textContent = 'Esforço está instável. Reserve energia para momentos críticos.';
    effortElements.status.className = 'hp-status warning';
  } else {
    effortElements.status.textContent = 'Esforço está estável.';
    effortElements.status.className = 'hp-status safe';
  }
}

function renderInventory() {
  inventoryList.innerHTML = '';

  if (!state.inventory.length) {
    inventoryList.innerHTML = '<li class="empty-state">Nenhum item no inventário. Adicione o primeiro item.</li>';
    return;
  }

  state.inventory.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.className = 'inventory-item';

    listItem.innerHTML = `
      <div class="item-main">
        <div class="item-name">
          <span>${escapeHtml(item.name)}</span>
          <span class="item-tag">x${escapeHtml(String(item.quantity))}</span>
        </div>
        <p class="item-desc">${escapeHtml(item.description || 'Sem descrição.')}</p>
      </div>
      <div class="item-actions">
        <button type="button" data-action="edit" data-id="${item.id}">Editar</button>
        <button type="button" data-action="delete" data-id="${item.id}">Remover</button>
      </div>
    `;

    inventoryList.appendChild(listItem);
  });

  inventoryList.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = state.inventory.find((entry) => entry.id === button.dataset.id);
      if (!item) return;
      inventoryIdInput.value = item.id;
      itemNameInput.value = item.name;
      itemQtyInput.value = item.quantity;
      itemDescriptionInput.value = item.description || '';
      cancelEditBtn.classList.remove('hidden');
      document.getElementById('saveItemBtn').textContent = 'Salvar alterações';
      itemNameInput.focus();
    });
  });

  inventoryList.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.id;
      state.inventory = state.inventory.filter((entry) => entry.id !== itemId);
      saveState();
      renderInventory();
    });
  });
}

function clearInventoryForm() {
  inventoryForm.reset();
  inventoryIdInput.value = '';
  itemQtyInput.value = 1;
  cancelEditBtn.classList.add('hidden');
  document.getElementById('saveItemBtn').textContent = 'Adicionar item';
}

function renderDiceHistory() {
  diceHistoryList.innerHTML = '';

  if (!state.diceHistory.length) {
    diceHistoryList.innerHTML = '<li class="empty-state">Nenhuma rolagem registrada ainda.</li>';
    return;
  }

  state.diceHistory.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'dice-history-item';

    item.innerHTML = `
      <span class="roll-label">${escapeHtml(entry.result)}</span>
      <span class="roll-time">${formatDate(entry.timestamp)}</span>
    `;

    diceHistoryList.appendChild(item);
  });

  if (state.diceHistory[0]) {
    lastRollText.textContent = state.diceHistory[0].result;
  } else {
    lastRollText.textContent = 'Nenhuma';
  }
}

function renderJournal() {
  const searchTerm = journalSearchInput.value.trim().toLowerCase();
  const tagFilter = journalTagFilter.value;
  const filteredEntries = state.journal.filter((entry) => {
    const matchesSearch = !searchTerm ||
      entry.title.toLowerCase().includes(searchTerm) ||
      entry.content.toLowerCase().includes(searchTerm) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

    const matchesTag = tagFilter === 'all' || entry.tags.includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(state.journal.flatMap((entry) => entry.tags))).sort();

  const currentValue = journalTagFilter.value;
  journalTagFilter.innerHTML = '<option value="all">Todas</option>' +
    allTags.map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)}</option>`).join('');

  if (currentValue && allTags.includes(currentValue)) {
    journalTagFilter.value = currentValue;
  } else {
    journalTagFilter.value = 'all';
  }

  journalList.innerHTML = '';

  if (!filteredEntries.length) {
    journalList.innerHTML = '<li class="empty-state">Nenhuma anotação encontrada para o filtro atual.</li>';
    return;
  }

  filteredEntries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'journal-item';

    item.innerHTML = `
      <div class="journal-header">
        <span class="journal-title">${escapeHtml(entry.title)}</span>
        <span class="roll-time">${formatDate(entry.timestamp)}</span>
      </div>
      <div class="journal-tags">
        ${entry.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <p class="journal-content">${escapeHtml(entry.content)}</p>
    `;

    journalList.appendChild(item);
  });
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeTags(rawValue) {
  if (!rawValue) return [];
  const values = rawValue
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      const normalized = tag.startsWith('#') ? tag : `#${tag}`;
      return normalized.replace(/\s+/g, '');
    });

  return Array.from(new Set(values)).slice(0, 6);
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
