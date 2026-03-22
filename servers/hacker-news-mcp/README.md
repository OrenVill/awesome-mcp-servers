# Hacker News MCP Server

MCP server for the [Hacker News](https://news.ycombinator.com) API. Uses the Firebase API and Algolia search. No API key required.

## Tools

- **get_top_stories** — Fetch top, new, or best stories. Returns title, URL, score, author, and comment count. Params: `count` (default 20), `listType` (top/new/best).
- **get_story** — Get a single story or item by ID with title, URL, score, by, kids count.
- **get_comments** — Get the comment tree for a story with configurable depth and limit.
- **search_hn** — Search Hacker News via Algolia. Params: `query`, `hitsPerPage`, `page`.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3502)
MCP_TRANSPORT=http npm start

# Stdio only (for Cursor, Claude Desktop, etc.)
MCP_TRANSPORT=stdio npm start
```

## Configuration

**config.json:**
```json
{
  "mcp": {
    "enabled": true,
    "transport": "http",
    "httpPort": 3502,
    "serverName": "hacker-news-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "firebaseBaseUrl": "https://hacker-news.firebaseio.com/v0",
    "algoliaBaseUrl": "https://hn.algolia.com/api/v1",
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
| `HN_FIREBASE_BASE_URL` | `api.firebaseBaseUrl` | Firebase API base |
| `HN_ALGOLIA_BASE_URL` | `api.algoliaBaseUrl` | Algolia API base |
| `HN_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "hacker-news": {
      "command": "node",
      "args": ["/path/to/servers/hacker-news-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3004/mcp`
- **Health check:** `http://localhost:3004/health`
