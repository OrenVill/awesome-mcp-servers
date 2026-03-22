# Wikipedia MCP Server

MCP server for the [Wikipedia REST API](https://www.mediawiki.org/wiki/API:Main_page) and [MediaWiki API](https://en.wikipedia.org/api/rest_v1/). Provides tools to search articles, get brief summaries, and fetch full extracts. No API key required.

## Tools

- **search_wikipedia** — Search for Wikipedia articles by query. Returns titles and snippets.
- **get_article** — Get full extract of a Wikipedia article by exact title.
- **get_summary** — Get a brief summary of an article (REST summary or intro extract).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3503)
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
    "httpPort": 3503,
    "serverName": "wikipedia-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "restBaseUrl": "https://en.wikipedia.org/api/rest_v1",
    "mediaWikiBaseUrl": "https://en.wikipedia.org/w/api.php",
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
| `WIKIPEDIA_REST_URL` | `api.restBaseUrl` | REST API base URL |
| `WIKIPEDIA_MEDIAWIKI_URL` | `api.mediaWikiBaseUrl` | MediaWiki API URL |
| `WIKIPEDIA_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "wikipedia": {
      "command": "node",
      "args": ["/path/to/servers/wikipedia-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3003/mcp`
- **Health check:** `http://localhost:3003/health`
