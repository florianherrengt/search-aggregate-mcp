import type { EngineAdapter, Result } from "../types.js";

export function createSearxngAdapter(baseUrl: string): EngineAdapter {
  return {
    name: "searxng",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&num_results=${numResults}`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`SearXNG search failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          results?: { url?: string; title?: string; content?: string }[];
        };

        return (data.results ?? []).map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          snippet: r.content ?? "",
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
