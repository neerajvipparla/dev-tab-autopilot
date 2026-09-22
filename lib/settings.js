const DEFAULTS = {
  apiKey: '',
  runMode: 'manual', // 'manual' | 'automatic'
  minConfidence: 0.45,
  excludePatterns: '',
  distractionAtEnd: true,
  /** @type {string[]} user-defined group names always offered to Jev */
  customGroups: [],
};

const CACHE_MAX = 500;
const CACHE_KEEP = 400;

export async function getSettings() {
  const { cache: _legacySyncCache, ...stored } = await chrome.storage.sync.get(null);
  const customGroups = Array.isArray(stored.customGroups)
    ? stored.customGroups.map((t) => String(t).trim()).filter(Boolean)
    : DEFAULTS.customGroups;
  return {
    ...DEFAULTS,
    ...stored,
    customGroups,
  };
}

/**
 * Classification cache lives in storage.local (sync has an 8KB per-item quota).
 * @returns {Promise<Record<string, { category: string, confidence: number, ts: number }>>}
 *          url key -> parent group
 */
export async function getCache() {
  const { cache } = await chrome.storage.local.get('cache');
  return cache || {};
}

let cacheWrite = Promise.resolve();

/**
 * Merge entries into the cache. Writes are queued so concurrent callers don't clobber each other.
 * @param {Record<string, { category: string, confidence: number, ts: number }>} entries
 */
export function mergeCache(entries) {
  cacheWrite = cacheWrite
    .then(async () => {
      const cache = { ...(await getCache()), ...entries };
      const keys = Object.keys(cache);
      if (keys.length > CACHE_MAX) {
        keys
          .sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
          .slice(0, keys.length - CACHE_KEEP)
          .forEach((k) => delete cache[k]);
      }
      await chrome.storage.local.set({ cache });
    })
    .catch((err) => console.warn('[Dev Tab Autopilot] cache write failed', err));
  return cacheWrite;
}

export async function clearCache() {
  await chrome.storage.local.remove('cache');
  // Older versions kept the cache in sync storage
  await chrome.storage.sync.remove('cache');
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
