# Trivia MCP Server

MCP server for the [Open Trivia DB](https://opentdb.com/api_config.php). Provides tools to fetch trivia questions, list categories, and look up question counts. No API key required.

## Tools

- **get_questions** — Fetch trivia questions with optional category, difficulty, and type filters. Returns questions with shuffled options for multiple-choice.
- **list_categories** — List all available trivia categories with their IDs.
- **get_category_count** — Get total and per-difficulty question counts for a category.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3514)
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
    "httpPort": 3514,
    "serverName": "trivia-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://opentdb.com",
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
| `TRIVIA_BASE_URL` | `api.baseUrl` | Open Trivia DB base URL |
| `TRIVIA_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "trivia": {
      "command": "node",
      "args": ["/path/to/servers/trivia-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3514/mcp`
- **Health check:** `http://localhost:3514/health`
