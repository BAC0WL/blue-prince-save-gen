// =============================================================================
// APP.JS  —  UI state management, rendering, and user interactions
//
// Depends on (loaded before this file in index.html):
//   src/data/fields.js        → ALL_FIELDS, CATEGORIES, BOOL_FIELDS
//   src/data/save_template.js → ARRAYS_TEMPLATE, SLOT_FOOTER
//   src/engine/savegen.js     → generateSaveFile, buildSlotSection
//   src/engine/encrypt.js     → es3Encrypt
//   src/engine/install.js     → downloadInstaller
// =============================================================================

// ── State ─────────────────────────────────────────────────────────────────────

// slotData = { "fieldKey": overrideValue, ... }
// Applied identically to all 4 save slots. Only fields that differ from
// their default are stored here.
const slotData = {};

// Persisted configs (saved to localStorage)
let savedConfigs = [];
try { savedConfigs = JSON.parse(localStorage.getItem('bp_configs') || '[]'); } catch (e) { }

// Fast lookup maps
const fieldByKey = {};
ALL_FIELDS.forEach(f => { fieldByKey[f.key] = f; });
BOOL_FIELDS.forEach(f => { fieldByKey[f.key] = f; });
HIDDEN_BOOL_FIELDS.forEach(f => { fieldByKey[f.key] = f; });

// Bool keys that appear in a named category section (not in the Flags panel)
const BOOLS_IN_CATEGORIES = new Set(
  Object.values(CATEGORIES).flat().filter(k => fieldByKey[k] && !fieldByKey[k].type)
);

function getDefault(key) {
  return (key in fieldByKey) ? fieldByKey[key].value : 0;
}

// slot param is kept for savegen.js compatibility but is ignored —
// all slots share the same data.
function getSlotValue(slot, key) {
  return (key in slotData) ? slotData[key] : getDefault(key);
}

function setSlotValue(slot, key, val) {
  if (String(val) === String(getDefault(key))) {
    delete slotData[key];
  } else {
    slotData[key] = val;
  }
  updateModifiedCounts();
  updateFooter();
}

function isModified(slot, key) {
  return key in slotData;
}

// ── Presets ───────────────────────────────────────────────────────────────────
// Add or remove presets here. Each preset merges values into the current slot.

const PRESETS = [
  {
    name: 'Scepter',
    desc: 'Day 1 Scepter',
    emoji: '🪄',
    values: { 'DAY': 0, 'Scepter Picked Up': true, },
  },
  {
    name: 'King',
    desc: 'Day 1 King',
    emoji: '♟',
    values: { 'DAY': 0, 'Chess Power': 6 },
  }
];

// ── UI Construction ───────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEditorPanels() {
  const main = document.getElementById('main-panels');

  // One panel per CATEGORY
  Object.entries(CATEGORIES).forEach(([catName, keys]) => {
    const div = document.createElement('div');
    div.className = 'panel';
    div.id = 'panel-editor-' + catName;

    const catFields = keys.map(k => fieldByKey[k]).filter(f => f && !f.hidden);
    div.innerHTML =
      '<div class="section-header">' +
      '<h2>' + escHtml(catName) + '</h2>' +
      '<span class="count">' + catFields.length + ' fields</span>' +
      '</div>' +
      '<div class="field-grid" id="fg-' + escHtml(catName) + '"></div>';
    main.appendChild(div);

    const grid = div.querySelector('.field-grid');
    catFields.forEach(f => buildFieldRow(grid, f));
  });

  // Flags panel — skip bools already shown in a category section
  const boolGrid = document.getElementById('bool-grid');
  BOOL_FIELDS.forEach(f => {
    if (BOOLS_IN_CATEGORIES.has(f.key)) return;
    const val = getSlotValue(1, f.key);
    const item = document.createElement('div');
    item.className = 'bool-item' + (val ? ' on' : '');
    item.setAttribute('data-key', f.key);
    item.onclick = () => toggleBool(f.key);
    item.innerHTML =
      '<div class="bool-check">' + (val ? '✓' : '') + '</div>' +
      '<div class="bool-item-label">' + escHtml(f.label) + '</div>';
    boolGrid.appendChild(item);
  });

  buildPresetCards();
  updateModifiedCounts();
  renderConfigList();
}

