# Crossref MCP Server

MCP server for the [Crossref REST API](https://api.crossref.org). Provides tools to look up DOI metadata and search scholarly works and journals. No API key required.

Crossref operates a "polite pool" with better service for clients that identify themselves with a contact email. Set `CROSSREF_MAILTO` (or `api.mailto` in `config.json`) to your email address to opt in to polite-pool etiquette — the server will append `&mailto=...` to GET requests and include the address in the `User-Agent`.

## Tools

- **get_work** — Get DOI metadata: title, authors, journal, year, type, URL, abstract.
- **search_works** — Search scholarly works by query. Optional `filter` (e.g. `from-pub-date:2020`).
- **search_journals** — Search journals by title/keywords. Returns ISSN, title, publisher.
- **get_journal** — Get journal details by ISSN: title, publisher, total works count.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3515)
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
    "httpPort": 3515,
    "serverName": "crossref-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.crossref.org",
    "timeoutMs": 15000,
    "mailto": ""
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
| `CROSSREF_BASE_URL` | `api.baseUrl` | Crossref API base URL |
| `CROSSREF_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `CROSSREF_MAILTO` | `api.mailto` | Contact email for the polite pool |

## Cursor Configuration

```json
{
  "mcpServers": {
    "crossref": {
      "command": "node",
      "args": ["/path/to/servers/crossref-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "CROSSREF_MAILTO": "you@example.com"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3515/mcp`
- **Health check:** `http://localhost:3515/health`
