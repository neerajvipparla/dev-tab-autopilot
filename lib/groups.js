import { colorForTitle, UNSORTED_TITLE } from './candidates.js';

/** @type {Map<number, Map<string, number>>} windowId -> groupTitle -> groupId */
const groupCache = new Map();

function cacheSet(windowId, title, groupId) {
  let byTitle = groupCache.get(windowId);
  if (!byTitle) {
    byTitle = new Map();
    groupCache.set(windowId, byTitle);
  }
  byTitle.set(title, groupId);
}

/**
 * @param {number} windowId
 * @param {string} title human group name
 * @returns {Promise<number|null>}
 */
export async function findGroupId(windowId, title) {
  const byTitle = groupCache.get(windowId);
  const cached = byTitle?.get(title);
  if (cached != null) {
    try {
      const g = await chrome.tabGroups.get(cached);
      if (g && g.windowId === windowId && g.title === title) return cached;
    } catch {
      byTitle.delete(title);
    }
  }

  const existing = await chrome.tabGroups.query({ windowId, title });
  if (existing.length > 0) {
    cacheSet(windowId, title, existing[0].id);
    return existing[0].id;
  }
  return null;
}

/**
 * @param {number} windowId
 * @param {string} title
 * @param {number[]} tabIds
 */
export async function createGroup(windowId, title, tabIds) {
  if (!tabIds.length) throw new Error('createGroup requires at least one tab');
  const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
  await chrome.tabGroups.update(groupId, {
    title,
    color: colorForTitle(title),
    collapsed: false,
  });
  cacheSet(windowId, title, groupId);
  return groupId;
}

/**
 * Move one tab into a named group (create if missing).
 * @param {chrome.tabs.Tab} tab
 * @param {string} title
 * @param {{ pinDistractionStyle?: boolean }} [opts]
 */
export async function moveTabIntoCategory(tab, title, opts = {}) {
  if (tab.id == null || tab.windowId == null) return null;
  const windowId = tab.windowId;
  let groupId = await findGroupId(windowId, title);

  if (groupId == null) {
    groupId = await createGroup(windowId, title, [tab.id]);
  } else if (tab.groupId !== groupId) {
    await chrome.tabs.group({ tabIds: [tab.id], groupId });
  }

  // Heuristic: push likely-distraction groups to the end
  if (opts.pinDistractionStyle && isDistractionTitle(title)) {
    try {
      await chrome.tabGroups.move(groupId, { index: -1 });
    } catch {
      // optional
    }
  }
  return groupId;
}

function isDistractionTitle(title) {
  return /youtube|reddit|twitter|\bx\b|instagram|netflix|facebook|tiktok/i.test(title);
}

/**
 * @param {number} windowId
 * @param {Array<{ tab: chrome.tabs.Tab, category: string }>} assignments category = group title
 * @param {{ distractionAtEnd?: boolean }} [opts]
 */
export async function applyGroupAssignments(windowId, assignments, { distractionAtEnd = true } = {}) {
  /** @type {Map<string, chrome.tabs.Tab[]>} */
  const byTitle = new Map();

  for (const { tab, category: title } of assignments) {
    if (tab.id == null || !title) continue;
    const list = byTitle.get(title) || [];
    list.push(tab);
    byTitle.set(title, list);
  }

  for (const [title, tabs] of byTitle) {
    const tabIds = tabs.map((t) => t.id).filter((id) => id != null);
    if (!tabIds.length) continue;

    let groupId = await findGroupId(windowId, title);
    if (groupId == null) {
      groupId = await createGroup(windowId, title, tabIds);
    } else {
      await chrome.tabs.group({ tabIds, groupId });
      try {
        await chrome.tabGroups.update(groupId, {
          title,
          color: colorForTitle(title),
        });
      } catch {
        // ignore
      }
    }

    if (distractionAtEnd && isDistractionTitle(title)) {
      try {
        await chrome.tabGroups.move(groupId, { index: -1 });
      } catch {
        // ignore
      }
    }
  }
}

export async function listGroupTitles(windowId) {
  const groups = await chrome.tabGroups.query({ windowId });
  return groups.map((g) => g.title).filter(Boolean);
}

export function clearGroupCache(windowId) {
  if (windowId == null) groupCache.clear();
  else groupCache.delete(windowId);
}

export { UNSORTED_TITLE };
