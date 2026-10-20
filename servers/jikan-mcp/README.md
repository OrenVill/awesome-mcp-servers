# Jikan MCP Server

MCP server for the [Jikan API](https://jikan.moe/) (unofficial MyAnimeList REST API). Search anime, fetch details by MAL ID, and browse top lists. No API key required.

> **Rate limit:** Jikan allows about **3 requests per second**. This server serializes outbound calls and enforces a minimum interval (~334 ms) between requests. Batch `query` arrays still run sequentially through that limiter.

## Tools

- **search_anime** — Search anime by title or keywords (supports batch `query` arrays).
- **get_anime** — Full anime metadata by MyAnimeList ID (`mal_id`).
- **get_top_anime** — Top anime lists; optional `filter`: `airing`, `upcoming`, `bypopularity`, `favorite`.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3533)
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
    "httpPort": 3533,
    "serverName": "jikan-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.jikan.moe/v4",
    "timeoutMs": 15000,
    "minRequestIntervalMs": 334
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
| `JIKAN_BASE_URL` | `api.baseUrl` | Jikan API base URL |
| `JIKAN_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `JIKAN_MIN_REQUEST_INTERVAL_MS` | `api.minRequestIntervalMs` | Min ms between API calls |

## Cursor Configuration

```json
{
  "mcpServers": {
    "jikan": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/jikan-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

For aggregation in `unified-mcp`, import `getJikanToolDefinitions` from `dist/mcp/tools/index.js`.

## Build

From the repo root:

```bash
npx turbo run build --filter=jikan-mcp
```
