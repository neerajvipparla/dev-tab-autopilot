import { classifyWithJev } from './lib/jev.js';
import {
  moveTabIntoCategory,
  applyGroupAssignments,
  clearGroupCache,
} from './lib/groups.js';
import { CATEGORIES } from './lib/categories.js';
import {
  getSettings,
  saveSettings,
  matchesExclude,
  cacheKey,
} from './lib/settings.js';

const debounceTimers = new Map();
const DEBOUNCE_MS = 500;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Dev Tab Autopilot] installed');
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'sort-tabs') {
    await sortCurrentWindow();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'SORT_WINDOW') {
        const result = await sortCurrentWindow();
        sendResponse({ ok: true, ...result });
        return;
      }
      if (msg?.type === 'GET_STATUS') {
        const settings = await getSettings();
        sendResponse({
          ok: true,
          runMode: settings.runMode,
          hasKey: Boolean(settings.apiKey),
        });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message' });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true; // async
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) return;
  scheduleAutoClassify(tabId, tab);
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id != null) scheduleAutoClassify(tab.id, tab);
});

chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  if (removeInfo.isWindowClosing) clearGroupCache(removeInfo.windowId);
});

function scheduleAutoClassify(tabId, tab) {
  const existing = debounceTimers.get(tabId);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    tabId,
    setTimeout(async () => {
      debounceTimers.delete(tabId);
      const settings = await getSettings();
      if (settings.runMode !== 'automatic') return;
      const fresh = await chrome.tabs.get(tabId).catch(() => null);
      if (!fresh?.url || fresh.url.startsWith('chrome')) return;
      try {
        await classifyAndMove(fresh, settings);
      } catch (err) {
        console.warn('[Dev Tab Autopilot] auto classify failed', err);
      }
    }, DEBOUNCE_MS),
  );
}

async function sortCurrentWindow() {
  const settings = await getSettings();
  if (!settings.apiKey) {
    throw new Error('Add your TypeSafe API key in Settings first.');
  }

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const windowId = active?.windowId;
  const tabs = await chrome.tabs.query(windowId != null ? { windowId } : { currentWindow: true });
  const targetWindowId = windowId ?? tabs[0]?.windowId;
  if (targetWindowId == null) {
    return { counts: {}, errors: 0, total: 0 };
  }

  /** @type {Record<string, number>} */
  const counts = {};
  let errors = 0;
  /** @type {Array<{ tab: chrome.tabs.Tab, category: string }>} */
  const assignments = [];

  // 1) Classify every eligible tab (reuse cache when possible)
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('chrome-extension')) {
      continue;
    }
    if (matchesExclude(tab.url, settings.excludePatterns)) continue;

    try {
      const category = await resolveCategory(tab, settings);
      assignments.push({ tab, category });
      counts[category] = (counts[category] || 0) + 1;
    } catch (err) {
      console.warn('Failed tab', tab.url, err);
      errors += 1;
    }
  }

  // 2) Find-or-create Chrome tab groups and move tabs into them
  await applyGroupAssignments(targetWindowId, assignments, {
    distractionAtEnd: settings.distractionAtEnd,
  });

  return { counts, errors, total: tabs.length };
}

/**
 * Resolve category for a tab (Jev + cache + confidence / enabled filters).
 * @param {chrome.tabs.Tab} tab
 * @param {Awaited<ReturnType<typeof getSettings>>} settings
 */
async function resolveCategory(tab, settings) {
  if (!tab.url || tab.id == null) return 'unsorted';
  if (matchesExclude(tab.url, settings.excludePatterns)) return 'unsorted';

  const key = cacheKey(tab.url);
  let category;
  let confidence = 1;

  const cached = settings.cache?.[key];
  // Cache 7 days
  if (cached && Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000) {
    category = cached.category;
    confidence = cached.confidence ?? 1;
  } else {
    const result = await classifyWithJev({
      apiKey: settings.apiKey,
      url: tab.url,
      title: tab.title || '',
    });
    category = result.category;
    confidence = result.confidence;

    const cache = { ...(settings.cache || {}) };
    cache[key] = { category, confidence, ts: Date.now() };
    // Bound cache size
    const keys = Object.keys(cache);
    if (keys.length > 500) {
      keys
        .sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
        .slice(0, keys.length - 400)
        .forEach((k) => delete cache[k]);
    }
    await saveSettings({ cache });
  }

  if (confidence < settings.minConfidence) {
    category = 'unsorted';
  } else if (category !== 'unsorted' && settings.enabledCategories?.[category] === false) {
    category = 'other';
  } else if (category !== 'unsorted' && !CATEGORIES[category]) {
    category = 'other';
  }

  return category;
}

/**
 * Classify one tab and move it into a Chrome tab group (create group if needed).
 * Used by automatic mode.
 */
async function classifyAndMove(tab, settings) {
  const category = await resolveCategory(tab, settings);
  await moveTabIntoCategory(tab, category, {
    distractionAtEnd: settings.distractionAtEnd,
  });
  return category;
}
