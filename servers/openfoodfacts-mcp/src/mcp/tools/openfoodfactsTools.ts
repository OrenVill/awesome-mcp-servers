import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  OpenFoodFactsService,
  OpenFoodFactsApiError,
  type OpenFoodFactsProduct,
  type OpenFoodFactsProductResponse,
  type OpenFoodFactsSearchResponse,
  type OpenFoodFactsSearchProduct,
} from '../../services/openfoodfactsService.js';

export const GET_PRODUCT_BY_BARCODE_DEF = {
  name: 'get_product_by_barcode',
  description:
    "🍫 I'm looking up a product on Open Food Facts\n\nFetch food product details by barcode (EAN/UPC), including name, brand, ingredients, allergens, Nutri-Score, and key nutrients. Pass `code` as a string or array, or use `codes` for a batch of barcodes.",
  keywords: [
    'open-food-facts',
    'food',
    'barcode',
    'ean',
    'upc',
    'nutrition',
    'ingredients',
    'nutriscore',
    'grocery',
    'product',
  ],
};

export const SEARCH_PRODUCTS_DEF = {
  name: 'search_products',
  description:
    "🔍 I'm searching Open Food Facts\n\nSearch the Open Food Facts database by product name, brand, or keywords. Optional `page_size` (1–100, default 20) limits how many results are returned.",
  keywords: [
    'open-food-facts',
    'food',
    'search',
    'find',
    'grocery',
    'nutrition',
    'barcode',
    'products',
  ],
};

export interface GetProductByBarcodeInput {
  code?: string | string[];
  codes?: string[];
}

export interface SearchProductsInput {
  search_terms: string;
  page_size?: number;
}

function normalizeBarcodes(args: GetProductByBarcodeInput): {
  items: string[];
  isBatch: boolean;
} {
  if (args.codes !== undefined) {
    const items = Array.isArray(args.codes) ? args.codes : [];
    return { items, isBatch: items.length > 1 };
  }
  if (args.code === undefined) {
    return { items: [], isBatch: false };
  }
  if (Array.isArray(args.code)) {
    return { items: args.code, isBatch: args.code.length > 1 };
  }
  return { items: [args.code], isBatch: false };
}

function stringOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' }, minItems: 1 },
    ],
    description: `${description} Accepts a single barcode or an array for batch requests.`,
  };
}

const BATCH_SEPARATOR = '\n\n---\n\n';

export class OpenFoodFactsTools {
  private service: OpenFoodFactsService;

