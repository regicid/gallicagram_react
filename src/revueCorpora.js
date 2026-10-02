// Corpora filterable by discipline / revue. Both go through the ngram routes (see
// ngramRoute.js), which filter on their revue field.
// `revues` points at a public JSON file shaped { discipline: { code: nom } }.
// `supportsDiscipline` marks the databases that know their disciplines; where it is false
// the codes must be listed one by one. Persée's accepts `discipline` syntactically but
// ignores it and returns the whole corpus, so it must stay false.
export const REVUE_CORPORA = {
  persee: { revues: '/revues_persee.json', supportsDiscipline: false, label: 'Persée' },
  'route à part (query_cairn)': { revues: '/revues_cairn.json', supportsDiscipline: true, label: 'Cairn' },
};

// Rolling-news transcripts. All three share the /query_tv route and name their channel in
// the `corpus` parameter; the keys are prefixed because bfmtv and cnews already exist as
// Agoragram web-article corpora and must stay separate.
export const TV_CORPORA = {
  tv_bfmtv: 'bfmtv',
  tv_cnews: 'cnews',
  tv_franceinfo: 'franceinfo',
};

export const isTvCorpus = (corpus) => Object.prototype.hasOwnProperty.call(TV_CORPORA, corpus);

// Corpora that are the sum of several revue corpora: each part is queried on its own
// route and the series are added together (both occurrences and corpus size).
export const COMBINED_CORPORA = {
  'route à part (persee+cairn)': ['persee', 'route à part (query_cairn)'],
};

// Who put a corpus together, keyed by the category in corpus.tsv, or by the corpus when
// its category also holds other people's corpora. Shown above the context panel; the same
// people are thanked at greater length in About.
const CATEGORY_CREDITS = {
  'Modern press': { name: 'Elias Echikr', url: 'https://www.linkedin.com/in/elias-echikr-134a5b259/' },
  'TV transcripts': { name: 'Yann de Boisvilliers', url: 'https://www.linkedin.com/in/yann-de-boisvilliers-875ab8275/' },
};
const MAJINBOOK = { name: 'MajinBook', url: 'https://github.com/mazieres/MajinBook' };
const CORPUS_CREDITS = {
  majinbook: MAJINBOOK,
  spa_majinbook: MAJINBOOK,
  eng_majinbook: MAJINBOOK,
  deu_majinbook: MAJINBOOK,
};

export const corpusCredit = (corpus, category) =>
  (has(CORPUS_CREDITS, corpus) ? CORPUS_CREDITS[corpus] : CATEGORY_CREDITS[category]);

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const isRevueCorpus = (corpus) => has(REVUE_CORPORA, corpus);
export const isCombinedCorpus = (corpus) => has(COMBINED_CORPORA, corpus);

// The revue corpora a given corpus is made of: itself, its parts, or none.
// Everything downstream (the pickers, the fetching) iterates over this.
export const revueCorpusParts = (corpus) => {
  if (isCombinedCorpus(corpus)) return COMBINED_CORPORA[corpus];
  if (isRevueCorpus(corpus)) return [corpus];
  return [];
};

// Discipline/revue selections are stored per corpus, never merged: the two taxonomies
// only share 10 of their names, and 41 revue codes collide case-insensitively between
// Persée (lowercase) and Cairn (uppercase).
export const getSelection = (query, corpus) => (query.revueSelection || {})[corpus] || {};

