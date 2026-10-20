# Awesome MCP Servers

Monorepo of **API-specialized MCP servers** in TypeScript. Each workspace wraps one public API (no API keys in most cases), with **stdio** and **HTTP** transports.

**Prerequisites:** Node.js 18+, npm

## Recommended: unified-mcp

Run **one process** (port **8000**) that bundles every key-free API plus optional credential-backed providers when you pass env vars in your MCP client:

- **Popular tools** — a small default set; expands to your top-used tools over time
- **`search_tools`** — keyword discovery across the full catalog
- **`execute_tools`** — run one or many bundled tools in parallel

```bash
npm install
npm run build
npm start                 # HTTP + stdio on port 8000
npm run start:stdio       # Cursor / Claude Desktop
```

Scaling knobs (lazy load, provider allowlists, LRU cap): [servers/unified-mcp/README.md](servers/unified-mcp/README.md).

### Credential-backed tools (process env)

Unified only registers providers that need secrets when the variable is **present on the server process** (for example Cursor’s `mcpServers.*.env`). It does not read tokens from repo `.env` files for gating — though local `.env` still populates `process.env` if you use it.

| Provider | Variable | Behavior without it |
|----------|----------|---------------------|
| CareClinic | `CARECLINIC_BEARER_TOKEN` | CareClinic tools omitted from `search_tools` / `execute_tools` |

Example Cursor snippet:

```json
"unified-mcp": {
  "command": "node",
  "args": ["servers/unified-mcp/dist/app.js"],
  "env": {
    "MCP_TRANSPORT": "stdio",
    "CARECLINIC_BEARER_TOKEN": "your-oauth-access-token"
  }
}
```

`GET /health` includes `tools.providersHiddenMissingEnv` when anything was skipped.

## Full server catalog

The list of **37** sibling APIs (ports, categories, summaries) is maintained in **[docs/SERVERS.md](docs/SERVERS.md)** so this README does not grow one row per server.

Regenerate after adding a server:

```bash
npm run docs:servers
```

## Standalone vs unified

| Use case | Command |
|----------|---------|
| Everything in one MCP | `npm start` (unified-mcp) |
| One API only | `npx turbo run start:http --filter=<name>-mcp` or `cd servers/<name>-mcp && npm run start:http` |
| CareClinic only | `npx turbo run start:http --filter=careclinic-mcp` — see [servers/careclinic-mcp/README.md](servers/careclinic-mcp/README.md) |

## Root scripts

| Script | What it does |
|--------|--------------|
| `npm run build` | Build all workspaces ([turbo](https://turborepo.com), cached) |
| `npm start` | unified-mcp (default: both transports) |
| `npm run start:http` / `start:stdio` | unified-mcp on one transport |
| `npm run start:all` | Every server in parallel (heavy; prefer unified) |
| `npm run docs:servers` | Refresh [docs/SERVERS.md](docs/SERVERS.md) |

## Known limitations

- **Rate limits:** Public APIs share anonymous quotas; optional env vars (e.g. `SEMANTIC_SCHOLAR_API_KEY`) raise limits where supported.
- **GitHub public** — ~60 requests/hour unauthenticated.
