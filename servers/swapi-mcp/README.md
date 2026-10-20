# SWAPI MCP Server

MCP server for the [Star Wars API (SWAPI)](https://swapi.dev/). Search films and characters, and look up people and planets by id. No API key required.

## Tools

- **search_films** — Search SWAPI films by title or text.
- **search_people** — Search SWAPI characters by name or text.
- **get_person** — Get a character by numeric id or resource URL.
- **get_planet** — Get a planet by numeric id or resource URL.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3534)
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
    "httpPort": 3534,
    "serverName": "swapi-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://swapi.dev/api",
    "timeoutMs": 15000
  }
}
```

| Variable | Description |
|----------|-------------|
| `MCP_TRANSPORT` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | HTTP port (default `3534`) |
| `MCP_SERVER_NAME` | MCP server name |
| `ENABLE_MCP_SERVER` | Set to `false` to disable |
| `SWAPI_BASE_URL` | SWAPI base URL |
| `SWAPI_TIMEOUT_MS` | Request timeout in ms |

## Cursor / Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "swapi": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/swapi-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Build first from the repo root: `npm run build` or `npx turbo run build --filter=swapi-mcp`.

## HTTP

- Health: `GET http://localhost:3534/health`
- MCP: `http://localhost:3534/mcp`
