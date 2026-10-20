import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { getConfig } from '../config.js';
import {
  isEagerProviderLoad,
  resolveEnabledProviderIds,
  resolveMaxLoadedProviders,
} from './providerFilter.js';
import { applyProcessEnvFilter } from './providerEnv.js';
import { PROVIDERS, type ProviderSpec } from './providers.js';
import type { RegistryToolDefinition } from './toolRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ToolCatalogEntry = {
  name: string;
  description: string;
  keywords: string[];
  inputSchema: object;
  provider: string;
};

type ToolCatalogFile = {
  version: number;
  tools: ToolCatalogEntry[];
};

function loadCatalogFile(): ToolCatalogFile {
  const path = resolve(__dirname, 'tool-catalog.json');
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as ToolCatalogFile;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Missing or invalid tool catalog at ${path} (${msg}). Run "npm run build" in unified-mcp (or from repo root).`
    );
  }
}

export class LazyToolRegistry {
  private enabledProviderIds: Set<string>;
  private providersHiddenMissingEnv: Array<{ id: string; missing: string[] }>;
  private providerById: Map<string, ProviderSpec>;
  private catalog: ToolCatalogEntry[];
  private catalogByName: Map<string, ToolCatalogEntry>;
  private toolNamesByProvider = new Map<string, Set<string>>();
  private maxLoadedProviders: number;
  private loadedProviders = new Set<string>();
  private providerLastUsed = new Map<string, number>();
  private executeByName = new Map<string, RegistryToolDefinition['execute']>();
  private loadPromises = new Map<string, Promise<void>>();
  private totalEvictions = 0;

  constructor() {
    const filterResolved = resolveEnabledProviderIds();
    this.providerById = new Map(PROVIDERS.map((p) => [p.id, p]));
    const { enabled, hiddenMissingEnv } = applyProcessEnvFilter(
      filterResolved,
      this.providerById
    );
    this.enabledProviderIds = enabled;
    this.providersHiddenMissingEnv = hiddenMissingEnv;
    this.maxLoadedProviders = resolveMaxLoadedProviders();

    const file = loadCatalogFile();
    this.catalog = file.tools.filter((t) => this.enabledProviderIds.has(t.provider));
    this.catalogByName = new Map(this.catalog.map((t) => [t.name, t]));
    for (const tool of this.catalog) {
      let names = this.toolNamesByProvider.get(tool.provider);
      if (!names) {
        names = new Set();
        this.toolNamesByProvider.set(tool.provider, names);
      }
      names.add(tool.name);
    }
  }

  getProvidersHiddenMissingEnv(): Array<{ id: string; missing: string[] }> {
    return this.providersHiddenMissingEnv.map((h) => ({ ...h }));
  }

  private registerCatalogTool(tool: ToolCatalogEntry): void {
    this.catalog.push(tool);
    this.catalogByName.set(tool.name, tool);
    let names = this.toolNamesByProvider.get(tool.provider);
    if (!names) {
      names = new Set();
      this.toolNamesByProvider.set(tool.provider, names);
    }
    names.add(tool.name);
  }

  /** Load tool metadata for enabled providers that were skipped at build (e.g. env-gated). */
  async hydrateCatalogFromProviders(): Promise<void> {
    const config = getConfig();
    for (const id of this.enabledProviderIds) {
      const existing = this.toolNamesByProvider.get(id);
      if (existing && existing.size > 0) {
        continue;
      }
      const spec = this.providerById.get(id);
      if (!spec) {
        continue;
      }
      const defs = await spec.loadTools(config.api);
      for (const def of defs) {
        if (this.catalogByName.has(def.name)) {
          continue;
        }
        this.registerCatalogTool({
          name: def.name,
          description: def.description,
          keywords: def.keywords ?? [],
          inputSchema: def.inputSchema,
          provider: id,
        });
      }
    }
  }

  getStatus(): {
    mode: 'lazy' | 'eager';
    enabledProviders: number;
    catalogTools: number;
    loadedProviders: number;
    maxLoadedProviders: number;
    loadedProviderIds: string[];
    totalEvictions: number;
    providerIds: string[];
    providersHiddenMissingEnv: Array<{ id: string; missing: string[] }>;
  } {
    const loadedProviderIds = [...this.loadedProviders].sort(
      (a, b) => (this.providerLastUsed.get(a) ?? 0) - (this.providerLastUsed.get(b) ?? 0)
    );
    return {
      mode: isEagerProviderLoad() ? 'eager' : 'lazy',
      enabledProviders: this.enabledProviderIds.size,
      catalogTools: this.catalog.length,
      loadedProviders: this.loadedProviders.size,
      maxLoadedProviders: this.maxLoadedProviders,
      loadedProviderIds,
      totalEvictions: this.totalEvictions,
      providerIds: [...this.enabledProviderIds],
      providersHiddenMissingEnv: this.getProvidersHiddenMissingEnv(),
    };
  }

  hasTool(name: string): boolean {
    return this.catalogByName.has(name);
  }

  getToolMeta(name: string): ToolCatalogEntry | undefined {
    return this.catalogByName.get(name);
  }

  listCatalog(): ToolCatalogEntry[] {
    return this.catalog;
  }

  searchByKeywords(keywords: string, limit: number): ToolCatalogEntry[] {
    const trimmed = keywords.trim();
    if (trimmed.length === 0) {
      return [];
    }
    if (trimmed === '*') {
      return this.catalog;
    }

    const terms = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.toLowerCase());
    if (terms.length === 0) {
      return [];
    }

    const scored = this.catalog.map((tool) => {
      const searchable =
        `${tool.name} ${tool.description} ${(tool.keywords ?? []).join(' ')}`.toLowerCase();
      let matches = 0;
      for (const term of terms) {
        if (searchable.includes(term)) {
          matches++;
        }
      }
      return { tool, matches };
    });

    return scored
      .filter((s) => s.matches > 0)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, limit)
      .map((s) => s.tool);
  }

  private touchProvider(providerId: string): void {
    this.providerLastUsed.set(providerId, Date.now());
  }

  private pickLeastRecentlyUsedProvider(excludeId?: string): string | undefined {
    let oldestId: string | undefined;
    let oldestTime = Infinity;
    for (const id of this.loadedProviders) {
      if (id === excludeId) {
        continue;
      }
      const t = this.providerLastUsed.get(id) ?? 0;
      if (t < oldestTime) {
        oldestTime = t;
        oldestId = id;
      }
    }
    return oldestId;
  }

  private unloadProvider(providerId: string, reason: string): void {
    if (!this.loadedProviders.has(providerId)) {
      return;
    }
    const toolNames = this.toolNamesByProvider.get(providerId);
    if (toolNames) {
      for (const name of toolNames) {
        this.executeByName.delete(name);
      }
    }
    this.loadedProviders.delete(providerId);
    this.providerLastUsed.delete(providerId);
    this.totalEvictions++;
    console.error(`[unified-mcp] provider unloaded id=${providerId} reason=${reason}`);
  }

  private makeRoomForProvider(incomingProviderId: string): void {
    if (this.maxLoadedProviders <= 0) {
      return;
    }
    while (
      this.loadedProviders.size >= this.maxLoadedProviders &&
      !this.loadedProviders.has(incomingProviderId)
    ) {
      const victim = this.pickLeastRecentlyUsedProvider(incomingProviderId);
      if (!victim) {
        break;
      }
      this.unloadProvider(victim, 'max_loaded_providers');
    }
  }

  private async loadProvider(providerId: string): Promise<void> {
    if (this.loadedProviders.has(providerId)) {
      this.touchProvider(providerId);
      return;
    }
    const existing = this.loadPromises.get(providerId);
    if (existing) {
      await existing;
      this.touchProvider(providerId);
      return;
    }

    const spec = this.providerById.get(providerId);
    if (!spec) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const promise = (async () => {
      this.makeRoomForProvider(providerId);
      const api = getConfig().api;
      const defs = await spec.loadTools(api);
      for (const def of defs) {
        if (!this.enabledProviderIds.has(providerId)) {
          continue;
        }
        if (this.catalogByName.has(def.name)) {
          this.executeByName.set(def.name, def.execute);
        }
      }
      this.loadedProviders.add(providerId);
      this.touchProvider(providerId);
    })();

    this.loadPromises.set(providerId, promise);
    try {
      await promise;
    } finally {
      this.loadPromises.delete(providerId);
    }
  }

  async warmEnabledProviders(): Promise<void> {
    await Promise.all([...this.enabledProviderIds].map((id) => this.loadProvider(id)));
  }

  async executeTool(name: string, args: Record<string, unknown>) {
    const meta = this.catalogByName.get(name);
    if (!meta) {
      throw new Error(`Unknown tool: ${name}`);
    }
    if (!this.enabledProviderIds.has(meta.provider)) {
      throw new Error(`Tool "${name}" is not available (provider disabled)`);
    }

    let execute = this.executeByName.get(name);
    if (!execute) {
      await this.loadProvider(meta.provider);
      execute = this.executeByName.get(name);
    }
    if (!execute) {
      throw new Error(`Tool "${name}" failed to load from provider ${meta.provider}`);
    }
    this.touchProvider(meta.provider);
    return execute(args);
  }
}

function logHiddenProviders(
  hidden: Array<{ id: string; missing: string[] }>
): void {
  for (const { id, missing } of hidden) {
    console.error(
      `[unified-mcp] Provider "${id}" hidden — set in MCP client env: ${missing.join(', ')}`
    );
  }
}

export async function createLazyToolRegistry(): Promise<LazyToolRegistry> {
  const registry = new LazyToolRegistry();
  logHiddenProviders(registry.getProvidersHiddenMissingEnv());
  await registry.hydrateCatalogFromProviders();
  if (isEagerProviderLoad()) {
    await registry.warmEnabledProviders();
  }
  return registry;
}
