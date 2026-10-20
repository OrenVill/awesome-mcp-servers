/**
 * Benchmark unified-mcp registry modes. Run from servers/unified-mcp:
 *   node scripts/bench-registry.mjs <mode> [args...]
 * Modes: baseline-eager | lazy-cold | lazy-warm-one | lru-rotate
 */
import { performance } from 'node:perf_hooks';

function mb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function mem() {
  const m = process.memoryUsage();
  return { heapUsedMb: mb(m.heapUsed), rssMb: mb(m.rss) };
}

const mode = process.argv[2];

const { createLazyToolRegistry } = await import('../dist/registry/toolRegistry.js');

if (mode === 'baseline-eager') {
  process.env.UNIFIED_MCP_EAGER_LOAD = 'true';
  delete process.env.UNIFIED_MCP_MAX_LOADED_PROVIDERS;
  const t0 = performance.now();
  const r = await createLazyToolRegistry();
  const startupMs = Math.round(performance.now() - t0);
  const st = r.getStatus();
  console.log(
    JSON.stringify({
      mode,
      startupMs,
      ...mem(),
      loadedProviders: st.loadedProviders,
      catalogTools: st.catalogTools,
    })
  );
  process.exit(0);
}

if (mode === 'lazy-cold') {
  delete process.env.UNIFIED_MCP_EAGER_LOAD;
  delete process.env.UNIFIED_MCP_MAX_LOADED_PROVIDERS;
  const t0 = performance.now();
  const r = await createLazyToolRegistry();
  const startupMs = Math.round(performance.now() - t0);
  const st = r.getStatus();
  console.log(
    JSON.stringify({
      mode,
      startupMs,
      ...mem(),
      loadedProviders: st.loadedProviders,
      catalogTools: st.catalogTools,
    })
  );
  process.exit(0);
}

if (mode === 'lazy-warm-one') {
  delete process.env.UNIFIED_MCP_EAGER_LOAD;
  delete process.env.UNIFIED_MCP_MAX_LOADED_PROVIDERS;
  const r = await createLazyToolRegistry();
  const cold = mem();
  const t0 = performance.now();
  await r.executeTool('get_current_weather', { latitude: 48.85, longitude: 2.35 });
  const firstToolMs = Math.round(performance.now() - t0);
  const t1 = performance.now();
  await r.executeTool('get_current_weather', { latitude: 40.71, longitude: -74.01 });
  const secondToolMs = Math.round(performance.now() - t1);
  console.log(
    JSON.stringify({
      mode,
      ...mem(),
      coldHeapMb: cold.heapUsedMb,
      firstToolMs,
      secondToolMs,
      status: r.getStatus(),
    })
  );
  process.exit(0);
}