function buildFieldRow(grid, f) {
  const row = document.createElement('div');
  row.setAttribute('data-key', f.key);

  const val = getSlotValue(1, f.key);
  const ek = f.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  if (f.uiType === 'upgrade-picker') {
    row.className = 'field-row upgrade-row' + (isModified(1, f.key) ? ' modified' : '');

    const optHtml = i => {
      const imgSrc = 'src/ui/upgrades/' + f.imgSlug + '/' + i + '.png';
      const optLabel = i === 0 ? 'None' : 'Upgrade ' + i;
      return '<div class="upgrade-option' + (val === i ? ' selected' : '') + '" ' +
        'data-val="' + i + '" onclick="handleUpgradePick(\'' + ek + '\', ' + i + ')">' +
        '<div class="upgrade-img-wrap">' +
        '<img src="' + imgSrc + '" alt="' + optLabel + '" onerror="this.classList.add(\'broken\')">' +
        '</div>' +
        '<div class="upgrade-option-label">' + optLabel + '</div>' +
        '</div>';
    };

    let pickerHtml;
    if (f.noneAlone) {
      // First row = None only, remaining options split into rowSize chunks.
      const groups = [[0]];
      for (let i = 1; i <= f.maxUpgrade; i += f.rowSize) {
        const chunk = [];
        for (let j = i; j < i + f.rowSize && j <= f.maxUpgrade; j++) chunk.push(j);
        groups.push(chunk);
      }
      pickerHtml = '<div class="upgrade-picker-rows">' +
        groups.map(g => '<div class="upgrade-picker">' + g.map(optHtml).join('') + '</div>').join('') +
        '</div>';
    } else {
      let optionsHtml = '';
      for (let i = 0; i <= f.maxUpgrade; i++) optionsHtml += optHtml(i);
      pickerHtml = '<div class="upgrade-picker">' + optionsHtml + '</div>';
    }

    row.innerHTML =
      '<div class="upgrade-row-header">' +
      '<div class="field-label">' + escHtml(f.label) + '</div>' +
      '</div>' +
      pickerHtml;
    grid.appendChild(row);
    return;
  }

  // Bool field (no type) → render as inline toggle matching the Flags panel style
  if (!f.type) {
    const val = getSlotValue(1, f.key);
    row.className = 'bool-item' + (val ? ' on' : '');
    row.onclick = () => toggleBool(f.key);
    row.innerHTML =
      '<div class="bool-check">' + (val ? '✓' : '') + '</div>' +
      '<div class="bool-item-label">' + escHtml(f.label || f.key) + '</div>';
    grid.appendChild(row);
    return;
  }

  row.className = 'field-row';
  let inputHtml;
  if (f.uiType === 'select') {
    const opts = f.options.map(o =>
      '<option value="' + o.value + '"' + (val === o.value ? ' selected' : '') + '>' + escHtml(o.label) + '</option>'
    ).join('');
    inputHtml = '<select onchange="handleFieldChange(\'' + ek + '\', parseInt(this.value))">' + opts + '</select>';
  } else if (f.type === 'System.String') {
    inputHtml = '<input type="text" value="' + escHtml(String(val)) + '" oninput="handleFieldChange(\'' + ek + '\', this.value)">';
  } else if (f.type === 'System.Single') {
    inputHtml = '<input type="number" step="any" value="' + val + '" onchange="handleFieldChange(\'' + ek + '\', parseFloat(this.value) || 0)">';
  } else {
    inputHtml = '<input type="number" step="1" value="' + val + '" onchange="handleFieldChange(\'' + ek + '\', parseInt(this.value) || 0)">';
  }

  row.innerHTML =
    '<div>' +
    '<div class="field-label">' + escHtml(f.label || f.key) + '</div>' +
    (f.desc ? '<div class="field-desc">' + escHtml(f.desc) + '</div>' : '') +
    '</div>' +
    '<div class="field-input-wrap">' + inputHtml + '</div>';
  grid.appendChild(row);
}

function handleUpgradePick(key, val) {
  setSlotValue(1, key, val);
  const row = document.querySelector('.field-row[data-key="' + key + '"]');
  if (row) {
    row.className = 'field-row upgrade-row' + (isModified(1, key) ? ' modified' : '');
    row.querySelectorAll('.upgrade-option').forEach(opt => {
      opt.classList.toggle('selected', parseInt(opt.getAttribute('data-val')) === val);
    });
  }
}

function handleFieldChange(key, val) {
  setSlotValue(1, key, val);
  const row = document.querySelector('.field-row[data-key="' + key + '"]');
  if (row) row.className = 'field-row' + (isModified(1, key) ? ' modified' : '');
}

