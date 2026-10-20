# PyPI MCP Server

MCP server for the public [PyPI JSON API](https://docs.pypi.org/api/json/). Look up package metadata and search project names via the [Simple Index JSON API](https://docs.pypi.org/api/index-api/). No API key required.

## Tools

- **get_package** — Fetch metadata for one or more PyPI projects (latest version, summary, license, requires-python, project URLs). Use `name` (string or array) or `names` (array).
- **search_packages** — Match project names against the PEP 691 Simple Index (cached after the first query). Optional `limit` (1–100, default 20).

## Transports

Supports both **stdio** and **HTTP** via `MCP_TRANSPORT`:

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 3535)
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
    "httpPort": 3535,
    "serverName": "pypi-mcp",
    "serverVersion": "1.0.0"
  },
  "api": {
    "baseUrl": "https://pypi.org",
    "simpleIndexUrl": "https://pypi.org/simple/",
    "timeoutMs": 30000,
    "searchMaxResults": 20
  }
}
```

| Environment variable | Overrides |
|---------------------|-----------|
| `MCP_TRANSPORT` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | HTTP listen port (default `3535`) |
| `MCP_SERVER_NAME` | MCP server name |
| `ENABLE_MCP_SERVER` | Set to `false` to disable |
| `PYPI_BASE_URL` | PyPI base URL |
| `PYPI_SIMPLE_INDEX_URL` | Simple index URL for name search |
| `PYPI_TIMEOUT_MS` | HTTP timeout in milliseconds |
| `PYPI_SEARCH_MAX_RESULTS` | Default search result limit |

## Programmatic tool registry

For aggregation or testing, export tool definitions with executors:

```ts
import { getPypiToolDefinitions } from './mcp/tools/index.js';

const tools = getPypiToolDefinitions();
```

## Cursor (stdio)

```json
{
  "mcpServers": {
    "pypi": {
      "command": "node",
      "args": ["/path/to/awesome-mcp-servers/servers/pypi-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Build first: `npm run build` from this directory (or `npx turbo run build --filter=pypi-mcp` from the repo root).
