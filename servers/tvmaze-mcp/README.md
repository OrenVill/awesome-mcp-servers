# TVMaze MCP Server

MCP server for the [TVMaze API](https://www.tvmaze.com/api). Search TV shows, fetch show details, and list episodes. No API key required.

## Tools

- **search_shows** — Search shows by title or keywords (supports batch `query` arrays).
- **get_show** — Full show metadata by TVMaze show ID.
- **get_show_episodes** — Episode list for a show by TVMaze show ID.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3524)
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
    "httpPort": 3524,
    "serverName": "tvmaze-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.tvmaze.com",
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
| `TVMAZE_BASE_URL` | `api.baseUrl` | TVMaze API base URL |
| `TVMAZE_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "tvmaze": {
      "command": "node",
      "args": ["/path/to/servers/tvmaze-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3524/mcp`
- **Health check:** `http://localhost:3524/health`
