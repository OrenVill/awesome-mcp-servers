# OpenAlex MCP Server

MCP server for the [OpenAlex API](https://api.openalex.org). Search scholarly works and authors, and fetch metadata by OpenAlex ID or DOI. No API key required.

OpenAlex offers a "polite pool" with better rate limits for clients that identify themselves with a contact email. Set `OPENALEX_MAILTO` (or `api.mailto` in `config.json`) to your email — the server appends `mailto=...` to requests and includes the address in the `User-Agent`.

## Tools

- **search_works** — Search works by free-text query. Optional `per_page` (1–200).
- **get_work** — Fetch a work by OpenAlex ID (`W…` or full URL) or DOI.
- **search_authors** — Search authors by name or keywords.
- **get_author** — Fetch an author profile by OpenAlex ID (`A…` or full URL).

Primary inputs (`query`, `id`) accept a single string or an array for batch requests.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3517)
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
    "httpPort": 3517,
    "serverName": "openalex-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.openalex.org",
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
| `OPENALEX_BASE_URL` | `api.baseUrl` | OpenAlex API base URL |
| `OPENALEX_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `OPENALEX_MAILTO` | `api.mailto` | Contact email for the polite pool |

## Cursor Configuration

```json
{
  "mcpServers": {
    "openalex": {
      "command": "node",
      "args": ["/path/to/servers/openalex-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "OPENALEX_MAILTO": "you@example.com"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3517/mcp`
- **Health check:** `http://localhost:3517/health`
