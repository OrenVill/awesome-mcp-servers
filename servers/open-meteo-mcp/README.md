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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `both` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `3001` | HTTP server port |
| `MCP_SERVER_NAME` | `open-meteo-mcp` | Server name |
| `ENABLE_MCP_SERVER` | `true` | Enable/disable server |

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
