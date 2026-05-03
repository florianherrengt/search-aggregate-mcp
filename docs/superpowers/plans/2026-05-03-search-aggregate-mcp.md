# Search Aggregate MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone MCP server that fires all available search engines (SearXNG, Brave, Exa, Serper) in parallel, deduplicates results by URL, and returns a frequency-ranked result list.

**Architecture:** Each engine has an adapter module exporting an async function. The main server registers an `aggregated_search` MCP tool that fires all enabled adapters via `Promise.allSettled`, merges results by normalized URL, sorts by frequency/position, and returns markdown-formatted output.

**Tech Stack:** TypeScript (ES2022, NodeNext modules), `@modelcontextprotocol/sdk` v1.x, `zod` v4, `node:fetch` (Node 18+). Zero runtime deps beyond MCP SDK and zod.

---

## File Structure

| File | Purpose |
|------|---------|
| `package.json` | Package config, scripts, deps |
| `tsconfig.json` | TypeScript config |
| `src/types.ts` | Shared types: `Result`, `MergedResult`, `EngineAdapter` |
| `src/adapters/searxng.ts` | SearXNG adapter |
| `src/adapters/brave.ts` | Brave Search adapter |
| `src/adapters/exa.ts` | Exa adapter |
| `src/adapters/serper.ts` | Serper (Google) adapter |
| `src/merge.ts` | URL normalization + dedup + merge algorithm |
| `src/index.ts` | MCP server setup, adapter init, tool registration |
| `src/__tests__/merge.test.ts` | Tests for merge algorithm |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "search-aggregate-mcp",
  "version": "1.0.0",
  "description": "MCP server that fires multiple search engines in parallel and merges results by frequency",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "search-aggregate-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "node --experimental-vm-modules node_modules/.bin/vitest run",
    "test:watch": "node --experimental-vm-modules node_modules/.bin/vitest"
  },
  "keywords": ["mcp", "search", "aggregate"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: dependencies installed, `node_modules` created

- [ ] **Step 4: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold project with package.json and tsconfig"
```

---

### Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface Result {
  url: string;
  title: string;
  snippet: string;
}

export interface MergedResult {
  url: string;
  title: string;
  snippet: string;
  frequency: number;
  bestPosition: number;
}

export interface EngineAdapter {
  name: string;
  search: (query: string, numResults: number) => Promise<Result[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts && git commit -m "feat: add shared types"
```

---

### Task 3: Merge Algorithm (TDD)

**Files:**
- Create: `src/merge.ts`
- Create: `src/__tests__/merge.test.ts`

- [ ] **Step 1: Create `src/__tests__/merge.test.ts` with failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { mergeResults, normalizeUrl } from "../merge.js";
import type { Result } from "../types.js";

describe("normalizeUrl", () => {
  it("lowercases hostname", () => {
    expect(normalizeUrl("https://Example.COM/Path")).toBe(
      "https://example.com/Path"
    );
  });

  it("strips trailing slash", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path"
    );
  });

  it("strips tracking params", () => {
    expect(
      normalizeUrl("https://example.com/page?utm_source=twitter&id=5")
    ).toBe("https://example.com/page?id=5");
  });

  it("strips all known tracking params", () => {
    const url =
      "https://example.com/page?utm_source=x&utm_medium=y&utm_campaign=z&fbclid=abc&gclid=def&keep=1";
    expect(normalizeUrl(url)).toBe("https://example.com/page?keep=1");
  });

  it("handles root path without trailing slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("strips hash fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page"
    );
  });
});

