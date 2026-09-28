import { CAIRN_CORPUS } from './revueCorpora';

// Corpora served by the query_ngram / joker_ngram / associated_ngram routes, which read a
// token-indexed database ({name}_ngram.db) and answer far faster than /query and /joker.
// Same CSV columns. App corpus code -> database name on the server.
// Every route also filters on the corpus's own fields (rubrique on lemonde_rubriques,
// revue on Cairn): see ngramFieldParams.
export const NGRAM_ROUTE_CORPORA = {
  presse: 'presse',
  tv_bfmtv: 'bfmtv',
  tv_cnews: 'cnews',
  tv_franceinfo: 'franceinfo',
  lemonde_rubriques: 'lemonde_rubriques',
  [CAIRN_CORPUS]: 'cairn',
};

export const usesNgramRoute = (corpus) => Object.prototype.hasOwnProperty.call(NGRAM_ROUTE_CORPORA, corpus);

export const ngramDbName = (corpus) => NGRAM_ROUTE_CORPORA[corpus];

// Filters on a corpus's own fields, as the ngram routes take them: `<field>=a,b` restricts
// both the counts and the totals to those values, `by_<field>=True` splits the series
// (query_ngram only). Empty selections are left out, i.e. no filter.
export const ngramFieldParams = (filters = {}, splitBy = []) =>
  Object.entries(filters)
    .filter(([, values]) => values && values.length > 0)
    .map(([field, values]) => `&${field}=${encodeURIComponent(values.join(','))}`)
    .join('')
  + splitBy.map(field => `&by_${field}=True`).join('');

// Rankings of joker_ngram / associated_ngram: raw count, or an association score between
// the found word and the searched one (count's own values are the default).
export const SCORE_METHODS = ['count', 'llr', 'pmi', 'logdice'];
