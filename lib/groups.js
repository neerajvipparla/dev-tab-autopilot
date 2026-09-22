import {
  colorForTitle,
  formatGroupTitle,
  isManagedParent,
  parentOfGroupTitle,
  rankSubs,
  UNSORTED_TITLE,
} from './candidates.js';

/** @type {Map<number, Map<string, number>>} windowId -> parent -> groupId */
const groupCache = new Map();

/** @typedef {(tab: chrome.tabs.Tab, parent: string) => string|null} SubForTab */

function cacheSet(windowId, parent, groupId) {
  let byParent = groupCache.get(windowId);
  if (!byParent) {
    byParent = new Map();
    groupCache.set(windowId, byParent);
  }
  byParent.set(parent, groupId);
}

/** A group belongs to a parent when titled "Parent" or "Parent · subs…" */
function titleMatchesParent(title, parent) {
  return !!title && (title === parent || parentOfGroupTitle(title) === parent);
}

/**
 * @param {number} windowId
 * @param {string} parent parent group name
 * @returns {Promise<number|null>}
 */
export async function findGroupId(windowId, parent) {
  const byParent = groupCache.get(windowId);
  const cached = byParent?.get(parent);
  if (cached != null) {
    try {
      const g = await chrome.tabGroups.get(cached);
      if (g && g.windowId === windowId && titleMatchesParent(g.title, parent)) return cached;
    } catch {
      // group was closed
    }
    byParent.delete(parent);
  }

  const groups = await chrome.tabGroups.query({ windowId });
  const match = groups.find((g) => titleMatchesParent(g.title, parent));
  if (match) {
    cacheSet(windowId, parent, match.id);
    return match.id;
  }
  return null;
}

/**
 * Put tabs into the parent's group, creating it if missing.
 * @param {number} windowId
 * @param {string} parent
 * @param {number[]} tabIds
 * @returns {Promise<number>} groupId
 */
async function ensureGroup(windowId, parent, tabIds) {
  let groupId = await findGroupId(windowId, parent);
  if (groupId == null) {
    groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    cacheSet(windowId, parent, groupId);
  } else {
    await chrome.tabs.group({ tabIds, groupId });
  }
  return groupId;
}

/**
 * Keep each subgroup's tabs contiguous (largest subgroup first) and refresh the title.
 * @param {number} groupId
 * @param {string} parent
 * @param {SubForTab} subForTab
 */
async function arrangeGroup(groupId, parent, subForTab) {
  const tabs = (await chrome.tabs.query({ groupId })).sort((a, b) => a.index - b.index);
  if (!tabs.length) return;

  /** @type {Map<number, string|null>} */
  const subs = new Map(tabs.map((t) => [t.id, subForTab(t, parent)]));
  const order = rankSubs([...subs.values()]);
  const rank = (sub) => (sub == null ? order.length : order.indexOf(sub));
  const sorted = [...tabs].sort(
    (a, b) => rank(subs.get(a.id)) - rank(subs.get(b.id)) || a.index - b.index,
  );

  if (sorted.some((t, i) => t.id !== tabs[i].id)) {
    const ids = sorted.map((t) => t.id);
    await chrome.tabs.move(ids, { index: tabs[0].index });
    // Re-assert membership in case a move landed on the group edge
    await chrome.tabs.group({ tabIds: ids, groupId });
  }

  await chrome.tabGroups.update(groupId, {
    title: formatGroupTitle(parent, [...subs.values()]),
    color: colorForTitle(parent),
  });
}

/**
 * Move one tab into its parent group (create if missing) and re-order subgroups.
 * The group it left (if any) gets its subgroup title refreshed too.
 * @param {chrome.tabs.Tab} tab
 * @param {string} parent
 * @param {{ pinDistractionStyle?: boolean, subForTab: SubForTab }} opts
 */
export async function moveTabIntoCategory(tab, parent, opts) {
  if (tab.id == null || tab.windowId == null) return null;
  const prevGroupId = tab.groupId;
  const groupId = await ensureGroup(tab.windowId, parent, [tab.id]);
  await arrangeGroup(groupId, parent, opts.subForTab);

  if (prevGroupId != null && prevGroupId !== -1 && prevGroupId !== groupId) {
    try {
      const prev = await chrome.tabGroups.get(prevGroupId);
      const prevParent = parentOfGroupTitle(prev.title || '');
      if (isManagedParent(prevParent)) await arrangeGroup(prevGroupId, prevParent, opts.subForTab);
    } catch {
      // group closed when its last tab left
    }
  }

  // Heuristic: push likely-distraction groups to the end
  if (opts.pinDistractionStyle && isDistractionTitle(parent)) {
    try {
      await chrome.tabGroups.move(groupId, { index: -1 });
    } catch {
      // optional
    }
  }
  return groupId;
}

function isDistractionTitle(parent) {
  return parent === 'Media' || /youtube|reddit|twitter|\bx\b|instagram|netflix|facebook|tiktok/i.test(parent);
}

/**
 * @param {number} windowId
 * @param {Array<{ tab: chrome.tabs.Tab, category: string }>} assignments category = parent group
 * @param {{ distractionAtEnd?: boolean, subForTab: SubForTab }} opts
 */
export async function applyGroupAssignments(windowId, assignments, { distractionAtEnd = true, subForTab }) {
  /** @type {Map<string, chrome.tabs.Tab[]>} */
  const byParent = new Map();

  for (const { tab, category: parent } of assignments) {
    if (tab.id == null || !parent) continue;
    const list = byParent.get(parent) || [];
    list.push(tab);
    byParent.set(parent, list);
  }

  for (const [parent, tabs] of byParent) {
    const tabIds = tabs.map((t) => t.id).filter((id) => id != null);
    if (!tabIds.length) continue;

    const groupId = await ensureGroup(windowId, parent, tabIds);
    await arrangeGroup(groupId, parent, subForTab);

    if (distractionAtEnd && isDistractionTitle(parent)) {
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
