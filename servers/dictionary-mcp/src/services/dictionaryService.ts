export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

export interface DictionaryPhonetic {
  text?: string;
  audio?: string;
  sourceUrl?: string;
  license?: { name?: string; url?: string };
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: DictionaryPhonetic[];
  meanings?: DictionaryMeaning[];
  origin?: string;
  sourceUrls?: string[];
  license?: { name?: string; url?: string };
}

interface DictionaryNotFound {
  title?: string;
  message?: string;
  resolution?: string;
}

export class DictionaryNotFoundError extends Error {
  constructor(public word: string, public lang: string, public detail?: string) {
    super(detail ?? `No definitions found for "${word}" (${lang})`);
    this.name = 'DictionaryNotFoundError';
  }
}

export class DictionaryService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.dictionaryapi.dev/api/v2';
    this.timeout = options?.timeout ?? 15000;
  }

  async define(word: string, lang: string = 'en'): Promise<DictionaryEntry[]> {
    return this.fetchEntry(word, lang);
  }

  async synonyms(word: string, lang: string = 'en'): Promise<Array<{ partOfSpeech: string; synonyms: string[] }>> {
    const entries = await this.fetchEntry(word, lang);
    const grouped = new Map<string, Set<string>>();

    for (const entry of entries) {
      for (const meaning of entry.meanings ?? []) {
        const pos = meaning.partOfSpeech || 'unknown';
        const set = grouped.get(pos) ?? new Set<string>();
        for (const s of meaning.synonyms ?? []) set.add(s);
        for (const def of meaning.definitions ?? []) {
          for (const s of def.synonyms ?? []) set.add(s);
        }
        grouped.set(pos, set);
      }
    }

    return Array.from(grouped.entries()).map(([partOfSpeech, set]) => ({
      partOfSpeech,
      synonyms: Array.from(set),
    }));
  }

  async phonetics(word: string, lang: string = 'en'): Promise<DictionaryPhonetic[]> {
    const entries = await this.fetchEntry(word, lang);
    const out: DictionaryPhonetic[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      if (entry.phonetic && !seen.has(`text:${entry.phonetic}`)) {
        seen.add(`text:${entry.phonetic}`);
        out.push({ text: entry.phonetic });
      }
      for (const p of entry.phonetics ?? []) {
        const key = `${p.text ?? ''}|${p.audio ?? ''}`;
        if (seen.has(key)) continue;
        if (!p.text && !p.audio) continue;
        seen.add(key);
        out.push({ text: p.text, audio: p.audio });
      }
    }

    return out;
  }

  private async fetchEntry(word: string, lang: string): Promise<DictionaryEntry[]> {
    const safeWord = encodeURIComponent(word.trim());
    const safeLang = encodeURIComponent(lang.trim() || 'en');
    const url = `${this.baseUrl}/entries/${safeLang}/${safeWord}`;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'dictionary-mcp/1.0 (https://github.com/awesome-mcp-servers)',
          Accept: 'application/json',
        },
      });
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
    clearTimeout(id);

    if (res.status === 404) {
      let detail: string | undefined;
      try {
        const body = (await res.json()) as DictionaryNotFound;
        detail = body.message ?? body.title;
      } catch {
        detail = undefined;
      }
      throw new DictionaryNotFoundError(word, lang, detail);
    }

    if (!res.ok) {
      throw new Error(`Dictionary API error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as DictionaryEntry[] | DictionaryNotFound;
    if (!Array.isArray(data)) {
      const detail = (data as DictionaryNotFound).message ?? (data as DictionaryNotFound).title;
      throw new DictionaryNotFoundError(word, lang, detail);
    }
    return data;
  }
}
