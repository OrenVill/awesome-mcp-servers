# npm Registry MCP Server

MCP server for the public [npm registry](https://registry.npmjs.org). Look up package metadata and search packages. No API key required.

## Tools

- **get_package** — Fetch metadata for one or more npm packages (latest version, description, license, maintainers, dist-tags). Supports scoped names like `@types/node`.
- **search_packages** — Search the registry by keyword or phrase. Optional `size` (1–250, default 20).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3525)
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
    "httpPort": 3525,
    "serverName": "npm-registry-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://registry.npmjs.org",
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
| `NPM_REGISTRY_BASE_URL` | `api.baseUrl` | npm registry base URL |
| `NPM_REGISTRY_TIMEOUT_MS` | `api.timeoutMs` | Request timeout (ms) |

## Cursor Configuration

```json
{
  "mcpServers": {
    "npm-registry": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/npm-registry-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## Build

From the monorepo root:

```bash
npx turbo run build --filter=npm-registry-mcp
```
