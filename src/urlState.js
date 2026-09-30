import { LEGACY_CORPUS_CODES, CAIRN_CORPUS, PERSEE_CORPUS, revueCorpusParts } from './revueCorpora';

// The plot as a URL, so that a link or a bookmark draws it again exactly: every tab with
// its own settings, the dates and the display options.
//
// The first tab keeps the names links have always used (word, corpus, mode...), so older
// links still open; the other tabs carry their number, as in q2.word and q2.corpus. Values
// left at their default are not written, which keeps the link of a simple plot short.
// Lists are comma-separated, except discipline names, which can contain a comma and so
// take one parameter each (cairn.discipline=Sociologie&cairn.discipline=...).

export const QUERY_DEFAULTS = {
  resolution: 'annee',
  searchMode: 'ngram',
  word2: '',
  distance: 10,
  n_joker: 10,
  length: 2,
  stopwords: 500,
  score: 'count',
  min_count: 20,
};

// The plot is drawn with the active tab's options, so those are the ones written, and a
// link gives them to every tab.
export const ADVANCED_DEFAULTS = {
  rescale: false,
  ratio: false,
  difference: false,
  loessSmoothing: false,
  showConfidenceInterval: true,
  showTotalBarplot: false,
  extendYScale: false,
  corpusBundle: false,
  base100: false,
  base100Year: null,
};

const LIST_MODES = ['joker', 'nearby', 'associated_article'];
// Settings that only mean something in some modes, and are only written there.
const MODE_FIELDS = {
  word2: ['cooccurrence', 'cooccurrence_article'],
  distance: ['cooccurrence'],
  n_joker: LIST_MODES,
  length: LIST_MODES,
  stopwords: LIST_MODES,
  score: ['joker', 'nearby'],
  min_count: ['joker', 'nearby'],
};

// Prefixes for the discipline/revue selection of each revue corpus: cairn.revues=...
const REVUE_KEYS = { [PERSEE_CORPUS]: 'persee', [CAIRN_CORPUS]: 'cairn' };

const DEFAULT_PLOT_TYPE = 'line';

const paramName = (tabIndex) => (name) => (tabIndex === 0 ? name : `q${tabIndex + 1}.${name}`);
const splitList = (value) => (value === '' ? [] : value.split(','));

// Everything selected, which is also what a picker starts with: no filter to write.
const isWholeCorpus = (selection, revueMap) => {
  if (!revueMap) return false;
  const disciplines = new Set(selection.disciplines || []);
  const revues = new Set(selection.revues || []);
  return Object.entries(revueMap).every(([name, journals]) =>
    disciplines.has(name) && Object.keys(journals).every(code => revues.has(code)));
};

export const encodeUrlState = (
  { queries, activeIndex = 0, startDate, endDate, smoothing = 0, plotType = DEFAULT_PLOT_TYPE, advancedOptions = {} },
  revuesData = {},
) => {
  const params = new URLSearchParams();
  queries.forEach((query, i) => {
    const key = paramName(i);
    params.set(key('word'), query.word || '');
    params.set(key('corpus'), query.corpus);
    const mode = query.searchMode || QUERY_DEFAULTS.searchMode;
    // Links have always named the first tab's mode.
    if (i === 0 || mode !== QUERY_DEFAULTS.searchMode) params.set(key('mode'), mode);
    if (query.resolution && query.resolution !== QUERY_DEFAULTS.resolution) params.set(key('resolution'), query.resolution);
    Object.entries(MODE_FIELDS).forEach(([field, modes]) => {
      const value = query[field];
      if (modes.includes(mode) && value !== undefined && value !== null && value !== ''
        && String(value) !== String(QUERY_DEFAULTS[field])) {
        params.set(key(field), value);
      }
    });
    if (query.rubriques?.length) params.set(key('rubriques'), query.rubriques.join(','));
    if (query.byRubrique) params.set(key('byRubrique'), '1');
    revueCorpusParts(query.corpus).forEach(part => {
      const selection = query.revueSelection?.[part];
      if (!selection || isWholeCorpus(selection, revuesData[part])) return;
      const prefix = key(REVUE_KEYS[part]);
      (selection.disciplines || []).forEach(name => params.append(`${prefix}.discipline`, name));
      if (Array.isArray(selection.revues)) params.set(`${prefix}.revues`, selection.revues.join(','));
    });
  });
  params.set('start', startDate);
  params.set('end', endDate);
  if (Number(smoothing)) params.set('smoothing', smoothing);
  if (plotType && plotType !== DEFAULT_PLOT_TYPE) params.set('plotType', plotType);
  if (activeIndex > 0) params.set('tab', activeIndex + 1);
  Object.entries(ADVANCED_DEFAULTS).forEach(([name, fallback]) => {
    const value = advancedOptions[name] ?? fallback;
    if (name === 'base100Year') {
      if (advancedOptions.base100 && value !== null) params.set(name, value);
    } else if (Boolean(value) !== fallback) {
      params.set(name, value ? '1' : '0');
    }
  });
  return params.toString();
};

