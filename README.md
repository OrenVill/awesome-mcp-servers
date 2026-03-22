# Awesome MCP Servers

Collection of API-specialized MCP (Model Context Protocol) servers. Each server targets one API and supports both HTTP and stdio transports.

## Servers

| Server | Description |
|--------|-------------|
| [open-meteo-mcp](servers/open-meteo-mcp/) | Weather API — location search, current weather, forecasts (no API key) |
| [wikipedia-mcp](servers/wikipedia-mcp/) | Wikipedia/MediaWiki API — search articles, get summaries and extracts (no API key) |

## Quick Start

Each server runs independently:

```bash
cd servers/open-meteo-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP (open-meteo: 3500, wikipedia: 3003)
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```
