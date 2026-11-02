/**
 * Shared helpers for agent-friendly MCP tool input schemas (explicit singular + plural
 * fields instead of JSON Schema oneOf) and batch argument resolution.
 */

export interface InputFieldError {
  field: string;
  message: string;
  suggestion?: string;
}

export function formatInputFieldError(err: InputFieldError): string {
  let text = `Field "${err.field}": ${err.message}`;
  if (err.suggestion) {
    text += ` Next step: ${err.suggestion}`;
  }
  return text;
}

/** Default plural field name for batch string/number params. */
const IRREGULAR_PLURALS: Record<string, string> = {
  query: 'queries',
  storyId: 'storyIds',
  nameOrCode: 'namesOrCodes',
  event_id: 'event_ids',
  question_id: 'question_ids',
  country_code: 'country_codes',
  indicator_id: 'indicator_ids',
  isbn: 'isbns',
  issn: 'issns',
  username: 'usernames',
  prefix: 'prefixes',
  mbid: 'mbids',
  code: 'codes',
  to: 'tos',
  key: 'keys',
  type: 'types',
  id: 'ids',
  repo: 'repos',
  slug: 'slugs',
  title: 'titles',
  name: 'names',
  date: 'dates',
  pmid: 'pmids',
  timezone: 'timezones',
  icao24: 'icao24s',
};

export interface BatchStringOptions {
  plural?: string;
  singularExample?: string;
  pluralExample?: string[];
}

