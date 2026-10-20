import { ALL_PROVIDER_IDS } from './providers.js';

function parseList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve which provider ids are active for this unified-mcp process.
 *
 * - UNIFIED_MCP_PROVIDERS — allowlist; when set, only these providers are visible/runnable.
 * - UNIFIED_MCP_EXCLUDE — removed from the default set (ignored if allowlist is set).
 */
export function resolveEnabledProviderIds(): string[] {
  const allow = parseList(process.env.UNIFIED_MCP_PROVIDERS);
  const known = new Set(ALL_PROVIDER_IDS);

  if (allow.length > 0) {
    const invalid = allow.filter((id) => !known.has(id));
    if (invalid.length > 0) {
      console.error(
        `[unified-mcp] Unknown UNIFIED_MCP_PROVIDERS entries (ignored): ${invalid.join(', ')}`
      );
    }
    return allow.filter((id) => known.has(id));
  }

  const exclude = new Set(parseList(process.env.UNIFIED_MCP_EXCLUDE));
  return ALL_PROVIDER_IDS.filter((id) => !exclude.has(id));
}

export function isEagerProviderLoad(): boolean {
  return process.env.UNIFIED_MCP_EAGER_LOAD === 'true';
}

/** 0 = no limit (default). When set to N > 0, only N providers stay loaded; LRU eviction on overflow. */
export function resolveMaxLoadedProviders(): number {
  const raw = process.env.UNIFIED_MCP_MAX_LOADED_PROVIDERS;
  if (!raw?.trim()) {
    return 0;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    console.error(
      `[unified-mcp] Invalid UNIFIED_MCP_MAX_LOADED_PROVIDERS="${raw}" — using unlimited`
    );
    return 0;
  }
  return n;
}