describe("mergeResults", () => {
  it("merges results from multiple engines by URL", () => {
    const engineA: Result[] = [
      { url: "https://example.com/a", title: "A", snippet: "from A" },
      { url: "https://example.com/b", title: "B", snippet: "from A" },
    ];
    const engineB: Result[] = [
      { url: "https://example.com/a", title: "A long", snippet: "from B" },
      { url: "https://example.com/c", title: "C", snippet: "from B" },
    ];

    const merged = mergeResults([engineA, engineB], 10);

    expect(merged[0].url).toBe("https://example.com/a");
    expect(merged[0].frequency).toBe(2);
    expect(merged[0].title).toBe("A long");
    expect(merged[0].snippet).toBe("from B");
  });

  it("ranks by frequency desc then bestPosition asc", () => {
    const engineA: Result[] = [
      { url: "https://a.com", title: "A", snippet: "s" },
      { url: "https://b.com", title: "B", snippet: "s" },
      { url: "https://c.com", title: "C", snippet: "s" },
    ];
    const engineB: Result[] = [
      { url: "https://b.com", title: "B", snippet: "s" },
      { url: "https://a.com", title: "A", snippet: "s" },
      { url: "https://d.com", title: "D", snippet: "s" },
    ];

    const merged = mergeResults([engineA, engineB], 10);

    expect(merged.map((r) => new URL(r.url).hostname)).toEqual([
      "a.com",
      "b.com",
      "c.com",
      "d.com",
    ]);
  });

  it("respects numResults limit", () => {
    const engineA: Result[] = Array.from({ length: 20 }, (_, i) => ({
      url: `https://example.com/${i}`,
      title: `Result ${i}`,
      snippet: `snippet ${i}`,
    }));

    const merged = mergeResults([engineA], 5);
    expect(merged).toHaveLength(5);
  });

  it("handles empty engine results", () => {
    const merged = mergeResults([[], [], []], 10);
    expect(merged).toEqual([]);
  });

  it("keeps longest snippet when merging", () => {
    const engineA: Result[] = [
      { url: "https://example.com", title: "T", snippet: "short" },
    ];
    const engineB: Result[] = [
      {
        url: "https://example.com",
        title: "T",
        snippet: "this is a much longer snippet",
      },
    ];

    const merged = mergeResults([engineA, engineB], 10);
    expect(merged[0].snippet).toBe("this is a much longer snippet");
  });

  it("handles empty input (no engines)", () => {
    const merged = mergeResults([], 10);
    expect(merged).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `merge` module does not exist

- [ ] **Step 3: Create `src/merge.ts`**

```typescript
import type { Result, MergedResult } from "./types.js";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_eid",
]);

export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  const params = url.searchParams;
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key)) {
      params.delete(key);
    }
  }

  let href = url.toString();
  if (href.endsWith("/")) {
    href = href.slice(0, -1);
  }
  return href;
}

export function mergeResults(
  engineResults: Result[][],
  numResults: number
): MergedResult[] {
  const map = new Map<
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
    for (let pos = 0; pos < results.length; pos++) {
      const r = results[pos];
      const key = normalizeUrl(r.url);

      const existing = map.get(key);
      if (existing) {
        existing.frequency += 1;
        if (pos + 1 < existing.bestPosition) {
          existing.bestPosition = pos + 1;
        }
        if (r.title.length > existing.title.length) {
          existing.title = r.title;
        }
        if (r.snippet.length > existing.snippet.length) {
          existing.snippet = r.snippet;
        }
      } else {
        map.set(key, {
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          frequency: 1,
          bestPosition: pos + 1,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.bestPosition - b.bestPosition;
    })
    .slice(0, numResults);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/merge.ts src/__tests__/merge.test.ts && git commit -m "feat: add merge algorithm with URL dedup and frequency ranking"
```

---

### Task 4: SearXNG Adapter

**Files:**
- Create: `src/adapters/searxng.ts`

- [ ] **Step 1: Create adapter**

```typescript
import type { EngineAdapter, Result } from "../types.js";

export function createSearxngAdapter(baseUrl: string): EngineAdapter {
  return {
    name: "SearXNG",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const url = new URL("/search", baseUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("num_results", String(numResults));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`SearXNG HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          results: { url: string; title: string; content: string }[];
        };
        return (data.results ?? []).slice(0, numResults).map((r) => ({
          url: r.url,
          title: r.title ?? "",
          snippet: r.content ?? "",
        }));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/searxng.ts && git commit -m "feat: add SearXNG adapter"
```

---

### Task 5: Brave Adapter

**Files:**
- Create: `src/adapters/brave.ts`

- [ ] **Step 1: Create adapter**

```typescript
import type { EngineAdapter, Result } from "../types.js";

export function createBraveAdapter(apiKey: string): EngineAdapter {
  return {
    name: "Brave",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(numResults));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch(url.toString(), {
          headers: {
            "X-Subscription-Token": apiKey,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Brave HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          web?: {
            results?: {
              url: string;
              title: string;
              description: string;
            }[];
          };
        };
        return (data.web?.results ?? []).slice(0, numResults).map((r) => ({
          url: r.url,
          title: r.title ?? "",
          snippet: r.description ?? "",
        }));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/brave.ts && git commit -m "feat: add Brave Search adapter"
```

---

### Task 6: Exa Adapter

**Files:**
- Create: `src/adapters/exa.ts`

- [ ] **Step 1: Create adapter**

```typescript
import type { EngineAdapter, Result } from "../types.js";

export function createExaAdapter(apiKey: string): EngineAdapter {
  return {
    name: "Exa",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch("https://api.exa.ai/search", {
          method: "POST",
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
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Exa HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          results: {
            url: string;
            title: string;
            text?: string;
            highlight?: string;
          }[];
        };
        return (data.results ?? []).slice(0, numResults).map((r) => ({
          url: r.url,
          title: r.title ?? "",
          snippet: r.highlight ?? r.text ?? "",
        }));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/exa.ts && git commit -m "feat: add Exa adapter"
```

---

### Task 7: Serper Adapter

**Files:**
- Create: `src/adapters/serper.ts`

- [ ] **Step 1: Create adapter**

```typescript
import type { EngineAdapter, Result } from "../types.js";

export function createSerperAdapter(apiKey: string): EngineAdapter {
  return {
    name: "Serper",
    search: async (query: string, numResults: number): Promise<Result[]> => {
      const url = new URL("https://google.serper.dev/search");
      url.searchParams.set("q", query);
      url.searchParams.set("num", String(numResults));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch(url.toString(), {
          headers: {
            "X-API-KEY": apiKey,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Serper HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          organic?: {
            link: string;
            title: string;
            snippet: string;
          }[];
        };
        return (data.organic ?? []).slice(0, numResults).map((r) => ({
          url: r.link,
          title: r.title ?? "",
          snippet: r.snippet ?? "",
        }));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/serper.ts && git commit -m "feat: add Serper adapter"
```

---

### Task 8: MCP Server (index.ts)

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mergeResults } from "./merge.js";
import { createSearxngAdapter } from "./adapters/searxng.js";
import { createBraveAdapter } from "./adapters/brave.js";
import { createExaAdapter } from "./adapters/exa.js";
import { createSerperAdapter } from "./adapters/serper.js";
import type { EngineAdapter } from "./types.js";

function loadAdapters(): EngineAdapter[] {
  const adapters: EngineAdapter[] = [];

  const searxngUrl = process.env.SEARXNG_URL;
  if (searxngUrl) {
    adapters.push(createSearxngAdapter(searxngUrl));
  }

  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    adapters.push(createBraveAdapter(braveKey));
  }

  const exaKey = process.env.EXA_API_KEY;
  if (exaKey) {
    adapters.push(createExaAdapter(exaKey));
  }

  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    adapters.push(createSerperAdapter(serperKey));
  }

  return adapters;
}

async function main() {
  const adapters = loadAdapters();

  if (adapters.length === 0) {
    console.error(
      "WARNING: No search engines configured. Set at least one of: SEARXNG_URL, BRAVE_API_KEY, EXA_API_KEY, SERPER_API_KEY"
    );
  }

  console.error(
    `Enabled engines: ${adapters.map((a) => a.name).join(", ") || "none"}`
  );

  const server = new McpServer({
    name: "search-aggregate",
    version: "1.0.0",
  });

  server.tool(
    "aggregated_search",
    "Search multiple engines in parallel and return deduplicated, frequency-ranked results",
    {
      query: z.string().describe("Search query"),
      numResults: z
        .number()
        .optional()
        .default(10)
        .describe("Max results to return"),
    },
    async ({ query, numResults }) => {
      if (adapters.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No search engines configured. Set at least one of: SEARXNG_URL, BRAVE_API_KEY, EXA_API_KEY, SERPER_API_KEY",
            },
          ],
          isError: true,
        };
      }

      const settled = await Promise.allSettled(
        adapters.map((a) => a.search(query, numResults))
      );

      const successes: Array<import("./types.js").Result[]> = [];
      for (let i = 0; i < settled.length; i++) {
        const result = settled[i];
        if (result.status === "fulfilled") {
          successes.push(result.value);
        } else {
          console.error(
            `${adapters[i].name} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
          );
        }
      }

      if (successes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "All search engines failed. Please check your API keys and network connectivity.",
            },
          ],
        };
      }

      const merged = mergeResults(successes, numResults ?? 10);

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
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts && git commit -m "feat: add MCP server with aggregated_search tool"
```

---

### Task 9: Build & Smoke Test

**Files:**
- Modify: none

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: `dist/` created with compiled JS

- [ ] **Step 2: Smoke test with no env vars (graceful error)**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js 2>/dev/null | head -1`
Expected: JSON response with server info

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: Commit build artifacts check**

Run: `echo 'dist/\nnode_modules/' > .gitignore && git add .gitignore && git commit -m "chore: add .gitignore"`
