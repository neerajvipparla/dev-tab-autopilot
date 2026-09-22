const DEFAULTS = {
  apiKey: '',
  runMode: 'manual', // 'manual' | 'automatic'
  minConfidence: 0.45,
  excludePatterns: '',
  distractionAtEnd: true,
  cache: {}, // url -> { category: groupTitle, confidence, ts }
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(null);
  return {
    ...DEFAULTS,
    ...stored,
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
    return `${u.origin}${u.pathname}`.replace(/\/$/, '') || u.origin;
  } catch {
    return url;
  }
}
