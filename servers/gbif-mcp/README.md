# GBIF MCP Server

MCP server for the [GBIF API](https://www.gbif.org/developer/summary) (Global Biodiversity Information Facility). Search taxonomy, look up species by taxon key, and query occurrence records. No API key required.

## Tools

- **search_species** — Free-text search of GBIF species/taxa (`q`, optional `limit`).
- **get_species** — Fetch taxon details by `key` or batch `keys[]`.
- **search_occurrences** — Search occurrence records by `scientificName`, optional `country` (ISO alpha-2), and `limit`.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3536)
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
    "httpPort": 3536,
    "serverName": "gbif-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.gbif.org/v1",
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
| `GBIF_BASE_URL` | `api.baseUrl` | GBIF API base URL |
| `GBIF_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

**stdio:**
```json
{
  "mcpServers": {
    "gbif": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/gbif-mcp/dist/app.js"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

**HTTP:** connect to `http://localhost:3536/mcp` (after `npm run build && MCP_TRANSPORT=http npm start`).

## Build

From the monorepo root:

```bash
npx turbo run build --filter=gbif-mcp
```

Or from this directory:

```bash
npm run build
npm start
```
