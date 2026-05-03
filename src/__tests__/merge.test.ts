import { describe, it, expect } from 'vitest';
import { normalizeUrl, mergeResults } from '../merge.js';
import type { Result, MergedResult } from '../types.js';

describe('normalizeUrl', () => {
  it('lowercases hostname', () => {
    expect(normalizeUrl('https://Example.COM/Path')).toBe('https://example.com/Path');
  });

  it('strips trailing slash', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
  });

  it('strips utm_source', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=twitter')).toBe('https://example.com/page');
  });

  it('strips utm_medium', () => {
    expect(normalizeUrl('https://example.com/page?utm_medium=email')).toBe('https://example.com/page');
  });

  it('strips utm_campaign', () => {
    expect(normalizeUrl('https://example.com/page?utm_campaign=launch')).toBe('https://example.com/page');
  });

  it('strips utm_term', () => {
    expect(normalizeUrl('https://example.com/page?utm_term=keyword')).toBe('https://example.com/page');
  });

  it('strips utm_content', () => {
    expect(normalizeUrl('https://example.com/page?utm_content=banner')).toBe('https://example.com/page');
  });

  it('strips fbclid', () => {
    expect(normalizeUrl('https://example.com/page?fbclid=abc123')).toBe('https://example.com/page');
  });

  it('strips gclid', () => {
    expect(normalizeUrl('https://example.com/page?gclid=abc123')).toBe('https://example.com/page');
  });

  it('strips gclsrc', () => {
    expect(normalizeUrl('https://example.com/page?gclsrc=aw.ds')).toBe('https://example.com/page');
  });

  it('strips dclid', () => {
    expect(normalizeUrl('https://example.com/page?dclid=abc123')).toBe('https://example.com/page');
  });

  it('strips msclkid', () => {
    expect(normalizeUrl('https://example.com/page?msclkid=abc123')).toBe('https://example.com/page');
  });

  it('strips mc_eid', () => {
    expect(normalizeUrl('https://example.com/page?mc_eid=abc123')).toBe('https://example.com/page');
  });

  it('strips all tracking params together', () => {
    expect(
      normalizeUrl(
        'https://example.com/page?utm_source=twitter&fbclid=abc&gclid=xyz&utm_campaign=launch',
      ),
    ).toBe('https://example.com/page');
  });

  it('keeps non-tracking query params', () => {
    expect(normalizeUrl('https://example.com/page?q=search&sort=asc&page=2')).toBe(
      'https://example.com/page?q=search&sort=asc&page=2',
    );
  });

  it('keeps non-tracking params while stripping tracking params', () => {
    expect(
      normalizeUrl(
        'https://example.com/page?q=search&utm_source=twitter&sort=asc&fbclid=abc',
      ),
    ).toBe('https://example.com/page?q=search&sort=asc');
  });

  it('strips hash fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe(
      'https://example.com/page',
    );
  });

  it('strips hash fragment with query params', () => {
    expect(normalizeUrl('https://example.com/page?q=search#section')).toBe(
      'https://example.com/page?q=search',
    );
  });

  it('strips both tracking params and hash fragment', () => {
    expect(
      normalizeUrl('https://Example.com/Page/?utm_source=twitter&q=search#section'),
    ).toBe('https://example.com/Page?q=search');
  });

  it('preserves root path', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('handles tracking params case-insensitively', () => {
    expect(normalizeUrl('https://example.com/page?UTM_SOURCE=twitter')).toBe(
      'https://example.com/page',
    );
  });
});

