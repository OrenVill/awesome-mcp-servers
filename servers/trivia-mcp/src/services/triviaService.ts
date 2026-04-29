export interface TriviaQuestion {
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

export interface TriviaQuestionsResponse {
  response_code: number;
  results: TriviaQuestion[];
}

export interface TriviaCategory {
  id: number;
  name: string;
}

export interface TriviaCategoriesResponse {
  trivia_categories: TriviaCategory[];
}

export interface TriviaCategoryCountResponse {
  category_id: number;
  category_question_count: {
    total_question_count: number;
    total_easy_question_count: number;
    total_medium_question_count: number;
    total_hard_question_count: number;
  };
}

const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  iquest: '¿',
  iexcl: '¡',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  sect: '§',
  para: '¶',
  middot: '·',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  Egrave: 'È',
  ecirc: 'ê',
  Ecirc: 'Ê',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  auml: 'ä',
  Auml: 'Ä',
  aring: 'å',
  Aring: 'Å',
  atilde: 'ã',
  Atilde: 'Ã',
  aelig: 'æ',
  AElig: 'Æ',
  ccedil: 'ç',
  Ccedil: 'Ç',
  iacute: 'í',
  Iacute: 'Í',
  igrave: 'ì',
  Igrave: 'Ì',
  icirc: 'î',
  Icirc: 'Î',
  iuml: 'ï',
  Iuml: 'Ï',
  oacute: 'ó',
  Oacute: 'Ó',
  ograve: 'ò',
  Ograve: 'Ò',
  ocirc: 'ô',
  Ocirc: 'Ô',
  ouml: 'ö',
  Ouml: 'Ö',
  otilde: 'õ',
  Otilde: 'Õ',
  oslash: 'ø',
  Oslash: 'Ø',
  uacute: 'ú',
  Uacute: 'Ú',
  ugrave: 'ù',
  Ugrave: 'Ù',
  ucirc: 'û',
  Ucirc: 'Û',
  uuml: 'ü',
  Uuml: 'Ü',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  yacute: 'ý',
  Yacute: 'Ý',
  yuml: 'ÿ',
  szlig: 'ß',
};

export function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  // Numeric entities: &#NNN; (decimal) and &#xHHHH; (hex)
  let out = str.replace(/&#(\d+);/g, (_, dec: string) => {
    const code = parseInt(dec, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
  out = out.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex: string) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
  // Named entities
  out = out.replace(/&([a-zA-Z]+);/g, (match, name: string) => {
    return Object.prototype.hasOwnProperty.call(HTML_NAMED_ENTITIES, name)
      ? HTML_NAMED_ENTITIES[name]
      : match;
  });
  return out;
}

export interface GetQuestionsParams {
  amount?: number;
  category?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'multiple' | 'boolean';
}

export class TriviaService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://opentdb.com').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getQuestions(params: GetQuestionsParams): Promise<TriviaQuestionsResponse> {
    const url = new URL(`${this.baseUrl}/api.php`);
    url.searchParams.set('amount', String(params.amount ?? 10));
    if (params.category != null) {
      url.searchParams.set('category', String(params.category));
    }
    if (params.difficulty) {
      url.searchParams.set('difficulty', params.difficulty);
    }
    if (params.type) {
      url.searchParams.set('type', params.type);
    }

    const res = await this.fetchWithTimeout(url.toString());
    const json = (await res.json()) as TriviaQuestionsResponse;

    // Decode HTML entities in all string fields
    if (Array.isArray(json.results)) {
      json.results = json.results.map((q) => ({
        ...q,
        category: decodeHtmlEntities(q.category),
        question: decodeHtmlEntities(q.question),
        correct_answer: decodeHtmlEntities(q.correct_answer),
        incorrect_answers: (q.incorrect_answers ?? []).map(decodeHtmlEntities),
      }));
    }

    return json;
  }

  async listCategories(): Promise<TriviaCategoriesResponse> {
    const url = `${this.baseUrl}/api_category.php`;
    const res = await this.fetchWithTimeout(url);
    const json = (await res.json()) as TriviaCategoriesResponse;
    if (Array.isArray(json.trivia_categories)) {
      json.trivia_categories = json.trivia_categories.map((c) => ({
        id: c.id,
        name: decodeHtmlEntities(c.name),
      }));
    }
    return json;
  }

  async getCategoryCount(category: number): Promise<TriviaCategoryCountResponse> {
    const url = new URL(`${this.baseUrl}/api_count.php`);
    url.searchParams.set('category', String(category));

    const res = await this.fetchWithTimeout(url.toString());
    return (await res.json()) as TriviaCategoryCountResponse;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'trivia-mcp/1.0 (https://github.com/awesome-mcp-servers)',
        },
      });
      clearTimeout(id);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}
