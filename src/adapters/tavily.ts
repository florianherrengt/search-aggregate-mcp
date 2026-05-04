import type { EngineAdapter, Result } from "../types.js";

export function createTavilyAdapter(apiKey: string): EngineAdapter {
  return {
    name: "Tavily",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: numResults,
            search_depth: "basic",
          }),
        });

        if (!response.ok) {
          throw new Error(`Tavily search failed with status ${response.status}`);
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
