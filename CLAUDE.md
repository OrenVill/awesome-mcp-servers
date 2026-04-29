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

## Build & run

Always build from the repo root — `unified-mcp` depends on the sibling servers being built first:

```bash
npm install
npm run build              # builds all workspaces in dependency order
```

The root [package.json](package.json) `build` script encodes this order. `unified-mcp/package.json` also has a `prestart` that runs the root build, so `npm start` from `servers/unified-mcp/` is safe.

Run a server:

```bash
cd servers/<name>
MCP_TRANSPORT=http npm start    # HTTP on the port from config.json
MCP_TRANSPORT=stdio npm start   # stdio for Cursor / Claude Desktop
MCP_TRANSPORT=both npm start    # default
```

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
2. Add the workspace entry implicitly via `servers/*` (already wildcarded in root [package.json](package.json)) and **append it to the root `build` script in dependency order** — `unified-mcp` last.
3. If the server should be aggregated, register its tools in `servers/unified-mcp/src/registry/toolRegistry.ts` and add its API config block to `servers/unified-mcp/config.json`.
4. Update [README.md](README.md) (Servers table + Quick Start) and [CHANGELOG.md](CHANGELOG.md).
5. Pick a free port in the 35xx range (or 8xxx for aggregators).

## Things to leave alone

- Don't introduce a test framework or lint config without being asked — none exist today.
- Don't add API-key handling. The "no API key required" property is a feature.
- Don't change the build ordering scheme to a generic graph builder; the explicit `-w` chain in root `package.json` is intentional and dependency-correct.
- Don't write to stdout from any server — it breaks stdio transport. Use `console.error`.
