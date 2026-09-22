const DEFAULTS = {
  apiKey: '',
  runMode: 'manual', // 'manual' | 'automatic'
  minConfidence: 0.45,
  excludePatterns: '',
  distractionAtEnd: true,
  /** @type {string[]} user-defined group names always offered to Jev */
  customGroups: [],
  cache: {}, // url -> { category: groupTitle, confidence, ts }
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(null);
  const customGroups = Array.isArray(stored.customGroups)
    ? stored.customGroups.map((t) => String(t).trim()).filter(Boolean)
    : DEFAULTS.customGroups;
  return {
    ...DEFAULTS,
    ...stored,
    customGroups,
    cache: stored.cache || {},
  };
}

/** Normalize + dedupe custom group titles */
export function normalizeCustomGroups(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const t = String(raw).trim().slice(0, 48);
    if (!t || t.toLowerCase() === 'unsorted') continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
}

export function matchesExclude(url, excludePatterns) {
  if (!excludePatterns?.trim()) return false;
  const lines = excludePatterns
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.some((p) => url.includes(p));
}

export function cacheKey(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '') || u.origin;
  } catch {
    return url;
  }
}
