// Le Monde has two databases: le_monde (the web press set, 1945-2026, daily, up to
// 2-grams) and lemonde_rubriques (1945-2024, monthly, up to 4-grams, split into
// rubriques, and the only one with the article modes). The picker shows them as a single
// "Le Monde", and each query goes to the one that can answer it: le_monde unless it needs
// rubriques, an article mode, or n-grams longer than 2.
export const LE_MONDE = 'le_monde';
export const LE_MONDE_RUBRIQUES = 'lemonde_rubriques';

const ARTICLE_MODES = ['article', 'cooccurrence_article', 'associated_article'];

export const hasRubriqueFilter = (query) =>
  (Array.isArray(query.rubriques) && query.rubriques.length > 0) || !!query.byRubrique;

const LIST_MODES = ['joker', 'nearby'];
// le_monde has nothing longer than 2-grams.
const LE_MONDE_MAX_LENGTH = 2;

// Size of the n-grams a query needs: its longest '+' or '&' part, and for the list modes
// one word more (or the requested length, if longer).
export const ngramSize = ({ word = '', searchMode, length }) => {
  const words = Math.max(0, ...word.split(/[+&]/)
    .map(part => part.trim().replace(/-/g, ' ').split(/\s+/).filter(Boolean).length));
  return LIST_MODES.includes(searchMode) ? Math.max(words + 1, Number(length) || 0) : words;
};

// The database a Le Monde query is actually sent to; every other corpus is left as is.
export const leMondeSource = (query) =>
  query.corpus === LE_MONDE && (hasRubriqueFilter(query) || ARTICLE_MODES.includes(query.searchMode)
    || ngramSize(query) > LE_MONDE_MAX_LENGTH)
    ? LE_MONDE_RUBRIQUES
    : query.corpus;

// Folds lemonde_rubriques into le_monde in the corpus list: one entry, offering the
// modes of both, in the place of lemonde_rubriques (the top of the modern press).
export const mergeLeMonde = (corpora) => {
  const rubriques = corpora.find(c => c.value === LE_MONDE_RUBRIQUES);
  const leMonde = corpora.find(c => c.value === LE_MONDE);
  if (!rubriques || !leMonde) return corpora;
  const merged = { ...leMonde, availableModes: [...new Set([...rubriques.availableModes, ...leMonde.availableModes])] };
  return corpora
    .filter(c => c !== leMonde)
    .map(c => (c === rubriques ? merged : c));
};
