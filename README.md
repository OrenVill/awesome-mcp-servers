# Awesome MCP Servers

Collection of API-specialized MCP (Model Context Protocol) servers. Each server targets one API and supports both HTTP and stdio transports. No API keys required.

**Prerequisites:** Node.js 18+, npm

## Servers

| Server | Description |
|--------|-------------|
| [unified-mcp](servers/unified-mcp/) | **All-in-one** — bundles every server below with popular tools + search_tools (no API key) |
| [open-meteo-mcp](servers/open-meteo-mcp/) | Weather API — location search, current weather, forecasts (no API key) |
| [rest-countries-mcp](servers/rest-countries-mcp/) | Countries API — lookup by name/code, search by region/capital, list all (no API key) |
| [wikipedia-mcp](servers/wikipedia-mcp/) | Wikipedia/MediaWiki API — search articles, get summaries and extracts (no API key) |
| [hacker-news-mcp](servers/hacker-news-mcp/) | Hacker News API — top stories, items, comments, Algolia search (no API key) |
| [arxiv-mcp](servers/arxiv-mcp/) | arXiv API — search research papers, fetch by ID, list by category (no API key) |
| [open-library-mcp](servers/open-library-mcp/) | Open Library — book search, ISBN/work/author lookup (no API key) |
| [nominatim-mcp](servers/nominatim-mcp/) | OpenStreetMap Nominatim — forward & reverse geocoding (no API key) |
| [dictionary-mcp](servers/dictionary-mcp/) | Free Dictionary API — definitions, synonyms, phonetics (no API key) |
| [frankfurter-mcp](servers/frankfurter-mcp/) | Frankfurter — ECB FX rates, conversion, historical & time series (no API key) |
| [usgs-earthquake-mcp](servers/usgs-earthquake-mcp/) | USGS Earthquake Catalog — query events by region/magnitude/time (no API key) |
| [spacex-mcp](servers/spacex-mcp/) | SpaceX — launches (latest/next/list), rockets, single-launch lookup (no API key) |
| [github-public-mcp](servers/github-public-mcp/) | GitHub public REST — repos, users, issues, releases, search (unauthenticated, ~60 req/hr) |
| [mdn-compat-mcp](servers/mdn-compat-mcp/) | MDN — search docs, fetch page, browser-compat extraction (no API key) |
| [datamuse-mcp](servers/datamuse-mcp/) | Datamuse — rhymes, synonyms, means-like, sounds-like, suggest (no API key) |
| [trivia-mcp](servers/trivia-mcp/) | Open Trivia DB — questions, categories, per-category counts (no API key) |
| [crossref-mcp](servers/crossref-mcp/) | Crossref — DOI metadata, works/journals search (no API key; optional `mailto` for polite pool) |

## Quick Start

From the repo root:

```bash
npm install
npm run build         # turbo builds all servers in dependency order (cached)
npm start             # starts unified-mcp (HTTP+stdio) on port 8000
```

Other root scripts (all powered by [turbo](https://turborepo.com)):

| Script | What it does |
|--------|-------------|
| `npm run build` | Build every server. Cached — re-runs are near-instant. |
| `npm start` | Start `unified-mcp` (default transport: both). |
| `npm run start:http` | Start `unified-mcp` on HTTP only (port 8000). |
| `npm run start:stdio` | Start `unified-mcp` on stdio only (Cursor / Claude Desktop). |
| `npm run start:all` | Start every server in parallel. |

### Running a single server

Filter via turbo from the root:

```bash
npx turbo run start:http --filter=open-meteo-mcp        # port 3500
npx turbo run start:http --filter=rest-countries-mcp    # port 3501
npx turbo run start:http --filter=hacker-news-mcp       # port 3502
npx turbo run start:http --filter=wikipedia-mcp         # port 3503
npx turbo run start:http --filter=arxiv-mcp             # port 3504
npx turbo run start:http --filter=open-library-mcp      # port 3505
npx turbo run start:http --filter=nominatim-mcp         # port 3506
npx turbo run start:http --filter=dictionary-mcp        # port 3507
npx turbo run start:http --filter=frankfurter-mcp       # port 3508
npx turbo run start:http --filter=usgs-earthquake-mcp   # port 3509
npx turbo run start:http --filter=spacex-mcp            # port 3510
npx turbo run start:http --filter=github-public-mcp     # port 3511
npx turbo run start:http --filter=mdn-compat-mcp        # port 3512
npx turbo run start:http --filter=datamuse-mcp          # port 3513
npx turbo run start:http --filter=trivia-mcp            # port 3514
npx turbo run start:http --filter=crossref-mcp          # port 3515
```

Or `cd` into the server and use its own scripts (`npm start`, `npm run start:http`, `npm run start:stdio`).

## Known limitations

- **Rate limits:** External APIs (Open-Meteo, Wikipedia, etc.) may enforce rate limits; no keys = shared quotas.
