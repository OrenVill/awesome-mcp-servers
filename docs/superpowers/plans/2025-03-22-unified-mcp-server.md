# Unified MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified MCP server that bundles all tools with popular-tool discovery and a search_tools meta-tool, while keeping individual servers runnable standalone.

**Architecture:** Per-service tool files export DEF constants (name, description, keywords) and `get*ToolDefinitions(apiConfig)`; a new unified-mcp package imports these, builds a registry, exposes top-5 popular + search_tools, and tracks usage in a persistent JSON file.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, express, Node 18+

**Spec:** `docs/superpowers/specs/2025-03-22-unified-mcp-server-design.md`

---

## File Map

### New files
- `servers/open-meteo-mcp/src/mcp/tools/index.ts` — barrel + getOpenMeteoToolDefinitions
- `servers/rest-countries-mcp/src/mcp/tools/index.ts` — barrel + getRestCountriesToolDefinitions
- `servers/wikipedia-mcp/src/mcp/tools/index.ts` — barrel + getWikipediaToolDefinitions
- `servers/hacker-news-mcp/src/mcp/tools/index.ts` — barrel + getHackerNewsToolDefinitions
- `servers/unified-mcp/` — full package (config, app, registry, mcpServer, README)
- `package.json` (root) — workspaces

### Modified files
- `servers/open-meteo-mcp/src/mcp/tools/geocodingTools.ts` — add SEARCH_LOCATIONS_DEF
- `servers/open-meteo-mcp/src/mcp/tools/weatherTools.ts` — add GET_CURRENT_WEATHER_DEF, GET_FORECAST_DEF
- `servers/open-meteo-mcp/src/mcp/mcpServer.ts` — use DEF imports
- `servers/rest-countries-mcp/src/mcp/tools/countriesTools.ts` — add GET_COUNTRY_DEF, SEARCH_COUNTRIES_DEF, LIST_ALL_COUNTRIES_DEF
- `servers/rest-countries-mcp/src/mcp/mcpServer.ts` — use DEF imports
- `servers/wikipedia-mcp/src/mcp/tools/wikipediaTools.ts` — add SEARCH_WIKIPEDIA_DEF, GET_ARTICLE_DEF, GET_SUMMARY_DEF
- `servers/wikipedia-mcp/src/mcp/mcpServer.ts` — use DEF imports
- `servers/hacker-news-mcp/src/mcp/tools/hackerNewsTools.ts` — add DEF for each tool
- `servers/hacker-news-mcp/src/mcp/mcpServer.ts` — use DEF imports
- `README.md` — add unified-mcp to Servers table and Quick Start

---

## Phase 1: Tool definitions (open-meteo-mcp)

### Task 1: Add DEF constants to geocodingTools

**Files:** Modify `servers/open-meteo-mcp/src/mcp/tools/geocodingTools.ts`

- [ ] **Step 1: Add SEARCH_LOCATIONS_DEF export**

After the imports (before `export interface SearchLocationsInput`), add:

```ts
export const SEARCH_LOCATIONS_DEF = {
  name: 'search_locations',
  description:
    'Search for locations by name or postal code. Returns coordinates and timezone for use with weather tools. Use before get_current_weather or get_forecast when you only have a place name.',
  keywords: ['weather', 'location', 'city', 'search', 'geocode', 'coordinates'],
};
```

- [ ] **Step 2: Commit**

```bash
cd servers/open-meteo-mcp && git add src/mcp/tools/geocodingTools.ts && git commit -m "feat(open-meteo): add SEARCH_LOCATIONS_DEF with keywords"
```

---

### Task 2: Add DEF constants to weatherTools

**Files:** Modify `servers/open-meteo-mcp/src/mcp/tools/weatherTools.ts`

- [ ] **Step 1: Add GET_CURRENT_WEATHER_DEF and GET_FORECAST_DEF**

After the DEFAULT_DAILY constant (before `export interface GetCurrentWeatherInput`), add:

