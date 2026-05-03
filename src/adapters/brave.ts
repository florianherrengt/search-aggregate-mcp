import type { EngineAdapter, Result } from "../types.js";

export function createBraveAdapter(apiKey: string): EngineAdapter {
  return {
    name: "brave",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "X-Subscription-Token": apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`Brave search failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          web?: { results?: { url?: string; title?: string; description?: string }[] };
        };

        return (data.web?.results ?? []).map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          snippet: r.description ?? "",
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
