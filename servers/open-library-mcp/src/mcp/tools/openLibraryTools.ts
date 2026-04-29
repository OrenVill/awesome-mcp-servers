import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  OpenLibraryService,
  type OpenLibraryAuthor,
  type OpenLibraryBook,
  type OpenLibrarySearchDoc,
  type OpenLibraryWork,
} from '../../services/openLibraryService.js';

export const SEARCH_BOOKS_DEF = {
  name: 'search_books',
  description:
    "🔍 I'm searching Open Library for books\n\nSearch Open Library by free-text query, author, or title. Returns matching titles with author, year, and Open Library work keys you can pass to get_work.",
  keywords: ['open-library', 'books', 'search', 'library', 'literature'],
};
export const GET_BOOK_BY_ISBN_DEF = {
  name: 'get_book_by_isbn',
  description:
    "📚 I'm looking up a book by ISBN\n\nFetch a single book record from Open Library by ISBN-10 or ISBN-13. Returns title, authors, publisher, and edition details.",
  keywords: ['open-library', 'book', 'isbn', 'edition', 'lookup'],
};
export const GET_AUTHOR_DEF = {
  name: 'get_author',
  description:
    "✍️ I'm loading an Open Library author\n\nGet author details by Open Library author key (e.g. `OL23919A`). Returns name, dates, biography, and alternate names.",
  keywords: ['open-library', 'author', 'writer', 'biography'],
};
export const GET_WORK_DEF = {
  name: 'get_work',
  description:
    "📖 I'm loading an Open Library work\n\nGet work details by Open Library work key (e.g. `OL45804W`). Returns title, description, subjects, and linked authors.",
  keywords: ['open-library', 'work', 'book', 'literature'],
};

export interface SearchBooksInput {
  query: string;
  limit?: number;
  author?: string;
  title?: string;
}

export interface GetBookByIsbnInput {
  isbn: string;
}

export interface GetAuthorInput {
  id: string;
}

export interface GetWorkInput {
  id: string;
}

export class OpenLibraryTools {
  private service: OpenLibraryService;

