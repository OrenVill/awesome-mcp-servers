export interface PubmedAuthor {
  name?: string;
  authtype?: string;
}

export interface PubmedArticleSummary {
  uid: string;
  title?: string;
  sorttitle?: string;
  pubdate?: string;
  epubdate?: string;
  source?: string;
  fulljournalname?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  lang?: string[];
  issn?: string;
  essn?: string;
  pubtype?: string[];
  authors?: PubmedAuthor[];
  elocationid?: string;
  doi?: string;
  pmc?: string;
  recordstatus?: string;
}

export interface PubmedSearchResult {
  count: number;
  retmax: number;
  retstart: number;
  ids: string[];
  queryTranslation?: string;
}

interface ESearchResponse {
  esearchresult?: {
    count?: string;
    retmax?: string;
    retstart?: string;
    idlist?: string[];
    querytranslation?: string;
    errorlist?: Record<string, string[]>;
  };
}

interface ESummaryResponse {
  result?: {
    uids?: string[];
    error?: string;
    [uid: string]: unknown;
  };
}

export class PubmedService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly toolName: string;
  private readonly defaultEmail: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    toolName?: string;
    email?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils').replace(
      /\/$/,
      ''
    );
    this.timeout = options?.timeout ?? 20000;
    this.toolName = options?.toolName ?? 'pubmed-mcp';
    this.defaultEmail = options?.email ?? '';
  }

  async searchArticles(params: {
    query: string;
    maxResults?: number;
    email?: string;
  }): Promise<PubmedSearchResult> {
    const retmax = params.maxResults ?? 10;
    const url = this.buildUrl('esearch.fcgi', {
      db: 'pubmed',
      term: params.query,
      retmax: String(retmax),
      retmode: 'json',
      email: params.email,
    });

    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`NCBI E-utilities returned ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as ESearchResponse;
    const es = json.esearchresult;
    if (!es) {
      throw new Error('Invalid esearch response from NCBI');
    }
    if (es.errorlist && Object.keys(es.errorlist).length > 0) {
      const msg = Object.entries(es.errorlist)
        .map(([k, v]) => `${k}: ${v.join(', ')}`)
        .join('; ');
      throw new Error(msg);
    }

    return {
      count: parseInt(es.count ?? '0', 10),
      retmax: parseInt(es.retmax ?? String(retmax), 10),
      retstart: parseInt(es.retstart ?? '0', 10),
      ids: es.idlist ?? [],
      queryTranslation: es.querytranslation,
    };
  }

  async getArticleSummaries(
    pmids: string[],
    email?: string
  ): Promise<Map<string, PubmedArticleSummary>> {
    if (pmids.length === 0) {
      return new Map();
    }

    const unique = [...new Set(pmids.map((id) => id.trim()).filter(Boolean))];
    const url = this.buildUrl('esummary.fcgi', {
      db: 'pubmed',
      id: unique.join(','),
      retmode: 'json',
      email,
    });

    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`NCBI E-utilities returned ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as ESummaryResponse;
    const result = json.result;
    if (!result) {
      throw new Error('Invalid esummary response from NCBI');
    }
    if (typeof result.error === 'string' && result.error) {
      throw new Error(result.error);
    }

    const map = new Map<string, PubmedArticleSummary>();
    for (const uid of result.uids ?? unique) {
      const raw = result[uid];
      if (!raw || typeof raw !== 'object') continue;
      const summary = raw as PubmedArticleSummary;
      if (!summary.uid) summary.uid = uid;
      summary.doi = this.extractDoi(summary.elocationid);
      map.set(uid, summary);
    }
    return map;
  }

  async getArticleAbstracts(
    pmids: string[],
    email?: string
  ): Promise<Map<string, { title?: string; abstract: string }>> {
    if (pmids.length === 0) {
      return new Map();
    }

    const unique = [...new Set(pmids.map((id) => id.trim()).filter(Boolean))];
    const url = this.buildUrl('efetch.fcgi', {
      db: 'pubmed',
      id: unique.join(','),
      rettype: 'abstract',
      retmode: 'text',
      email,
    });

    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`NCBI E-utilities returned ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    return this.parseAbstractTextResponse(text, unique);
  }

  private parseAbstractTextResponse(
    text: string,
    requestedIds: string[]
  ): Map<string, { title?: string; abstract: string }> {
    const map = new Map<string, { title?: string; abstract: string }>();
    const blocks = text.split(/\n(?=\d+\.\s)/).filter((b) => b.trim().length > 0);

    for (const block of blocks) {
      const pmidMatch = block.match(/PMID:\s*(\d+)/i);
      const pmid = pmidMatch?.[1];
      if (!pmid) continue;

      const lines = block.split('\n');
      let title: string | undefined;
      let abstractStart = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^\d+\.\s/.test(line) && !title) {
          title = line.replace(/^\d+\.\s*/, '').trim();
          continue;
        }
        if (line === 'Author information:' || line.startsWith('(')) {
          continue;
        }
        if (
          abstractStart === -1 &&
          title &&
          line.length > 0 &&
          !line.startsWith('PMID:') &&
          !/^\(\d+\)/.test(line) &&
          line !== title
        ) {
          abstractStart = i;
          break;
        }
      }

      let abstract = '';
      if (abstractStart >= 0) {
        abstract = lines
          .slice(abstractStart)
          .join('\n')
          .replace(/\nPMID:\s*\d+.*$/s, '')
          .trim();
      }

      if (!abstract) {
        const afterAuthors = block.split(/Author information:[\s\S]*?\n\n/)[1];
        if (afterAuthors) {
          abstract = afterAuthors.replace(/\nPMID:\s*\d+.*$/s, '').trim();
        }
      }

      map.set(pmid, { title, abstract: abstract || '(No abstract available)' });
    }

    for (const id of requestedIds) {
      if (!map.has(id)) {
        map.set(id, { abstract: '(No abstract available for this PMID)' });
      }
    }

    return map;
  }

  private extractDoi(elocationid?: string): string | undefined {
    if (!elocationid) return undefined;
    const match = elocationid.match(/doi:\s*(\S+)/i);
    return match?.[1];
  }

  private buildUrl(
    endpoint: string,
    params: Record<string, string | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') {
        url.searchParams.set(k, v);
      }
    }
    url.searchParams.set('tool', this.toolName);
    const email = params.email ?? this.defaultEmail;
    if (email) {
      url.searchParams.set('email', email);
    }
    return url.toString();
  }

  private userAgent(): string {
    if (this.defaultEmail) {
      return `pubmed-mcp/1.0 (mailto:${this.defaultEmail})`;
    }
    return 'pubmed-mcp/1.0';
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent(),
          Accept: 'application/json, text/plain, */*',
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
