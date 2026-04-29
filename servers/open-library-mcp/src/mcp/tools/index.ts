import {
  OpenLibraryTools,
  SEARCH_BOOKS_DEF,
  GET_BOOK_BY_ISBN_DEF,
  GET_AUTHOR_DEF,
  GET_WORK_DEF,
  type SearchBooksInput,
  type GetBookByIsbnInput,
  type GetAuthorInput,
  type GetWorkInput,
} from './openLibraryTools.js';
import { OpenLibraryService } from '../../services/openLibraryService.js';
import { getConfig } from '../../config.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function getOpenLibraryToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenLibraryService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new OpenLibraryTools(service);
  return [
    {
      ...SEARCH_BOOKS_DEF,
      inputSchema: OpenLibraryTools.getSearchBooksSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchBooks(args as unknown as SearchBooksInput),
    },
    {
      ...GET_BOOK_BY_ISBN_DEF,
      inputSchema: OpenLibraryTools.getGetBookByIsbnSchema().inputSchema,
      execute: (args) =>
        tools.executeGetBookByIsbn(args as unknown as GetBookByIsbnInput),
    },
    {
      ...GET_AUTHOR_DEF,
      inputSchema: OpenLibraryTools.getGetAuthorSchema().inputSchema,
      execute: (args) => tools.executeGetAuthor(args as unknown as GetAuthorInput),
    },
    {
      ...GET_WORK_DEF,
      inputSchema: OpenLibraryTools.getGetWorkSchema().inputSchema,
      execute: (args) => tools.executeGetWork(args as unknown as GetWorkInput),
    },
  ];
}
