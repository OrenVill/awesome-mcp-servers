# careclinic-mcp

Local MCP server that proxies tools to the official [CareClinic Health Tracker](https://careclinic.io/careclinic-mcp/) remote MCP at `https://mcp.careclinic.io/mcp`.

**Every user must supply their own OAuth access token.** This repo does not host CareClinic credentials. In **unified-mcp**, CareClinic tools appear only when `CARECLINIC_BEARER_TOKEN` is set on the MCP process (e.g. your client’s `env` block).

## Authentication (required for tool calls)

1. Connect your CareClinic account to an MCP client that supports OAuth (see [CareClinic’s docs](https://github.com/tandemloop/careclinic_mcp)), **or** complete the OAuth flow described at `https://mcp.careclinic.io/.well-known/oauth-authorization-server`.
2. Copy the **access token** (bearer token) for **your** account.
3. Set it in the environment before starting this server:

```bash
export CARECLINIC_BEARER_TOKEN='your-access-token-here'
```

You may include or omit the `Bearer ` prefix; both work.

If `CARECLINIC_BEARER_TOKEN` is missing, `tools/list` still works (tool names come from CareClinic), but **every `tools/call` returns a clear error** asking you to set the variable.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CARECLINIC_BEARER_TOKEN` | — | **Required for calls.** Your personal OAuth access token. |
| `CARECLINIC_MCP_URL` | `https://mcp.careclinic.io/mcp` | Upstream MCP endpoint |
| `CARECLINIC_TIMEOUT_MS` | `60000` | Upstream timeout |
| `MCP_TRANSPORT` | `both` | `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `3516` | HTTP port |
| `MCP_SERVER_NAME` | `careclinic-mcp` | MCP server name |
| `ENABLE_MCP_SERVER` | `true` | Set `false` to disable |

## Run

```bash
cd servers/careclinic-mcp
npm run build
CARECLINIC_BEARER_TOKEN='…' npm start
```

HTTP health check: `GET http://localhost:3516/health` includes `careclinicBearerTokenConfigured`.

## Cursor (stdio)

```json
{
  "mcpServers": {
    "careclinic": {
      "command": "node",
      "args": ["/absolute/path/to/awesome-mcp-servers/servers/careclinic-mcp/dist/app.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "CARECLINIC_BEARER_TOKEN": "your-access-token-here"
      }
    }
  }
}
```

Use **your** token only; never commit tokens to git or share a single token across users.

## Prefer OAuth in the client?

If your MCP client supports remote OAuth connectors, you can skip this wrapper and point the client directly at `https://mcp.careclinic.io/mcp` (see root README). Use **this** server when you already have a bearer token and want stdio or a local HTTP hop.

## Upstream

- Repo: [tandemloop/careclinic_mcp](https://github.com/tandemloop/careclinic_mcp)
- Help: [Connect CareClinic to supported AI clients](https://cdn.careclinic.io/mcp/help/index.html)
