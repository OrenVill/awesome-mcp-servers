# opensky-mcp

MCP server for the [OpenSky Network REST API](https://openskynetwork.github.io/opensky-api/rest.html). Uses the **anonymous tier** (no credentials). Supports stdio and HTTP transports.

## Tools

| Tool | Description |
|------|-------------|
| `get_all_states` | Live ADS-B state vectors worldwide; optional `icao24` filter (string or array) |
| `get_flight_track` | Recent path for one aircraft (`icao24`, optional Unix `time`) |
| `get_airport_arrivals` | Arrivals at an ICAO airport (`airport`, optional `begin`/`end` Unix seconds) |

## Configuration

See `config.json`. Environment overrides:

| Variable | Purpose |
|----------|---------|
| `MCP_TRANSPORT` | `stdio`, `http`, or `both` (default: both) |
| `MCP_HTTP_PORT` | HTTP port (default: **3526**) |
| `MCP_SERVER_NAME` | MCP server name |
| `ENABLE_MCP_SERVER` | Set `false` to disable |
| `OPENSKY_BASE_URL` | API base (default: `https://opensky-network.org/api`) |
| `OPENSKY_TIMEOUT_MS` | Request timeout (default: 20000) |

## Run

```bash
npm run build
npm start
# HTTP only:
MCP_TRANSPORT=http npm start
# stdio only:
MCP_TRANSPORT=stdio npm start
```

Health: `GET http://localhost:3526/health`  
MCP: `http://localhost:3526/mcp`

## Cursor (stdio)

```json
{
  "mcpServers": {
    "opensky": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/opensky-mcp/dist/app.js"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

## Notes

- Anonymous access is rate-limited; historical tracks and flights may return errors for older time ranges.
- `get_airport_arrivals` defaults to a 2-hour window ending now if `begin`/`end` are omitted.
