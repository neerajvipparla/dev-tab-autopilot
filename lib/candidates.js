/**
 * Parent-group candidates for Jev, plus URL-derived subgroups.
 * Chrome can't nest tab groups, so each Chrome group is a *parent* (GitHub, Docs, …)
 * and subgroups (repo, docs site, …) are kept contiguous inside it and listed in the title.
 * Jev cannot invent free text — we propose parent labels from URLs/titles/existing groups,
 * then Jev chooses among them. Subgroups come straight from the URL (no Jev call).
 */

// grey is reserved for Unsorted
const COLORS = ['blue', 'purple', 'orange', 'green', 'cyan', 'pink', 'yellow', 'red'];

/** Fixed colors so well-known parents never collide */
const PARENT_COLORS = {
  GitHub: 'green',
  GitLab: 'orange',
  Docs: 'purple',
  'CI / Deploy': 'yellow',
  AI: 'cyan',
  Local: 'blue',
  Chat: 'pink',
  Tracker: 'blue',
  Cloud: 'orange',
  Media: 'red',
};

export const UNSORTED_KEY = 'unsorted';
export const UNSORTED_TITLE = 'Unsorted';

/** Separator between parent and subgroup list in a Chrome group title */
export const SUB_SEP = ' · ';
const MAX_SUBS_IN_TITLE = 3;

/** Human descriptions Jev sees for well-known parents */
const PARENT_DESCRIPTIONS = {
  GitHub: 'GitHub repositories, pull requests, issues, and Actions runs',
  GitLab: 'GitLab projects, merge requests, issues, and pipelines',
  Docs: 'Documentation, guides, and API reference sites',
  'CI / Deploy': 'CI pipelines, builds, and deployment dashboards (CircleCI, Argo CD, Vercel, …)',
  AI: 'AI assistants and chats (ChatGPT, Claude, Gemini, …)',
  Local: 'Local dev servers running on this machine (localhost)',
  Chat: 'Team chat (Slack, Discord)',
  Tracker: 'Issue trackers and project boards (Linear, Jira)',
  Cloud: 'Cloud provider consoles (AWS, GCP, Azure)',
  Media: 'Video, social media, and entertainment',
};

/**
 * Flat labels produced by earlier versions. Existing groups with these names are
 * not re-offered as candidates, so old groups dissolve into the new parents.
 */
const LEGACY_LABELS = new Set([
  'GitHub PRs',
  'GitHub Issues',
  'GitHub Actions',
  'GitLab MRs',
  'GitLab Issues',
  'GitLab CI',
  'Linear',
  'Jira',
  'Slack',
  'Discord',
  'YouTube',
  'Reddit',
  'X / Twitter',
  'Vercel',
  'Netlify',
  'AWS Console',
  'GCP Console',
  'Azure Portal',
  'Blog',
  'App',
  'Dashboard',
  'Console',
  'Admin',
]);

/** github.com/<segment> pages that are not owner/repo */
const GITHUB_NON_REPO = new Set([
  'settings', 'orgs', 'organizations', 'notifications', 'pulls', 'issues', 'marketplace',
  'explore', 'topics', 'trending', 'collections', 'sponsors', 'new', 'login', 'codespaces',
  'features', 'search', 'apps', 'dashboard', 'enterprises', 'account',
]);

/** Two-label public suffixes we care about (not a full PSL) */
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'co.in', 'co.jp',
  'com.br', 'co.nz', 'com.sg', 'github.io', 'vercel.app', 'netlify.app', 'pages.dev',
]);

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
 * @param {string} host hostname without www.
 * @returns {string} e.g. console.typesafe.ai → typesafe.ai, www.bbc.co.uk → bbc.co.uk
 */
function registrableDomain(host) {
  if (/^[\d.]+$/.test(host) || !host.includes('.')) return host;
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  const n = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-n).join('.');
}

/** Short site name: docs.stripe.com → stripe */
function siteName(host) {
  return registrableDomain(host).split('.')[0];
}

/**
 * Parent group + subgroup for one tab, from URL/title.
 * @param {string} url
 * @param {string} [title]
 * @returns {{ parent: string, sub: string|null, site: string }|null}
 *          site is the short site name (docs.stripe.com → stripe)
 */
