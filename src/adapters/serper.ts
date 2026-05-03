import type { EngineAdapter, Result } from "../types.js";

export function createSerperAdapter(apiKey: string): EngineAdapter {
  return {
    name: "serper",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        const url = `https://google.serper.dev/search?q=${encodeURIComponent(query)}&num=${numResults}`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "X-API-KEY": apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`Serper search failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          organic?: { link?: string; title?: string; snippet?: string }[];
        };

        return (data.organic ?? []).map((r) => ({
          url: r.link ?? "",
          title: r.title ?? "",
          snippet: r.snippet ?? "",
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