export interface BatchNumberOptions {
  plural?: string;
  singularExample?: number;
  pluralExample?: number[];
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function defaultPlural(singular: string): string {
  if (IRREGULAR_PLURALS[singular]) return IRREGULAR_PLURALS[singular];
  if (singular.endsWith('y') && singular.length > 1 && !/[aeiou]y$/i.test(singular)) {
    return `${singular.slice(0, -1)}ies`;
  }
  if (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('ch')) {
    return `${singular}es`;
  }
  return `${singular}s`;
}

export function batchStringProperties(
  singular: string,
  description: string,
  pluralOrOptions?: string | BatchStringOptions
): Record<string, object> {
  const options: BatchStringOptions =
    typeof pluralOrOptions === 'string' ? { plural: pluralOrOptions } : (pluralOrOptions ?? {});
  const pluralKey = options.plural ?? defaultPlural(singular);
  const singEx = options.singularExample ?? 'example';
  const plurEx = options.pluralExample ?? ['example-a', 'example-b'];
  return {
    [singular]: omitUndefined({
      type: 'string',
      description: `${description} Single value only — example: "${singEx}". For multiple values use \`${pluralKey}\` instead.`,
      examples: options.singularExample ? [options.singularExample] : [singEx],
    }),
    [pluralKey]: omitUndefined({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      description: `Batch strings (${pluralKey}): run several ${singular} values in one call. Example: ${JSON.stringify(plurEx)}. Do not set \`${singular}\` when using this field.`,
      examples: [plurEx],
    }),
  };
}

export function batchNumberProperties(
  singular: string,
  description: string,
  range: { minimum: number; maximum: number },
  pluralOrOptions?: string | BatchNumberOptions
): Record<string, object> {
  const options: BatchNumberOptions =
    typeof pluralOrOptions === 'string' ? { plural: pluralOrOptions } : (pluralOrOptions ?? {});
  const pluralKey = options.plural ?? defaultPlural(singular);
  const singEx = options.singularExample ?? 47.37;
  const plurEx = options.pluralExample ?? [47.37, 52.52];
  const num = {
    type: 'number',
    minimum: range.minimum,
    maximum: range.maximum,
  };
  return {
    [singular]: omitUndefined({
      ...num,
      description: `${description} Single value — example: ${singEx}. For batch coordinates use \`${pluralKey}\` paired with the other axis plural field.`,
      examples: [singEx],
    }),
    [pluralKey]: omitUndefined({
      type: 'array',
      items: num,
      minItems: 1,
      description: `Batch numbers (${pluralKey}): example ${JSON.stringify(plurEx)}. Must align positionally with the paired plural coordinate field when batching locations.`,
      examples: [plurEx],
    }),
  };
}

/** Single string parameter with a documented example (agent-friendly, no enum). */
export function exampleStringProperty(
  description: string,
  example: string,
  options?: { pattern?: string; minLength?: number }
): object {
  return omitUndefined({
    type: 'string',
    description: `${description} Example: "${example}".`,
    examples: [example],
    pattern: options?.pattern,
    minLength: options?.minLength,
  });
}

/** Latitude/longitude (or lat/lon) pair fields with documented batch JSON shape. */
export function batchCoordinateProperties(
  latKey: string,
  lonKey: string,
  options?: {
    latPlural?: string;
    lonPlural?: string;
    latRange?: { minimum: number; maximum: number };
    lonRange?: { minimum: number; maximum: number };
  }
): Record<string, object> {
  const latPlural = options?.latPlural ?? defaultPlural(latKey);
  const lonPlural = options?.lonPlural ?? defaultPlural(lonKey);
  const latRange = options?.latRange ?? { minimum: -90, maximum: 90 };
  const lonRange = options?.lonRange ?? { minimum: -180, maximum: 180 };
  const batchExample = `{ "${latPlural}": [47.37, 52.52], "${lonPlural}": [8.54, 13.41] }`;
  return {
    ...batchNumberProperties(
      latKey,
      `Latitude (WGS84). Required unless \`city\` is set.`,
      latRange,
      { plural: latPlural, singularExample: 47.37, pluralExample: [47.37, 52.52] }
    ),
    ...batchNumberProperties(
      lonKey,
      `Longitude (WGS84). Required unless \`city\` is set. Batch shape: ${batchExample}.`,
      lonRange,
      { plural: lonPlural, singularExample: 8.54, pluralExample: [8.54, 13.41] }
    ),
  };
}

export function normalizeToArray<T>(value: T | T[]): { items: T[]; isBatch: boolean } {
  if (Array.isArray(value)) return { items: value, isBatch: true };
  return { items: [value], isBatch: false };
}

function asArgRecord(args: object): Record<string, unknown> {
  return args as Record<string, unknown>;
}

/** Read singular or plural batch field, then normalize (supports legacy array-on-singular). */
export function normalizeStringArgFromArgs(
  args: object,
  singular: string,
  plural?: string
): { items: string[]; isBatch: boolean } | InputFieldError {
  return resolveStringBatch(args, singular, plural);
}

export function normalizeNumberArgFromArgs(
  args: object,
  singular: string,
  range: { minimum: number; maximum: number },
  plural?: string
): { items: number[]; isBatch: boolean } | InputFieldError {
  return resolveNumberBatch(args, singular, range, plural);
}

export function resolveStringBatch(
  args: object,
  singular: string,
  plural?: string
): { items: string[]; isBatch: boolean } | InputFieldError {
  const record = asArgRecord(args);
  const pluralKey = plural ?? defaultPlural(singular);
  const s = record[singular];
  const p = record[pluralKey];
  const hasPlural = p !== undefined && p !== null;
  const hasSingular = s !== undefined && s !== null && s !== '';

  if (hasSingular && hasPlural) {
    return {
      field: singular,
      message: `Provide either \`${singular}\` or \`${pluralKey}\`, not both.`,
      suggestion: `Use \`${pluralKey}\`: ["a","b"] for batch lookups.`,
    };
  }

  if (hasPlural) {
    if (!Array.isArray(p) || p.length === 0) {
      return {
        field: pluralKey,
        message: 'Must be a non-empty array of strings.',
        suggestion: 'Example: ["value1","value2"].',
      };
    }
    if (p.some((x) => typeof x !== 'string' || !x.trim())) {
      return {
        field: pluralKey,
        message: 'Every entry must be a non-empty string.',
        suggestion: 'Remove empty strings from the array.',
      };
    }
    return { items: p.map((x) => (x as string).trim()), isBatch: true };
  }

  if (Array.isArray(s)) {
    if (s.length === 0) {
      return {
        field: singular,
        message: 'Array must not be empty.',
        suggestion: `Prefer \`${pluralKey}\` for batch requests.`,
      };
    }
    if (s.some((x) => typeof x !== 'string' || !String(x).trim())) {
      return {
        field: singular,
        message: 'Array must contain only non-empty strings.',
        suggestion: `Use \`${pluralKey}\` for batch requests.`,
      };
    }
    return { items: (s as string[]).map((x) => x.trim()), isBatch: true };
  }

  if (typeof s === 'string' && s.trim()) {
    return { items: [s.trim()], isBatch: false };
  }

  return {
    field: singular,
    message: `Either \`${singular}\` or \`${pluralKey}\` is required.`,
    suggestion: `Example: { "${singular}": "example" }.`,
  };
}

export function resolveNumberBatch(
  args: object,
  singular: string,
  range: { minimum: number; maximum: number },
  plural?: string
): { items: number[]; isBatch: boolean } | InputFieldError {
  const record = asArgRecord(args);
  const pluralKey = plural ?? defaultPlural(singular);
  const s = record[singular];
  const p = record[pluralKey];
  const hasPlural = p !== undefined && p !== null;
  const hasSingular = s !== undefined && s !== null;

  if (hasSingular && hasPlural) {
    return {
      field: singular,
      message: `Provide either \`${singular}\` or \`${pluralKey}\`, not both.`,
      suggestion: `Use paired \`${pluralKey}\` arrays for batch coordinates.`,
    };
  }

  const validateNum = (n: unknown, field: string): number | InputFieldError => {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      return { field, message: 'Must be a finite number.', suggestion: `Example: { "${singular}": 47.37 }.` };
    }
    if (n < range.minimum || n > range.maximum) {
      return {
        field,
        message: `Must be between ${range.minimum} and ${range.maximum} (got ${n}).`,
        suggestion: 'Check the coordinate value and try again.',
      };
    }
    return n;
  };