export function classifyTab(url, title = '') {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname || '/';
  const parts = path.split('/').filter(Boolean);
  const site = siteName(host);
  const r = (parent, sub = null) => ({ parent, sub, site });

  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
    return { parent: 'Local', sub: u.port ? `:${u.port}` : null, site: 'localhost' };
  }

  if (host === 'github.com') {
    // /owner/repo[/pull|issues|actions…] → repo; /pulls, /settings/…, /orgs/… → no sub
    const isRepo = parts.length >= 2 && !GITHUB_NON_REPO.has(parts[0]);
    return r('GitHub', isRepo ? parts[1] : null);
  }
  if (host === 'gist.github.com') return r('GitHub', 'gist');
  if (host.includes('gitlab.')) {
    const dash = parts.indexOf('-');
    const project = (dash === -1 ? parts : parts.slice(0, dash));
    return r('GitLab', project.length >= 2 ? project[project.length - 1] : null);
  }

  if (host.includes('circleci.com')) return r('CI / Deploy', 'CircleCI');
  if (host.includes('argocd') || host.includes('argo-cd') || /^Argo CD\b/.test(title)) {
    return r('CI / Deploy', 'Argo CD');
  }
  if (host.includes('jenkins')) return r('CI / Deploy', 'Jenkins');
  if (host.includes('buildkite.com')) return r('CI / Deploy', 'Buildkite');
  if (host === 'vercel.com') return r('CI / Deploy', 'Vercel');
  if (host === 'app.netlify.com') return r('CI / Deploy', 'Netlify');

  if (host === 'chatgpt.com' || host === 'chat.openai.com') return r('AI', 'ChatGPT');
  if (host === 'claude.ai') return r('AI', 'Claude');
  if (host === 'gemini.google.com') return r('AI', 'Gemini');
  if (host.includes('perplexity.ai')) return r('AI', 'Perplexity');

  if (host === 'app.slack.com' || host.endsWith('.slack.com')) return r('Chat', 'Slack');
  if (host === 'discord.com' || host === 'discordapp.com') return r('Chat', 'Discord');
  if (host === 'linear.app') return r('Tracker', 'Linear');
  if (host.includes('atlassian.net') || host.startsWith('jira.')) return r('Tracker', 'Jira');

  if (host.includes('console.aws.amazon.com')) return r('Cloud', 'AWS');
  if (host.includes('console.cloud.google.com')) return r('Cloud', 'GCP');
  if (host.includes('portal.azure.com')) return r('Cloud', 'Azure');

  if (host === 'youtube.com' || host === 'youtu.be') return r('Media', 'YouTube');
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) return r('Media', 'Reddit');
  if (host === 'x.com' || host === 'twitter.com') return r('Media', 'X');
  if (host === 'twitch.tv') return r('Media', 'Twitch');

  if (host.includes('notion.so') || host.includes('notion.site')) return r('Notion');
  if (host === 'stackoverflow.com' || host.endsWith('.stackexchange.com')) return r('Stack Overflow');

  if (host === 'docs.rs') return r('Docs', 'docs.rs');
  if (host === 'developer.mozilla.org') return r('Docs', 'MDN');
  if (host.endsWith('.readthedocs.io')) return r('Docs', host.split('.')[0]);
  if (/^(docs|developers?)\./.test(host) || parts[0] === 'docs') return r('Docs', site);

  // Unknown site: group by registrable domain, subdomain (or product-area path) as subgroup
  const domain = registrableDomain(host);
  const subdomain = host === domain ? '' : host.slice(0, -domain.length - 1).split('.')[0];
  if (subdomain) return { parent: domain, sub: subdomain, site };
  if (parts[0] && /^(blog|app|dashboard|console|admin)$/i.test(parts[0])) {
    return { parent: domain, sub: parts[0].toLowerCase(), site };
  }
  return { parent: domain, sub: null, site };
}

/**
 * Subgroup for a tab once its parent is decided. Only when Jev agreed with the URL's
 * parent — custom groups, user-made groups, and Unsorted keep plain titles.
 * @param {{ url?: string, title?: string }} tab
 * @param {string} parent chosen parent group
 * @param {Set<string>} customSet user-defined groups (no subgroups)
 * @returns {string|null}
 */
export function subForParent(tab, parent, customSet) {
  if (!tab?.url || parent === UNSORTED_TITLE || customSet.has(parent)) return null;
  const info = classifyTab(tab.url, tab.title || '');
  if (!info) return null;
  return info.parent === parent ? info.sub : null;
}

/**
 * Whether this extension owns the group's title (so it may rewrite the subgroup list).
 * @param {string} parent
 */
export function isManagedParent(parent) {
  return parent in PARENT_DESCRIPTIONS || (parent.includes('.') && !parent.includes(' '));
}

/**
 * @param {string} groupTitle e.g. "GitHub · backend, hyperswitch"
 * @returns {string} "GitHub"
 */
export function parentOfGroupTitle(groupTitle) {
  const i = String(groupTitle).indexOf(SUB_SEP);
  return i === -1 ? String(groupTitle) : String(groupTitle).slice(0, i);
}

