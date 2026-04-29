# Nominatim MCP Server

MCP server for the [OpenStreetMap Nominatim API](https://nominatim.org/release-docs/latest/api/Overview/). Provides tools to geocode addresses, reverse-geocode coordinates, and look up OSM objects by ID. No API key required.

## Tools

- **geocode** — Forward geocode an address or place name to coordinates and address details.
- **reverse_geocode** — Reverse geocode latitude/longitude to a structured address.
- **lookup** — Bulk lookup of OSM objects by their OSM IDs (e.g. `R146656,W104393803,N240109189`).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3506)
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
    "httpPort": 3506,
    "serverName": "nominatim-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://nominatim.openstreetmap.org",
    "timeoutMs": 15000,
    "userAgent": "nominatim-mcp/1.0 (https://github.com/awesome-mcp-servers)"
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
| `NOMINATIM_BASE_URL` | `api.baseUrl` | Nominatim API base URL |
| `NOMINATIM_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `NOMINATIM_USER_AGENT` | `api.userAgent` | Required `User-Agent` sent with every request |

## Cursor Configuration

```json
{
  "mcpServers": {
    "nominatim": {
      "command": "node",
      "args": ["/path/to/servers/nominatim-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3506/mcp`
- **Health check:** `http://localhost:3506/health`

## Notes

Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires:

- A descriptive, identifiable `User-Agent` on every request (set via `NOMINATIM_USER_AGENT`).
- A maximum of **~1 request per second**. This server does not rate-limit on your behalf — keep call rates low or run your own Nominatim instance and override `NOMINATIM_BASE_URL` for heavy use.
