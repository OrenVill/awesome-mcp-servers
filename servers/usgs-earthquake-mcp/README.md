# USGS Earthquake MCP Server

MCP server for the [USGS Earthquake Catalog (FDSN Event) API](https://earthquake.usgs.gov/fdsnws/event/1/). Query earthquakes worldwide by region, magnitude, and time. No API key required.

## Tools

- **query_earthquakes** — Flexible query by time range, magnitude range, and geographic region (point + radius).
- **get_recent_significant** — Recent significant earthquakes above a magnitude threshold within the last N days.
- **get_event** — Fetch a single earthquake event by its USGS event ID (e.g. `nc73649170`).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3509)
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
    "httpPort": 3509,
    "serverName": "usgs-earthquake-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://earthquake.usgs.gov/fdsnws/event/1",
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
| `USGS_BASE_URL` | `api.baseUrl` | USGS FDSN event base URL |
| `USGS_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "usgs-earthquake": {
      "command": "node",
      "args": ["/path/to/servers/usgs-earthquake-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3509/mcp`
- **Health check:** `http://localhost:3509/health`