// Builds the `&discipline=…&revue=…` filter for the ngram routes. The API unions the two
// parameters, and the server rejects request lines over ~4 KB — Cairn's 672 codes alone are ~4.7 KB — so whole disciplines are collapsed into
// `discipline=`, which keeps the URL an order of magnitude shorter.
// Revue codes are separated by commas, and the discipline names that contain one
// ('Info, Communication') are recognised as such.
export const buildRevueFilter = (revues, revueMap, supportsDiscipline) => {
  const revueParam = codes => `&revue=${encodeURIComponent(codes.join(','))}`;
  // Never initialised: no filter at all, i.e. the whole corpus.
  if (!Array.isArray(revues)) return '';
  // Explicitly empty: send a code that matches nothing, otherwise an empty `revue`
  // would be read as "no filter" and silently plot the whole corpus.
  if (revues.length === 0) return '&revue=__aucune__';
  if (!revueMap) return revueParam(revues);

  const selected = new Set(revues);
  const allCodes = new Set(Object.values(revueMap).flatMap(d => Object.keys(d)));
  if ([...allCodes].every(c => selected.has(c))) return '';
  if (!supportsDiscipline) return revueParam(revues);

  const covered = new Set();
  const disciplines = [];
  Object.entries(revueMap).forEach(([name, journals]) => {
    const codes = Object.keys(journals);
    if (codes.length > 0 && codes.every(c => selected.has(c))) {
      disciplines.push(name);
      codes.forEach(c => covered.add(c));
    }
  });

  const leftover = revues.filter(c => !covered.has(c));
  return (disciplines.length > 0 ? `&discipline=${encodeURIComponent(disciplines.join(','))}` : '')
    + (leftover.length > 0 ? revueParam(leftover) : '');
};

export const CAIRN_CORPUS = 'route à part (query_cairn)';
export const PERSEE_CORPUS = 'persee';
// Corpus codes that were renamed or folded into another entry (see leMonde.js), so that
// links shared under the old code still open.
export const LEGACY_CORPUS_CODES = {
  'route à part (query_persee)': PERSEE_CORPUS,
  lemonde_rubriques: 'le_monde',
  // Le Monde's code until December 2025.
  lemonde: 'le_monde',
  // The server renamed the database.
  ouest_france2: 'ouest_france',
};
const CAIRN_SEARCH = 'https://shs.cairn.info/recherche';
// Past this many revue codes the query string gets unwieldy; the discipline ids that
// cover them are sent instead, which is broader but keeps the request sane.
const MAX_REVUE_PARAMS = 40;

// Builds a Cairn full-text search query string mirroring the graph's revue selection.
// The result is only ever handed to the user as a link: Cairn is behind bot protection
// that answers automated requests with a CAPTCHA, so the site is not queried from here.
//
// Cairn offers no exact-year filter, so the link cannot be pinned to the clicked year;
// see the yearGap note below.
export const buildCairnSearchParams = ({ word, year, revues, revueMap, disciplineIds }) => {
  const p = new URLSearchParams();
  p.set('lang', 'fr');
  p.set('advancedFilters[0][field]', 'full_text');
  p.set('advancedFilters[0][operator]', 'and');
  p.set('advancedFilters[0][value]', word);
  p.set('typepubs[0]', '1'); // journals only: books and book chapters are not in the ngram corpus

  // Cairn cannot filter on a given year. Its only date control is `yearGap`, a relative
  // preset: current year, or the last 3, 5 or 10. beginYear/endYear exist in its state but
  // are bound to no input, which is why it echoes them back empty. The tightest preset
  // still containing the clicked year is used — that narrows recent searches without ever
  // excluding the year itself; anything older simply searches the whole period.
  const gap = year ? new Date().getFullYear() - Number(year) : null;
  if (gap !== null && gap >= 0) {
    const preset = [0, 2, 4, 9].find(g => gap <= g);
    if (preset !== undefined) p.set('yearGap', String(preset));
  }

  const selected = Array.isArray(revues) ? revues : null;
  const allCodes = revueMap ? Object.values(revueMap).flatMap(d => Object.keys(d)) : [];
  const everything = !selected || (allCodes.length > 0 && new Set(selected).size >= new Set(allCodes).size);

  if (!everything && selected.length > 0) {
    if (selected.length <= MAX_REVUE_PARAMS) {
      selected.forEach((code, i) => p.set(`revues[${i}]`, code));
    } else if (revueMap && disciplineIds) {
      // Fall back to the disciplines that the selection covers.
      const chosen = new Set(selected);
      const ids = Object.entries(revueMap)
        .filter(([, journals]) => Object.keys(journals).some(c => chosen.has(c)))
        .map(([name]) => disciplineIds[name])
        .filter(Boolean);
      [...new Set(ids)].forEach((id, i) => p.set(`disciplines[${i}]`, id));
    }
  }
  return p.toString();
};

export const cairnSearchUrl = (args) => `${CAIRN_SEARCH}?${buildCairnSearchParams(args)}`;