```ts
export const GET_CURRENT_WEATHER_DEF = {
  name: 'get_current_weather',
  description:
    'Get current weather conditions for a location by latitude and longitude. Returns temperature, humidity, wind, precipitation, and weather conditions.',
  keywords: ['weather', 'temperature', 'forecast', 'current'],
};
export const GET_FORECAST_DEF = {
  name: 'get_forecast',
  description:
    'Get multi-day weather forecast for a location. Returns daily highs/lows, precipitation, and conditions for up to 16 days.',
  keywords: ['weather', 'forecast', 'temperature', 'precipitation'],
};
```

- [ ] **Step 2: Commit**

```bash
cd servers/open-meteo-mcp && git add src/mcp/tools/weatherTools.ts && git commit -m "feat(open-meteo): add weather DEF constants with keywords"
```

---

### Task 3: Add open-meteo tools index

**Files:** Create `servers/open-meteo-mcp/src/mcp/tools/index.ts`

- [ ] **Step 1: Create index.ts**

```ts
import { GeocodingTools, SEARCH_LOCATIONS_DEF } from './geocodingTools.js';
import {
  WeatherTools,
  GET_CURRENT_WEATHER_DEF,
  GET_FORECAST_DEF,
} from './weatherTools.js';
import { OpenMeteoService } from '../../services/openMeteoService.js';
import { getConfig } from '../../config.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function getOpenMeteoToolDefinitions(apiConfig?: {
  geocodingBaseUrl?: string;
  forecastBaseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenMeteoService({
    geocodingBase: config.geocodingBaseUrl ?? 'https://geocoding-api.open-meteo.com/v1',
    forecastBase: config.forecastBaseUrl ?? 'https://api.open-meteo.com/v1',
    timeout: config.timeoutMs ?? 15000,
  });
  const geocoding = new GeocodingTools(service);
  const weather = new WeatherTools(service);
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

- [ ] **Step 2: Verify build**

```bash
cd servers/open-meteo-mcp && npm run build
```
Expected: success

- [ ] **Step 3: Commit**

```bash
git add src/mcp/tools/index.ts && git commit -m "feat(open-meteo): add tools index and getOpenMeteoToolDefinitions"
```

---

### Task 4: Update open-meteo mcpServer to use DEFs

**Files:** Modify `servers/open-meteo-mcp/src/mcp/mcpServer.ts`

- [ ] **Step 1: Add imports**

Add:
```ts
import { SEARCH_LOCATIONS_DEF } from './tools/geocodingTools.js';
import { GET_CURRENT_WEATHER_DEF, GET_FORECAST_DEF } from './tools/weatherTools.js';
```

- [ ] **Step 2: Replace tool definitions in ListToolsRequestSchema**

Replace the tools array with:
```ts
const tools: Tool[] = [
  {
    ...SEARCH_LOCATIONS_DEF,
    inputSchema: GeocodingTools.getSearchLocationsSchema().inputSchema as Tool['inputSchema'],
  },
  {
    ...GET_CURRENT_WEATHER_DEF,
    inputSchema: WeatherTools.getCurrentWeatherSchema().inputSchema as Tool['inputSchema'],
  },
  {
    ...GET_FORECAST_DEF,
    inputSchema: WeatherTools.getForecastSchema().inputSchema as Tool['inputSchema'],
  },
];
```

- [ ] **Step 3: Build and commit**

```bash
npm run build && git add src/mcp/mcpServer.ts && git commit -m "refactor(open-meteo): mcpServer use DEF imports"
```

---

## Phase 2: Tool definitions (rest-countries-mcp)

### Task 5: Add DEF constants to countriesTools

**Files:** Modify `servers/rest-countries-mcp/src/mcp/tools/countriesTools.ts`

- [ ] **Step 1: Add DEF constants**

After the imports (before `const DEFAULT_FIELDS`), add:

```ts
export const GET_COUNTRY_DEF = {
  name: 'get_country',
  description:
    'Look up a country by name or alpha-2/alpha-3 code. Returns country details including capital, region, population, languages.',
  keywords: ['country', 'countries', 'geography', 'capital', 'region'],
};
export const SEARCH_COUNTRIES_DEF = {
  name: 'search_countries',
  description:
    'Search countries by region, subregion, or capital city. Returns matching countries.',
  keywords: ['country', 'countries', 'region', 'capital', 'search'],
};
export const LIST_ALL_COUNTRIES_DEF = {
  name: 'list_all_countries',
  description:
    'List all countries with optional field selection. Returns name, codes, capital, region, etc.',
  keywords: ['country', 'countries', 'list', 'all'],
};
```

- [ ] **Step 2: Commit**

```bash
cd servers/rest-countries-mcp && git add src/mcp/tools/countriesTools.ts && git commit -m "feat(rest-countries): add DEF constants with keywords"
```

---

### Task 6: Add rest-countries tools index

**Files:** Create `servers/rest-countries-mcp/src/mcp/tools/index.ts`

- [ ] **Step 1: Create index.ts**

```ts
import {
  CountriesTools,
  GET_COUNTRY_DEF,
  SEARCH_COUNTRIES_DEF,
  LIST_ALL_COUNTRIES_DEF,
} from './countriesTools.js';
import { RestCountriesService } from '../../services/restCountriesService.js';
import { getConfig } from '../../config.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function getRestCountriesToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new RestCountriesService({
    baseUrl: config.baseUrl ?? 'https://restcountries.com/v3.1',
    timeout: config.timeoutMs ?? 15000,
  });
  const countriesTools = new CountriesTools(service);
  return [
    {
      ...GET_COUNTRY_DEF,
      inputSchema: CountriesTools.getGetCountrySchema().inputSchema,
      execute: countriesTools.executeGetCountry.bind(countriesTools),
    },
    {
      ...SEARCH_COUNTRIES_DEF,
      inputSchema: CountriesTools.getSearchCountriesSchema().inputSchema,
      execute: countriesTools.executeSearchCountries.bind(countriesTools),
    },
    {
      ...LIST_ALL_COUNTRIES_DEF,
      inputSchema: CountriesTools.getListAllCountriesSchema().inputSchema,
      execute: countriesTools.executeListAllCountries.bind(countriesTools),
    },
  ];
}
```

- [ ] **Step 2: Build and commit**

```bash
npm run build && git add src/mcp/tools/index.ts && git commit -m "feat(rest-countries): add tools index and getRestCountriesToolDefinitions"
```

---

### Task 7: Update rest-countries mcpServer to use DEFs

**Files:** Modify `servers/rest-countries-mcp/src/mcp/mcpServer.ts`

- [ ] **Step 1: Add imports and replace tools array**

Add imports for GET_COUNTRY_DEF, SEARCH_COUNTRIES_DEF, LIST_ALL_COUNTRIES_DEF from countriesTools.
Replace the tools array in ListToolsRequestSchema with DEF-based entries (same pattern as open-meteo).

- [ ] **Step 2: Build and commit**

```bash
npm run build && git add src/mcp/mcpServer.ts && git commit -m "refactor(rest-countries): mcpServer use DEF imports"
```

---

## Phase 3: Tool definitions (wikipedia-mcp)

### Task 8: Add DEF constants to wikipediaTools

**Files:** Modify `servers/wikipedia-mcp/src/mcp/tools/wikipediaTools.ts`

- [ ] **Step 1: Add DEF constants**

After imports, before `export interface SearchWikipediaInput`:

```ts
export const SEARCH_WIKIPEDIA_DEF = {
  name: 'search_wikipedia',
  description:
    'Search for Wikipedia articles by query. Returns article titles and snippets. Use before get_article or get_summary when you need to find articles by topic.',
  keywords: ['wikipedia', 'search', 'article', 'encyclopedia'],
};
export const GET_ARTICLE_DEF = {
  name: 'get_article',
  description:
    'Get full extract/summary of a Wikipedia article by exact title. Returns introductory and extended content.',
  keywords: ['wikipedia', 'article', 'read', 'content'],
};
export const GET_SUMMARY_DEF = {
  name: 'get_summary',
  description:
    'Get a brief summary of a Wikipedia article by exact title. Uses REST summary when available, otherwise intro extract.',
  keywords: ['wikipedia', 'summary', 'brief'],
};
```

- [ ] **Step 2: Commit**

```bash
cd servers/wikipedia-mcp && git add src/mcp/tools/wikipediaTools.ts && git commit -m "feat(wikipedia): add DEF constants with keywords"
```

---

### Task 9: Add wikipedia tools index and update mcpServer

**Files:** Create `servers/wikipedia-mcp/src/mcp/tools/index.ts`, Modify `servers/wikipedia-mcp/src/mcp/mcpServer.ts`

- [ ] **Step 1: Create index.ts** — same pattern as rest-countries. Use `WikipediaTools.getSearchWikipediaSchema()`, `getGetArticleSchema()`, `getGetSummarySchema()`. WikipediaService takes `restBaseUrl`, `mediaWikiBaseUrl`, `timeoutMs`.
- [ ] **Step 2: Update mcpServer** — import SEARCH_WIKIPEDIA_DEF, GET_ARTICLE_DEF, GET_SUMMARY_DEF; replace tools array with DEF-based entries
- [ ] **Step 3: Build and commit**

---

## Phase 4: Tool definitions (hacker-news-mcp)

### Task 10: Add DEF constants to hackerNewsTools

**Files:** Modify `servers/hacker-news-mcp/src/mcp/tools/hackerNewsTools.ts`

- [ ] **Step 1: Add DEF constants** for get_top_stories, get_story, get_comments, search_hn. Keywords per spec §9: get_top_stories (hacker news, hn, news, stories, top), get_story (hacker news, hn, story, item), get_comments (hacker news, hn, comments, discussion), search_hn (hacker news, hn, search)
- [ ] **Step 2: Commit**

---

### Task 11: Add hacker-news tools index and update mcpServer

**Files:** Create `servers/hacker-news-mcp/src/mcp/tools/index.ts`, Modify `servers/hacker-news-mcp/src/mcp/mcpServer.ts`

- [ ] **Step 1: Create index.ts** — use `HackerNewsTools.getTopStoriesSchema()`, `getStorySchema()`, `getCommentsSchema()`, `getSearchHNSchema()`. HackerNewsService takes `firebaseBaseUrl`, `algoliaBaseUrl`, `timeoutMs`.
- [ ] **Step 2: Update mcpServer** — import DEFs for get_top_stories, get_story, get_comments, search_hn; replace tools array
- [ ] **Step 3: Build and commit**

---

## Phase 5: Unified MCP package

### Task 12: Create unified-mcp package scaffold

**Files:** Create `servers/unified-mcp/package.json`, `tsconfig.json`, `config.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "unified-mcp",
  "version": "1.0.0",
  "description": "Unified MCP server bundling all awesome-mcp tools with popular-tool discovery",
  "main": "dist/app.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "start:stdio": "MCP_TRANSPORT=stdio node dist/app.js",
    "start:http": "MCP_TRANSPORT=http node dist/app.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.22.0",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.5",
    "@types/node": "^22.0.0",
    "typescript": "^5.9.3"
  },
  "engines": { "node": ">=18" }
}
```

- [ ] **Step 2: Create tsconfig.json** (mirror open-meteo-mcp)
- [ ] **Step 3: Create config.json** with mcp + api sections per spec
- [ ] **Step 4: npm install**
- [ ] **Step 5: Commit**

---

### Task 13: Create unified config.ts

**Files:** Create `servers/unified-mcp/src/config.ts`

- [ ] **Step 1: Implement config loader** with mcp (popularTools, popularToolsCount, usageFile) and api (openMeteo, restCountries, wikipedia, hackerNews). Env UNIFIED_MCP_USAGE_FILE overrides usageFile. Export `getMCPConfig()` and `getConfig()` for app.ts (consistent with other servers).
- [ ] **Step 2: Commit**

---

### Task 14: Create usageTracker

**Files:** Create `servers/unified-mcp/src/registry/usageTracker.ts`

- [ ] **Step 1: Implement UsageTracker**
  - `increment(toolName: string): void` — bump count in memory
  - `getTopN(n: number): string[]` — return top N tool names by count
  - `load(): void` — read from file (expand ~ to home), init map
  - `flush(): Promise<void>` — write to file (async, debounced)
  - `flushSync(): void` — immediate write (for shutdown)
- [ ] **Step 2: On increment, schedule debounced flush (e.g. 2s)**
- [ ] **Step 3: Commit**

---

### Task 15: Create toolRegistry

**Files:** Create `servers/unified-mcp/src/registry/toolRegistry.ts`

- [ ] **Step 1: Implement buildToolRegistry** — import get*ToolDefinitions from each server. Use relative paths `../../../open-meteo-mcp/dist/mcp/tools/index.js` (3 levels up from `registry/` to `servers/`). Pass api config from unified config, build Map.
- [ ] **Step 2: Export RegistryToolDefinition type** (define locally or re-export)
- [ ] **Step 3: Verify imports resolve** — **Build order:** run `npm run build` in each of open-meteo-mcp, rest-countries-mcp, wikipedia-mcp, hacker-news-mcp before building unified-mcp.
- [ ] **Step 4: Commit**

---

### Task 16: Implement unified mcpServer

**Files:** Create `servers/unified-mcp/src/mcp/mcpServer.ts`

- [ ] **Step 1: Create MCPServer class** with same transport pattern as other servers (stdio + HTTP). Export `createMCPServer(config)` for app.ts to use.
- [ ] **Step 2: ListToolsRequestSchema** — return popular tools (from usageTracker.getTopN or config) + search_tools. Popular set: if usage file has data → top 5; else first popularToolsCount of popularTools
- [ ] **Step 3: CallToolRequestSchema** — switch on name; for search_tools, handle keywords + execute; for others, delegate to registry, call usageTracker.increment
- [ ] **Step 4: search_tools logic** — keywords split on whitespace, case-insensitive match, return top 10; execute: lookup registry, if missing return error, else run and increment
- [ ] **Step 5: Logging** — same pattern as other servers
- [ ] **Step 6: stop()** — call usageTracker.flushSync() before closing
- [ ] **Step 7: Build and test**
- [ ] **Step 8: Commit**

---

### Task 17: Create unified app.ts

**Files:** Create `servers/unified-mcp/src/app.ts`

- [ ] **Step 1: Entry point** — dotenv, load config, createMCPServer, graceful shutdown (SIGTERM/SIGINT) with await mcpServer.stop()
- [ ] **Step 2: Build and run** — verify stdio and HTTP
- [ ] **Step 3: Commit**

---

### Task 18: Add root workspaces

**Files:** Create or modify `package.json` at repo root

- [ ] **Step 1: Add workspaces** — if no root package.json exists, create one with `"workspaces": ["servers/*"]`. Add `"build": "npm run build --workspaces"` (or sequential builds) to build all before unified-mcp.
- [ ] **Step 2: npm install at root** to link
- [ ] **Step 3: Verify unified-mcp can import from siblings** (may need to adjust imports to use package names if workspace names differ)
- [ ] **Step 4: Commit**

---

### Task 19: Fix unified-mcp imports

**Files:** Modify `servers/unified-mcp/src/registry/toolRegistry.ts`

- [ ] **Step 1: Resolve import paths** — use `../../../open-meteo-mcp/dist/mcp/tools/index.js` (3 levels up from `src/registry/` to `servers/`). Same for rest-countries-mcp, wikipedia-mcp, hacker-news-mcp. Ensure all four servers are built before building unified-mcp.
- [ ] **Step 2: Ensure tool classes receive correct config** — unified config.api.openMeteo has geocodingBaseUrl, forecastBaseUrl, timeoutMs; map to OpenMeteoService constructor
- [ ] **Step 3: Build and run quick test**
- [ ] **Step 4: Commit**

---

### Task 20: Add unified-mcp README and update global README

**Files:** Create `servers/unified-mcp/README.md`, Modify `README.md`

- [ ] **Step 1: unified-mcp README** — tools (popular + search_tools), config, Cursor setup
- [ ] **Step 2: Global README** — add unified-mcp to Servers table, add Quick Start for unified
- [ ] **Step 3: Commit**

---

## Verification

**Build order:** Build open-meteo-mcp, rest-countries-mcp, wikipedia-mcp, hacker-news-mcp (in any order), then unified-mcp.

- [ ] All 4 standalone servers build and run (no regression)
- [ ] unified-mcp builds and runs (stdio + HTTP)
- [ ] tools/list returns popular + search_tools
- [ ] search_tools with keywords only returns matching tools
- [ ] search_tools with execute runs tool and returns result
- [ ] Usage file created/updated after tool calls
- [ ] Graceful shutdown flushes usage
