// Corpora served by their own API route and filterable by discipline / revue.
// `revues` points at a public JSON file shaped { discipline: { code: nom } }.
// `supportsDiscipline` marks the routes that accept a `discipline` parameter; where it
// is false the codes must be listed one by one. query_persee accepts the parameter
// syntactically but ignores it and returns the whole corpus, so it must stay false.
export const REVUE_CORPORA = {
  'route à part (query_persee)': { route: 'query_persee', revues: '/revues_persee.json', supportsDiscipline: false, label: 'Persée' },
  'route à part (query_cairn)': { route: 'query_cairn', revues: '/revues_cairn.json', supportsDiscipline: true, label: 'Cairn' },
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
  'route à part (persee+cairn)': ['route à part (query_persee)', 'route à part (query_cairn)'],
};

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

export const CAIRN_CORPUS = 'route à part (query_cairn)';
const CAIRN_SEARCH = 'https://shs.cairn.info/recherche';
// Past this many revue codes the query string gets unwieldy; the discipline ids that
// cover them are sent instead, which is broader but keeps the request sane.
const MAX_REVUE_PARAMS = 40;

// Builds a Cairn full-text search query string mirroring the graph's revue selection.
//
// Only some of Cairn's filters bind server-side. `disciplines`, `revues` and `typepubs`
// do; `beginYear`/`endYear` do NOT — the page renders with yearGap "all" and the year is
// applied later by Livewire in a real browser. They are still included so that the link
// we hand the user filters properly when they open it, but results parsed out of a
// proxied fetch are NOT restricted to the year.
export const buildCairnSearchParams = ({ word, year, revues, revueMap, disciplineIds }) => {
  const p = new URLSearchParams();
  p.set('lang', 'fr');
  p.set('advancedFilters[0][field]', 'full_text');
  p.set('advancedFilters[0][operator]', 'and');
  p.set('advancedFilters[0][value]', word);
  p.set('typepubs[0]', '1'); // journals only: books and book chapters are not in the ngram corpus
  if (year) {
    p.set('beginYear', String(year));
    p.set('endYear', String(year));
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
export const cairnProxyUrl = (args) => `/api/cairn?${buildCairnSearchParams(args)}`;

// Parses Cairn's search results. Each card carries an overlay <a> whose aria-label holds
// the title, plus an <h3>, the authors, the "Dans <revue> (issue)" line and a snippet
// with the search term in bold — that snippet is the actual context.
// The snippet is rendered with dangerouslySetInnerHTML, and it comes from a third party.
// Only the inline tags that carry the term highlighting survive; everything else is
// reduced to its text, so no attributes (and so no event handlers) are ever emitted.
const KEEP_TAGS = new Set(['SPAN', 'EM', 'B', 'STRONG', 'I', 'MARK']);
const sanitiseSnippet = (node) => {
  if (!node) return '';
  const escape = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const walk = (el) => [...el.childNodes].map(n => {
    if (n.nodeType === 3) return escape(n.textContent);
    if (n.nodeType !== 1) return '';
    const inner = walk(n);
    // Keep the bold wrapper that marks the searched term, drop its classes.
    return KEEP_TAGS.has(n.tagName) ? `<${n.tagName.toLowerCase()}>${inner}</${n.tagName.toLowerCase()}>` : inner;
  }).join('');
  return walk(node).replace(/\s+/g, ' ').trim();
};

export const parseCairnResults = (doc) => {
  const results = [];
  doc.querySelectorAll('a[href*="/revue-"][aria-label]').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!/-page-\d+/.test(href)) return; // skip issue covers and other non-article links
    const card = link.closest('div');
    if (!card) return;
    const text = (sel) => card.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() || '';
    const title = text('h3') || (link.getAttribute('aria-label') || '').split(' - Dans ')[0];
    if (!title) return;
    const authors = [...card.querySelectorAll('ul li a')].map(a => a.textContent.trim()).filter(Boolean);
    const source = text('p.leading-5');
    const snippet = sanitiseSnippet(card.querySelector('p.font-serif'));
    results.push({ title, href, authors, source, snippet });
  });
  // The same article can appear under several nested wrappers; keep the first of each.
  const seen = new Set();
  return results.filter(r => !seen.has(r.href) && seen.add(r.href));
};
