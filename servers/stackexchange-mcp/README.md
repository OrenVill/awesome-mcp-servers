# Stack Exchange MCP Server

MCP server for the [Stack Exchange API 2.3](https://api.stackexchange.com/docs). Search questions, fetch posts by ID, and look up tags across Stack Exchange sites (default: Stack Overflow). No API key required.

## Tools

- **search_questions** — Advanced question search (`query` or batch `query[]`, optional `site`, `pagesize`).
- **get_question** — Fetch question(s) by ID (`question_id` / `ids`, single or array; multiple IDs use one API call).
- **search_tags** — Find tags whose name contains `inname` on a site.

All tools include `keywords` for unified registry search.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3520)
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
    "transport": "both",
    "httpPort": 3520,
    "serverName": "stackexchange-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.stackexchange.com/2.3",
    "defaultSite": "stackoverflow",
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
| `STACKEXCHANGE_BASE_URL` | `api.baseUrl` | API base URL |
| `STACKEXCHANGE_SITE` | `api.defaultSite` | Default site (e.g. `stackoverflow`) |
| `STACKEXCHANGE_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "stackexchange": {
      "command": "node",
      "args": ["/path/to/servers/stackexchange-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

- **MCP endpoint:** `http://localhost:3520/mcp`
- **Health check:** `http://localhost:3520/health`

## Registry export

For aggregation in `unified-mcp`, import `getStackexchangeToolDefinitions` from `dist/mcp/tools/index.js`.
