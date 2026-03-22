# Unified MCP Server Design

**Date:** 2025-03-22  
**Status:** Design approved, pending implementation

---

## 1. Overview

Add a **unified MCP server** that bundles all tools from individual servers into one deployable server, with:

- **Popular tools** (top 5): Start with 3 configurable defaults; evolve to top 5 most-used via persistent usage tracking
- **search_tools**: A meta-tool for discovery and execution of non-popular tools by keyword

Individual servers (open-meteo, rest-countries, wikipedia, hacker-news) remain runnable standalone; no behavior change.

---

## 2. Architecture

```
servers/
├── open-meteo-mcp/       # unchanged, runs standalone
├── rest-countries-mcp/   # unchanged
├── wikipedia-mcp/        # unchanged
├── hacker-news-mcp/      # unchanged
└── unified-mcp/          # NEW
    ├── config.json
    ├── package.json
    ├── src/
    │   ├── config.ts
    │   ├── app.ts
    │   ├── registry/
    │   │   ├── toolRegistry.ts    # builds registry from service imports
    │   │   └── usageTracker.ts    # read/write usage file
    │   └── mcp/
    │       └── mcpServer.ts       # popular tools + search_tools
    └── README.md
```

---

## 3. Tool Registry (Import from Service Tool Files)

### 3.1 Per-tool definition constants

Each server's tool files export explicit per-tool definitions. Name, description, and keywords live in the tool files as the single source of truth.

**Example — open-meteo-mcp:**

```ts
// servers/open-meteo-mcp/src/mcp/tools/geocodingTools.ts
export const SEARCH_LOCATIONS_DEF = {
  name: 'search_locations',
  description: 'Search for locations by name or postal code. Returns lat/lon for get_current_weather or get_forecast.',
  keywords: ['weather', 'location', 'city', 'search', 'geocode', 'coordinates'],
};
// existing: getSearchLocationsSchema(), executeSearchLocations()
```

```ts
// servers/open-meteo-mcp/src/mcp/tools/weatherTools.ts
export const GET_CURRENT_WEATHER_DEF = {
  name: 'get_current_weather',
  description: 'Get current weather for a location by latitude and longitude.',
  keywords: ['weather', 'temperature', 'forecast', 'current'],
};
export const GET_FORECAST_DEF = {
  name: 'get_forecast',
  description: 'Get weather forecast for the next 1-16 days.',
  keywords: ['weather', 'forecast', 'temperature', 'precipitation'],
};
```

### 3.2 Barrel export and getToolDefinitions()

Each server exports a `get*ToolDefinitions()` function that returns full registry entries (name, description, inputSchema, keywords, execute):

```ts
// servers/open-meteo-mcp/src/mcp/tools/index.ts (new)
import { GeocodingTools, SEARCH_LOCATIONS_DEF, getSearchLocationsSchema } from './geocodingTools.js';
import { WeatherTools, GET_CURRENT_WEATHER_DEF, GET_FORECAST_DEF, ... } from './weatherTools.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
};

export function getOpenMeteoToolDefinitions(): RegistryToolDefinition[] {
  const geocoding = new GeocodingTools();
  const weather = new WeatherTools();
  return [
    {
      ...SEARCH_LOCATIONS_DEF,
      inputSchema: GeocodingTools.getSearchLocationsSchema().inputSchema,
      execute: geocoding.executeSearchLocations.bind(geocoding),
    },
    {
      ...GET_CURRENT_WEATHER_DEF,
      inputSchema: WeatherTools.getCurrentWeatherSchema().inputSchema,
      execute: weather.executeGetCurrentWeather.bind(weather),
    },
    {
      ...GET_FORECAST_DEF,
      inputSchema: WeatherTools.getForecastSchema().inputSchema,
      execute: weather.executeGetForecast.bind(weather),
    },
  ];
}
```

### 3.3 Tool instance config (unified-mcp)

Tool classes use `getConfig()` which loads from their package. The unified server loads its own config; it must provide per-service API settings so tools receive the correct base URLs and timeouts.

**Approach:** The unified server's `config.json` includes an `api` section that merges all service API configs:

```json
{
  "api": {
    "openMeteo": {
      "geocodingBaseUrl": "https://geocoding-api.open-meteo.com/v1",
      "forecastBaseUrl": "https://api.open-meteo.com/v1",
      "timeoutMs": 15000
    },
    "restCountries": { "baseUrl": "https://restcountries.com/v3.1", "timeoutMs": 15000 },
    "wikipedia": { "restBaseUrl": "...", "mediaWikiBaseUrl": "...", "timeoutMs": 15000 },
    "hackerNews": { "firebaseBaseUrl": "...", "algoliaBaseUrl": "...", "timeoutMs": 15000 }
  }
}
```

Each `get*ToolDefinitions()` will accept an optional config override, or the unified server will set `process.env` / a shared config context before calling them. **Implementation detail:** Either (a) pass config into `get*ToolDefinitions(config)` so tools receive unified config, or (b) have the unified server load each server's config.json and pass the relevant `api` section when constructing tool instances. Prefer (b) to keep each server's config self-contained and reuse their existing config loading.

### 3.4 Registry builds from imports

