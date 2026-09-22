import { getSettings, saveSettings, normalizeCustomGroups } from './lib/settings.js';

const apiKeyEl = document.getElementById('apiKey');
const minConfidenceEl = document.getElementById('minConfidence');
const excludeEl = document.getElementById('excludePatterns');
const distractionEl = document.getElementById('distractionAtEnd');
const savedEl = document.getElementById('saved');
const newGroupEl = document.getElementById('newGroup');
const listEl = document.getElementById('customGroupList');

/** @type {string[]} */
let customGroups = [];

function renderGroups() {
  listEl.innerHTML = '';
  if (!customGroups.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No custom groups yet.';
    listEl.appendChild(empty);
    return;
  }
  for (const name of customGroups) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost small';
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
      customGroups = customGroups.filter((g) => g !== name);
      renderGroups();
    });
    li.append(span, btn);
    listEl.appendChild(li);
  }
}

function addGroupFromInput() {
  const name = newGroupEl.value.trim();
  if (!name) return;
  customGroups = normalizeCustomGroups([...customGroups, name]);
  newGroupEl.value = '';
  renderGroups();
}

document.getElementById('addGroup').addEventListener('click', addGroupFromInput);
newGroupEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addGroupFromInput();
  }
});

async function load() {
  const s = await getSettings();
  apiKeyEl.value = s.apiKey || '';
  minConfidenceEl.value = String(s.minConfidence ?? 0.45);
  excludeEl.value = s.excludePatterns || '';
  distractionEl.checked = s.distractionAtEnd !== false;
  customGroups = normalizeCustomGroups(s.customGroups || []);
  document.querySelectorAll('input[name="runMode"]').forEach((el) => {
    el.checked = el.value === (s.runMode || 'manual');
  });
  renderGroups();
}

document.getElementById('save').addEventListener('click', async () => {
  const runMode = document.querySelector('input[name="runMode"]:checked')?.value || 'manual';

  await saveSettings({
    apiKey: apiKeyEl.value.trim(),
    runMode,
    minConfidence: Number(minConfidenceEl.value) || 0.45,
    excludePatterns: excludeEl.value,
    distractionAtEnd: distractionEl.checked,
    customGroups: normalizeCustomGroups(customGroups),
  });

  savedEl.hidden = false;
  setTimeout(() => {
    savedEl.hidden = true;
  }, 1500);
});

document.getElementById('clearCache').addEventListener('click', async () => {
  await saveSettings({ cache: {} });
  savedEl.textContent = 'Cache cleared';
  savedEl.hidden = false;
  setTimeout(() => {
    savedEl.textContent = 'Saved';
    savedEl.hidden = true;
  }, 1500);
});

load();
