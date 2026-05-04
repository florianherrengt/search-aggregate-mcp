import type { EngineAdapter, Result } from "../types.js";

export function createBingAdapter(apiKey: string): EngineAdapter {
  return {
    name: "Bing",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const url = new URL("https://api.bing.microsoft.com/v7.0/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(numResults));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(url.toString(), {
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Bing search failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          webPages?: {
            value?: { url?: string; name?: string; snippet?: string }[];
          };
        };

        return (data.webPages?.value ?? []).map((r) => ({
          url: r.url ?? "",
          title: r.name ?? "",
          snippet: r.snippet ?? "",
        }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
