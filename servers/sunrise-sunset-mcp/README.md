# Sunrise-Sunset MCP Server

MCP server for the [Sunrise-Sunset.org API](https://sunrise-sunset.org/api). Provides sunrise, sunset, solar noon, day length, and twilight times for coordinates. No API key required.

## Tools

- **get_sun_times** — Sunrise/sunset and twilight times for a latitude/longitude. Optional `date` (`YYYY-MM-DD`). Supports batch requests via paired `lat`/`lng` arrays.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3530)
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
    "httpPort": 3530,
    "serverName": "sunrise-sunset-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.sunrise-sunset.org/json",
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
| `SUNRISE_SUNSET_BASE_URL` | `api.baseUrl` | API base URL |
| `SUNRISE_SUNSET_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

**HTTP (recommended for local dev):**

```json
{
  "mcpServers": {
    "sunrise-sunset": {
      "url": "http://localhost:3530/mcp"
    }
  }
}
```

**Stdio:**

```json
{
  "mcpServers": {
    "sunrise-sunset": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/sunrise-sunset-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Build first: `npm run build` from the repo root (or `npm run build` in this directory).
