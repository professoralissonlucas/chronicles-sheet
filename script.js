const STORAGE_KEY = 'chronicles-sheet-state-v1';

const defaultState = {
  theme: 'field',
  attributesHidden: false,
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

const attributeInputs = document.querySelectorAll('.attribute input');
const attributesGrid = document.querySelector('.attributes-grid');
const toggleAttributesBtn = document.getElementById('toggleAttributesBtn');

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
const journalList = document.getElementById('journalList');

init();

function init() {
  bindCharacterInputs();
  bindAttributeInputs();
  bindAttributesToggle();
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
  // Backup que não é um objeto (array, número, null) é tratado como vazio.
  const merged = deepMerge(safe, isPlainObject(raw) ? raw : {});

  if (!isPlainObject(merged.character)) {
    merged.character = { ...safe.character };
  }

  // Recupera hp, sanity e effort quando vierem null ou inválidos.
  // O atual fica sempre entre 0 e o máximo.
  ['hp', 'sanity', 'effort'].forEach((key) => {
    const stat = isPlainObject(merged.character[key]) ? merged.character[key] : safe.character[key];
    const max = clampNumber(stat.max, 1, Infinity, safe.character[key].max);
    const current = clampNumber(stat.current, 0, max, 0);
    merged.character[key] = { ...stat, current, max };
  });

  ['name', 'className', 'notes'].forEach((key) => {
    const value = merged.character[key];
    if (typeof value === 'number') {
      merged.character[key] = String(value);
    } else if (typeof value !== 'string') {
      merged.character[key] = '';
    }
  });
  merged.character.level = clampNumber(merged.character.level, 1, 99, 1);

  if (!Array.isArray(merged.inventory)) merged.inventory = safe.inventory;
  if (!Array.isArray(merged.diceHistory)) merged.diceHistory = safe.diceHistory;
  if (!Array.isArray(merged.journal)) merged.journal = safe.journal;

  // Valida cada item das listas e descarta os inválidos.
  const inventoryIds = new Set();
  const diceIds = new Set();
  const journalIds = new Set();
  merged.inventory = merged.inventory.map((item) => normalizeInventoryItem(item, inventoryIds)).filter(Boolean);
  merged.diceHistory = merged.diceHistory.map((entry) => normalizeDiceEntry(entry, diceIds)).filter(Boolean).slice(0, 12);
  merged.journal = merged.journal.map((entry) => normalizeJournalEntry(entry, journalIds)).filter(Boolean);

  if (!merged.theme || !['field', 'journal'].includes(merged.theme)) {
    merged.theme = defaultState.theme;
  }

  if (typeof merged.attributesHidden !== 'boolean') {
    merged.attributesHidden = false;
  }

  if (!isPlainObject(merged.character.attributes)) {
    merged.character.attributes = { ...safe.character.attributes };
  }

  Object.keys(safe.character.attributes).forEach((key) => {
    merged.character.attributes[key] = clampNumber(merged.character.attributes[key], 1, 30, safe.character.attributes[key]);
  });

  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Converte para número e limita entre min e max. Valor vazio ou inválido vira o padrão.
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

// Mantém o id se for texto e ainda não tiver sido usado; senão gera um novo.
function normalizeId(id, usedIds) {
  const nextId = typeof id === 'string' && id && !usedIds.has(id) ? id : generateId();
  usedIds.add(nextId);
  return nextId;
}

// Data inválida vira null, porque o formatDate quebra com datas inválidas.
function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function normalizeInventoryItem(item, usedIds) {
  if (!isPlainObject(item)) return null;

  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return null;

  return {
    ...item,
    id: normalizeId(item.id, usedIds),
    name,
    quantity: clampNumber(item.quantity, 1, Infinity, 1),
    description: typeof item.description === 'string' ? item.description : '',
  };
}

function normalizeDiceEntry(entry, usedIds) {
  if (!isPlainObject(entry)) return null;
  if (typeof entry.result !== 'string' || !entry.result.trim()) return null;

  return {
    ...entry,
    id: normalizeId(entry.id, usedIds),
    timestamp: normalizeTimestamp(entry.timestamp),
  };
}

function normalizeJournalEntry(entry, usedIds) {
  if (!isPlainObject(entry)) return null;
  if (typeof entry.title !== 'string' || !entry.title.trim()) return null;
  if (typeof entry.content !== 'string' || !entry.content.trim()) return null;

  let tags = [];
  if (Array.isArray(entry.tags)) {
    tags = entry.tags.filter((tag) => typeof tag === 'string' && tag.trim());
  } else if (typeof entry.tags === 'string') {
    tags = normalizeTags(entry.tags);
  }

  return {
    ...entry,
    id: normalizeId(entry.id, usedIds),
    tags,
    timestamp: normalizeTimestamp(entry.timestamp),
  };
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
        // Enquanto digita, só salva números válidos; o campo é corrigido no change.
        const level = clampNumber(value, 1, 99, null);
        if (level === null) return;
        state.character.level = level;
      } else if (key === 'name' || key === 'className' || key === 'notes') {
        state.character[key] = value;
      }
      saveState();
    });
  });

  // Ao sair do campo (ou apertar Enter), o nível fica entre 1 e 99.
  characterFields.level.addEventListener('change', () => {
    state.character.level = clampNumber(characterFields.level.value, 1, 99, 1);
    saveState();
    renderCharacterBlock();
  });
}

