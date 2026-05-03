#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createSearxngAdapter } from "./adapters/searxng.js";
import { createBraveAdapter } from "./adapters/brave.js";
import { createExaAdapter } from "./adapters/exa.js";
import { createSerperAdapter } from "./adapters/serper.js";
import { mergeResults } from "./merge.js";
import type { EngineAdapter } from "./types.js";

function loadAdapters(): EngineAdapter[] {
  const adapters: EngineAdapter[] = [];
  const missing: string[] = [];

  if (process.env.SEARXNG_URL) {
    adapters.push(createSearxngAdapter(process.env.SEARXNG_URL));
  } else {
    missing.push("SEARXNG_URL");
  }
  if (process.env.BRAVE_API_KEY) {
    adapters.push(createBraveAdapter(process.env.BRAVE_API_KEY));
  } else {
    missing.push("BRAVE_API_KEY");
  }
  if (process.env.EXA_API_KEY) {
    adapters.push(createExaAdapter(process.env.EXA_API_KEY));
  } else {
    missing.push("EXA_API_KEY");
  }
  if (process.env.SERPER_API_KEY) {
    adapters.push(createSerperAdapter(process.env.SERPER_API_KEY));
  } else {
    missing.push("SERPER_API_KEY");
  }

  if (adapters.length === 0) {
    console.error(
      `WARNING: No search engine adapters configured. Set one or more of: ${missing.join(", ")}`
    );
    console.error(
      `WARNING: Alternatively, set ALLOW_NO_ENGINES to suppress this warning.`
    );
  }

  return adapters;
}

async function main() {
  const adapters = loadAdapters();

  const server = new McpServer({
    name: "search-aggregate",
    version: "1.0.0",
  });

  server.tool(
    "aggregated_search",
    "Search multiple engines in parallel and return merged results",
    {
      query: z.string().describe("Search query"),
      numResults: z.number().optional().default(10).describe("Max results to return"),
    },
    async ({ query, numResults }) => {
      if (adapters.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "No search engine adapters configured. Set SEARXNG_URL, BRAVE_API_KEY, EXA_API_KEY, or SERPER_API_KEY environment variables.",
            },
          ],
        };
      }

      const settled = await Promise.allSettled(
        adapters.map((a) => a.search(query, numResults))
      );

      const successes: Parameters<typeof mergeResults>[0] = [];
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i]!;
        if (result.status === "fulfilled") {
          successes.push(result.value);
        } else {
          console.error(`Engine ${adapters[i]!.name} failed:`, result.reason);
        }
      }

      if (successes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "All search engines failed. Check server logs for details.",
            },
          ],
        };
      }

      const merged = mergeResults(successes, numResults);
      const text = merged
        .map((r) => `## [${r.title}](${r.url})\n\n${r.snippet}`)
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`search-aggregate MCP server running with ${adapters.length} adapter(s)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
