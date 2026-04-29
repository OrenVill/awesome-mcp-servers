# arXiv MCP Server

MCP server for the [arXiv API](https://arxiv.org/help/api). Provides tools to search research papers, fetch paper metadata by ID, and list recent papers by category. No API key required.

## Tools

- **search_arxiv** — Search arXiv research papers by free-text query, optionally filtered by category.
- **get_paper** — Fetch a paper's metadata by arXiv ID (e.g. `2401.12345` or `cs/0301001`).
- **list_recent** — List recent papers in a given arXiv category (e.g. `cs.LG`, `cs.AI`).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3504)
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
    "httpPort": 3504,
    "serverName": "arxiv-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "http://export.arxiv.org/api/query",
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
| `ARXIV_BASE_URL` | `api.baseUrl` | arXiv API base URL |
| `ARXIV_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "node",
      "args": ["/path/to/servers/arxiv-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3504/mcp`
- **Health check:** `http://localhost:3504/health`
