import { getSettings, saveSettings } from './lib/settings.js';

const statusEl = document.getElementById('status');
const runModeEl = document.getElementById('runMode');
const sortBtn = document.getElementById('sortBtn');
const resultEl = document.getElementById('result');
const quickGroupEl = document.getElementById('quickGroup');
const addGroupBtn = document.getElementById('addGroupBtn');
const customPreviewEl = document.getElementById('customPreview');

async function refreshStatus() {
  const settings = await getSettings();
  runModeEl.value = settings.runMode || 'manual';
  const customs = settings.customGroups || [];
  customPreviewEl.textContent = customs.length
    ? `Custom: ${customs.join(' · ')}`
    : 'No custom groups yet — add one above or in Settings.';

  if (!settings.apiKey) {
    statusEl.textContent = 'Add API key in Settings before sorting.';
    statusEl.className = 'status err';
    sortBtn.disabled = true;
  } else {
    statusEl.textContent =
      settings.runMode === 'automatic'
        ? 'Automatic — new tabs are sorted after load.'
        : 'Manual — click Sort or press ⌘⇧G.';
    statusEl.className = 'status ok';
    sortBtn.disabled = false;
  }
}

runModeEl.addEventListener('change', async () => {
  await saveSettings({ runMode: runModeEl.value });
  await refreshStatus();
});

async function addCustomGroup() {
  const name = quickGroupEl.value.trim();
  if (!name) return;
  addGroupBtn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'ADD_CUSTOM_GROUP', name });
    if (!res?.ok) throw new Error(res?.error || 'Failed to add group');
    quickGroupEl.value = '';
    await refreshStatus();
  } catch (err) {
    resultEl.hidden = false;
    resultEl.textContent = String(err?.message || err);
  } finally {
    addGroupBtn.disabled = false;
  }
}

addGroupBtn.addEventListener('click', addCustomGroup);
quickGroupEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomGroup();
  }
});

sortBtn.addEventListener('click', async () => {
  sortBtn.disabled = true;
  sortBtn.textContent = 'Sorting…';
  resultEl.hidden = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'SORT_WINDOW' });
    if (!res?.ok) throw new Error(res?.error || 'Sort failed');
    const lines = Object.entries(res.counts || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`);
    resultEl.hidden = false;
    resultEl.textContent =
      (lines.length ? lines.join('\n') : 'No tabs sorted') +
      (res.errors ? `\nerrors: ${res.errors}` : '');
  } catch (err) {
    resultEl.hidden = false;
    resultEl.textContent = String(err?.message || err);
  } finally {
    sortBtn.textContent = 'Sort this window';
    await refreshStatus();
  }
});

refreshStatus();