function toggleBool(key) {
  const newVal = !getSlotValue(1, key);
  setSlotValue(1, key, newVal);

  const item = document.querySelector('.bool-item[data-key="' + key + '"]');
  if (item) {
    item.className = 'bool-item' + (newVal ? ' on' : '');
    item.querySelector('.bool-check').textContent = newVal ? '✓' : '';
  }
  updateBoolCount();
}

function updateBoolCount() {
  const on = BOOL_FIELDS.filter(f => !BOOLS_IN_CATEGORIES.has(f.key) && getSlotValue(1, f.key)).length;
  const el = document.getElementById('flags-on-count');
  if (el) el.textContent = on + ' on';
}

// ── Navigation ────────────────────────────────────────────────────────────────

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  const btn = document.querySelector('[onclick="showPanel(\'' + id + '\')"]');
  if (btn) btn.classList.add('active');
}

// ── Refresh editor ────────────────────────────────────────────────────────────

function refreshEditor() {
  ALL_FIELDS.filter(f => !f.hidden).forEach(f => {
    const val = getSlotValue(1, f.key);
    const row = document.querySelector('.field-row[data-key="' + f.key + '"]');
    if (!row) return;
    if (f.uiType === 'upgrade-picker') {
      row.className = 'field-row upgrade-row' + (isModified(1, f.key) ? ' modified' : '');
      row.querySelectorAll('.upgrade-option').forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.getAttribute('data-val')) === val);
      });
    } else {
      const inp = row.querySelector('input, select');
      if (inp) inp.value = val;
      row.className = 'field-row' + (isModified(1, f.key) ? ' modified' : '');
    }
  });

  BOOL_FIELDS.forEach(f => {
    const val = getSlotValue(1, f.key);
    const item = document.querySelector('.bool-item[data-key="' + f.key + '"]');
    if (item) {
      item.className = 'bool-item' + (val ? ' on' : '');
      item.querySelector('.bool-check').textContent = val ? '✓' : '';
    }
  });

  updateBoolCount();
  updateModifiedCounts();
  updateFooter();
}

// ── Presets ───────────────────────────────────────────────────────────────────

function buildPresetCards() {
  const grid = document.getElementById('preset-grid');
  PRESETS.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    const entries = Object.entries(p.values);
    const valsHtml = entries.slice(0, 5).map(([k, v]) => escHtml(k) + ': ' + escHtml(String(v))).join('<br>') +
      (entries.length > 5 ? '<br>…+' + (entries.length - 5) + ' more' : '');
    card.innerHTML =
      '<div class="preset-title">' + p.emoji + ' ' + escHtml(p.name) + '</div>' +
      '<div class="preset-desc">' + escHtml(p.desc) + '</div>' +
      '<div class="preset-vals">' + valsHtml + '</div>' +
      '<button class="btn-apply" data-preset="' + idx + '" onclick="applyPreset(' + idx + ')">Apply</button>';
    grid.appendChild(card);
  });
}

function applyPreset(idx) {
  const p = PRESETS[idx];
  Object.entries(p.values).forEach(([k, v]) => { slotData[k] = v; });
  refreshEditor();
  toast('Preset "' + p.name + '" applied to all slots');
}

function updateModifiedCounts() {
  Object.keys(CATEGORIES).forEach(cat => {
    const mods = (CATEGORIES[cat] || []).filter(k => isModified(1, k)).length;
    const el = document.getElementById('cnt-' + cat);
    if (el) el.textContent = mods > 0 ? mods + ' ✎' : '';
  });
  const flagMods = BOOL_FIELDS.filter(f => !BOOLS_IN_CATEGORIES.has(f.key) && isModified(1, f.key)).length;
  const flagEl = document.getElementById('cnt-flags');
  if (flagEl) flagEl.textContent = flagMods > 0 ? flagMods + ' ✎' : '';
}

// ── Saved configs ─────────────────────────────────────────────────────────────

function saveConfig() {
  const name = document.getElementById('config-name-input').value.trim();
  if (!name) return;
  savedConfigs.push({
    name,
    date: new Date().toLocaleDateString(),
    data: JSON.parse(JSON.stringify(slotData)),
  });
  persistConfigs();
  document.getElementById('config-name-input').value = '';
  renderConfigList();
  toast('Config "' + name + '" saved');
}