  constructor(service?: OpenFoodFactsService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenFoodFactsService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetProductByBarcodeSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          code: stringOrArraySchema('Product barcode (EAN-13, UPC, etc.).'),
          codes: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Alternative to `code`: list of barcodes to fetch in one call.',
          },
        },
      },
    };
  }

  static getSearchProductsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          search_terms: {
            type: 'string',
            description: 'Search query (product name, brand, category keywords, etc.)',
          },
          page_size: {
            type: 'number',
            description: 'Maximum number of results to return (1–100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['search_terms'],
      },
    };
  }

  private clampPageSize(size: number | undefined): number {
    if (size === undefined || Number.isNaN(size)) return 20;
    return Math.min(100, Math.max(1, Math.floor(size)));
  }

  private productDisplayName(product: OpenFoodFactsProduct): string {
    return (
      product.product_name ??
      product.product_name_en ??
      product.generic_name ??
      'Unknown product'
    );
  }

  private formatNutriments(nutriments: OpenFoodFactsProduct['nutriments']): string[] {
    if (!nutriments) return [];
    const keys = [
      ['energy-kcal_100g', 'Energy (kcal/100g)'],
      ['fat_100g', 'Fat (g/100g)'],
      ['saturated-fat_100g', 'Saturated fat (g/100g)'],
      ['carbohydrates_100g', 'Carbs (g/100g)'],
      ['sugars_100g', 'Sugars (g/100g)'],
      ['fiber_100g', 'Fiber (g/100g)'],
      ['proteins_100g', 'Protein (g/100g)'],
      ['salt_100g', 'Salt (g/100g)'],
    ] as const;
    const lines: string[] = [];
    for (const [key, label] of keys) {
      const val = nutriments[key];
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`- ${label}: ${val}`);
      }
    }
    return lines;
  }

  formatProductAsText(response: OpenFoodFactsProductResponse, requestedCode: string): string {
    const product = response.product!;
    const code = response.code ?? product.code ?? requestedCode;
    const lines: string[] = [`# ${this.productDisplayName(product)}`, '', `**Barcode:** ${code}`];

    if (product.brands) lines.push(`**Brands:** ${product.brands}`);
    if (product.quantity) lines.push(`**Quantity:** ${product.quantity}`);
    if (product.categories) lines.push(`**Categories:** ${product.categories}`);

    const scores: string[] = [];
    if (product.nutriscore_grade) scores.push(`Nutri-Score: ${product.nutriscore_grade.toUpperCase()}`);
    if (product.nova_group !== undefined) scores.push(`NOVA: ${product.nova_group}`);
    if (product.ecoscore_grade) scores.push(`Eco-Score: ${product.ecoscore_grade.toUpperCase()}`);
    if (scores.length) lines.push(`**Scores:** ${scores.join(' · ')}`);

    const ingredients =
      product.ingredients_text ?? product.ingredients_text_en;
    if (ingredients) {
      lines.push('', '**Ingredients:**', ingredients.slice(0, 1500));
    }

    if (product.allergens) lines.push('', `**Allergens:** ${product.allergens}`);
    if (product.traces) lines.push(`**Traces:** ${product.traces}`);
    if (product.labels) lines.push(`**Labels:** ${product.labels}`);
    if (product.countries) lines.push(`**Countries:** ${product.countries}`);
    if (product.stores) lines.push(`**Stores:** ${product.stores}`);

    const nutrientLines = this.formatNutriments(product.nutriments);
    if (nutrientLines.length) {
      lines.push('', '**Nutrients (per 100g):**', ...nutrientLines);
    }

    if (product.serving_size) lines.push('', `**Serving size:** ${product.serving_size}`);

    const pageUrl =
      product.url ?? `https://world.openfoodfacts.org/product/${code}`;
    lines.push('', `**Open Food Facts:** ${pageUrl}`);

    const image = product.image_front_url ?? product.image_url;
    if (image) lines.push(`**Image:** ${image}`);

    return lines.join('\n');
  }

  formatSearchAsText(response: OpenFoodFactsSearchResponse, query: string): string {
    const lines: string[] = [
      `# Open Food Facts search: "${query}"`,
      '',
      `**Total matches (approx.):** ${response.count}`,
      `**Page:** ${response.page} · **Showing:** ${response.products.length}`,
      '',
    ];

    if (response.products.length === 0) {
      lines.push('No products found.');
      return lines.join('\n');
    }

    response.products.forEach((product, i) => {
      lines.push(this.formatSearchHit(product, i + 1));
      if (i < response.products.length - 1) lines.push('');
    });

    return lines.join('\n');
  }

  private formatSearchHit(product: OpenFoodFactsSearchProduct, index: number): string {
    const name = product.product_name ?? 'Unknown product';
    const code = product.code ?? '?';
    const block: string[] = [`## ${index}. ${name}`, `Barcode: ${code}`];
    if (product.brands) block.push(`Brands: ${product.brands}`);
    if (product.quantity) block.push(`Quantity: ${product.quantity}`);
    if (product.categories) block.push(`Categories: ${product.categories.slice(0, 200)}`);

    const scores: string[] = [];
    if (product.nutriscore_grade) scores.push(`Nutri-Score ${product.nutriscore_grade.toUpperCase()}`);
    if (product.nova_group !== undefined) scores.push(`NOVA ${product.nova_group}`);
    if (product.ecoscore_grade) scores.push(`Eco-Score ${product.ecoscore_grade.toUpperCase()}`);
    if (scores.length) block.push(`Scores: ${scores.join(' · ')}`);

    const pageUrl =
      product.url ?? (product.code ? `https://world.openfoodfacts.org/product/${product.code}` : undefined);
    if (pageUrl) block.push(`Link: ${pageUrl}`);

    return block.join('\n');
  }

  async executeGetProductByBarcode(
    args: GetProductByBarcodeInput
  ): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeBarcodes(args);

    if (items.length === 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'Provide `code` (string or array) or `codes` (array of barcodes)'
      );
    }

    if (items.some((c) => !c || typeof c !== 'string' || !c.trim())) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'Each barcode must be a non-empty string'
      );
    }

    const sections = await Promise.all(
      items.map(async (code) => {
        try {
          const response = await this.service.getProductByBarcode(code);
          return this.formatProductAsText(response, code);
        } catch (err) {
          if (err instanceof OpenFoodFactsApiError && err.notFound) {
            return `Product not found for barcode: "${code}"`;
          }
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `get_product_by_barcode failed for "${code}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchProducts(args: SearchProductsInput): Promise<MCPToolCallResult> {
    if (
      !args.search_terms ||
      typeof args.search_terms !== 'string' ||
      !args.search_terms.trim()
    ) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'search_terms is required and must be a non-empty string'
      );
    }

    const pageSize = this.clampPageSize(args.page_size);

    try {
      const response = await this.service.searchProducts(args.search_terms, pageSize);
      return {
        content: [
          {
            type: 'text',
            text: this.formatSearchAsText(response, args.search_terms.trim()),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async initialize(): Promise<void> {}

  async cleanup(): Promise<void> {}
}
