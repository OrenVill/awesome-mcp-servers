# Awesome MCP Servers

Collection of API-specialized MCP (Model Context Protocol) servers. Each server targets one API and supports both HTTP and stdio transports. No API keys required.

**Prerequisites:** Node.js 18+, npm

## Servers

| Server | Description |
|--------|-------------|
| [unified-mcp](servers/unified-mcp/) | **All-in-one** — bundles weather, countries, Wikipedia, Hacker News with popular tools + search_tools (no API key) |
| [open-meteo-mcp](servers/open-meteo-mcp/) | Weather API — location search, current weather, forecasts (no API key) |
| [rest-countries-mcp](servers/rest-countries-mcp/) | Countries API — lookup by name/code, search by region/capital, list all (no API key) |
| [wikipedia-mcp](servers/wikipedia-mcp/) | Wikipedia/MediaWiki API — search articles, get summaries and extracts (no API key) |
| [hacker-news-mcp](servers/hacker-news-mcp/) | Hacker News API — top stories, items, comments, Algolia search (no API key) |

## Quick Start

From the repo root:

```bash
npm install
npm run build         # turbo builds all servers in dependency order (cached)
npm start             # starts unified-mcp (HTTP+stdio) on port 8000
```

Other root scripts (all powered by [turbo](https://turborepo.com)):

| Script | What it does |
|--------|-------------|
| `npm run build` | Build every server. Cached — re-runs are near-instant. |
| `npm start` | Start `unified-mcp` (default transport: both). |
| `npm run start:http` | Start `unified-mcp` on HTTP only (port 8000). |
| `npm run start:stdio` | Start `unified-mcp` on stdio only (Cursor / Claude Desktop). |
| `npm run start:all` | Start every server in parallel. |

### Running a single server

Filter via turbo from the root:

```bash
npx turbo run start:http --filter=open-meteo-mcp     # port 3500
npx turbo run start:http --filter=rest-countries-mcp # port 3501
npx turbo run start:http --filter=hacker-news-mcp    # port 3502
npx turbo run start:http --filter=wikipedia-mcp      # port 3503
```

Or `cd` into the server and use its own scripts (`npm start`, `npm run start:http`, `npm run start:stdio`).

## Known limitations

- **Rate limits:** External APIs (Open-Meteo, Wikipedia, etc.) may enforce rate limits; no keys = shared quotas.