```ts
// servers/unified-mcp/src/registry/toolRegistry.ts
import { getOpenMeteoToolDefinitions } from '../../open-meteo-mcp/src/mcp/tools/index.js';
import { getRestCountriesToolDefinitions } from '../../rest-countries-mcp/src/mcp/tools/index.js';
import { getWikipediaToolDefinitions } from '../../wikipedia-mcp/src/mcp/tools/index.js';
import { getHackerNewsToolDefinitions } from '../../hacker-news-mcp/src/mcp/tools/index.js';

export function buildToolRegistry(): Map<string, RegistryToolDefinition> {
  const all = [
    ...getOpenMeteoToolDefinitions(),
    ...getRestCountriesToolDefinitions(),
    ...getWikipediaToolDefinitions(),
    ...getHackerNewsToolDefinitions(),
  ];
  return new Map(all.map((t) => [t.name, t]));
}
```

**Duplicate tool names:** The registry uses a `Map` keyed by tool name. If two servers export tools with the same name, the later import overwrites the earlier. Servers must use unique tool names (current tools already satisfy this).

### 3.5 Standalone servers use definitions

Each standalone mcpServer.ts switches from hardcoded name/description to imports:

```ts
// Before
{ name: 'search_locations', description: '...', inputSchema: ... }

// After
{ ...SEARCH_LOCATIONS_DEF, inputSchema: GeocodingTools.getSearchLocationsSchema().inputSchema }
```

---

## 4. Popular Tools

- **Config:** `popularTools: ["get_current_weather", "search_wikipedia", "get_top_stories"]` (3 defaults)
- **Usage file:** `~/.config/awesome-mcp-servers/unified-usage.json`
  - Format: `{ "get_current_weather": 42, "search_wikipedia": 31, ... }`
  - Path: `config.mcp.usageFile`; env `UNIFIED_MCP_USAGE_FILE` overrides when set
- **Logic:**
  - On startup: if file exists and has data → top 5 by count = popular set
  - Otherwise → use the first `popularToolsCount` entries of `popularTools` (or all if fewer)
- **On every tool call** (popular or via search_tools execute): increment count, persist (debounced/async)
- **On graceful shutdown:** flush pending usage writes before process exit to avoid data loss

---

## 5. search_tools Tool

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "keywords": {
      "type": "string",
      "description": "One or more keywords to search for relevant tools (e.g. 'weather paris', 'countries')"
    },
    "execute": {
      "type": "object",
      "description": "Optional. If provided, execute the specified tool and return its result.",
      "properties": {
        "name": { "type": "string" },
        "arguments": { "type": "object" }
      }
    }
  },
  "required": ["keywords"]
}
```

**Behavior:**

- **If `execute` omitted:** Split keywords on whitespace; match against each tool's keyword list (case-insensitive; any term match → include); rank by match count; return top 10 with name, description, inputSchema. No phrase support.
- **If `execute` present:** Look up tool by name. If not in registry → return MCP error (e.g. `INVALID_REQUEST`, message "Unknown tool: {name}"). If found, validate `arguments` against the tool's inputSchema (invalid args produce the same validation errors as direct tool calls), run the tool, increment usage, return result.

---

## 6. tools/list Contents

Returns: `[popular_1, ..., popular_5, search_tools]` — so 6 tools when usage data exists, or 4 tools when using 3 configured + search_tools.

---

## 7. Workspace / Dependencies

- Root `package.json` will use workspaces to include all servers (implement in step 6 of implementation order)
- `unified-mcp` depends on sibling servers via `"../open-meteo-mcp"` etc., or workspace references
- Each server exports its `get*ToolDefinitions` from `src/mcp/tools/index.ts`

---

## 8. Config (unified-mcp)

```json
{
  "mcp": {
    "enabled": true,
    "transport": "both",
    "httpPort": 3000,
    "serverName": "unified-mcp",
    "serverVersion": "1.0.0",
    "popularTools": ["get_current_weather", "search_wikipedia", "get_top_stories"],
    "popularToolsCount": 5,
    "usageFile": "~/.config/awesome-mcp-servers/unified-usage.json"
  }
}
```

---

## 9. Keyword List (Per Tool)

| Tool | Keywords |
|------|----------|
| search_locations | weather, location, city, search, geocode, coordinates |
| get_current_weather | weather, temperature, forecast, current |
| get_forecast | weather, forecast, temperature, precipitation |
| get_country | country, countries, geography, capital, region |
| search_countries | country, countries, region, capital, search |
| list_all_countries | country, countries, list, all |
| search_wikipedia | wikipedia, search, article, encyclopedia |
| get_article | wikipedia, article, read, content |
| get_summary | wikipedia, summary, brief |
| get_top_stories | hacker news, hn, news, stories, top |
| get_story | hacker news, hn, story, item |
| get_comments | hacker news, hn, comments, discussion |
| search_hn | hacker news, hn, search |

---

## 10. Implementation Order

1. Add per-tool DEF constants and keywords to each server's tool files
2. Add `src/mcp/tools/index.ts` with `get*ToolDefinitions()` per server
3. Update standalone mcpServers to use DEF imports
4. Create `unified-mcp` package with config, usageTracker, toolRegistry
5. Implement mcpServer with popular tools + search_tools
6. Add workspace setup if needed
7. Documentation (README, global README)
