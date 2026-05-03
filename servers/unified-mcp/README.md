# Unified MCP Server

Single MCP server bundling all tools from weather, countries, Wikipedia, and Hacker News. Supports **popular tools** (top 5 by usage), **search_tools** for keyword-based discovery, and **execute_tools** for running one or more bundled tools in a single call. No API keys required.

## Tools

### Popular tools (default)

Initially shows the first `popularToolsCount` from `popularTools` in config. After tool usage is tracked, the top 5 most-used tools are shown instead.

Default popular tools:

- **get_current_weather** — Current weather for a location (lat/lon).
- **search_wikipedia** — Search Wikipedia articles by query.
- **get_top_stories** — Top stories from Hacker News.

### search_tools (meta-tool)

Discover any tool by keyword:

- **keywords** — Search terms (e.g. `"weather paris"`, `"countries"`). Returns up to 10 matching tools with their input schemas.

### execute_tools (meta-tool)

Run one or more bundled tools in a single call. Tools execute in parallel; results return in the same order with the tool name and either content or an error:

- **tools** — Array of `{ name, arguments? }`. `name` must match a tool from `search_tools`; `arguments` must match that tool's `inputSchema`.

All bundled tools:

| Source | Tools |
|--------|-------|
| Open-Meteo | `search_locations`, `get_current_weather`, `get_forecast` |
| Rest Countries | `get_country`, `search_countries`, `list_all_countries` |
| Wikipedia | `search_wikipedia`, `get_article`, `get_summary` |
| Hacker News | `get_top_stories`, `get_story`, `get_comments`, `search_hn` |

## Configuration

**config.json:**

```json
{
  "mcp": {
    "enabled": true,
    "transport": "both",
    "httpPort": 8000,
    "serverName": "unified-mcp",
    "serverVersion": "1.0.0",
    "popularTools": ["get_current_weather", "search_wikipedia", "get_top_stories"],
    "popularToolsCount": 5,
    "usageFile": "~/.config/awesome-mcp-servers/unified-usage.json"
  },
  "api": {
    "openMeteo": { "geocodingBaseUrl": "...", "forecastBaseUrl": "...", "timeoutMs": 15000 },
    "restCountries": { "baseUrl": "...", "timeoutMs": 15000 },
    "wikipedia": { "restBaseUrl": "...", "mediaWikiBaseUrl": "...", "timeoutMs": 15000 },
    "hackerNews": { "firebaseBaseUrl": "...", "algoliaBaseUrl": "...", "timeoutMs": 15000 }
  }
}
```

**Build order:** Build sibling servers (open-meteo-mcp, rest-countries-mcp, wikipedia-mcp, hacker-news-mcp) before unified-mcp. From repo root: `npm run build`.

## Environment Variables

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `MCP_TRANSPORT` | `mcp.transport` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `mcp.httpPort` | HTTP server port (default: 8000) |
| `UNIFIED_MCP_USAGE_FILE` | `mcp.usageFile` | Path for usage tracking JSON |
| `UNIFIED_MCP_API_KEYS` | `mcp.apiKeys` | Optional JSON object of `{"name":"key"}` pairs. When set, HTTP `/mcp` requires `Authorization: Bearer <key>` (or `X-API-Key: <key>`). Stdio is unaffected. |

API base URLs and timeouts are overridable via env (e.g. `OPEN_METEO_GEOCODING_URL`, `REST_COUNTRIES_BASE_URL`).

## Client Authentication (HTTP)

The HTTP transport is **open by default** so local development just works. To require a key from connecting clients, set `UNIFIED_MCP_API_KEYS` to a JSON object mapping a friendly name (used in logs) to a secret:

```bash
export UNIFIED_MCP_API_KEYS='{"alice":"sk-abc-123","claude-desktop":"sk-def-456"}'
npm run start:http
```

Clients must then send one of:

```http
Authorization: Bearer sk-abc-123
X-API-Key: sk-abc-123
```

Notes:

- Stdio is **not** gated — owning the process is sufficient authority.
- `GET /health` stays open so liveness probes don't need credentials.
- Bad/missing keys return `401` with a JSON-RPC error. The 401 deliberately omits a `WWW-Authenticate: Bearer` header so MCP clients don't mistake this for an OAuth-protected resource and trigger OAuth discovery (`/.well-known/oauth-authorization-server`, `/register`, etc.). Those endpoints still return a clean JSON 404 if probed.
- Keys live in env vars only — never in `config.json`. Use a `.env` file (loaded by dotenv) for local persistence.
- The matched name is logged on each request (`auth ok caller=alice`); the key value is never logged.

### Cursor / Claude Desktop with HTTP auth

Cursor's MCP HTTP transport reads custom headers from a `headers` field — not `authorization` at the top level. Use:

```json
{
  "mcpServers": {
    "unified-mcp": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer sk-oren-123"
      }
    }
  }
}
```

If you put the auth value at the top level (e.g. `"authorization": "Bearer …"`), Cursor silently ignores it, the request goes out with no header, and you'll see a 401 followed by a confusing `Cannot POST /register` error as the client falls into OAuth discovery.

## Cursor Configuration

```json
{
  "mcpServers": {
    "unified-mcp": {
      "command": "node",
      "args": ["/path/to/servers/unified-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Use an absolute path to `dist/app.js`. Ensure sibling servers are built first (`npm run build` from repo root).

## Transports

```bash
# Both transports (default)
MCP_TRANSPORT=both npm start

# HTTP only (port 8000)
MCP_TRANSPORT=http npm start

# Stdio only (for Cursor, Claude Desktop, etc.)
MCP_TRANSPORT=stdio npm start
```

## HTTP Mode

- **MCP endpoint:** `http://localhost:8000/mcp`
- **Health check:** `http://localhost:8000/health`
