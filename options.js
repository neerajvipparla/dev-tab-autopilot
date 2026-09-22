import { getSettings, saveSettings } from './lib/settings.js';

const apiKeyEl = document.getElementById('apiKey');
const minConfidenceEl = document.getElementById('minConfidence');
const excludeEl = document.getElementById('excludePatterns');
const distractionEl = document.getElementById('distractionAtEnd');
const savedEl = document.getElementById('saved');

async function load() {
  const s = await getSettings();
  apiKeyEl.value = s.apiKey || '';
  minConfidenceEl.value = String(s.minConfidence ?? 0.45);
  excludeEl.value = s.excludePatterns || '';
  distractionEl.checked = s.distractionAtEnd !== false;
  document.querySelectorAll('input[name="runMode"]').forEach((el) => {
    el.checked = el.value === (s.runMode || 'manual');
  });
}

document.getElementById('save').addEventListener('click', async () => {
  const runMode = document.querySelector('input[name="runMode"]:checked')?.value || 'manual';

  await saveSettings({
    apiKey: apiKeyEl.value.trim(),
    runMode,
    minConfidence: Number(minConfidenceEl.value) || 0.45,
    excludePatterns: excludeEl.value,
    distractionAtEnd: distractionEl.checked,
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
