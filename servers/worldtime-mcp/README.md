# World Time MCP Server

MCP server for the [World Time API](http://worldtimeapi.org/). Provides current local and UTC time by IANA timezone, by IP geolocation, and a full timezone catalog. No API key required.

## Tools

- **get_time_by_timezone** — Current datetime for an IANA timezone (e.g. `Europe/London`). Use `timezone` (string or array) or `timezones` (array) for batch lookups.
- **get_time_by_ip** — Current datetime inferred from an IP address; omit `ip` to use the `/ip` endpoint for the caller.
- **list_timezones** — List all supported IANA timezone identifiers.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3529)
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
    "httpPort": 3529,
    "serverName": "worldtime-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "http://worldtimeapi.org/api",
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
| `WORLDTIME_BASE_URL` | `api.baseUrl` | World Time API base URL |
| `WORLDTIME_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "worldtime": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/worldtime-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

For aggregation in `unified-mcp`, import `getWorldtimeToolDefinitions` from `dist/mcp/tools/index.js`.
