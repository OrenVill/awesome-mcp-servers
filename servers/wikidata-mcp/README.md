# Wikidata MCP Server

MCP server for the [Wikidata MediaWiki API](https://www.wikidata.org/w/api.php). Search entities and fetch data by Q-id via `wbsearchentities` and `wbgetentities`. No API key required.

## Tools

- **search_entities** — Search Wikidata by label or alias. Optional `language` and `limit`.
- **get_entity** — Fetch entity labels, descriptions, aliases, claim counts, and sitelinks by Q-id. Accepts a single id or an array for batch lookup.
- **get_entity_description** — Get the description for one or more Q-ids in a given language.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default from config)
MCP_TRANSPORT=both npm start

# HTTP only (port 3519)
MCP_TRANSPORT=http npm start

# Stdio only (for Cursor, Claude Desktop, etc.)
MCP_TRANSPORT=stdio npm start
```

## Configuration

**config.json:**

```json
{
  "mcp": {
    "enabled": true,
    "transport": "http",
    "httpPort": 3519,
    "serverName": "wikidata-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "mediaWikiBaseUrl": "https://www.wikidata.org/w/api.php",
    "defaultLanguage": "en",
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
| `WIKIDATA_API_URL` | `api.mediaWikiBaseUrl` | MediaWiki API URL |
| `WIKIDATA_DEFAULT_LANGUAGE` | `api.defaultLanguage` | Default language code |
| `WIKIDATA_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "wikidata": {
      "command": "node",
      "args": ["/path/to/servers/wikidata-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

- **MCP endpoint:** `http://localhost:3519/mcp`
- **Health:** `http://localhost:3519/health`
