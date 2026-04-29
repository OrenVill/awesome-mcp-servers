# SpaceX MCP Server

MCP server for the [SpaceX REST API](https://github.com/r-spacex/SpaceX-API). Provides tools to query launches, rockets, and the next/latest launch. No API key required.

## Tools

- **get_latest_launch** — Get the most recent SpaceX launch.
- **get_next_launch** — Get the next scheduled SpaceX launch.
- **list_launches** — List launches with filters (upcoming, success) and sort order.
- **get_launch** — Get a single launch by id.
- **get_rocket** — Get a single rocket by id.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3510)
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
    "httpPort": 3510,
    "serverName": "spacex-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.spacexdata.com/v4",
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
| `SPACEX_BASE_URL` | `api.baseUrl` | SpaceX API base URL |
| `SPACEX_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "spacex": {
      "command": "node",
      "args": ["/path/to/servers/spacex-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3510/mcp`
- **Health check:** `http://localhost:3510/health`
