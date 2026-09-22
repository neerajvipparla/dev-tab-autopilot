const DEFAULTS = {
  apiKey: '',
  runMode: 'manual', // 'manual' | 'automatic'
  minConfidence: 0.45,
  excludePatterns: '',
  enabledCategories: {
    code: true,
    pr: true,
    issue: true,
    ci: true,
    docs: true,
    chat: true,
    cloud: true,
    learning: true,
    distraction: true,
    other: true,
  },
  distractionAtEnd: true,
  cache: {}, // url -> { category, confidence, ts }
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(null);
  return {
    ...DEFAULTS,
    ...stored,
    enabledCategories: {
      ...DEFAULTS.enabledCategories,
      ...(stored.enabledCategories || {}),
    },
    cache: stored.cache || {},
  };
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
    // Drop hash/query noise for cache hits
    return `${u.origin}${u.pathname}`.replace(/\/$/, '') || u.origin;
  } catch {
    return url;
  }
}
