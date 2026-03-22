# Awesome MCP Servers

Collection of API-specialized MCP (Model Context Protocol) servers. Each server targets one API and supports both HTTP and stdio transports.

## Servers

| Server | Description |
|--------|-------------|
| [unified-mcp](servers/unified-mcp/) | **All-in-one** — bundles weather, countries, Wikipedia, Hacker News with popular tools + search_tools (no API key) |
| [open-meteo-mcp](servers/open-meteo-mcp/) | Weather API — location search, current weather, forecasts (no API key) |
| [rest-countries-mcp](servers/rest-countries-mcp/) | Countries API — lookup by name/code, search by region/capital, list all (no API key) |
| [wikipedia-mcp](servers/wikipedia-mcp/) | Wikipedia/MediaWiki API — search articles, get summaries and extracts (no API key) |
| [hacker-news-mcp](servers/hacker-news-mcp/) | Hacker News API — top stories, items, comments, Algolia search (no API key) |

## Quick Start

### Unified server (all tools)

```bash
npm install
npm run build
cd servers/unified-mcp
MCP_TRANSPORT=http npm start   # HTTP on port 3000
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```

### Individual servers

Each server runs independently:

```bash
cd servers/open-meteo-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP on port 3001
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```

```bash
cd servers/hacker-news-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP on port 3004
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```

```bash
cd servers/wikipedia-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP on port 3003
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```

```bash
cd servers/rest-countries-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP on port 3002
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```
