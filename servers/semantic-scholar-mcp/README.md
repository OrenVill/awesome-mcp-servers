# Semantic Scholar MCP Server

MCP server for the [Semantic Scholar Graph API](https://api.semanticscholar.org/api-docs/graph). Search papers, fetch metadata, and list citing works. No API key required (shared rate limits); optional `SEMANTIC_SCHOLAR_API_KEY` for higher throughput.

## Tools

- **search_papers** — Free-text paper search. Accepts `query` as a string or string array; optional `limit` (1–100, default 10).
- **get_paper** — Paper metadata by Semantic Scholar ID or prefixed external ID (`DOI:…`, `ArXiv:…`, `PMID:…`). Use `paperId` for one paper or `ids` for batch lookup.
- **get_paper_citations** — Papers that cite a given work. Requires `paperId`; optional `limit` (1–1000, default 10).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports
MCP_TRANSPORT=both npm start

# HTTP only (port 3531)
MCP_TRANSPORT=http npm start

# Stdio only (Cursor, Claude Desktop, etc.)
MCP_TRANSPORT=stdio npm start
```

## Configuration

**config.json:**

```json
{
  "mcp": {
    "enabled": true,
    "transport": "http",
    "httpPort": 3531,
    "serverName": "semantic-scholar-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.semanticscholar.org/graph/v1",
    "timeoutMs": 20000,
    "apiKey": ""
  }
}
```

## Environment Variables

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `MCP_TRANSPORT` | `mcp.transport` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `mcp.httpPort` | HTTP server port (default 3531) |
| `MCP_SERVER_NAME` | `mcp.serverName` | Server name |
| `ENABLE_MCP_SERVER` | `mcp.enabled` | `false` to disable |
| `SEMANTIC_SCHOLAR_BASE_URL` | `api.baseUrl` | Graph API base URL |
| `SEMANTIC_SCHOLAR_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `SEMANTIC_SCHOLAR_API_KEY` | `api.apiKey` | Optional API key (`x-api-key` header) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "semantic-scholar": {
      "command": "node",
      "args": ["/path/to/servers/semantic-scholar-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

- Health: `GET http://localhost:3531/health`
- MCP: `POST http://localhost:3531/mcp`

Build first: `npm run build` from the repo root (`npx turbo run build --filter=semantic-scholar-mcp`) or from this directory.
