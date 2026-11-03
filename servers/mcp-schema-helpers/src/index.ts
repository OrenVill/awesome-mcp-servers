/**
 * Shared helpers for agent-friendly MCP tool input schemas (explicit singular + plural
 * fields instead of JSON Schema oneOf) and batch argument resolution.
 */

export interface InputFieldError {
  field: string;
  message: string;
  suggestion?: string;
}

/** MCP tool inputSchema shape including agent-readiness documentation fields. */
export interface AgentReadyObjectInputSchema {
  type: 'object';
  properties: object;
  required?: string[];
  description?: string;
  examples?: Record<string, unknown>[];
  additionalProperties?: boolean;
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
      description: `${description} Single value — example: "${singEx}". For batch, send \`${pluralKey}\` as a string array in the same request object (see inputSchema \`examples\`, e.g. ${JSON.stringify({ [pluralKey]: plurEx })}).`,
      examples: options.singularExample ? [options.singularExample] : [singEx],
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
      description: `${description} Single value — example: ${singEx}. For batch coordinates send paired \`${pluralKey}\` number arrays (see inputSchema \`examples\`; plural fields omitted from properties for a shallow schema).`,
      examples: [singEx],
    }),
  };
}

/** Single string parameter with a documented example (agent-friendly, no enum). */
export function exampleStringProperty(
  description: string,
  example: string,
  options?: { pattern?: string; minLength?: number; default?: string }
): object {
  return omitUndefined({
    type: 'string',
    description: `${description} Example: "${example}".`,
    examples: [example],
    default: options?.default ?? example,
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

/** Full inputSchema.examples entries for singular + plural string batch params. */
export function stringBatchInputExamples(
  singular: string,
  options?: BatchStringOptions & { extra?: Record<string, unknown>[] }
): Record<string, unknown>[] {
  const pluralKey = options?.plural ?? defaultPlural(singular);
  const singEx = options?.singularExample ?? 'example';
  const plurEx = options?.pluralExample ?? ['example-a', 'example-b'];
  const base: Record<string, unknown>[] = [
    { [singular]: singEx },
    { [pluralKey]: plurEx },
  ];
  return options?.extra ? [...base, ...options.extra] : base;
}

/** Full inputSchema.examples entries for coordinate single + batch params. */
export function coordinateBatchInputExamples(
  latKey: string,
  lonKey: string,
  options?: {
    latPlural?: string;
    lonPlural?: string;
    single?: { lat: number; lon: number };
    batch?: { lats: number[]; lons: number[] };
    extra?: Record<string, unknown>[];
  }
): Record<string, unknown>[] {
  const latPlural = options?.latPlural ?? defaultPlural(latKey);
  const lonPlural = options?.lonPlural ?? defaultPlural(lonKey);
  const lat = options?.single?.lat ?? 47.37;
  const lon = options?.single?.lon ?? 8.54;
  const lats = options?.batch?.lats ?? [47.37, 52.52];
  const lons = options?.batch?.lons ?? [8.54, 13.41];
  const base: Record<string, unknown>[] = [
    { [latKey]: lat, [lonKey]: lon },
    { [latPlural]: lats, [lonPlural]: lons },
  ];
  return options?.extra ? [...base, ...options.extra] : base;
}

export const AGENT_READY_BATCH_DESCRIPTION =
  'Use the singular field for one value or the plural array field for batch calls. Full JSON request shapes are in `examples`.';

const STRING_BATCH_PRESETS: Record<string, BatchStringOptions> = {
  query: { singularExample: 'example search', pluralExample: ['first query', 'second query'] },
  word: { singularExample: 'example', pluralExample: ['moon', 'soon'] },
  nameOrCode: { singularExample: 'France', pluralExample: ['France', 'Germany', 'pe'] },
  name: { singularExample: 'requests', pluralExample: ['requests', 'flask'] },
  title: { singularExample: 'Albert Einstein', pluralExample: ['Albert Einstein', 'Zurich'] },
  id: { singularExample: '1', pluralExample: ['1', '2'] },
  isbn: { singularExample: '9780141036144', pluralExample: ['9780141036144', '9780007522746'] },
  issn: { singularExample: '2167-8359', pluralExample: ['2167-8359', '0036-8075'] },
  doi: { singularExample: '10.1038/nphys1170', pluralExample: ['10.1038/nphys1170', '10.1126/science.1259855'] },
  pmid: { singularExample: '35296578', pluralExample: ['35296578', '12345678'] },
  storyId: { singularExample: '8863', pluralExample: ['8863', '1'] },
  event_id: { singularExample: 'nc73649170', pluralExample: ['nc73649170', 'ak02012345'] },
  question_id: { singularExample: '11227958', pluralExample: ['11227958', '47718771'] },
  country_code: { singularExample: 'usa', pluralExample: ['usa', 'deu'] },
  indicator_id: { singularExample: 'SP.POP.TOTL', pluralExample: ['SP.POP.TOTL', 'NY.GDP.MKTP.CD'] },
  username: { singularExample: 'torvalds', pluralExample: ['torvalds', 'gaearon'] },
  repo: { singularExample: 'linux', pluralExample: ['linux', 'git'] },
  slug: { singularExample: 'Web/API/Fetch_API', pluralExample: ['Web/API/Fetch_API', 'Web/JavaScript'] },
  prefix: { singularExample: 'py', pluralExample: ['py', 'ja'] },
  mbid: { singularExample: 'b10bbbfc-c9a0-42b6-b235-e9660daf6117', pluralExample: ['b10bbbfc-c9a0-42b6-b235-e9660daf6117'] },
  code: { singularExample: '3017620422003', pluralExample: ['3017620422003', '5000159407236'] },
  to: { singularExample: 'CHF', pluralExample: ['CHF', 'GBP', 'JPY'] },
  date: { singularExample: '2024-01-15', pluralExample: ['2024-01-15', '2024-06-01'] },
  timezone: { singularExample: 'Europe/Zurich', pluralExample: ['Europe/Zurich', 'America/New_York'] },
  icao24: { singularExample: '3c6444', pluralExample: ['3c6444', 'a835af'] },
  search: { singularExample: 'luke', pluralExample: ['luke', 'vader'] },
  inname: { singularExample: 'python', pluralExample: ['python', 'java'] },
  key: { singularExample: '2435090', pluralExample: ['2435090', '5219294'] },
  type: { singularExample: 'water', pluralExample: ['water', 'fire'] },
  paperId: { singularExample: '649def34f8be52c8b66281af', pluralExample: ['649def34f8be52c8b66281af'] },
  ids: { singularExample: '649def34f8be52c8b66281af', pluralExample: ['649def34f8be52c8b66281af', 'abc123'] },
  mal_id: { singularExample: '5114', pluralExample: ['5114', '1'] },
  tvmaze_id: { singularExample: '82', pluralExample: ['82', '1'] },
  category: { singularExample: 'cs.AI', pluralExample: ['cs.AI', 'cs.LG'] },
  text: { singularExample: 'react', pluralExample: ['react', 'vue'] },
  search_terms: { singularExample: 'nutella', pluralExample: ['nutella', 'water'] },
};

export function defaultStringBatchOptions(singular: string): BatchStringOptions {
  return STRING_BATCH_PRESETS[singular] ?? { singularExample: 'example', pluralExample: ['example-a', 'example-b'] };
}

const NUMBER_BATCH_PRESETS: Record<string, BatchNumberOptions> = {
  question_id: { plural: 'question_ids', singularExample: 11227958, pluralExample: [11227958, 47718771] },
  storyId: { singularExample: 8863, pluralExample: [8863, 1] },
};

export function defaultNumberBatchRange(_singular: string): { minimum: number; maximum: number } {
  return { minimum: 1, maximum: 99999999999 };
}

export function defaultNumberBatchOptions(singular: string): BatchNumberOptions {
  return NUMBER_BATCH_PRESETS[singular] ?? { singularExample: 1, pluralExample: [1, 2] };
}

export function numberBatchInputExamples(
  singular: string,
  range: { minimum: number; maximum: number },
  options?: BatchNumberOptions
): Record<string, unknown>[] {
  const pluralKey = options?.plural ?? defaultPlural(singular);
  const singEx = options?.singularExample ?? 1;
  const plurEx = options?.pluralExample ?? [1, 2];
  return [{ [singular]: singEx }, { [pluralKey]: plurEx }];
}

/** GitHub-style owner + repo / repos batch request examples. */
export function ownerRepoBatchExamples(
  ownerExample = 'vercel',
  repoExample = 'next.js',
  reposExample: string[] = ['next.js', 'swr']
): Record<string, unknown>[] {
  return [
    { owner: ownerExample, repo: repoExample },
    { owner: ownerExample, repos: reposExample },
  ];
}

export function mergeInputExamples(
  ...groups: Record<string, unknown>[][]
): Record<string, unknown>[] {
  return groups.flat();
}

/** Examples when two string batch dimensions are used together (e.g. country + indicator). */
export function dualStringBatchInputExamples(
  fieldA: string,
  fieldB: string,
  optA?: BatchStringOptions,
  optB?: BatchStringOptions
): Record<string, unknown>[] {
  const pA = optA?.plural ?? defaultPlural(fieldA);
  const pB = optB?.plural ?? defaultPlural(fieldB);
  const a = optA?.singularExample ?? 'a';
  const b = optB?.singularExample ?? 'b';
  const aPl = optA?.pluralExample ?? ['a1', 'a2'];
  const bPl = optB?.pluralExample ?? ['b1', 'b2'];
  return [
    { [fieldA]: a, [fieldB]: b },
    { [pA]: aPl, [pB]: bPl },
    { [fieldA]: a, [pB]: bPl },
    { [pA]: aPl, [fieldB]: b },
  ];
}

export function buildAgentReadyExamples(block: {
  stringSingulars?: string[];
  numberSingulars?: string[];
  coordinate?: { latKey: string; lonKey: string; lonPlural?: string; extra?: Record<string, unknown>[] };
}): Record<string, unknown>[] {
  const singulars = [...new Set(block.stringSingulars ?? [])];
  if (
    singulars.includes('country_code') &&
    singulars.includes('indicator_id')
  ) {
    return dualStringBatchInputExamples(
      'country_code',
      'indicator_id',
      defaultStringBatchOptions('country_code'),
      defaultStringBatchOptions('indicator_id')
    );
  }
  const stringExamples = singulars.flatMap((s) =>
    stringBatchInputExamples(s, defaultStringBatchOptions(s))
  );
  const numberSingulars = [...new Set(block.numberSingulars ?? [])].filter(
    (n) =>
      !block.coordinate ||
      (n !== block.coordinate.latKey && n !== block.coordinate.lonKey)
  );
  const numberExamples = numberSingulars.flatMap((n) =>
    numberBatchInputExamples(n, defaultNumberBatchRange(n), defaultNumberBatchOptions(n))
  );
  const coordExamples = block.coordinate
    ? coordinateBatchInputExamples(block.coordinate.latKey, block.coordinate.lonKey, {
        lonPlural: block.coordinate.lonPlural,
        extra: block.coordinate.extra,
      })
    : [];
  return [...stringExamples, ...numberExamples, ...coordExamples];
}

/** Wrap properties with agent-readiness metadata (examples + allow batch-only plural keys). */
export function agentReadyInputSchema(
  properties: Record<string, object>,
  config: {
    description?: string;
    examples: Record<string, unknown>[];
    required?: string[];
  }
): AgentReadyObjectInputSchema {
  return {
    type: 'object',
    additionalProperties: true,
    description: config.description ?? AGENT_READY_BATCH_DESCRIPTION,
    examples: config.examples,
    properties,
    ...(config.required?.length ? { required: config.required } : {}),
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