  if (hasPlural) {
    if (!Array.isArray(p) || p.length === 0) {
      return {
        field: pluralKey,
        message: 'Must be a non-empty array of numbers.',
        suggestion: 'Example: [47.37, 52.52].',
      };
    }
    const items: number[] = [];
    for (let i = 0; i < p.length; i++) {
      const v = validateNum(p[i], pluralKey);
      if (typeof v !== 'number') return v;
      items.push(v);
    }
    return { items, isBatch: true };
  }

  if (Array.isArray(s)) {
    if (s.length === 0) {
      return { field: singular, message: 'Array must not be empty.', suggestion: `Use \`${pluralKey}\` for batch.` };
    }
    const items: number[] = [];
    for (let i = 0; i < s.length; i++) {
      const v = validateNum(s[i], singular);
      if (typeof v !== 'number') return v;
      items.push(v);
    }
    return { items, isBatch: true };
  }

  if (hasSingular) {
    const v = validateNum(s, singular);
    if (typeof v !== 'number') return v;
    return { items: [v], isBatch: false };
  }

  return {
    field: singular,
    message: `Either \`${singular}\` or \`${pluralKey}\` is required.`,
    suggestion: `Example: { "${singular}": 47.37 }.`,
  };
}

export function resolveCoordinatePairs(
  args: object,
  latKey: string,
  lonKey: string,
  latRange: { minimum: number; maximum: number },
  lonRange: { minimum: number; maximum: number },
  lonPluralKey?: string
): { pairs: Array<{ lat: number; lon: number }>; isBatch: boolean } | InputFieldError {
  const latBatch = resolveNumberBatch(args, latKey, latRange);
  if ('field' in latBatch) return latBatch;
  const lonBatch = resolveNumberBatch(args, lonKey, lonRange, lonPluralKey);
  if ('field' in lonBatch) return lonBatch;

  if (latBatch.items.length !== lonBatch.items.length) {
    return {
      field: latKey,
      message: `\`${latKey}\` and \`${lonKey}\` must have the same number of values when batching (got ${latBatch.items.length} and ${lonBatch.items.length}).`,
      suggestion: 'Pass paired arrays of equal length, e.g. latitudes/lats and longitudes/lons.',
    };
  }
  if (latBatch.items.length === 0) {
    return {
      field: latKey,
      message: `\`${latKey}\` and \`${lonKey}\` are required.`,
      suggestion: `Example: { "${latKey}": 47.37, "${lonKey}": 8.54 }.`,
    };
  }

  const pairs = latBatch.items.map((lat, i) => ({ lat, lon: lonBatch.items[i]! }));
  return { pairs, isBatch: latBatch.isBatch || lonBatch.isBatch };
}

export const BATCH_SEPARATOR = '\n\n---\n\n';

export function stringOrArraySchema(_description: string): object {
  throw new Error('stringOrArraySchema is removed; use batchStringProperties(singular, description) spread into properties');
}

/** @deprecated Use batchNumberProperties */
export function numberOrArraySchema(_description: string, _range?: { minimum: number; maximum: number }): object {
  throw new Error('numberOrArraySchema is removed; use batchNumberProperties');
}
