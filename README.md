# Awesome MCP Servers

Collection of API-specialized MCP (Model Context Protocol) servers. Each server targets one API and supports both HTTP and stdio transports.

## Servers

| Server | Description |
|--------|-------------|
| [open-meteo-mcp](servers/open-meteo-mcp/) | Weather API — location search, current weather, forecasts (no API key) |
| [rest-countries-mcp](servers/rest-countries-mcp/) | Countries API — lookup by name/code, search by region/capital, list all (no API key) |

## Quick Start

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
cd servers/rest-countries-mcp
npm install
npm run build
MCP_TRANSPORT=http npm start   # HTTP on port 3002
# or
MCP_TRANSPORT=stdio npm start  # Stdio for Cursor/Claude Desktop
```
