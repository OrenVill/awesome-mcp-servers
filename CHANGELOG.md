# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
