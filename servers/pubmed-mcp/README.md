# PubMed MCP Server

MCP server for [NCBI E-utilities](https://eutils.ncbi.nlm.nih.gov/entrez/eutils/) (PubMed/MEDLINE). Search articles and fetch summaries or abstracts by PMID. No API key required.

NCBI asks clients to identify themselves with a `tool` name and contact `email`. This server sends `tool=pubmed-mcp` on every request. Set `PUBMED_EMAIL` (or `api.email` in `config.json`) to your email address for polite-pool etiquette. You can also pass an optional `email` parameter on individual tool calls.

## Tools

- **search_articles** — Search PubMed by query (`esearch`). Returns PMIDs with title, authors, journal, and date. Optional `max_results` (1–100, default 10). Batch: pass an array of queries.
- **get_article_summary** — Bibliographic summary by PMID (`esummary`). Batch: pass an array of PMIDs.
- **get_article_abstract** — Full abstract text by PMID (`efetch`). Batch: pass an array of PMIDs.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default from config.json is http only — set MCP_TRANSPORT=both as needed)
MCP_TRANSPORT=both npm start

# HTTP only (port 3518)
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
    "httpPort": 3518,
    "serverName": "pubmed-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    "timeoutMs": 20000,
    "toolName": "pubmed-mcp",
    "email": ""
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
| `PUBMED_BASE_URL` | `api.baseUrl` | NCBI E-utilities base URL |
| `PUBMED_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `PUBMED_TOOL_NAME` | `api.toolName` | `tool` parameter sent to NCBI |
| `PUBMED_EMAIL` | `api.email` | Contact email for NCBI etiquette |

## Cursor Configuration

```json
{
  "mcpServers": {
    "pubmed": {
      "command": "node",
      "args": ["/path/to/servers/pubmed-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "PUBMED_EMAIL": "you@example.com"
      }
    }
  }
}
```

## HTTP Mode

After `npm run build && MCP_TRANSPORT=http npm start`:

- Health: `GET http://localhost:3518/health`
- MCP: `POST http://localhost:3518/mcp`

## Build

From the monorepo root:

```bash
npx turbo run build --filter=pubmed-mcp
```
