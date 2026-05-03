# search-aggregate-mcp — Design Spec

## Problem

When researching a topic, the agent has access to multiple search engines (SearXNG, Brave, Exa, Serper) but must manually choose which to call, handle failures, and mentally deduplicate results. Existing MCP servers for multi-engine search (Argus, captain-search, multi-search-mcp) either do sequential fallback or simple concatenation — none fire all engines in parallel and merge results ranked by cross-engine frequency.

## Goal

A standalone MCP server that fires all available search engines in parallel, deduplicates results by URL, and returns a single ranked list ordered by how many engines agreed a result is relevant.

## Requirements

1. **Parallel execution** — all engines fire simultaneously via `Promise.allSettled`
2. **URL dedup** — normalize URLs, merge duplicates, keep best snippet
3. **Frequency ranking** — results appearing in more engines rank higher; ties broken by best position
4. **Graceful degradation** — missing API keys = engine silently skipped; individual engine failures don't kill the query
5. **Standalone npm package** — install anywhere, configure via env vars, works with any MCP host
6. **Clean output** — each result is `{title, url, snippet}` with no engine metadata noise

## Non-requirements

- No caching (can be added later)
- No query reformulation per engine
- No content extraction (future subsystem)
- No scoring weights per engine (frequency is the signal)

## Architecture

```
┌──────────────────────────────────┐
│        MCP Server (stdio)        │
│                                  │
│  Tool: aggregated_search         │
│           │                      │
│           ├─→ SearXNG adapter    │
│           ├─→ Brave adapter      │
│           ├─→ Exa adapter        │
│           └─→ Serper adapter     │
│           │                      │
│           ▼                      │
│      Merge + Dedup               │
│      (by normalized URL)         │
│      Order: freq desc, pos asc   │
│           │                      │
│           ▼                      │
│     Unified result list          │
└──────────────────────────────────┘
```

## Tool Interface

**`aggregated_search`**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
| `numResults` | number | No | 10 | Max results to return |

Returns MCP text content — a single markdown string with results formatted as:

```markdown
## [Title](url)

Snippet text...
```

Each result block is separated by a blank line. No engine names, no scores, no metadata — just title (as a clickable link), URL, and snippet.

## Merge Algorithm

1. Fire all enabled engines in parallel with `Promise.allSettled`
2. Each engine returns up to `numResults` results normalized to `{ url, title, snippet }`
3. Normalize URLs for dedup:
   - Lowercase hostname
   - Strip trailing slash
   - Strip common tracking params (`utm_source`, `utm_medium`, `utm_campaign`, `fbclid`, `gclid`)
4. Group by normalized URL. For each unique URL:
   - `frequency` = number of engines that returned it
   - `bestPosition` = minimum 1-indexed position across engines
   - `bestSnippet` = longest non-empty snippet across engines
   - `bestTitle` = longest non-empty title across engines
5. Sort: primary by `frequency` descending, secondary by `bestPosition` ascending
6. Return top `numResults`

## Engine Adapters

Each adapter is an async function: `(query: string, numResults: number) => Promise<Result[]>`

### Availability check

At startup, check which env vars are present. Only register adapters for available engines. If zero engines are available, log a warning to stderr.

### SearXNG

| Config | Env var | Required |
|--------|---------|----------|
| Instance URL | `SEARXNG_URL` | Yes (e.g. `http://localhost:8888`) |

- API: `GET {SEARXNG_URL}/search?q={query}&format=json&num_results={numResults}`
- No API key needed
- Parse `results[].url`, `results[].title`, `results[].content`

### Brave

| Config | Env var | Required |
|--------|---------|----------|
| API key | `BRAVE_API_KEY` | Yes |

- API: `GET https://api.search.brave.com/res/v1/web/search?q={query}&count={numResults}`
- Headers: `X-Subscription-Token: {BRAVE_API_KEY}`
- Parse `web.results[].url`, `web.results[].title`, `web.results[].description`

### Exa

| Config | Env var | Required |
|--------|---------|----------|
| API key | `EXA_API_KEY` | Yes |

- API: `POST https://api.exa.ai/search`
- Headers: `x-api-key: {EXA_API_KEY}`
- Body: `{ query, numResults, type: "auto", contents: { highlights: { maxCharacters: 500 } } }`
- Parse `results[].url`, `results[].title`, `results[].text` (from highlights)

### Serper

| Config | Env var | Required |
|--------|---------|----------|
| API key | `SERPER_API_KEY` | Yes |

- API: `GET https://google.serper.dev/search?q={query}&num={numResults}`
- Headers: `X-API-KEY: {SERPER_API_KEY}`
- Parse `organic[].link`, `organic[].title`, `organic[].snippet`

## Error Handling

- **Per-engine timeout**: 10 seconds via `AbortController`
- **`Promise.allSettled`**: individual engine failures (timeout, 429, network) don't affect others
- **All engines fail**: return empty result set with a text explanation
- **No engines configured**: tool returns error message suggesting which env vars to set
- **Logging**: all logging via `console.error` — stdout is reserved for MCP JSON-RPC

## Package Structure

```
search-aggregate-mcp/
  package.json
  tsconfig.json
  src/
    index.ts            # MCP server setup, tool registration, adapter initialization
    merge.ts            # dedup + merge algorithm
    types.ts            # Result, NormalizedResult, EngineAdapter types
    adapters/
      searxng.ts
      brave.ts
      exa.ts
      serper.ts
  README.md
```

## Tech Stack

- TypeScript (`target: ES2022`, `module: NodeNext`)
- `@modelcontextprotocol/sdk` v1.x (stable) — `McpServer` + `StdioServerTransport`
- `zod` for tool input validation
- `node:fetch` (Node 18+) for HTTP — no axios, no httpx
- Runtime: `tsx` in dev, compiled JS in published package
- Zero runtime deps beyond MCP SDK and zod

## MCP Registration Example

```json
{
  "mcp": {
    "search-aggregate": {
      "command": ["npx", "-y", "search-aggregate-mcp"],
      "env": {
        "SEARXNG_URL": "http://localhost:8888",
        "BRAVE_API_KEY": "bsk_...",
        "EXA_API_KEY": "...",
        "SERPER_API_KEY": "..."
      }
    }
  }
}
```

Only engines with their required env vars present are used. No key = silently skipped.

## Future Work (out of scope for v1)

- **Content extraction fallback chain** — fire multiple extraction tools (markdownify, SearXNG reader, etc.), fallback on failure
- **Per-engine scoring weights** — weight Exa higher for research queries, Brave for news
- **Result caching** — avoid re-querying identical terms within a TTL
- **Additional engines** — Tavily, DuckDuckGo, Bing, etc.
- **Category-specific tools** — `aggregated_news_search`, `aggregated_image_search`
