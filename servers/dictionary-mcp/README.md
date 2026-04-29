# Dictionary MCP Server

MCP server for the [Free Dictionary API](https://dictionaryapi.dev/). Provides tools to look up word definitions, phonetics, audio pronunciations, and synonyms. No API key required.

## Tools

- **define_word** — Get full definition entry for a word: phonetics, parts of speech, definitions, and examples.
- **get_synonyms** — Extract synonyms from the dictionary entry, grouped by part of speech.
- **get_phonetics** — Extract phonetic spellings and audio pronunciation URLs for a word.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3507)
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
    "httpPort": 3507,
    "serverName": "dictionary-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.dictionaryapi.dev/api/v2",
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
| `DICTIONARY_BASE_URL` | `api.baseUrl` | Dictionary API base URL |
| `DICTIONARY_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "dictionary": {
      "command": "node",
      "args": ["/path/to/servers/dictionary-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3507/mcp`
- **Health check:** `http://localhost:3507/health`