/**
 * Subgroups ordered largest first, ties by name. Nulls are ignored.
 * @param {Array<string|null>} subs one entry per tab
 * @returns {string[]}
 */
export function rankSubs(subs) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const s of subs) if (s) counts.set(s, (counts.get(s) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s);
}

/**
 * @param {string} parent
 * @param {Array<string|null>} subs one entry per tab in the group
 * @returns {string} "Docs · stripe, hyperswitch" or "GitHub · a, b, c +2"
 */
export function formatGroupTitle(parent, subs) {
  const ranked = rankSubs(subs);
  if (!ranked.length) return parent;
  const shown = ranked.slice(0, MAX_SUBS_IN_TITLE).join(', ');
  const extra = ranked.length - MAX_SUBS_IN_TITLE;
  return `${parent}${SUB_SEP}${shown}${extra > 0 ? ` +${extra}` : ''}`;
}

/**
 * Build candidate parent-group labels for a window of tabs.
 * @param {Array<{ url?: string, title?: string }>} tabs
 * @param {string[]} [existingGroupTitles]
 * @param {number} [maxCandidates]
 * @param {string[]} [customGroups] user-defined groups (always included when possible)
 * @returns {{ titles: string[], criteria: Record<string, string>, slugToTitle: Record<string, string>, titleToSlug: Record<string, string> }}
 */
export function buildCandidates(
  tabs,
  existingGroupTitles = [],
  maxCandidates = 18,
  customGroups = [],
) {
  /** @type {Map<string, number>} */
  const scores = new Map();
  /** @type {Map<string, Array<string|null>>} parent -> subs seen in this window */
  const subsByParent = new Map();

  const bump = (title, weight = 1) => {
    if (!title || title === UNSORTED_TITLE) return;
    const cleaned = String(title).trim().slice(0, 48);
    if (!cleaned) return;
    scores.set(cleaned, (scores.get(cleaned) || 0) + weight);
  };

  // User custom groups — highest priority so they always survive the cap
  for (const t of customGroups) bump(t, 100);

  for (const tab of tabs) {
    if (!tab?.url) continue;
    const info = classifyTab(tab.url, tab.title || '');
    if (!info) continue;
    bump(info.parent, 1);
    const list = subsByParent.get(info.parent) || [];
    list.push(info.sub);
    subsByParent.set(info.parent, list);
  }

  // Existing groups: keep user-made ones (e.g. "Research"), skip legacy flat labels/hosts
  for (const t of existingGroupTitles) {
    if (!t) continue;
    const parent = parentOfGroupTitle(t).trim();
    if (!parent || parent === UNSORTED_TITLE) continue;
    const fromTabs = subsByParent.has(parent);
    const legacy = LEGACY_LABELS.has(parent) || /^Local :\d+$/.test(parent) || parent.includes('.');
    if (fromTabs || !legacy) bump(parent, 3);
  }

  const customSet = new Set(
    customGroups.map((t) => String(t).trim().slice(0, 48)).filter(Boolean),
  );

  // Prefer: all custom groups first, then other high-scoring labels
  const customRanked = [...customSet];
  const autoRanked = [...scores.entries()]
    .filter(([title]) => !customSet.has(title))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([title]) => title);

  const room = Math.max(0, maxCandidates - 1 - customRanked.length);
  const ranked = [...customRanked, ...autoRanked.slice(0, room)];

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
    let i = 2;
    while (slugToTitle[slug] && slugToTitle[slug] !== title) {
      slug = `${slugify(title)}_${i++}`;
    }
    slugToTitle[slug] = title;
    titleToSlug[title] = slug;
    criteria[slug] = describeParent(title, customSet.has(title), subsByParent.get(title) || []);
  }

  return { titles: ranked, criteria, slugToTitle, titleToSlug };
}

function describeParent(title, isCustom, subs) {
  if (title === UNSORTED_TITLE) return 'Does not clearly belong with any other open-tab group';
  if (isCustom) return `User-defined group “${title}” — prefer when the tab matches this label`;
  const base = PARENT_DESCRIPTIONS[title] || `Tabs for ${title} (same site, product, or task)`;
  const examples = rankSubs(subs).slice(0, 5);
  return examples.length ? `${base} — open here: ${examples.join(', ')}` : base;
}

/**
 * Stable Chrome tabGroups color from a parent name (fixed for well-known parents).
 * @param {string} title
 * @returns {chrome.tabGroups.ColorEnum}
 */
export function colorForTitle(title) {
  if (title === UNSORTED_TITLE) return 'grey';
  if (PARENT_COLORS[title]) return PARENT_COLORS[title];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
