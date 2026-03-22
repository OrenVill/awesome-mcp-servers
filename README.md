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
npm run build
```

### Unified server (all tools)

```bash
cd servers/unified-mcp
MCP_TRANSPORT=http npm start   # HTTP on port 8000 (see config.json)
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```

### Individual servers

Each server runs independently:

```bash
cd servers/open-meteo-mcp
MCP_TRANSPORT=http npm start   # HTTP on port 3500
# or
MCP_TRANSPORT=stdio npm start
```

```bash
cd servers/rest-countries-mcp
MCP_TRANSPORT=http npm start   # HTTP on port 3501
```

```bash
cd servers/hacker-news-mcp
MCP_TRANSPORT=http npm start   # HTTP on port 3502
```

```bash
cd servers/wikipedia-mcp
MCP_TRANSPORT=http npm start   # HTTP on port 3503
```

## Known limitations

- **Build order:** Run `npm run build` from repo root so sibling servers are built before unified-mcp.
- **Rate limits:** External APIs (Open-Meteo, Wikipedia, etc.) may enforce rate limits; no keys = shared quotas.
