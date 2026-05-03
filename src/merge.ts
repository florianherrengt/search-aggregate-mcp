import type { Result, MergedResult } from './types.js';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_eid',
]);

export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  const toDelete: string[] = [];
  url.searchParams.forEach((_, key) => {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      toDelete.push(key);
    }
  });
  for (const key of toDelete) {
    url.searchParams.delete(key);
  }

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname;

  return url.toString();
}

export function mergeResults(
  engineResults: Result[][],
  numResults: number,
): MergedResult[] {
  const groups = new Map<
    string,
    {
      url: string;
      title: string;
      snippet: string;
      frequency: number;
      bestPosition: number;
    }
  >();

  for (const results of engineResults) {
    const engineSeen = new Set<string>();
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const normalizedUrl = normalizeUrl(result.url);

      if (engineSeen.has(normalizedUrl)) continue;
      engineSeen.add(normalizedUrl);

      const position = i + 1;
      const existing = groups.get(normalizedUrl);

      if (existing) {
        existing.frequency += 1;
        if (position < existing.bestPosition) {
          existing.bestPosition = position;
        }
        if (result.title.length > existing.title.length) {
          existing.title = result.title;
        }
        if (result.snippet.length > existing.snippet.length) {
          existing.snippet = result.snippet;
        }
      } else {
        groups.set(normalizedUrl, {
          url: result.url,
          title: result.title,
          snippet: result.snippet,
          frequency: 1,
          bestPosition: position,
        });
      }
    }
  }

  const merged = Array.from(groups.values());

  merged.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.bestPosition - b.bestPosition;
  });

  return merged.slice(0, numResults);
}
