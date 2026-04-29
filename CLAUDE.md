# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this repo is

Monorepo of API-specialized MCP (Model Context Protocol) servers. Each server wraps **one external API**, requires **no API keys**, and supports both **stdio** and **HTTP** transports.

- npm workspaces under [servers/](servers/) — one workspace per server.
- TypeScript, ES2022, NodeNext modules, strict mode. Node 18+.
- Runtime deps: `@modelcontextprotocol/sdk`, `express`, `cors`, `dotenv`.

## Servers

| Server | Port | Purpose |
|--------|------|---------|
| [unified-mcp](servers/unified-mcp/) | 8000 | Aggregates all servers below + `search_tools` meta-tool + usage-based "popular tools" |
| [open-meteo-mcp](servers/open-meteo-mcp/) | 3500 | Weather (geocoding, current, forecast) |
| [rest-countries-mcp](servers/rest-countries-mcp/) | 3501 | Countries lookup/search |
| [hacker-news-mcp](servers/hacker-news-mcp/) | 3502 | Top stories, items, comments, Algolia search |
| [wikipedia-mcp](servers/wikipedia-mcp/) | 3503 | Article search, summary, full extract |
| [arxiv-mcp](servers/arxiv-mcp/) | 3504 | arXiv papers — search, fetch by ID, recent by category |
| [open-library-mcp](servers/open-library-mcp/) | 3505 | Open Library — book / ISBN / work / author lookup |
| [nominatim-mcp](servers/nominatim-mcp/) | 3506 | OpenStreetMap geocoding (forward/reverse/lookup) |
| [dictionary-mcp](servers/dictionary-mcp/) | 3507 | Free Dictionary API — definitions, synonyms, phonetics |
| [frankfurter-mcp](servers/frankfurter-mcp/) | 3508 | Frankfurter — ECB FX rates, convert, historical, time series |
| [usgs-earthquake-mcp](servers/usgs-earthquake-mcp/) | 3509 | USGS Earthquake Catalog — query / recent / by event |
| [spacex-mcp](servers/spacex-mcp/) | 3510 | SpaceX — launches, rockets, latest/next |
| [github-public-mcp](servers/github-public-mcp/) | 3511 | GitHub public REST (unauthenticated, ~60 req/hr) |
| [mdn-compat-mcp](servers/mdn-compat-mcp/) | 3512 | MDN — search docs, get doc, browser-compat extract |
| [datamuse-mcp](servers/datamuse-mcp/) | 3513 | Datamuse — rhymes, synonyms, ml, sl, suggest |
| [trivia-mcp](servers/trivia-mcp/) | 3514 | Open Trivia DB — questions, categories, counts |
| [crossref-mcp](servers/crossref-mcp/) | 3515 | Crossref — DOI metadata, works/journals search |

## Build & run

Build orchestration is [turbo](https://turborepo.com). Configuration lives in [turbo.json](turbo.json); turbo derives the build order from npm-workspace `dependencies` (so `unified-mcp` lists its four siblings as `"*"` deps — that's how `dependsOn: ["^build"]` finds them).

```bash
npm install
npm run build              # turbo run build  — siblings in parallel, then unified-mcp
npm start                  # turbo run start --filter=unified-mcp
npm run start:http         # unified-mcp HTTP only (port 8000)
npm run start:stdio        # unified-mcp stdio only
npm run start:all          # every server in parallel
```

Single sibling server:

```bash
npx turbo run start:http --filter=open-meteo-mcp
# or
cd servers/<name> && MCP_TRANSPORT=http npm start
```

Build outputs (`dist/**`) and `.turbo/` are git-ignored and cached locally; `npm run build` is near-instant on a clean tree.

There are no tests in this repo. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) only runs `npm ci` + `npm run build`. Don't claim "tests pass" — there are none.

## Per-server layout

```
servers/<name>/
├── README.md
├── config.json              # mcp + api sections; env vars override
├── package.json
├── tsconfig.json
└── src/
    ├── app.ts               # entry: dotenv, config, bootstrap
    ├── config.ts            # loads config.json + env overrides; exports getMCPConfig()
    ├── services/            # API client logic (no MCP types)
    └── mcp/
        ├── mcpServer.ts     # dual transport, ListTools/CallTool handlers
        ├── types/mcpTypes.ts
        └── tools/*Tools.ts  # one file per tool group
```

`unified-mcp` additionally has [src/registry/](servers/unified-mcp/src/registry/) for the cross-server tool registry and persistent usage tracker (`~/.config/awesome-mcp-servers/unified-usage.json`).

## Conventions

- **One API per server.** Don't merge unrelated APIs into one server (the unified server is the only aggregator).
- **Config:** every server has a root `config.json` with `mcp` and `api` sections. `src/config.ts` loads it and applies env overrides. Standard env vars: `MCP_TRANSPORT`, `MCP_HTTP_PORT`, `MCP_SERVER_NAME`, `ENABLE_MCP_SERVER`. API-specific vars are namespaced (e.g. `OPEN_METEO_FORECAST_URL`).
- **Tool responses:** always `{ content: [{ type: 'text', text }] }`. Errors via `createMCPErrorResult(MCPErrorCode.XXX, message)`.
- **Tool dispatch:** exhaustive `switch` on tool name in `mcpServer.ts`; throw on unknown.
- **Transports:** stdio uses `StdioServerTransport`; HTTP uses `StreamableHTTPServerTransport` mounted at `/mcp` with a session map keyed by `Mcp-Session-Id`. Always expose `GET /health`.
- **Logging:** stderr only (stdout is reserved for stdio transport). Prefix every line with `[<serverName>]`. Log transport ready, session init/close, tool call + ok/error.
- **Tool keywords:** every tool definition includes a `keywords` array — the unified server's `search_tools` ranks against it.

The full pattern is documented in [.cursor/rules/mcp-server-creation.mdc](.cursor/rules/mcp-server-creation.mdc) and mirrored in [.claude/rules/mcp-server-creation.mdc](.claude/rules/mcp-server-creation.mdc). Read it before adding or modifying servers.

## When adding a new server

1. Scaffold `servers/<name>/` matching the layout above.
2. The workspace is auto-discovered via the `servers/*` glob — no root edit needed.
3. If the server should be aggregated, **add it as a `"*"` dep in `servers/unified-mcp/package.json`** (so turbo orders it before `unified-mcp:build`), then register its tools in `servers/unified-mcp/src/registry/toolRegistry.ts` and add its API config block to `servers/unified-mcp/config.json`.
4. Update [README.md](README.md) (Servers table + Quick Start) and [CHANGELOG.md](CHANGELOG.md).
5. Pick a free port in the 35xx range (or 8xxx for aggregators).

## Things to leave alone

- Don't introduce a test framework or lint config without being asked — none exist today.
- Don't add API-key handling. The "no API key required" property is a feature.
- Don't replace turbo with a hand-rolled `-w` chain. Build order comes from workspace dependencies + `dependsOn: ["^build"]`; that's how a new aggregated server gets ordered without editing root scripts.
- Don't write to stdout from any server — it breaks stdio transport. Use `console.error`.
