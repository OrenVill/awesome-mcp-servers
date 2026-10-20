import {
  OpenFoodFactsTools,
  GET_PRODUCT_BY_BARCODE_DEF,
  SEARCH_PRODUCTS_DEF,
  type GetProductByBarcodeInput,
  type SearchProductsInput,
} from './openfoodfactsTools.js';
import { OpenFoodFactsService } from '../../services/openfoodfactsService.js';
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

export function getOpenfoodfactsToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenFoodFactsService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new OpenFoodFactsTools(service);
  return [
    {
      ...GET_PRODUCT_BY_BARCODE_DEF,
      inputSchema: OpenFoodFactsTools.getGetProductByBarcodeSchema().inputSchema,
      execute: (args) =>
        tools.executeGetProductByBarcode(args as unknown as GetProductByBarcodeInput),
    },
    {
      ...SEARCH_PRODUCTS_DEF,
      inputSchema: OpenFoodFactsTools.getSearchProductsSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchProducts(args as unknown as SearchProductsInput),
    },
  ];
}

export {
  OpenFoodFactsTools,
  GET_PRODUCT_BY_BARCODE_DEF,
  SEARCH_PRODUCTS_DEF,
  type GetProductByBarcodeInput,
  type SearchProductsInput,
} from './openfoodfactsTools.js';
