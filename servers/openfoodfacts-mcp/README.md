# Open Food Facts MCP Server

MCP server for the public [Open Food Facts](https://world.openfoodfacts.org) API v2. Look up products by barcode and search the food database. No API key required.

## Tools

- **get_product_by_barcode** — Fetch product details by EAN/UPC barcode (ingredients, allergens, Nutri-Score, nutrients). Use `code` (string or array) or `codes` for batch lookup.
- **search_products** — Search by product name, brand, or keywords. Optional `page_size` (1–100, default 20).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3532)
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
    "httpPort": 3532,
    "serverName": "openfoodfacts-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://world.openfoodfacts.org/api/v2",
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
| `OPENFOODFACTS_BASE_URL` | `api.baseUrl` | Open Food Facts API v2 base URL |
| `OPENFOODFACTS_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "openfoodfacts": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/openfoodfacts-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

For aggregation in `unified-mcp`, import `getOpenfoodfactsToolDefinitions` from `dist/mcp/tools/index.js`.

## Build

From the repo root:

```bash
npx turbo run build --filter=openfoodfacts-mcp
```
