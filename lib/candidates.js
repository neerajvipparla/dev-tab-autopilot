/**
 * Dynamic group-name candidates for Jev.
 * Jev cannot invent free text — we propose labels from URLs/titles/existing groups,
 * then Jev chooses among them.
 */

const COLORS = ['blue', 'purple', 'orange', 'green', 'cyan', 'pink', 'yellow', 'red', 'grey'];

export const UNSORTED_KEY = 'unsorted';
export const UNSORTED_TITLE = 'Unsorted';

/**
 * @param {string} title
 * @returns {string} stable slug for Jev criteria keys
 */
export function slugify(title) {
  const s = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return s || 'group';
}

/**
 * Suggest a human group label for one tab from URL/title.
 * @param {string} url
 * @param {string} [title]
 * @returns {string|null}
 */
export function suggestLabelForTab(url, title = '') {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol === 'chrome:' || u.protocol === 'chrome-extension:') return null;

  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname || '/';
  const port = u.port;

  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
    return port ? `Local :${port}` : 'Local';
  }

  if (host === 'github.com' || host === 'gist.github.com') {
    const parts = path.split('/').filter(Boolean);
    const owner = parts[0];
    const repo = parts[1];
    if (/\/pull\/|\/pulls(\/|$)/.test(path)) {
      return repo ? `GitHub PRs · ${repo}` : 'GitHub PRs';
    }
    if (/\/issues(\/|$)/.test(path)) {
      return repo ? `GitHub Issues · ${repo}` : 'GitHub Issues';
    }
    if (/\/actions(\/|$)|\/runs\//.test(path)) {
      return repo ? `GitHub Actions · ${repo}` : 'GitHub Actions';
    }
    if (owner && repo) return `GitHub · ${repo}`;
    return 'GitHub';
  }

  if (host.includes('gitlab.')) {
    if (path.includes('/merge_requests')) return 'GitLab MRs';
    if (path.includes('/issues')) return 'GitLab Issues';
    if (path.includes('/pipelines') || path.includes('/-/jobs')) return 'GitLab CI';
    return 'GitLab';
  }

  if (host === 'linear.app') return 'Linear';
  if (host.includes('atlassian.net') || host.startsWith('jira.')) return 'Jira';
  if (host === 'app.slack.com' || host.endsWith('.slack.com')) return 'Slack';
  if (host === 'discord.com' || host === 'discordapp.com') return 'Discord';
  if (host.includes('notion.so') || host.includes('notion.site')) return 'Notion';
  if (host === 'stackoverflow.com' || host.endsWith('.stackexchange.com')) return 'Stack Overflow';
  if (host === 'youtube.com' || host === 'youtu.be') return 'YouTube';
  if (host === 'x.com' || host === 'twitter.com') return 'X / Twitter';
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'Reddit';
  if (host.includes('vercel.com')) return 'Vercel';
  if (host.includes('netlify.com')) return 'Netlify';
  if (host.includes('console.aws.amazon.com')) return 'AWS Console';
  if (host.includes('console.cloud.google.com')) return 'GCP Console';
  if (host.includes('portal.azure.com')) return 'Azure Portal';
  if (host === 'docs.rs' || host.startsWith('docs.') || path.includes('/docs/')) {
    return host === 'docs.rs' ? 'docs.rs' : `Docs · ${host}`;
  }

  // Prefer a clean host label; use first path segment when it looks like a product area
  const first = path.split('/').filter(Boolean)[0];
  if (first && /^(docs|blog|app|dashboard|console|admin)$/i.test(first)) {
    return `${capitalize(first)} · ${host}`;
  }

  // Title can refine very generic hosts
  if (title && host.length > 28) {
    const short = title.split(/[|\-–—]/)[0].trim().slice(0, 28);
    if (short.length >= 3) return short;
  }

  return host;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build candidate group labels for a window of tabs.
 * @param {Array<{ url?: string, title?: string }>} tabs
 * @param {string[]} [existingGroupTitles]
 * @param {number} [maxCandidates]
 * @returns {{ titles: string[], criteria: Record<string, string>, slugToTitle: Record<string, string>, titleToSlug: Record<string, string> }}
 */
export function buildCandidates(tabs, existingGroupTitles = [], maxCandidates = 18) {
  /** @type {Map<string, number>} */
  const scores = new Map();

  const bump = (title, weight = 1) => {
    if (!title || title === UNSORTED_TITLE) return;
    scores.set(title, (scores.get(title) || 0) + weight);
  };

  for (const t of existingGroupTitles) {
    if (t && t !== UNSORTED_TITLE) bump(t, 3);
  }

  for (const tab of tabs) {
    if (!tab?.url) continue;
    const label = suggestLabelForTab(tab.url, tab.title || '');
    if (label) bump(label, 1);
  }

  // Always keep Unsorted as an escape hatch
  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([title]) => title)
    .slice(0, Math.max(1, maxCandidates - 1));

  if (!ranked.includes(UNSORTED_TITLE)) {
    ranked.push(UNSORTED_TITLE);
  }

  /** @type {Record<string, string>} */
  const slugToTitle = {};
  /** @type {Record<string, string>} */
  const titleToSlug = {};
  /** @type {Record<string, string>} */
  const criteria = {};

  for (const title of ranked) {
    let slug = slugify(title);
    // Avoid collisions
    let i = 2;
    while (slugToTitle[slug] && slugToTitle[slug] !== title) {
      slug = `${slugify(title)}_${i++}`;
    }
    slugToTitle[slug] = title;
    titleToSlug[title] = slug;
    criteria[slug] =
      title === UNSORTED_TITLE
        ? 'Does not clearly belong with any other open-tab group'
        : `Tabs that belong together under “${title}” (same product, repo, or task)`;
  }

  return { titles: ranked, criteria, slugToTitle, titleToSlug };
}

/**
 * Stable Chrome tabGroups color from a title.
 * @param {string} title
 * @returns {chrome.tabGroups.ColorEnum}
 */
export function colorForTitle(title) {
  if (title === UNSORTED_TITLE) return 'grey';
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