if (mode === 'lru-rotate') {
  const max = parseInt(process.argv[3] ?? '10', 10);
  const rotate = parseInt(process.argv[4] ?? '20', 10);
  delete process.env.UNIFIED_MCP_EAGER_LOAD;
  process.env.UNIFIED_MCP_MAX_LOADED_PROVIDERS = String(max);
  delete process.env.UNIFIED_MCP_PROVIDERS;

  const r = await createLazyToolRegistry();
  const providers = [
    'open-meteo',
    'wikipedia',
    'hacker-news',
    'arxiv',
    'crossref',
    'pubmed',
    'wikidata',
    'stackexchange',
    'worldbank',
    'openfda',
    'musicbrainz',
    'tvmaze',
    'npm-registry',
    'opensky',
    'pokeapi',
    'worldtime',
    'sunrise-sunset',
    'semantic-scholar',
    'openfoodfacts',
    'jikan',
    'swapi',
    'pypi',
    'gbif',
    'openalex',
    'nominatim',
    'dictionary',
    'frankfurter',
    'spacex',
    'github-public',
    'mdn',
    'datamuse',
    'trivia',
    'open-library',
    'rest-countries',
    'usgs-earthquake',
    'opennotify',
  ].slice(0, rotate);

  const toolByProvider = {
    'open-meteo': () => r.executeTool('get_current_weather', { latitude: 48.85, longitude: 2.35 }),
    wikipedia: () => r.executeTool('search_wikipedia', { query: 'test' }),
    'hacker-news': () => r.executeTool('get_top_stories', {}),
    arxiv: () => r.executeTool('search_arxiv', { query: 'machine learning', max_results: 1 }),
    crossref: () => r.executeTool('search_works', { query: 'biology', per_page: 1 }),
    pubmed: () => r.executeTool('search_articles', { query: 'aspirin', max_results: 1 }),
    wikidata: () => r.executeTool('search_entities', { search: 'Paris', limit: 1 }),
    stackexchange: () => r.executeTool('search_questions', { query: 'python', pagesize: 1 }),
    worldbank: () => r.executeTool('list_countries', {}),
    openfda: () => r.executeTool('search_drug_labels', { search: 'ibuprofen', limit: 1 }),
    musicbrainz: () => r.executeTool('search_artist', { query: 'beatles', limit: 1 }),
    tvmaze: () => r.executeTool('search_shows', { query: 'breaking bad', limit: 1 }),
    'npm-registry': () => r.executeTool('get_package', { name: 'lodash' }),
    opensky: () => r.executeTool('get_all_states', {}),
    pokeapi: () => r.executeTool('get_pokemon', { name: 'pikachu' }),
    worldtime: () => r.executeTool('list_timezones', {}),
    'sunrise-sunset': () =>
      r.executeTool('get_sun_times', { lat: 48.85, lng: 2.35 }),
    'semantic-scholar': () =>
      r.executeTool('search_papers', { query: 'transformer', limit: 1 }),
    openfoodfacts: () =>
      r.executeTool('get_product_by_barcode', { code: '3017620422003' }),
    jikan: () => r.executeTool('search_anime', { query: 'naruto', limit: 1 }),
    swapi: () => r.executeTool('search_films', { search: 'hope' }),
    pypi: () => r.executeTool('get_package', { name: 'requests' }),
    gbif: () => r.executeTool('search_species', { q: 'homo sapiens', limit: 1 }),
    openalex: () => r.executeTool('search_works', { query: 'cancer', per_page: 1 }),
    nominatim: () => r.executeTool('geocode', { query: 'Berlin' }),
    dictionary: () => r.executeTool('define_word', { word: 'hello' }),
    frankfurter: () => r.executeTool('convert_currency', { from: 'USD', to: 'EUR', amount: 1 }),
    spacex: () => r.executeTool('get_latest_launch', {}),
    'github-public': () => r.executeTool('get_user', { username: 'octocat' }),
    mdn: () => r.executeTool('search_mdn', { query: 'fetch', limit: 1 }),
    datamuse: () => r.executeTool('find_rhymes', { word: 'cat' }),
    trivia: () => r.executeTool('get_questions', { amount: 1 }),
    'open-library': () => r.executeTool('search_books', { query: 'tolkien', limit: 1 }),
    'rest-countries': () => r.executeTool('get_country', { name: 'France' }),
    'usgs-earthquake': () => r.executeTool('get_event', { event_id: 'us7000' }).catch(() => ({})),
    opennotify: () => r.executeTool('get_iss_location', {}),
  };

  const latencies = [];
  const tAll = performance.now();
  for (const p of providers) {
    const fn = toolByProvider[p];
    if (!fn) continue;
    const t0 = performance.now();
    try {
      await fn();
    } catch {
      /* network errors still count load latency */
    }
    latencies.push(Math.round(performance.now() - t0));
  }
  const totalMs = Math.round(performance.now() - tAll);
  const st = r.getStatus();
  console.log(
    JSON.stringify({
      mode: 'lru-rotate',
      maxLoadedProviders: max,
      providersTouched: providers.length,
      totalMs,
      avgToolMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p95ToolMs: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? 0,
      ...mem(),
      status: st,
    })
  );
  process.exit(0);
}

console.error('Unknown mode', mode);
process.exit(1);
