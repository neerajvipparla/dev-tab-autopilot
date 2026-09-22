import { classifyWithJev } from './lib/jev.js';
import {
  moveTabIntoCategory,
  applyGroupAssignments,
  clearGroupCache,
  listGroupTitles,
} from './lib/groups.js';
import { buildCandidates, subForParent, UNSORTED_TITLE } from './lib/candidates.js';
import {
  getSettings,
  saveSettings,
  matchesExclude,
  cacheKey,
  normalizeCustomGroups,
  getCache,
  mergeCache,
} from './lib/settings.js';

const debounceTimers = new Map();
const DEBOUNCE_MS = 500;

/** Sorts and auto-moves run one at a time so parallel runs can't create duplicate groups */
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

chrome.runtime.onInstalled.addListener(() => {
  // Older versions kept the classification cache in sync storage (quota-limited)
  chrome.storage.sync.remove('cache').catch(() => {});
  console.log('[Dev Tab Autopilot] installed — parent groups with subgroups');
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'sort-tabs') {
    await enqueue(sortCurrentWindow);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'SORT_WINDOW') {
        const result = await enqueue(sortCurrentWindow);
        sendResponse({ ok: true, ...result });
        return;
      }
      if (msg?.type === 'ADD_CUSTOM_GROUP') {
        const settings = await getSettings();
        const name = String(msg.name || '').trim();
        if (!name) throw new Error('Group name required');
        const customGroups = normalizeCustomGroups([
          ...(settings.customGroups || []),
          name,
        ]);
        await saveSettings({ customGroups });
        sendResponse({ ok: true, customGroups });
        return;
      }
      if (msg?.type === 'LIST_CUSTOM_GROUPS') {
        const settings = await getSettings();
        sendResponse({ ok: true, customGroups: settings.customGroups || [] });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message' });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true;
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
        await enqueue(async () => {
          // Re-read: the tab may have moved or closed while queued
          const current = await chrome.tabs.get(tabId).catch(() => null);
          if (current?.url && !current.url.startsWith('chrome')) await classifyAndMove(current, settings);
        });
      } catch (err) {
        console.warn('[Dev Tab Autopilot] auto classify failed', err);
      }
    }, DEBOUNCE_MS),
  );
}

/**
 * Eligible http(s) tabs in a window, minus excludes.
 */
function filterTabs(tabs, excludePatterns) {
  return tabs.filter((tab) => {
    if (!tab.url) return false;
    if (tab.url.startsWith('chrome') || tab.url.startsWith('chrome-extension')) return false;
    if (matchesExclude(tab.url, excludePatterns)) return false;
    return true;
  });
}

async function buildWindowCandidates(windowId, tabs, settings) {
  const existingTitles = await listGroupTitles(windowId);
  return buildCandidates(tabs, existingTitles, 18, settings.customGroups || []);
}

/** Subgroup lookup for tabs inside a parent group (custom groups have none) */
function makeSubForTab(settings) {
  const customSet = new Set(settings.customGroups || []);
  return (tab, parent) => subForParent(tab, parent, customSet);
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

  const eligible = filterTabs(tabs, settings.excludePatterns);
  const candidates = await buildWindowCandidates(targetWindowId, eligible, settings);

  /** @type {Record<string, number>} */
  const counts = {};
  let errors = 0;
  /** @type {Array<{ tab: chrome.tabs.Tab, category: string }>} */
  const assignments = [];

  const siblings = eligible.map((t) => ({ url: t.url, title: t.title || '' }));
  const cache = await getCache();

  for (const tab of eligible) {
    try {
      const category = await resolveCategory(tab, settings, candidates, siblings, cache);
      assignments.push({ tab, category });
      counts[category] = (counts[category] || 0) + 1;
    } catch (err) {
      console.warn('Failed tab', tab.url, err);
      errors += 1;
    }
  }

  await applyGroupAssignments(targetWindowId, assignments, {
    distractionAtEnd: settings.distractionAtEnd,
    subForTab: makeSubForTab(settings),
  });

  return { counts, errors, total: tabs.length, groups: candidates.titles };
}

/**
 * @param {chrome.tabs.Tab} tab
 * @param {Awaited<ReturnType<typeof getSettings>>} settings
 * @param {ReturnType<typeof buildCandidates>} candidates
 * @param {Array<{ url: string, title: string }>} siblings
 * @param {Awaited<ReturnType<typeof getCache>>} cache snapshot; new entries are merged into storage
 * @returns {Promise<string>} parent group title
 */
async function resolveCategory(tab, settings, candidates, siblings, cache) {
  if (!tab.url || tab.id == null) return UNSORTED_TITLE;

  const key = cacheKey(tab.url);
  let category;
  let confidence = 1;

  const cached = cache[key];
  const candidateSet = new Set(candidates.titles);
  // Reuse cache only if that group is still a candidate this round
  if (
    cached &&
    Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000 &&
    cached.category &&
    candidateSet.has(cached.category)
  ) {
    category = cached.category;
    confidence = cached.confidence ?? 1;
  } else {
    const result = await classifyWithJev({
      apiKey: settings.apiKey,
      url: tab.url,
      title: tab.title || '',
      criteria: candidates.criteria,
      slugToTitle: candidates.slugToTitle,
      siblingTabs: siblings.filter((s) => s.url !== tab.url),
    });
    category = result.category;
    confidence = result.confidence;

    const entry = { category, confidence, ts: Date.now() };
    cache[key] = entry;
    await mergeCache({ [key]: entry });
  }

  if (confidence < settings.minConfidence) {
    return UNSORTED_TITLE;
  }
  if (!candidateSet.has(category)) {
    return UNSORTED_TITLE;
  }
  return category;
}

async function classifyAndMove(tab, settings) {
  if (!tab.url || tab.windowId == null) return UNSORTED_TITLE;

  const tabs = await chrome.tabs.query({ windowId: tab.windowId });
  const eligible = filterTabs(tabs, settings.excludePatterns);
  const candidates = await buildWindowCandidates(tab.windowId, eligible, settings);
  const siblings = eligible.map((t) => ({ url: t.url, title: t.title || '' }));

  const category = await resolveCategory(tab, settings, candidates, siblings, await getCache());
  await moveTabIntoCategory(tab, category, {
    pinDistractionStyle: settings.distractionAtEnd,
    subForTab: makeSubForTab(settings),
  });
  return category;
}
