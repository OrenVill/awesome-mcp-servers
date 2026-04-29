export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  primaryCategory: string;
  link: string;
}

export class ArxivService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'http://export.arxiv.org/api/query';
    this.timeout = options?.timeout ?? 15000;
  }

  async search(params: {
    query: string;
    maxResults?: number;
    category?: string;
  }): Promise<ArxivPaper[]> {
    const max = clampInt(params.maxResults ?? 10, 1, 50);
    const query = params.category
      ? `all:${params.query}+AND+cat:${params.category}`
      : `all:${params.query}`;
    // arXiv expects the search_query value pre-formatted with `+` separators;
    // build the URL manually so we don't double-encode the `+` operators.
    const url =
      `${this.baseUrl}?search_query=${encodeArxivQuery(query)}` +
      `&max_results=${max}`;

    const xml = await this.fetchXml(url);
    return parseArxivAtom(xml);
  }

  async getPaper(id: string): Promise<ArxivPaper | null> {
    const url = `${this.baseUrl}?id_list=${encodeURIComponent(id)}`;
    const xml = await this.fetchXml(url);
    const papers = parseArxivAtom(xml);
    return papers.length > 0 ? papers[0]! : null;
  }

  async listRecent(params: {
    category: string;
    maxResults?: number;
  }): Promise<ArxivPaper[]> {
    const max = clampInt(params.maxResults ?? 20, 1, 100);
    const url =
      `${this.baseUrl}?search_query=cat:${encodeArxivQuery(params.category)}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=${max}`;

    const xml = await this.fetchXml(url);
    return parseArxivAtom(xml);
  }

  private async fetchXml(url: string): Promise<string> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'arxiv-mcp/1.0 (https://github.com/awesome-mcp-servers)',
          Accept: 'application/atom+xml, application/xml, text/xml',
        },
      });
      clearTimeout(id);
      if (!res.ok) {
        throw new Error(`arXiv API returned ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

// Encode an arXiv query value while preserving the literal `+` and `:` operators.
function encodeArxivQuery(value: string): string {
  return value
    .split('+')
    .map((part) => part.split(':').map(encodeURIComponent).join(':'))
    .join('+');
}

// Decode the small set of XML/HTML entities that arXiv emits.
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  // Match <tag ...>...</tag> non-greedily; arXiv tag content is single-instance per entry.
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  if (!m || m[1] === undefined) return null;
  return decodeXmlEntities(m[1]).trim();
}

function extractAllTags(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    if (m[1] !== undefined) out.push(decodeXmlEntities(m[1]).trim());
  }
  return out;
}

function extractAttribute(
  block: string,
  tag: string,
  attr: string
): string | null {
  // Self-closing or open tag — match the first occurrence.
  const re = new RegExp(
    `<${tag}\\b[^>]*\\b${attr}\\s*=\\s*"([^"]*)"[^>]*/?>`,
    'i'
  );
  const m = block.match(re);
  if (!m || m[1] === undefined) return null;
  return decodeXmlEntities(m[1]).trim();
}

export function parseArxivAtom(xml: string): ArxivPaper[] {
  const entries: ArxivPaper[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(xml)) !== null) {
    const block = match[1] ?? '';

    const id = extractTag(block, 'id') ?? '';
    const title = (extractTag(block, 'title') ?? '').replace(/\s+/g, ' ');
    const summary = extractTag(block, 'summary') ?? '';
    const published = extractTag(block, 'published') ?? '';
    const updated = extractTag(block, 'updated') ?? '';

    // <author><name>...</name></author> — collect all author <name> tags.
    const authorBlocks: string[] = [];
    const authorRe = /<author\b[^>]*>([\s\S]*?)<\/author>/gi;
    let am: RegExpExecArray | null;
    while ((am = authorRe.exec(block)) !== null) {
      if (am[1] !== undefined) authorBlocks.push(am[1]);
    }
    const authors: string[] = [];
    for (const ab of authorBlocks) {
      const name = extractTag(ab, 'name');
      if (name) authors.push(name);
    }
    if (authors.length === 0) {
      // Fallback: any <name> tags inside the entry (covers minor schema drift).
      const fallback = extractAllTags(block, 'name');
      for (const n of fallback) authors.push(n);
    }

    const primaryCategory =
      extractAttribute(block, 'arxiv:primary_category', 'term') ??
      extractAttribute(block, 'category', 'term') ??
      '';

    entries.push({
      id,
      title,
      summary,
      authors,
      published,
      updated,
      primaryCategory,
      link: id, // arXiv <id> is the canonical abs URL
    });
  }
  return entries;
}