// The state a URL describes, or null when it names no plot. Dates the URL leaves out come
// back as null, for the caller to fill in.
export const decodeUrlState = (search) => {
  const params = new URLSearchParams(search);
  if (!params.get('word') || !params.get('corpus')) return null;

  const queries = [];
  for (let i = 0; params.has(paramName(i)('corpus')); i++) {
    const key = paramName(i);
    const code = params.get(key('corpus'));
    const corpus = LEGACY_CORPUS_CODES[code] || code;
    let searchMode = params.get(key('mode')) || QUERY_DEFAULTS.searchMode;
    // "By document" was Le Monde's article mode before it had several.
    if (searchMode === 'document' && corpus === 'le_monde') searchMode = 'article';
    const query = { word: params.get(key('word')) || '', corpus, searchMode };
    if (params.get(key('resolution'))) query.resolution = params.get(key('resolution'));
    Object.keys(MODE_FIELDS).forEach(field => {
      if (!params.has(key(field))) return;
      const value = params.get(key(field));
      if (typeof QUERY_DEFAULTS[field] !== 'number') query[field] = value;
      else if (value !== '' && !Number.isNaN(Number(value))) query[field] = Number(value);
    });
    if (params.has(key('rubriques'))) query.rubriques = splitList(params.get(key('rubriques')));
    if (params.get(key('byRubrique')) === '1') query.byRubrique = true;
    revueCorpusParts(corpus).forEach(part => {
      const prefix = key(REVUE_KEYS[part]);
      const disciplines = params.getAll(`${prefix}.discipline`);
      const revues = params.get(`${prefix}.revues`);
      if (disciplines.length === 0 && revues === null) return;
      // An empty discipline list also keeps the picker from selecting everything.
      query.revueSelection = {
        ...query.revueSelection,
        [part]: { disciplines, ...(revues !== null ? { revues: splitList(revues) } : {}) },
      };
    });
    queries.push(query);
  }

  const year = (name) => {
    const value = parseInt(params.get(name), 10);
    return Number.isNaN(value) ? null : value;
  };
  const advancedOptions = {};
  Object.entries(ADVANCED_DEFAULTS).forEach(([name, fallback]) => {
    if (!params.has(name)) return;
    if (name === 'base100Year') advancedOptions[name] = year(name);
    else advancedOptions[name] = params.get(name) === '1';
  });
  const tab = year('tab');
  return {
    queries,
    activeIndex: tab && tab >= 1 && tab <= queries.length ? tab - 1 : 0,
    startDate: year('start'),
    endDate: year('end'),
    smoothing: year('smoothing') || 0,
    plotType: params.get('plotType') || DEFAULT_PLOT_TYPE,
    advancedOptions,
  };
};
