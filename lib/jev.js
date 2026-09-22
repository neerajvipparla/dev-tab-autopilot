import { JEV_CRITERIA } from './categories.js';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

/**
 * Ask Jev which category a tab belongs to.
 * @param {{ apiKey: string, url: string, title: string }} args
 * @returns {Promise<{ category: string, confidence: number, model: string, usage: object }>}
 */
export async function classifyWithJev({ apiKey, url, title }) {
  if (!apiKey) {
    throw new Error('Missing TypeSafe API key. Open extension Settings and paste TYPESAFE_API_KEY.');
  }

  const body = {
    model: 'jev-latest',
    state: {
      url,
      title: title || '',
      hint: 'This is a browser tab open on a developer machine. Pick the best workspace group.',
    },
    questions: {
      category: {
        type: 'choice',
        instructions:
          'Which developer browser-tab category best fits this tab? Use the URL path as the primary signal (e.g. /pull/ → pr, /actions → ci, localhost → code).',
        criteria: JEV_CRITERIA,
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
  const answer = data.answers?.category;
  if (!answer?.choice) {
    throw new Error('Jev returned no category choice');
  }

  return {
    category: answer.choice,
    confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
    model: data.model || 'jev-latest',
    usage: data.usage || {},
  };
}