function loadConfig(idx) {
  const cfg = savedConfigs[idx];
  // Support old per-slot format (cfg.slots) and new flat format (cfg.data)
  const data = cfg.data || (cfg.slots && cfg.slots[1]) || {};
  Object.keys(slotData).forEach(k => delete slotData[k]);
  Object.assign(slotData, JSON.parse(JSON.stringify(data)));
  refreshEditor();
  toast('Loaded "' + cfg.name + '"');
}

function deleteConfig(idx) {
  savedConfigs.splice(idx, 1);
  persistConfigs();
  renderConfigList();
}

function exportConfig(idx) {
  const blob = new Blob([JSON.stringify(savedConfigs[idx], null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = savedConfigs[idx].name.replace(/\s+/g, '_') + '_bp_config.json';
  a.click();
}

function importConfig(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const cfg = JSON.parse(ev.target.result);
      if (cfg.data || cfg.slots) {
        savedConfigs.push(cfg);
        persistConfigs();
        renderConfigList();
        toast('Imported "' + (cfg.name || 'config') + '"');
      } else {
        toast('Invalid config file');
      }
    } catch {
      toast('Invalid JSON file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function persistConfigs() {
  try { localStorage.setItem('bp_configs', JSON.stringify(savedConfigs)); } catch (e) { }
}

function renderConfigList() {
  const list = document.getElementById('config-list');
  if (!savedConfigs.length) {
    list.innerHTML = '<div class="empty-state">No saved configs yet.</div>';
    return;
  }
  list.innerHTML = savedConfigs.map((c, i) =>
    '<div class="config-item">' +
    '<div class="config-info">' +
    '<div class="config-name">' + escHtml(c.name) + '</div>' +
    '<div class="config-meta">Saved ' + escHtml(c.date) + '</div>' +
    '</div>' +
    '<button class="btn btn-sm" onclick="loadConfig(' + i + ')">Load</button>' +
    '<button class="btn btn-sm" onclick="exportConfig(' + i + ')">⬇ Export</button>' +
    '<button class="btn btn-sm btn-danger" onclick="deleteConfig(' + i + ')">✕</button>' +
    '</div>'
  ).join('');
}

// ── Downloads ─────────────────────────────────────────────────────────────────

async function downloadEncrypted() {
  const btn = document.getElementById('enc-btn');
  btn.textContent = '⏳ Encrypting…';
  btn.disabled = true;
  try {
    const plaintext = generateSaveFile();
    const b64 = await es3Encrypt(plaintext);
    // es3Encrypt returns a base64 string, but the game expects raw binary.
    // Decode base64 → Uint8Array before writing the file.
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MtHollyBlueprint.es3';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('MtHollyBlueprint.es3 downloaded!');
  } catch (e) {
    toast('Encryption failed: ' + e.message);
    console.error(e);
  } finally {
    btn.textContent = '⬇ Download MtHollyBlueprint.es3';
    btn.disabled = false;
  }
}

function copyRaw() {
  navigator.clipboard.writeText(generateSaveFile()).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy raw (unencrypted)'; }, 2000);
  });
}

// ── Drag & drop for config import ─────────────────────────────────────────────

function initDropZone() {
  const zone = document.getElementById('import-drop');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const cfg = JSON.parse(ev.target.result);
        if (cfg.data || cfg.slots) {
          savedConfigs.push(cfg);
          persistConfigs();
          renderConfigList();
          toast('Imported "' + (cfg.name || 'config') + '"');
        } else {
          toast('Invalid config file');
        }
      } catch { toast('Invalid JSON'); }
    };
    reader.readAsText(file);
  });
  zone.addEventListener('click', () => zone.querySelector('input[type=file]').click());
}

// ── Footer ────────────────────────────────────────────────────────────────────

function updateFooter() {
  const total = Object.keys(slotData).length;
  document.getElementById('footer-sub').textContent = total > 0
    ? total + ' field(s) customized — applied to all 4 slots'
    : 'No changes yet — all slots use defaults';
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Init ──────────────────────────────────────────────────────────────────────

buildEditorPanels();
showPanel('editor-Core');
updateBoolCount();
updateFooter();
initDropZone();

// Restore saved installer paths from localStorage
try {
  const sp = localStorage.getItem('bp_inst_save');
  const gp = localStorage.getItem('bp_inst_game');
  const spEl = document.getElementById('installer-save-path');
  const gpEl = document.getElementById('installer-game-exe');
  if (sp && spEl) spEl.value = sp;
  if (gp && gpEl) gpEl.value = gp;
} catch (e) { }
