# REST Countries MCP Server

MCP server for the [REST Countries](https://restcountries.com) API. Provides tools for country lookup, search by region/capital, and listing all countries. No API key required.

## Tools

- **get_country** — Get country info by name or alpha code (e.g. "peru", "pe", "PER"). Returns name, capital, region, population, currencies, languages, etc.
- **search_countries** — Search countries by region, subregion, or capital. Returns a list of matching countries.
- **list_all_countries** — List all countries with optional fields filter (max 10 fields).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3501)
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
    "httpPort": 3501,
    "serverName": "rest-countries-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://restcountries.com/v3.1",
    "timeoutMs": 15000
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
| `REST_COUNTRIES_BASE_URL` | `api.baseUrl` | REST Countries API base URL |
| `REST_COUNTRIES_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "rest-countries": {
      "command": "node",
      "args": ["/path/to/servers/rest-countries-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3002/mcp`
- **Health check:** `http://localhost:3002/health`
