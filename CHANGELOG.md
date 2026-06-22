# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- **Batch (multi-request) inputs** — single-item tools across the servers now accept
  either a single value or an array on their primary input, running sub-requests
  concurrently and returning one result section per item (joined by `---`). Fully
  backwards-compatible: passing a single value behaves exactly as before. Covered tools:
  - search/lookup queries: `search_wikipedia`, `get_article`, `get_summary`,
    `search_arxiv`, `get_paper`, `search_works`, `search_journals`, `get_work`,
    `get_journal`, `search_books`, `get_book_by_isbn`, `get_author`, `search_repos`,
    `get_repo`, `get_user`, `list_repo_issues`, `list_repo_releases`, `search_hn`,
    `get_story`, `get_comments`, `search_mdn`, `get_doc`, `get_browser_compat`,
    `get_country`, `search_countries`, `get_launch`, `get_rocket`, `get_event`
  - word tools: `define_word`, `get_synonyms`, `get_phonetics`, `find_rhymes`,
    `find_synonyms`, `means_like`, `sounds_like`, `suggest`
  - geo: `geocode`, `reverse_geocode`, `search_locations`, `get_current_weather`,
    `get_forecast` (lat/lon arrays zipped pairwise)
  - currency: `convert_currency` (multiple target currencies), `get_historical_rates`
    (multiple dates)
  - Per-item failures are isolated as an error section rather than failing the whole batch.

### Fixed

- **rest-countries-mcp** — restore functionality after the upstream
  `restcountries.com/v3.1` API was deprecated/removed (it now 301-redirects to a
  deprecation notice, and v5 requires an API key). The service now sources the
  same data from the key-free `mledoze/countries` dataset (jsDelivr CDN),
  fetched once and cached in memory, with all lookups filtered locally. Tool
  names, schemas, and output formatting are unchanged (population is no longer
  reported, as the dataset omits it).
- **rest-countries-mcp** — harden the service so a deprecated/changed upstream
  (any non-array or non-JSON response) raises a clear error instead of being
  silently treated as "No country found", which previously caused models to
  retry endlessly.

## [1.0.0] - 2025-03-22

### Added

- **unified-mcp** — All-in-one MCP server bundling all tools:
  - Popular tools (top 5 by usage, configurable defaults)
  - `search_tools` meta-tool for keyword-based discovery and execution
  - Persistent usage tracking (`~/.config/awesome-mcp-servers/unified-usage.json`)
  - HTTP transport (default port 8000)
- **open-meteo-mcp** — Weather API: location search, current weather, forecasts
- **rest-countries-mcp** — Countries API: lookup, search by region/capital, list all
- **wikipedia-mcp** — Wikipedia/MediaWiki: search, get article, get summary
- **hacker-news-mcp** — Hacker News: top stories, story, comments, Algolia search
- Per-server tool definitions with keywords (for unified search_tools)
- Root workspace with sequential build order
- Logging with `[serverName]` prefix for all servers
- No API keys required for any server

### Config

- Each server: `config.json` with `mcp` and `api` sections
- Env overrides: `MCP_TRANSPORT`, `MCP_HTTP_PORT`, `UNIFIED_MCP_USAGE_FILE`
- Default ports: unified 8000, open-meteo 3500, rest-countries 3501, hacker-news 3502, wikipedia 3503
