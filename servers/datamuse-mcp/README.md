# Datamuse MCP Server

MCP server for the [Datamuse API](https://www.datamuse.com/api/). Find words: rhymes, synonyms, "means like", "sounds like", and autocomplete suggestions. No API key required (100k requests/day free).

## Tools

- **find_rhymes** — Find words that rhyme with a given word.
- **find_synonyms** — Find synonyms for a given word.
- **means_like** — Find words with similar meaning to a query (supports multi-word phrases).
- **sounds_like** — Find words that sound similar to the input.
- **suggest** — Get autocomplete-style suggestions for a prefix.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3513)
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
    "httpPort": 3513,
    "serverName": "datamuse-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.datamuse.com",
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
| `DATAMUSE_BASE_URL` | `api.baseUrl` | Datamuse API base URL |
| `DATAMUSE_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "datamuse": {
      "command": "node",
      "args": ["/path/to/servers/datamuse-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3513/mcp`
- **Health check:** `http://localhost:3513/health`
