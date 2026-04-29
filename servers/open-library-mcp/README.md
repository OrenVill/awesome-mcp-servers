# Open Library MCP Server

MCP server for the [Open Library API](https://openlibrary.org/developers/api). Provides tools to search and look up books, authors, and works on Open Library. No API key required.

## Tools

- **search_books** — Search Open Library for books by query, author, or title. Returns matching titles and metadata.
- **get_book_by_isbn** — Look up a single book by ISBN-10 or ISBN-13.
- **get_author** — Get author details by Open Library author key (e.g. `OL23919A`).
- **get_work** — Get work details by Open Library work key (e.g. `OL45804W`).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3505)
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
    "httpPort": 3505,
    "serverName": "open-library-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://openlibrary.org",
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
| `OPEN_LIBRARY_BASE_URL` | `api.baseUrl` | Open Library base URL |
| `OPEN_LIBRARY_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "open-library": {
      "command": "node",
      "args": ["/path/to/servers/open-library-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3505/mcp`
- **Health check:** `http://localhost:3505/health`
