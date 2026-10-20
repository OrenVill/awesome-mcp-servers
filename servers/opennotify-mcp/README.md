# Open Notify MCP Server

MCP server for the [Open Notify API](http://api.open-notify.org). Provides ISS location, people in space, and ISS pass predictions. No API key required.

## Tools

- **get_iss_location** — Current ISS latitude/longitude and observation timestamp.
- **get_people_in_space** — Count and names of people in space, grouped by spacecraft.
- **get_iss_pass_times** — Upcoming visible ISS passes for a location (`lat`, `lon`, optional `alt` in meters; default 20).

> **Note:** Open Notify’s documentation states the ISS pass times API has been removed from their public service. The tool still calls `iss-pass.json` as documented historically; if the endpoint is unavailable, the tool returns a clear API error.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3528)
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
    "transport": "both",
    "httpPort": 3528,
    "serverName": "opennotify-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "http://api.open-notify.org",
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
| `OPENNOTIFY_BASE_URL` | `api.baseUrl` | Open Notify API base URL |
| `OPENNOTIFY_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Build & Run

From the monorepo root:

```bash
npm install
npx turbo run build --filter=opennotify-mcp
npx turbo run start:http --filter=opennotify-mcp
```

Or from this directory:

```bash
npm run build
MCP_TRANSPORT=http npm start
```

Health check: `GET http://localhost:3528/health`

## Unified MCP

For aggregation in `unified-mcp`, import `getOpennotifyToolDefinitions` from `dist/mcp/tools/index.js`.
