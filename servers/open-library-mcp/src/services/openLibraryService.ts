export interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  edition_count?: number;
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
  language?: string[];
  subject?: string[];
}

export interface OpenLibrarySearchResponse {
  numFound?: number;
  start?: number;
  docs?: OpenLibrarySearchDoc[];
}

export interface OpenLibraryBook {
  key?: string;
  title?: string;
  subtitle?: string;
  authors?: Array<{ key?: string; name?: string } | { author?: { key?: string }; type?: { key?: string } }>;
  publishers?: string[];
  publish_date?: string;
  publish_places?: string[];
  number_of_pages?: number;
  isbn_10?: string[];
  isbn_13?: string[];
  works?: Array<{ key?: string }>;
  subjects?: string[];
  languages?: Array<{ key?: string }>;
  description?: string | { value?: string };
  covers?: number[];
  identifiers?: Record<string, string[]>;
}

export interface OpenLibraryAuthor {
  key?: string;
  name?: string;
  personal_name?: string;
  birth_date?: string;
  death_date?: string;
  bio?: string | { value?: string };
  alternate_names?: string[];
  wikipedia?: string;
  links?: Array<{ title?: string; url?: string }>;
  photos?: number[];
}

export interface OpenLibraryWork {
  key?: string;
  title?: string;
  subtitle?: string;
  description?: string | { value?: string };
  authors?: Array<{ author?: { key?: string }; type?: { key?: string } }>;
  subjects?: string[];
  subject_places?: string[];
  subject_people?: string[];
  subject_times?: string[];
  first_publish_date?: string;
  covers?: number[];
  links?: Array<{ title?: string; url?: string }>;
}

export class OpenLibraryService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://openlibrary.org').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async searchBooks(params: {
    query?: string;
    limit?: number;
    author?: string;
    title?: string;
  }): Promise<OpenLibrarySearchResponse> {
    const url = new URL(`${this.baseUrl}/search.json`);
    if (params.title) {
      url.searchParams.set('title', params.title);
    }
    if (params.author) {
      url.searchParams.set('author', params.author);
    }
    if (params.query && !params.title && !params.author) {
      url.searchParams.set('q', params.query);
    } else if (params.query) {
      // Include free-text query alongside title/author when supplied.
      url.searchParams.set('q', params.query);
    }
    url.searchParams.set('limit', String(params.limit ?? 10));

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Open Library search failed (HTTP ${res.status})`);
    }
    return (await res.json()) as OpenLibrarySearchResponse;
  }

  async getBookByIsbn(isbn: string): Promise<OpenLibraryBook | null> {
    const cleaned = isbn.replace(/[-\s]/g, '');
    const url = `${this.baseUrl}/isbn/${encodeURIComponent(cleaned)}.json`;

    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Open Library ISBN lookup failed (HTTP ${res.status})`);
    }
    return (await res.json()) as OpenLibraryBook;
  }

  async getAuthor(id: string): Promise<OpenLibraryAuthor | null> {
    const cleaned = id.replace(/^\/?authors\//, '').trim();
    const url = `${this.baseUrl}/authors/${encodeURIComponent(cleaned)}.json`;

    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Open Library author lookup failed (HTTP ${res.status})`);
    }
    return (await res.json()) as OpenLibraryAuthor;
  }

  async getWork(id: string): Promise<OpenLibraryWork | null> {
    const cleaned = id.replace(/^\/?works\//, '').trim();
    const url = `${this.baseUrl}/works/${encodeURIComponent(cleaned)}.json`;

    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Open Library work lookup failed (HTTP ${res.status})`);
    }
    return (await res.json()) as OpenLibraryWork;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'open-library-mcp/1.0 (https://github.com/awesome-mcp-servers)',
          Accept: 'application/json',
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
