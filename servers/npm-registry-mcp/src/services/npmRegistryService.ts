export interface NpmPackageVersion {
  name?: string;
  version?: string;
  description?: string;
  license?: string | { type?: string };
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  dist?: { tarball?: string; shasum?: string };
  engines?: Record<string, string>;
  [key: string]: unknown;
}

export interface NpmPackageDocument {
  _id?: string;
  name?: string;
  description?: string;
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, NpmPackageVersion>;
  time?: Record<string, string>;
  maintainers?: Array<{ name?: string; email?: string }>;
  keywords?: string[];
  homepage?: string;
  repository?: string | { type?: string; url?: string };
  license?: string;
  [key: string]: unknown;
}

export interface NpmSearchPackage {
  name: string;
  version?: string;
  description?: string;
  keywords?: string[];
  links?: {
    npm?: string;
    homepage?: string | null;
    repository?: string | null;
    bugs?: string | null;
  };
  publisher?: { username?: string; email?: string };
  date?: string;
}

export interface NpmSearchObject {
  package: NpmSearchPackage;
  score?: { final?: number; detail?: { quality?: number; popularity?: number; maintenance?: number } };
  searchScore?: number;
}

export interface NpmSearchResponse {
  objects: NpmSearchObject[];
  total: number;
  time?: string;
}

export class NpmRegistryApiError extends Error {
  status: number;
  notFound: boolean;

  constructor(message: string, status: number, notFound = false) {
    super(message);
    this.name = 'NpmRegistryApiError';
    this.status = status;
    this.notFound = notFound;
  }
}

export class NpmRegistryService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://registry.npmjs.org').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getPackage(name: string): Promise<NpmPackageDocument> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new NpmRegistryApiError('Package name is required', 0);
    }
    const path = `/${encodeURIComponent(trimmed)}`;
    return this.fetchJson<NpmPackageDocument>(path);
  }

  async searchPackages(text: string, size = 20): Promise<NpmSearchResponse> {
    const q = text.trim();
    if (!q) {
      throw new NpmRegistryApiError('Search text is required', 0);
    }
    const params = new URLSearchParams({ text: q, size: String(size) });
    return this.fetchJson<NpmSearchResponse>(`/-/v1/search?${params.toString()}`);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'npm-registry-mcp/1.0 (https://github.com/awesome-mcp-servers)',
        },
      });
      clearTimeout(id);

      if (!res.ok) {
        if (res.status === 404) {
          throw new NpmRegistryApiError(`Package not found`, res.status, true);
        }
        let detail = '';
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) detail = `: ${body.error}`;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new NpmRegistryApiError(
          `npm registry ${res.status} ${res.statusText}${detail}`,
          res.status
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof NpmRegistryApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NpmRegistryApiError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw err;
    }
  }
}
