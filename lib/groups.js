import { CATEGORIES, UNSORTED } from './categories.js';

/** @type {Map<number, Map<string, number>>} windowId -> category -> groupId */
const groupCache = new Map();

function metaFor(category) {
  if (category === 'unsorted') return UNSORTED;
  return CATEGORIES[category] || UNSORTED;
}

function cacheSet(windowId, category, groupId) {
  let byCat = groupCache.get(windowId);
  if (!byCat) {
    byCat = new Map();
    groupCache.set(windowId, byCat);
  }
  byCat.set(category, groupId);
}

/**
 * Find an existing tab group for this category in the window, or null.
 * @param {number} windowId
 * @param {string} category
 * @returns {Promise<number|null>}
 */
export async function findGroupId(windowId, category) {
  const meta = metaFor(category);

  const byCat = groupCache.get(windowId);
  const cached = byCat?.get(category);
  if (cached != null) {
    try {
      const g = await chrome.tabGroups.get(cached);
      if (g && g.windowId === windowId && g.title === meta.title) {
        return cached;
      }
    } catch {
      byCat.delete(category);
    }
  }

  const existing = await chrome.tabGroups.query({ windowId, title: meta.title });
  if (existing.length > 0) {
    cacheSet(windowId, category, existing[0].id);
    return existing[0].id;
  }

  return null;
}

/**
 * Create a new named/colored tab group containing the given tab ids.
 * Chrome only creates a group when you pass tabIds — there is no empty-group API.
 * @param {number} windowId
 * @param {string} category
 * @param {number[]} tabIds
 * @returns {Promise<number>} groupId
 */
export async function createGroup(windowId, category, tabIds) {
  if (!tabIds.length) {
    throw new Error('createGroup requires at least one tab');
  }
  const meta = metaFor(category);
  const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
  await chrome.tabGroups.update(groupId, {
    title: meta.title,
    color: meta.color,
    collapsed: false,
  });
  cacheSet(windowId, category, groupId);
  return groupId;
}

/**
 * Move one tab into its category group. Creates the group if it does not exist yet.
 * @param {chrome.tabs.Tab} tab
 * @param {string} category
 * @param {{ distractionAtEnd?: boolean }} [opts]
 */
export async function moveTabIntoCategory(tab, category, { distractionAtEnd = true } = {}) {
  if (tab.id == null || tab.windowId == null) return null;

  const windowId = tab.windowId;
  let groupId = await findGroupId(windowId, category);

  if (groupId == null) {
    // No group yet → create one with this tab
    groupId = await createGroup(windowId, category, [tab.id]);
  } else if (tab.groupId !== groupId) {
    // Group exists → add / move tab into it
    await chrome.tabs.group({ tabIds: [tab.id], groupId });
  }

  if (distractionAtEnd && category === 'distraction') {
    try {
      await chrome.tabGroups.move(groupId, { index: -1 });
    } catch {
      // optional
    }
  }

  return groupId;
}

/**
 * After classifying many tabs, put each category's tabs into one group
 * (create if missing, otherwise merge into existing).
 * @param {number} windowId
 * @param {Array<{ tab: chrome.tabs.Tab, category: string }>} assignments
 * @param {{ distractionAtEnd?: boolean }} [opts]
 */
export async function applyGroupAssignments(windowId, assignments, { distractionAtEnd = true } = {}) {
  /** @type {Map<string, chrome.tabs.Tab[]>} */
  const byCategory = new Map();

  for (const { tab, category } of assignments) {
    if (tab.id == null) continue;
    const list = byCategory.get(category) || [];
    list.push(tab);
    byCategory.set(category, list);
  }

  for (const [category, tabs] of byCategory) {
    const tabIds = tabs.map((t) => t.id).filter((id) => id != null);
    if (!tabIds.length) continue;

    let groupId = await findGroupId(windowId, category);
    if (groupId == null) {
      groupId = await createGroup(windowId, category, tabIds);
    } else {
      await chrome.tabs.group({ tabIds, groupId });
      // Ensure title/color still match (in case user renamed)
      const meta = metaFor(category);
      try {
        await chrome.tabGroups.update(groupId, {
          title: meta.title,
          color: meta.color,
        });
      } catch {
        // ignore
      }
    }

    if (distractionAtEnd && category === 'distraction') {
      try {
        await chrome.tabGroups.move(groupId, { index: -1 });
      } catch {
        // ignore
      }
    }
  }
}

export function clearGroupCache(windowId) {
  if (windowId == null) groupCache.clear();
  else groupCache.delete(windowId);
}
