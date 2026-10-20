# MusicBrainz MCP Server

MCP server for the [MusicBrainz Web Service (WS2)](https://musicbrainz.org/doc/MusicBrainz_API). Search artists and releases, look up artists by MBID. No API key required.

MusicBrainz requires a meaningful `User-Agent` on every request. This server sends one by default (`awesome-mcp-servers/1.0`) and enforces **at most one API request per second** in the service layer.

## Tools

- **search_artist** — Search artists by name or Lucene query. Returns MBIDs, types, countries, disambiguation.
- **search_release** — Search albums/releases by title or Lucene query. Returns MBIDs, dates, artist credits.
- **lookup_artist** — Full artist details by MBID (aliases, tags, life span). Accepts a single MBID or an array for batch lookup.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3523)
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
    "transport": "both",
    "httpPort": 3523,
    "serverName": "musicbrainz-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://musicbrainz.org/ws/2",
    "timeoutMs": 15000,
    "userAgent": "awesome-mcp-servers/1.0",
    "minRequestIntervalMs": 1000
  }
}
```

## Environment Variables

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `MCP_TRANSPORT` | `mcp.transport` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `mcp.httpPort` | HTTP server port (default 3523) |
| `MCP_SERVER_NAME` | `mcp.serverName` | Server name |
| `ENABLE_MCP_SERVER` | `mcp.enabled` | `false` to disable |
| `MUSICBRAINZ_BASE_URL` | `api.baseUrl` | WS2 base URL |
| `MUSICBRAINZ_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |
| `MUSICBRAINZ_USER_AGENT` | `api.userAgent` | Required User-Agent header value |
| `MUSICBRAINZ_MIN_REQUEST_INTERVAL_MS` | `api.minRequestIntervalMs` | Min gap between API calls (default 1000) |

## Cursor / Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "musicbrainz": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/musicbrainz-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "MUSICBRAINZ_USER_AGENT": "your-app/1.0 (contact@example.com)"
      }
    }
  }
}
```

Set a descriptive `MUSICBRAINZ_USER_AGENT` (app name + contact) per [MusicBrainz etiquette](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting).

## Build

From the repo root:

```bash
npx turbo run build --filter=musicbrainz-mcp
```

Or from this directory:

```bash
npm run build
```
