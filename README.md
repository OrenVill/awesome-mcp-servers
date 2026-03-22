# Awesome MCP Servers

Collection of API-specialized MCP (Model Context Protocol) servers. Each server targets one API and supports both HTTP and stdio transports.

## Servers

| Server | Description |
|--------|-------------|
| [open-meteo-mcp](servers/open-meteo-mcp/) | Weather API — location search, current weather, forecasts (no API key) |
| [hacker-news-mcp](servers/hacker-news-mcp/) | Hacker News API — top stories, items, comments, Algolia search (no API key) |

## Quick Start

Each server runs independently:

```bash
cd servers/open-meteo-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP on port 3500
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
