# Frankfurter MCP Server

MCP server for the [Frankfurter API](https://www.frankfurter.app/). Provides ECB foreign exchange rates: latest, historical, time series, and currency conversion. No API key required.

## Tools

- **get_latest_rates** — Get the latest FX rates published by the ECB. Optional base currency and target symbols.
- **convert_currency** — Convert an amount from one currency to another using the latest rate.
- **get_historical_rates** — Get FX rates for a specific date (`YYYY-MM-DD`).
- **get_time_series** — Get FX rates over a date range. End date is optional.
- **list_currencies** — List all currencies supported by Frankfurter (ISO code → name).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3508)
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
    "transport": "http",
    "httpPort": 3508,
    "serverName": "frankfurter-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.frankfurter.app",
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
| `FRANKFURTER_BASE_URL` | `api.baseUrl` | Frankfurter API base URL |
| `FRANKFURTER_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "frankfurter": {
      "command": "node",
      "args": ["/path/to/servers/frankfurter-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3508/mcp`
- **Health check:** `http://localhost:3508/health`