  constructor(service?: OpenLibraryService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenLibraryService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchBooksSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search query (book title, keywords, etc.)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          author: {
            type: 'string',
            description: 'Optional author name filter',
          },
          title: {
            type: 'string',
            description: 'Optional exact title filter',
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetBookByIsbnSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          isbn: {
            type: 'string',
            description: 'ISBN-10 or ISBN-13 (hyphens allowed and stripped)',
          },
        },
        required: ['isbn'],
      },
    };
  }

  static getGetAuthorSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'Open Library author key (e.g. "OL23919A")',
          },
        },
        required: ['id'],
      },
    };
  }

  static getGetWorkSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'Open Library work key (e.g. "OL45804W")',
          },
        },
        required: ['id'],
      },
    };
  }

  async executeSearchBooks(args: SearchBooksInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required and must be a string');
    }
    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 100');
    }

    try {
      const response = await this.service.searchBooks({
        query: args.query,
        limit,
        author: args.author,
        title: args.title,
      });
      const docs = response.docs ?? [];
      const text = this.formatSearchResultsAsText(docs, args.query, response.numFound);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Open Library search failed: ${message}`);
    }
  }

  async executeGetBookByIsbn(args: GetBookByIsbnInput): Promise<MCPToolCallResult> {
    if (!args.isbn || typeof args.isbn !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'isbn is required and must be a string');
    }

    try {
      const book = await this.service.getBookByIsbn(args.isbn);
      if (!book) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Book not found for ISBN "${args.isbn}"`);
      }
      const text = this.formatBookAsText(book, args.isbn);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to look up ISBN: ${message}`);
    }
  }

  async executeGetAuthor(args: GetAuthorInput): Promise<MCPToolCallResult> {
    if (!args.id || typeof args.id !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id is required and must be a string');
    }

    try {
      const author = await this.service.getAuthor(args.id);
      if (!author) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Author not found: "${args.id}"`);
      }
      const text = this.formatAuthorAsText(author);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get author: ${message}`);
    }
  }

  async executeGetWork(args: GetWorkInput): Promise<MCPToolCallResult> {
    if (!args.id || typeof args.id !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id is required and must be a string');
    }

    try {
      const work = await this.service.getWork(args.id);
      if (!work) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Work not found: "${args.id}"`);
      }
      const text = this.formatWorkAsText(work);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get work: ${message}`);
    }
  }

  private formatSearchResultsAsText(
    docs: OpenLibrarySearchDoc[],
    query: string,
    totalHits?: number
  ): string {
    if (docs.length === 0) {
      return `No Open Library books found for "${query}".`;
    }

    let text = `Found ${docs.length} book(s) for "${query}"`;
    if (totalHits != null) text += ` (${totalHits.toLocaleString()} total)`;
    text += ':\n\n';

    docs.forEach((d, i) => {
      const title = d.title ?? '(untitled)';
      const authors = d.author_name?.join(', ') ?? 'Unknown author';
      const year = d.first_publish_year != null ? ` (${d.first_publish_year})` : '';
      text += `${i + 1}. **${title}** — ${authors}${year}\n`;
      if (d.key) text += `   work: ${d.key}\n`;
      if (d.edition_count != null) text += `   editions: ${d.edition_count}\n`;
      const isbn = d.isbn?.[0];
      if (isbn) text += `   ISBN: ${isbn}\n`;
      text += '\n';
    });
    text += 'Use get_work with the work key (e.g. OL45804W) or get_book_by_isbn for full details.';
    return text.trim();
  }

  private formatBookAsText(book: OpenLibraryBook, requestedIsbn: string): string {
    const title = book.title ?? '(untitled)';
    let text = `# ${title}`;
    if (book.subtitle) text += `: ${book.subtitle}`;
    text += '\n\n';

    if (book.publish_date) text += `**Published:** ${book.publish_date}\n`;
    if (book.publishers?.length) text += `**Publisher:** ${book.publishers.join(', ')}\n`;
    if (book.publish_places?.length) text += `**Place:** ${book.publish_places.join(', ')}\n`;
    if (book.number_of_pages != null) text += `**Pages:** ${book.number_of_pages}\n`;
    if (book.isbn_10?.length) text += `**ISBN-10:** ${book.isbn_10.join(', ')}\n`;
    if (book.isbn_13?.length) text += `**ISBN-13:** ${book.isbn_13.join(', ')}\n`;
    if (book.key) text += `**Key:** ${book.key}\n`;
    if (book.works?.length) {
      const works = book.works.map((w) => w.key).filter(Boolean).join(', ');
      if (works) text += `**Work(s):** ${works}\n`;
    }
    if (book.languages?.length) {
      const langs = book.languages.map((l) => l.key).filter(Boolean).join(', ');
      if (langs) text += `**Languages:** ${langs}\n`;
    }
    if (book.subjects?.length) text += `**Subjects:** ${book.subjects.slice(0, 10).join(', ')}\n`;

    const description = this.extractDescription(book.description);
    if (description) text += `\n${description}\n`;

    if (!book.title) {
      text += `\n_(Looked up by ISBN ${requestedIsbn})_\n`;
    }
    return text.trim();
  }

  private formatAuthorAsText(author: OpenLibraryAuthor): string {
    const name = author.name ?? author.personal_name ?? '(unnamed author)';
    let text = `# ${name}\n\n`;
    if (author.key) text += `**Key:** ${author.key}\n`;
    if (author.birth_date) text += `**Born:** ${author.birth_date}\n`;
    if (author.death_date) text += `**Died:** ${author.death_date}\n`;
    if (author.alternate_names?.length) {
      text += `**Also known as:** ${author.alternate_names.slice(0, 10).join(', ')}\n`;
    }
    if (author.wikipedia) text += `**Wikipedia:** ${author.wikipedia}\n`;

    const bio = this.extractDescription(author.bio);
    if (bio) text += `\n${bio}\n`;

    if (author.links?.length) {
      text += '\n**Links:**\n';
      author.links.slice(0, 10).forEach((l) => {
        if (l.url) text += `- ${l.title ?? l.url}: ${l.url}\n`;
      });
    }
    return text.trim();
  }

  private formatWorkAsText(work: OpenLibraryWork): string {
    const title = work.title ?? '(untitled work)';
    let text = `# ${title}`;
    if (work.subtitle) text += `: ${work.subtitle}`;
    text += '\n\n';

    if (work.key) text += `**Key:** ${work.key}\n`;
    if (work.first_publish_date) text += `**First published:** ${work.first_publish_date}\n`;
    if (work.authors?.length) {
      const authors = work.authors
        .map((a) => a.author?.key)
        .filter((k): k is string => Boolean(k))
        .join(', ');
      if (authors) text += `**Authors:** ${authors}\n`;
    }
    if (work.subjects?.length) text += `**Subjects:** ${work.subjects.slice(0, 12).join(', ')}\n`;
    if (work.subject_people?.length) text += `**People:** ${work.subject_people.slice(0, 8).join(', ')}\n`;
    if (work.subject_places?.length) text += `**Places:** ${work.subject_places.slice(0, 8).join(', ')}\n`;
    if (work.subject_times?.length) text += `**Times:** ${work.subject_times.slice(0, 8).join(', ')}\n`;

    const description = this.extractDescription(work.description);
    if (description) text += `\n${description}\n`;

    if (work.links?.length) {
      text += '\n**Links:**\n';
      work.links.slice(0, 10).forEach((l) => {
        if (l.url) text += `- ${l.title ?? l.url}: ${l.url}\n`;
      });
    }
    return text.trim();
  }

  private extractDescription(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const v = (value as { value?: unknown }).value;
      if (typeof v === 'string') return v.trim();
    }
    return undefined;
  }
}
