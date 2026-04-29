# MDN Compat MCP Server

MCP server for the [MDN Web Docs](https://developer.mozilla.org) public search and content APIs. Provides tools to search MDN documentation, fetch full docs by slug, and extract browser compatibility tables for web platform features (HTML/CSS/JS/Web APIs). No API key required.

## Tools

- **search_mdn** — Search MDN docs by query. Returns titles, slugs, summaries, and relevance scores.
- **get_doc** — Fetch a doc by slug (e.g. `Web/API/fetch`, `Web/CSS/grid`). Returns title, summary, URL, and a plain-text rendering of body sections.
- **get_browser_compat** — Extract browser support data from a doc's compatibility section. Returns a per-browser support summary.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3512)
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
    "httpPort": 3512,
    "serverName": "mdn-compat-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "searchBaseUrl": "https://developer.mozilla.org/api/v1/search",
    "docsBaseUrl": "https://developer.mozilla.org",
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
| `MDN_SEARCH_BASE_URL` | `api.searchBaseUrl` | MDN search API base URL |
| `MDN_DOCS_BASE_URL` | `api.docsBaseUrl` | MDN docs base URL |
| `MDN_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "mdn": {
      "command": "node",
      "args": ["/path/to/servers/mdn-compat-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3512/mcp`
- **Health check:** `http://localhost:3512/health`
