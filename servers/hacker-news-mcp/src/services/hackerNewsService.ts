export interface HNItem {
  id: number;
  type?: 'story' | 'comment' | 'job' | 'poll' | 'pollopt';
  by?: string;
  time?: number;
  text?: string;
  dead?: boolean;
  deleted?: boolean;
  parent?: number;
  kids?: number[];
  descendants?: number;
  score?: number;
  title?: string;
  url?: string;
  parts?: number[];
}

export interface AlgoliaHit {
  objectID: string;
  story_id?: number;
  title: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
  created_at_i: number;
}

export interface AlgoliaSearchResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  query: string;
}

export type StoryListType = 'top' | 'new' | 'best';

export class HackerNewsService {
  private readonly firebaseBase: string;
  private readonly algoliaBase: string;
  private readonly timeout: number;

  constructor(options?: {
    firebaseBase?: string;
    algoliaBase?: string;
    timeout?: number;
  }) {
    this.firebaseBase = options?.firebaseBase ?? 'https://hacker-news.firebaseio.com/v0';
    this.algoliaBase = options?.algoliaBase ?? 'https://hn.algolia.com/api/v1';
    this.timeout = options?.timeout ?? 15000;
  }

  async getStoryIds(listType: StoryListType): Promise<number[]> {
    const endpoint =
      listType === 'top'
        ? 'topstories'
        : listType === 'new'
          ? 'newstories'
          : 'beststories';
    const url = `${this.firebaseBase}/${endpoint}.json`;
    const res = await this.fetchWithTimeout(url);
    return (await res.json()) as number[];
  }

  async getItem(id: number): Promise<HNItem | null> {
    const url = `${this.firebaseBase}/item/${id}.json`;
    const res = await this.fetchWithTimeout(url);
    const data = await res.json();
    return data === null ? null : (data as HNItem);
  }

  async search(params: {
    query: string;
    hitsPerPage?: number;
    page?: number;
  }): Promise<AlgoliaSearchResponse> {
    const url = new URL(`${this.algoliaBase}/search`);
    url.searchParams.set('query', params.query);
    url.searchParams.set('hitsPerPage', String(params.hitsPerPage ?? 20));
    url.searchParams.set('page', String(params.page ?? 0));

    const res = await this.fetchWithTimeout(url.toString());
    return (await res.json()) as AlgoliaSearchResponse;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}
