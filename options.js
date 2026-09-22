import { CATEGORIES } from './lib/categories.js';
import { getSettings, saveSettings } from './lib/settings.js';

const apiKeyEl = document.getElementById('apiKey');
const minConfidenceEl = document.getElementById('minConfidence');
const excludeEl = document.getElementById('excludePatterns');
const distractionEl = document.getElementById('distractionAtEnd');
const catsEl = document.getElementById('categories');
const savedEl = document.getElementById('saved');

for (const [key, meta] of Object.entries(CATEGORIES)) {
  const label = document.createElement('label');
  label.className = 'check';
  label.innerHTML = `<input type="checkbox" data-cat="${key}" /> ${meta.title}`;
  catsEl.appendChild(label);
}

async function load() {
  const s = await getSettings();
  apiKeyEl.value = s.apiKey || '';
  minConfidenceEl.value = String(s.minConfidence ?? 0.45);
  excludeEl.value = s.excludePatterns || '';
  distractionEl.checked = s.distractionAtEnd !== false;
  document.querySelectorAll('input[name="runMode"]').forEach((el) => {
    el.checked = el.value === (s.runMode || 'manual');
  });
  document.querySelectorAll('[data-cat]').forEach((el) => {
    const key = el.getAttribute('data-cat');
    el.checked = s.enabledCategories?.[key] !== false;
  });
}

document.getElementById('save').addEventListener('click', async () => {
  const runMode = document.querySelector('input[name="runMode"]:checked')?.value || 'manual';
  const enabledCategories = {};
  document.querySelectorAll('[data-cat]').forEach((el) => {
    enabledCategories[el.getAttribute('data-cat')] = el.checked;
  });

  await saveSettings({
    apiKey: apiKeyEl.value.trim(),
    runMode,
    minConfidence: Number(minConfidenceEl.value) || 0.45,
    excludePatterns: excludeEl.value,
    distractionAtEnd: distractionEl.checked,
    enabledCategories,
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
