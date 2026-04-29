export interface DatamuseWord {
  word: string;
  score?: number;
  tags?: string[];
  numSyllables?: number;
}

export class DatamuseService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.datamuse.com';
    this.timeout = options?.timeout ?? 15000;
  }

  async findRhymes(word: string, limit: number): Promise<DatamuseWord[]> {
    const url = new URL(`${this.baseUrl}/words`);
    url.searchParams.set('rel_rhy', word);
    url.searchParams.set('max', String(limit));
    return this.fetchWords(url.toString());
  }

  async findSynonyms(word: string, limit: number): Promise<DatamuseWord[]> {
    const url = new URL(`${this.baseUrl}/words`);
    url.searchParams.set('rel_syn', word);
    url.searchParams.set('max', String(limit));
    return this.fetchWords(url.toString());
  }

  async meansLike(query: string, limit: number): Promise<DatamuseWord[]> {
    const url = new URL(`${this.baseUrl}/words`);
    url.searchParams.set('ml', query);
    url.searchParams.set('max', String(limit));
    return this.fetchWords(url.toString());
  }

  async soundsLike(word: string, limit: number): Promise<DatamuseWord[]> {
    const url = new URL(`${this.baseUrl}/words`);
    url.searchParams.set('sl', word);
    url.searchParams.set('max', String(limit));
    return this.fetchWords(url.toString());
  }

  async suggest(prefix: string, limit: number): Promise<DatamuseWord[]> {
    const url = new URL(`${this.baseUrl}/sug`);
    url.searchParams.set('s', prefix);
    url.searchParams.set('max', String(limit));
    return this.fetchWords(url.toString());
  }

  private async fetchWords(url: string): Promise<DatamuseWord[]> {
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Datamuse API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as DatamuseWord[];
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'datamuse-mcp/1.0 (https://github.com/awesome-mcp-servers)',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}
