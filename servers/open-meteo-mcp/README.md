# Open-Meteo MCP Server

MCP server for the [Open-Meteo](https://open-meteo.com) weather API. Provides tools for location search, current weather, and multi-day forecasts. No API key required.

## Tools

- **search_locations** — Search for locations by name or postal code. Returns coordinates and timezone.
- **get_current_weather** — Current conditions for a location (lat/lon).
- **get_forecast** — Multi-day forecast (up to 16 days) for a location.

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3001)
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
    "httpPort": 3001,
    "serverName": "open-meteo-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "geocodingBaseUrl": "https://geocoding-api.open-meteo.com/v1",
    "forecastBaseUrl": "https://api.open-meteo.com/v1",
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
| `OPEN_METEO_GEOCODING_URL` | `api.geocodingBaseUrl` | Geocoding API base |
| `OPEN_METEO_FORECAST_URL` | `api.forecastBaseUrl` | Forecast API base |
| `OPEN_METEO_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "open-meteo": {
      "command": "node",
      "args": ["/path/to/servers/open-meteo-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## HTTP Mode

When using HTTP:

- **MCP endpoint:** `http://localhost:3001/mcp`
- **Health check:** `http://localhost:3001/health`
