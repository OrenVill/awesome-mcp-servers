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

API base URLs and timeouts are overridable via env (e.g. `OPEN_METEO_GEOCODING_URL`, `REST_COUNTRIES_BASE_URL`).

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
