# GitHub Public MCP Server

MCP server for the [GitHub REST API v3](https://docs.github.com/en/rest) (`https://api.github.com`). Read-only access to public repositories, users, issues, releases, and search. **No API key required.**

> **Rate limit:** Unauthenticated requests are limited to **60 requests per hour per IP** by GitHub. When the limit is hit, tools return a clean rate-limit error. This server does **not** support tokens or `Authorization` headers — the "no API key required" property is intentional.

## Tools

- **get_repo** — Get metadata for a public repository (`owner/repo`).
- **get_user** — Get a public user or organization profile by username.
- **list_repo_issues** — List issues for a repository (filter by `state`, paginate up to 100).
- **list_repo_releases** — List releases for a repository (up to 100).
- **search_repos** — Search public repositories by query (up to 50 results).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3511)
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
    "httpPort": 3511,
    "serverName": "github-public-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.github.com",
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
| `GITHUB_PUBLIC_BASE_URL` | `api.baseUrl` | GitHub REST API base URL |
| `GITHUB_PUBLIC_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "github-public": {
      "command": "node",
      "args": ["/path/to/servers/github-public-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3511/mcp`
- **Health check:** `http://localhost:3511/health`

## Rate Limits

GitHub's unauthenticated API allows roughly **60 requests per hour per IP**. When exhausted (HTTP `403` with `X-RateLimit-Remaining: 0`), tools return a clean error like:

```
Error (API_ERROR): GitHub rate limit hit (60/hr unauthenticated). Try again later.
```

This server intentionally does not accept GitHub tokens to preserve the "no API key required" property of this monorepo.
