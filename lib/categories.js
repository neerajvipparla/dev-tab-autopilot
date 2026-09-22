/** @typedef {'code'|'pr'|'issue'|'ci'|'docs'|'chat'|'cloud'|'learning'|'distraction'|'other'|'unsorted'} Category */

/** @type {Record<Exclude<Category, 'unsorted'>, { title: string, color: chrome.tabGroups.ColorEnum, description: string }>} */
export const CATEGORIES = {
  code: {
    title: 'Code',
    color: 'blue',
    description: 'Local servers, in-browser editors, repo code views',
  },
  pr: {
    title: 'PRs',
    color: 'purple',
    description: 'Pull requests and merge requests',
  },
  issue: {
    title: 'Issues',
    color: 'orange',
    description: 'Bug tickets and issue trackers',
  },
  ci: {
    title: 'CI',
    color: 'green',
    description: 'CI builds, Actions, pipelines, deploys',
  },
  docs: {
    title: 'Docs',
    color: 'cyan',
    description: 'Documentation and API references',
  },
  chat: {
    title: 'Chat',
    color: 'pink',
    description: 'Slack, Discord, Teams, chat apps',
  },
  cloud: {
    title: 'Cloud',
    color: 'yellow',
    description: 'Cloud consoles and deploy dashboards',
  },
  learning: {
    title: 'Learning',
    color: 'grey',
    description: 'Courses, tutorials, Stack Overflow',
  },
  distraction: {
    title: 'Distraction',
    color: 'red',
    description: 'Social, video, news, entertainment',
  },
  other: {
    title: 'Other',
    color: 'grey',
    description: 'Everything else',
  },
};

export const UNSORTED = {
  title: 'Unsorted',
  color: 'grey',
};

/** Criteria map sent to Jev choice */
export const JEV_CRITERIA = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, meta]) => [key, meta.description]),
);
