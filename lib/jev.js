const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/**
 * Ask Jev to pick a group among dynamic candidates.
 * @param {{
 *   apiKey: string,
 *   url: string,
 *   title: string,
 *   criteria: Record<string, string>,
 *   slugToTitle: Record<string, string>,
 *   siblingTabs?: Array<{ url: string, title: string }>
 * }} args
 * @returns {Promise<{ category: string, confidence: number, model: string, usage: object }>}
 *          category is the human group title
 */
export async function classifyWithJev({
  apiKey,
  url,
  title,
  criteria,
  slugToTitle,
  siblingTabs = [],
}) {
  if (!apiKey) {
    throw new Error('Missing TypeSafe API key. Open extension Settings and paste TYPESAFE_API_KEY.');
  }
  if (!criteria || !Object.keys(criteria).length) {
    throw new Error('No group candidates to choose from');
  }

  const body = {
    model: 'jev-latest',
    state: {
      url,
      title: title || '',
      other_open_tabs: siblingTabs.slice(0, 30).map((t) => ({
        url: t.url,
        title: t.title || '',
      })),
      available_groups: Object.values(slugToTitle),
      hint: 'Pick the single best top-level tab group for this tab so related work sits together. Groups are broad (GitHub, Docs, CI / Deploy, AI, a site, or a user-defined group); finer subgroups are handled separately.',
    },
    questions: {
      group: {
        type: 'choice',
        instructions:
          'Which tab group should this browser tab join? Choose the most accurate group among the options; prefer a user-defined group when the tab clearly fits it. Use Unsorted only when nothing else fits.',
        criteria,
      },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jev API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data.answers?.group;
  if (!answer?.choice) {
    throw new Error('Jev returned no group choice');
  }

  const humanTitle = slugToTitle[answer.choice] || answer.choice;

  return {
    category: humanTitle,
    confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
    model: data.model || 'jev-latest',
    usage: data.usage || {},
  };
}