function bindAttributeInputs() {
  attributeInputs.forEach((input) => {
    const key = input.closest('.attribute').dataset.attribute;

    input.addEventListener('input', () => {
      // Enquanto digita, só salva números válidos; o campo é corrigido no change.
      const value = clampNumber(input.value, 1, 30, null);
      if (value === null) return;
      state.character.attributes[key] = value;
      saveState();
    });

    // Ao sair do campo, limita entre 1 e 30. Campo vazio volta ao último valor salvo.
    input.addEventListener('change', () => {
      state.character.attributes[key] = clampNumber(input.value, 1, 30, state.character.attributes[key]);
      saveState();
      renderAttributes();
    });
  });
}

function bindAttributesToggle() {
  toggleAttributesBtn.addEventListener('click', () => {
    state.attributesHidden = !state.attributesHidden;
    saveState();
    renderAttributes();
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
    const renderStat = () => {
      if (key === 'hp') renderHp();
      if (key === 'sanity') renderSanity();
      if (key === 'effort') renderEffort();
    };

    element.addEventListener('input', () => {
      // Enquanto digita, ignora campo vazio ou menor que 1 para não forçar "1".
      const nextMax = clampNumber(element.value, 1, Infinity, null);
      if (nextMax === null || Number(element.value) < 1) return;
      const currentStat = getNestedValue(state, path) || { max: nextMax, current: 0 };

      setNestedValue(state, path, {
        ...currentStat,
        max: nextMax,
        current: currentStat.current,
      });
      saveState();
      renderStat();
    });

    // Ao sair do campo, confirma o máximo e ajusta o atual para não passar dele.
    // Isso é feito só aqui para não perder o valor atual enquanto a pessoa digita.
    element.addEventListener('change', () => {
      const currentStat = getNestedValue(state, path) || { max: 1, current: 0 };
      const typedMax = Number(element.value);
      const nextMax = element.value !== '' && typedMax >= 1 ? typedMax : Math.max(1, Number(currentStat.max) || 1);

      setNestedValue(state, path, {
        ...currentStat,
        max: nextMax,
        current: Math.min(Number(currentStat.current) || 0, nextMax),
      });
      saveState();
      renderStat();
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
  renderAttributes();
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

function renderAttributes() {
  attributeInputs.forEach((input) => {
    const key = input.closest('.attribute').dataset.attribute;
    input.value = state.character.attributes[key];
  });

  const hidden = Boolean(state.attributesHidden);
  attributesGrid.classList.toggle('hidden', hidden);
  toggleAttributesBtn.textContent = hidden ? 'Mostrar' : 'Ocultar';
  toggleAttributesBtn.setAttribute('aria-label', hidden ? 'Mostrar atributos' : 'Ocultar atributos');
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
        <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">Editar</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(item.id)}">Remover</button>
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
    allTags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');

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
