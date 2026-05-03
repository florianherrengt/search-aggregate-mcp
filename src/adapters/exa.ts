import type { EngineAdapter, Result } from "../types.js";

export function createExaAdapter(apiKey: string): EngineAdapter {
  return {
    name: "exa",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch("https://api.exa.ai/search", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            numResults,
            type: "auto",
            contents: {
              highlights: { maxCharacters: 500 },
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Exa search failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          results?: { url?: string; title?: string; highlight?: string; text?: string }[];
        };

        return (data.results ?? []).map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          snippet: r.highlight ?? r.text ?? "",
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
