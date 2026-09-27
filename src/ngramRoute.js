// Corpora served by the query_ngram / joker_ngram / wildcard_ngram routes, which read a
// token-indexed database ({name}_ngram.db) and answer far faster than /query and /joker.
// Same CSV columns. App corpus code -> database name on the server.
// Cairn has a database too, but these routes take no revue/discipline filter, so it
// stays on query_cairn.
export const NGRAM_ROUTE_CORPORA = {
  presse: 'presse',
  tv_bfmtv: 'bfmtv',
  tv_cnews: 'cnews',
  tv_franceinfo: 'franceinfo',
};

export const usesNgramRoute = (corpus) => Object.prototype.hasOwnProperty.call(NGRAM_ROUTE_CORPORA, corpus);

export const ngramDbName = (corpus) => NGRAM_ROUTE_CORPORA[corpus];

// Rankings of joker_ngram / associated_ngram: raw count, or an association score between
// the found word and the searched one (count's own values are the default).
export const SCORE_METHODS = ['count', 'llr', 'pmi', 'logdice'];
