import type { ProviderSpec } from './providers.js';

/** True when the variable is set on the process (e.g. MCP client `env` block or shell), not read from disk. */
export function isProcessEnvVarSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

export function missingRequiredProcessEnv(spec: ProviderSpec): string[] {
  const required = spec.requiredProcessEnv;
  if (!required?.length) {
    return [];
  }
  return required.filter((name) => !isProcessEnvVarSet(name));
}

export function providerProcessEnvSatisfied(spec: ProviderSpec): boolean {
  return missingRequiredProcessEnv(spec).length === 0;
}

export function applyProcessEnvFilter(
  providerIds: Iterable<string>,
  providerById: Map<string, ProviderSpec>
): {
  enabled: Set<string>;
  hiddenMissingEnv: Array<{ id: string; missing: string[] }>;
} {
  const enabled = new Set<string>();
  const hiddenMissingEnv: Array<{ id: string; missing: string[] }> = [];

  for (const id of providerIds) {
    const spec = providerById.get(id);
    if (!spec) {
      continue;
    }
    const missing = missingRequiredProcessEnv(spec);
    if (missing.length > 0) {
      hiddenMissingEnv.push({ id, missing });
    } else {
      enabled.add(id);
    }
  }

  return { enabled, hiddenMissingEnv };
}