describe('mergeResults', () => {
  it('merges results from multiple engines', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A1', snippet: 'Snippet A1' },
        { url: 'https://b.com/1', title: 'B1', snippet: 'Snippet B1' },
      ],
      [
        { url: 'https://a.com/1', title: 'A1 longer', snippet: 'Snippet A1 longer' },
        { url: 'https://b.com/1', title: 'B1', snippet: 'Snippet B1' },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.url).toBe('https://a.com/1');
    expect(merged[0]!.frequency).toBe(2);
    expect(merged[0]!.title).toBe('A1 longer');
    expect(merged[0]!.snippet).toBe('Snippet A1 longer');
    expect(merged[1]!.url).toBe('https://b.com/1');
    expect(merged[1]!.frequency).toBe(2);
  });

  it('ranks by frequency descending', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'Common', snippet: 'Seen in all' },
        { url: 'https://b.com/1', title: 'Two engines', snippet: 'Seen in 2' },
      ],
      [
        { url: 'https://a.com/1', title: 'Common', snippet: 'Seen in all' },
        { url: 'https://c.com/1', title: 'One engine', snippet: 'Seen in 1' },
      ],
      [
        { url: 'https://a.com/1', title: 'Common', snippet: 'Seen in all' },
        { url: 'https://b.com/1', title: 'Two engines', snippet: 'Seen in 2' },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged[0]!.url).toBe('https://a.com/1');
    expect(merged[0]!.frequency).toBe(3);
    expect(merged[1]!.url).toBe('https://b.com/1');
    expect(merged[1]!.frequency).toBe(2);
    expect(merged[2]!.url).toBe('https://c.com/1');
    expect(merged[2]!.frequency).toBe(1);
  });

  it('breaks ties by bestPosition ascending', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'Snippet A' },
        { url: 'https://b.com/1', title: 'B', snippet: 'Snippet B' },
      ],
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'Snippet A' },
        { url: 'https://c.com/1', title: 'C', snippet: 'Snippet C' },
      ],
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'Snippet A' },
        { url: 'https://b.com/1', title: 'B', snippet: 'Snippet B' },
        { url: 'https://c.com/1', title: 'C', snippet: 'Snippet C' },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged[0]!.url).toBe('https://a.com/1');
    expect(merged[0]!.frequency).toBe(3);
    expect(merged[1]!.url).toBe('https://b.com/1');
    expect(merged[1]!.frequency).toBe(2);
    expect(merged[2]!.url).toBe('https://c.com/1');
    expect(merged[2]!.frequency).toBe(2);
  });

  it('respects numResults limit', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A1', snippet: 'S1' },
        { url: 'https://a.com/2', title: 'A2', snippet: 'S2' },
        { url: 'https://a.com/3', title: 'A3', snippet: 'S3' },
      ],
    ];

    const merged = mergeResults(engineResults, 2);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.url).toBe('https://a.com/1');
    expect(merged[1]!.url).toBe('https://a.com/2');
  });

  it('returns empty array for empty input', () => {
    expect(mergeResults([], 10)).toEqual([]);
  });

  it('returns empty array when all engines return empty', () => {
    expect(mergeResults([[], []], 10)).toEqual([]);
  });

  it('handles single engine input', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A1', snippet: 'S1' },
        { url: 'https://a.com/2', title: 'A2', snippet: 'S2' },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.frequency).toBe(1);
    expect(merged[1]!.frequency).toBe(1);
  });

  it('deduplicates identical URLs within the same engine', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'First', snippet: 'S1' },
        { url: 'https://a.com/1', title: 'Duplicate', snippet: 'S2' },
      ],
      [
        { url: 'https://a.com/1', title: 'From Engine 2', snippet: 'S3' },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.frequency).toBe(2);
    expect(merged[0]!.title).toBe('From Engine 2');
  });

  it('deduplicates by normalized URL (tracking params)', () => {
    const engineResults: Result[][] = [
      [
        {
          url: 'https://a.com/page?utm_source=twitter&q=search',
          title: 'Page A',
          snippet: 'From twitter',
        },
      ],
      [
        {
          url: 'https://A.com/page?q=search&fbclid=abc',
          title: 'Page A by engine 2',
          snippet: 'From facebook',
        },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.frequency).toBe(2);
  });

  it('uses longest non-empty title', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'Short', snippet: 'S' },
      ],
      [
        {
          url: 'https://a.com/1',
          title: 'This is the longer title from engine 2',
          snippet: 'S',
        },
      ],
      [
        { url: 'https://a.com/1', title: 'Mid title', snippet: 'S' },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.frequency).toBe(3);
    expect(merged[0]!.title).toBe('This is the longer title from engine 2');
  });

  it('uses longest non-empty snippet', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'T', snippet: 'Short' },
      ],
      [
        {
          url: 'https://a.com/1',
          title: 'T',
          snippet: 'This is a much longer snippet with more text',
        },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.snippet).toBe('This is a much longer snippet with more text');
  });

  it('tracks bestPosition as minimum position across engines', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'S' },
        { url: 'https://a.com/2', title: 'B', snippet: 'S' },
        { url: 'https://a.com/3', title: 'C', snippet: 'S' },
        { url: 'https://a.com/4', title: 'D', snippet: 'S' },
      ],
      [
        { url: 'https://a.com/3', title: 'C', snippet: 'S' },
        { url: 'https://a.com/1', title: 'A', snippet: 'S' },
      ],
    ];

    const result = mergeResults(engineResults, 10);

    const a = result.find((r) => r.url === 'https://a.com/1')!;
    const b = result.find((r) => r.url === 'https://a.com/2')!;
    const c = result.find((r) => r.url === 'https://a.com/3')!;
    const d = result.find((r) => r.url === 'https://a.com/4')!;

    expect(a.bestPosition).toBe(1);
    expect(b.bestPosition).toBe(2);
    expect(c.bestPosition).toBe(1);
    expect(d.bestPosition).toBe(4);
  });

  it('deduplicates by normalized URL with trailing slash and tracking params', () => {
    const engineResults: Result[][] = [
      [
        {
          url: 'https://example.com/path/',
          title: 'Page',
          snippet: 'Snippet',
        },
      ],
      [
        {
          url: 'https://example.com/path?utm_source=twitter',
          title: 'Page',
          snippet: 'Snippet',
        },
      ],
      [
        {
          url: 'https://EXAMPLE.com/path?utm_source=newsletter&fbclid=xyz',
          title: 'Page',
          snippet: 'Snippet',
        },
      ],
    ];

    const merged = mergeResults(engineResults, 10);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.frequency).toBe(3);
  });

  it('returns all results when numResults exceeds available', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'S' },
        { url: 'https://b.com/1', title: 'B', snippet: 'S' },
      ],
    ];

    const merged = mergeResults(engineResults, 100);

    expect(merged).toHaveLength(2);
  });

  it('returns top numResults when there are more results available', () => {
    const engineResults: Result[][] = [
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'S' },
        { url: 'https://b.com/1', title: 'B', snippet: 'S' },
      ],
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'S' },
        { url: 'https://c.com/1', title: 'C', snippet: 'S' },
      ],
      [
        { url: 'https://a.com/1', title: 'A', snippet: 'S' },
        { url: 'https://d.com/1', title: 'D', snippet: 'S' },
      ],
    ];

    const merged = mergeResults(engineResults, 2);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.url).toBe('https://a.com/1');
    expect(merged[0]!.frequency).toBe(3);
  });
});
