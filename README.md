# search-aggregate-mcp

An MCP server that queries multiple search engines in parallel, deduplicates results by URL, and ranks them by how many engines agreed they're relevant.

Results that appear across more engines rank higher. Ties are broken by each result's best position across engines.

## Why?

AI agents already have access to multiple search tools, but they call them one at a time and mentally deduplicate. This server fires all configured engines simultaneously, merges the results, and returns a single ranked list — faster and more comprehensive than any single engine.

## Supported Engines

| Engine | Env Variable | Required |
|--------|-------------|----------|
| [SearXNG](https://github.com/searxng/searxng) | `SEARXNG_URL` | URL of your instance (e.g. `http://localhost:8888`) |
| [Brave Search](https://brave.com/search/api/) | `BRAVE_API_KEY` | API key |
| [Exa](https://exa.ai) | `EXA_API_KEY` | API key |
| [Serper](https://serper.dev) | `SERPER_API_KEY` | API key |
| [Tavily](https://tavily.com) | `TAVILY_API_KEY` | API key |
| [Bing](https://www.microsoft.com/en-us/bing/apis) | `BING_API_KEY` | API key |

Set any combination of these. Only engines with their env vars present are used — missing keys are silently skipped. At least one engine must be configured.

## Install

```bash
npx -y search-aggregate-mcp
```

No install needed — `npx` handles it. Or install globally:

```bash
npm install -g search-aggregate-mcp
```

## Configuration

Add it to your MCP client config. Example for **Claude Code** (in `~/.claude/claude_desktop_config.json` or your project's `.claude/settings.json`):

```json
{
  "mcpServers": {
    "search-aggregate": {
      "command": "npx",
      "args": ["-y", "search-aggregate-mcp"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key",
        "EXA_API_KEY": "your-exa-api-key",
        "SERPER_API_KEY": "your-serper-api-key"
      }
    }
  }
}
```

Only include env vars for the engines you want to use. You can mix and match freely — one engine works, all six works, anything in between.

## Usage

Once configured, the server exposes a single tool:

### `aggregated_search`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | — | Search query |
| `numResults` | number | 10 | Max results to return |

Results are returned as markdown with clickable links:

```markdown
## [Result Title](https://example.com/page)

Snippet text describing the result...
```

## How It Works

1. **Parallel** — all configured engines are queried simultaneously via `Promise.allSettled`
2. **Resilient** — if one engine fails (timeout, rate limit, network error), the others still return results
3. **Deduplicated** — URLs are normalized (lowercase hostname, trailing slashes removed, tracking parameters stripped) and merged
4. **Ranked** — results are sorted by frequency (how many engines returned them), then by best position

URL normalization strips these tracking parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `gclsrc`, `dclid`, `msclkid`, `mc_eid`, and hash fragments.

## Example

With Brave, Serper, and Exa configured, a search for `"rust web framework"` might produce:

```
Engine results:
  Brave:  [A, B, C, D]
  Serper: [A, C, E, F]
  Exa:    [A, B, D, G]

Merged output (ranked by frequency):
  A — frequency 3 (all three engines)
  B — frequency 2 (Brave + Exa)
  C — frequency 2 (Brave + Serper)
  D — frequency 2 (Brave + Exa)
  E — frequency 1 (Serper only)
  F — frequency 1 (Serper only)
  G — frequency 1 (Exa only)
```

## Development

```bash
npm install        # install dependencies
npm run dev        # run with tsx (hot reload)
npm run build      # compile TypeScript
npm test           # run tests
```

## License

MIT
