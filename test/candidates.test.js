import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTab,
  buildCandidates,
  formatGroupTitle,
  parentOfGroupTitle,
  subForParent,
  colorForTitle,
  UNSORTED_TITLE,
} from '../lib/candidates.js';

test('GitHub repo, PR, issues and actions share the repo subgroup', () => {
  for (const path of [
    '/dodopayments/backend',
    '/dodopayments/backend/pull/42',
    '/dodopayments/backend/issues',
    '/dodopayments/backend/actions/runs/1',
  ]) {
    assert.deepEqual(
      pick(classifyTab(`https://github.com${path}`)),
      { parent: 'GitHub', sub: 'backend' },
      path,
    );
  }
  assert.deepEqual(pick(classifyTab('https://github.com/pulls')), { parent: 'GitHub', sub: null });
  assert.deepEqual(pick(classifyTab('https://github.com/settings/tokens')), { parent: 'GitHub', sub: null });
  assert.deepEqual(pick(classifyTab('https://github.com/orgs/dodo/teams')), { parent: 'GitHub', sub: null });
});

test('docs sites become Docs subgroups', () => {
  assert.deepEqual(pick(classifyTab('https://docs.stripe.com/payments')), { parent: 'Docs', sub: 'stripe' });
  assert.deepEqual(pick(classifyTab('https://docs.hyperswitch.io/x')), { parent: 'Docs', sub: 'hyperswitch' });
  assert.deepEqual(pick(classifyTab('https://docs.rs/tokio')), { parent: 'Docs', sub: 'docs.rs' });
});

test('CI, AI and local tabs', () => {
  assert.deepEqual(pick(classifyTab('https://app.circleci.com/pipelines/gh/x')), {
    parent: 'CI / Deploy',
    sub: 'CircleCI',
  });
  assert.deepEqual(pick(classifyTab('https://argocd.internal.dodo.dev/applications', 'Argo CD')), {
    parent: 'CI / Deploy',
    sub: 'Argo CD',
  });
  assert.deepEqual(pick(classifyTab('https://chatgpt.com/c/123')), { parent: 'AI', sub: 'ChatGPT' });
  assert.deepEqual(pick(classifyTab('http://localhost:3000/')), { parent: 'Local', sub: ':3000' });
});

test('unknown sites group by registrable domain with subdomain as subgroup', () => {
  assert.deepEqual(pick(classifyTab('https://console.typesafe.ai/usage')), { parent: 'typesafe.ai', sub: 'console' });
  assert.deepEqual(pick(classifyTab('https://typesafe.ai/blog/jev')), { parent: 'typesafe.ai', sub: 'blog' });
  assert.deepEqual(pick(classifyTab('https://www.bbc.co.uk/news')), { parent: 'bbc.co.uk', sub: null });
});

test('chrome pages and junk are skipped', () => {
  assert.equal(classifyTab('chrome://extensions'), null);
  assert.equal(classifyTab('not a url'), null);
});

test('formatGroupTitle lists largest subgroups first and caps at 3', () => {
  assert.equal(formatGroupTitle('Docs', []), 'Docs');
  assert.equal(formatGroupTitle('Docs', ['stripe', 'hyperswitch', 'stripe']), 'Docs · stripe, hyperswitch');
  assert.equal(formatGroupTitle('GitHub', ['a', 'b', 'c', 'd', 'e', 'a', null]), 'GitHub · a, b, c +2');
});

test('parentOfGroupTitle strips the subgroup list', () => {
  assert.equal(parentOfGroupTitle('GitHub · backend, hyperswitch'), 'GitHub');
  assert.equal(parentOfGroupTitle('Work'), 'Work');
});

test('buildCandidates proposes parents, keeps customs, ignores legacy flat groups', () => {
  const tabs = [
    { url: 'https://github.com/a/backend' },
    { url: 'https://github.com/a/hyperswitch/pull/1' },
    { url: 'https://docs.stripe.com/x' },
  ];
  const c = buildCandidates(
    tabs,
    ['GitHub PRs · backend', 'app.circleci.com', 'Research', 'Docs · stripe'],
    18,
    ['Work'],
  );
  assert.deepEqual(c.titles.slice().sort(), ['Docs', 'GitHub', 'Research', UNSORTED_TITLE, 'Work'].sort());
  assert.match(c.criteria[c.titleToSlug.GitHub], /backend/);
});

test('subForParent', () => {
  const tab = { url: 'https://docs.stripe.com/x' };
  const customs = new Set(['Work']);
  assert.equal(subForParent(tab, 'Docs', customs), 'stripe');
  assert.equal(subForParent(tab, 'Work', customs), null);
  assert.equal(subForParent(tab, UNSORTED_TITLE, customs), null);
  // Jev picked a different parent (e.g. a user-made group) → no subgroup
  assert.equal(subForParent(tab, 'Research', customs), null);
});

test('well-known parents get distinct fixed colors; grey only for Unsorted', () => {
  assert.equal(colorForTitle(UNSORTED_TITLE), 'grey');
  const known = ['GitHub', 'Docs', 'CI / Deploy', 'AI'].map(colorForTitle);
  assert.equal(new Set(known).size, known.length);
  for (const t of ['typesafe.ai', 'Work', 'Research']) assert.notEqual(colorForTitle(t), 'grey');
});

function pick(info) {
  return info && { parent: info.parent, sub: info.sub };
}
