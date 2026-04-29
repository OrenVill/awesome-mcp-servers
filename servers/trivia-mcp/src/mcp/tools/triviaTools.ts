import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  TriviaService,
  type TriviaQuestion,
} from '../../services/triviaService.js';

export const GET_QUESTIONS_DEF = {
  name: 'get_questions',
  description:
    "🎲 I'm fetching trivia questions\n\nFetch trivia questions from Open Trivia DB. Optionally filter by category, difficulty (easy/medium/hard), and type (multiple/boolean). Returns each question with its category, difficulty, correct answer, and (for multiple choice) shuffled options.",
  keywords: ['trivia', 'quiz', 'questions', 'game', 'opentdb'],
};

export const LIST_CATEGORIES_DEF = {
  name: 'list_categories',
  description:
    "🎲 I'm listing trivia categories\n\nList all available trivia categories with their numeric IDs. Use the IDs as the `category` argument to get_questions or get_category_count.",
  keywords: ['trivia', 'quiz', 'categories', 'list', 'opentdb'],
};

export const GET_CATEGORY_COUNT_DEF = {
  name: 'get_category_count',
  description:
    "🎲 I'm counting questions in a category\n\nGet the total number of questions in a category along with per-difficulty (easy/medium/hard) counts.",
  keywords: ['trivia', 'quiz', 'count', 'category', 'opentdb'],
};

export interface GetQuestionsInput {
  amount?: number;
  category?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'multiple' | 'boolean';
}

export interface ListCategoriesInput {
  // no args
}

export interface GetCategoryCountInput {
  category: number;
}

const RESPONSE_CODE_MESSAGES: Record<number, string> = {
  0: 'Success',
  1: 'No results: not enough questions for the requested filters',
  2: 'Invalid parameter: one of the supplied arguments is not valid',
  3: 'Token not found',
  4: 'Token empty: this token has returned all possible questions',
  5: 'Rate limit: too many requests, slow down',
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class TriviaTools {
  private service: TriviaService;

  constructor(service?: TriviaService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new TriviaService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetQuestionsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          amount: {
            type: 'number',
            description: 'Number of questions to fetch (1-50)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
          category: {
            type: 'number',
            description: 'Optional category ID (use list_categories to get IDs)',
          },
          difficulty: {
            type: 'string',
            description: 'Optional difficulty filter',
            enum: ['easy', 'medium', 'hard'],
          },
          type: {
            type: 'string',
            description: 'Optional question type filter',
            enum: ['multiple', 'boolean'],
          },
        },
      },
    };
  }

  static getListCategoriesSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  static getGetCategoryCountSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'number',
            description: 'Category ID to count questions for (use list_categories to find IDs)',
          },
        },
        required: ['category'],
      },
    };
  }

  async executeGetQuestions(args: GetQuestionsInput): Promise<MCPToolCallResult> {
    const amount = args.amount ?? 10;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1 || amount > 50) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'amount must be a number between 1 and 50');
    }
    if (args.category != null && (typeof args.category !== 'number' || !Number.isFinite(args.category))) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'category must be a number');
    }
    if (args.difficulty != null && !['easy', 'medium', 'hard'].includes(args.difficulty)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'difficulty must be one of: easy, medium, hard');
    }
    if (args.type != null && !['multiple', 'boolean'].includes(args.type)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'type must be one of: multiple, boolean');
    }

    try {
      const response = await this.service.getQuestions({
        amount,
        category: args.category,
        difficulty: args.difficulty,
        type: args.type,
      });

      if (response.response_code !== 0) {
        const msg = RESPONSE_CODE_MESSAGES[response.response_code] ?? `Open Trivia DB error code ${response.response_code}`;
        return createMCPErrorResult(MCPErrorCode.API_ERROR, msg);
      }

      const text = this.formatQuestionsAsText(response.results);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch trivia questions: ${message}`);
    }
  }

  async executeListCategories(_args: ListCategoriesInput): Promise<MCPToolCallResult> {
    try {
      const response = await this.service.listCategories();
      const cats = response.trivia_categories ?? [];

      if (cats.length === 0) {
        return { content: [{ type: 'text', text: 'No trivia categories returned.' }] };
      }

      let text = `Found ${cats.length} trivia categories:\n\n`;
      cats.forEach((c) => {
        text += `- **${c.id}** — ${c.name}\n`;
      });
      text += '\nUse the numeric ID as the `category` argument to get_questions or get_category_count.';
      return { content: [{ type: 'text', text: text.trim() }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to list categories: ${message}`);
    }
  }

  async executeGetCategoryCount(args: GetCategoryCountInput): Promise<MCPToolCallResult> {
    if (typeof args.category !== 'number' || !Number.isFinite(args.category)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'category is required and must be a number');
    }

    try {
      const response = await this.service.getCategoryCount(args.category);
      const counts = response.category_question_count;

      if (!counts) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `No counts returned for category ${args.category}`);
      }

      const text =
        `Category ${response.category_id} question counts:\n\n` +
        `- Total: ${counts.total_question_count}\n` +
        `- Easy: ${counts.total_easy_question_count}\n` +
        `- Medium: ${counts.total_medium_question_count}\n` +
        `- Hard: ${counts.total_hard_question_count}`;
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get category count: ${message}`);
    }
  }

  private formatQuestionsAsText(questions: TriviaQuestion[]): string {
    if (questions.length === 0) {
      return 'No trivia questions returned.';
    }

    let text = `Got ${questions.length} trivia question(s):\n\n`;
    questions.forEach((q, i) => {
      text += `${i + 1}. ${q.question}\n`;
      text += `   - Category: ${q.category}\n`;
      text += `   - Difficulty: ${q.difficulty}\n`;
      text += `   - Type: ${q.type}\n`;
      if (q.type === 'multiple') {
        const options = shuffle([q.correct_answer, ...(q.incorrect_answers ?? [])]);
        text += `   - Options:\n`;
        options.forEach((opt, j) => {
          const letter = String.fromCharCode(65 + j);
          text += `       ${letter}) ${opt}\n`;
        });
      } else {
        text += `   - Options: True / False\n`;
      }
      text += `   - Correct answer: ${q.correct_answer}\n\n`;
    });
    return text.trim();
  }
}
