import { getSettings, saveSettings } from './lib/settings.js';

const statusEl = document.getElementById('status');
const runModeEl = document.getElementById('runMode');
const sortBtn = document.getElementById('sortBtn');
const resultEl = document.getElementById('result');

async function refreshStatus() {
  const settings = await getSettings();
  runModeEl.value = settings.runMode || 'manual';
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
