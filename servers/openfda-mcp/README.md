# openFDA MCP Server

MCP server for the [openFDA API](https://open.fda.gov/apis/). Search drug labeling, medical device adverse events (MAUDE), and food enforcement recalls. No API key required (rate limits apply without a key).

## Tools

- **search_drug_labels** — Search SPL drug labeling records by Lucene query or plain term.
- **search_device_events** — Search MAUDE device adverse event reports.
- **search_food_enforcement** — Search food recall / enforcement records.

All search tools accept `search` (required) and optional `limit` (default **5**, max 100).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default from config)
MCP_TRANSPORT=both npm start

# HTTP only (port 3522)
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
    "httpPort": 3522,
    "serverName": "openfda-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://api.fda.gov",
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
| `OPENFDA_BASE_URL` | `api.baseUrl` | openFDA API base URL |
| `OPENFDA_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "openfda": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/openfda-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Build first: `npm run build --workspace=openfda-mcp` from the repo root.
