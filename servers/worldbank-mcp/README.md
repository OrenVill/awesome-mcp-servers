# World Bank MCP Server

MCP server for the [World Bank Open Data API](https://data.worldbank.org/) (`https://api.worldbank.org/v2`, JSON). Countries, indicator search, and country-level time series. No API key required.

## Tools

- **list_countries** — List World Bank countries/economies (aggregates excluded by default).
- **search_indicators** — Search indicators by keyword in id or name (default source: World Development Indicators).
- **get_country_indicator** — Fetch indicator values for a country; optional `date` year or `YYYY:YYYY` range.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3521)
MCP_TRANSPORT=http npm start

# Stdio only (for Cursor, Claude Desktop, etc.)
MCP_TRANSPORT=stdio npm start
```

## Configuration

Each server has a `config.json` at its root. Values are overridden by environment variables.

**config.json:**
```json
{
  "mcp": {
    "enabled": true,
    "transport": "both",
    "httpPort": 3521,
    "serverName": "worldbank-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.worldbank.org/v2",
    "timeoutMs": 20000,
    "defaultSourceId": "2"
  }
}
```

## Environment Variables

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `MCP_TRANSPORT` | `mcp.transport` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `mcp.httpPort` | HTTP server port |
| `MCP_SERVER_NAME` | `mcp.serverName` | Server name |
| `ENABLE_MCP_SERVER` | `mcp.enabled` | `false` to disable |
| `WORLDBANK_BASE_URL` | `api.baseUrl` | World Bank API base URL |
| `WORLDBANK_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `WORLDBANK_DEFAULT_SOURCE_ID` | `api.defaultSourceId` | Default indicator source (2 = WDI) |

## Cursor Configuration

**HTTP (local):**
```json
{
  "mcpServers": {
    "worldbank": {
      "url": "http://localhost:3521/mcp"
    }
  }
}
```

**Stdio:**
```json
{
  "mcpServers": {
    "worldbank": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/worldbank-mcp/dist/app.js"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

Build first: `npm run build` from the repo root (or `npm run build` in this directory).
