import { CAIRN_CORPUS } from './revueCorpora';

// Corpora served by the query_ngram / joker_ngram / associated_ngram routes, which read a
// token-indexed database ({name}_ngram.db) and answer far faster than /query and /joker.
// Same CSV columns. App corpus code -> database name on the server.
// Every route also filters on the corpus's own fields (rubrique on lemonde_rubriques,
// revue on Cairn): see ngramFieldParams.
export const NGRAM_ROUTE_CORPORA = {
  presse: 'presse',
  livres: 'livres',
  american_stories: 'american_stories',
  paris: 'paris',
  moniteur: 'moniteur',
  la_presse: 'la_presse',
  constitutionnel: 'constitutionnel',
  figaro: 'figaro',
  huma: 'huma',
  lacroix: 'lacroix',
  subtitles: 'subtitles',
  ouest: 'ouest',
  prenoms: 'prenoms',
  spa_majinbook: 'spa_majinbook',
  tv_bfmtv: 'bfmtv',
  tv_cnews: 'cnews',
  tv_franceinfo: 'franceinfo',
  lemonde_rubriques: 'lemonde_rubriques',
  [CAIRN_CORPUS]: 'cairn',
};

// The contemporary web press (Elias Echikr's databases, once served by the Agoragram API)
// goes through the same routes with elias=true; the app corpus code is the database name.
export const ELIAS_CORPORA = new Set([
  '20minutes', 'atlantico', 'bfmtv', 'challenges', 'cnews', 'francesoir',
  'gala', 'l_opinion', 'la_depeche', 'laprovence', 'latribune',
  'le_capital', 'le_courrier_de_l_ouest', 'le_figaro', 'le_journal_du_dimanche',
  'le_maine_libre', 'le_marin', 'le_monde', 'le_nouvel_observateur',
  'le_telegramme', 'les_echos', 'marianne', 'mediapart',
  'midilibre', 'nice_matin', 'ouest_france2', 'paris_match', 'paris_normandie',
  'presse_ocean', 'sud_ouest', 'telerama', 'valeurs_actuelles', 'voici',
  'voiles_et_voiliers',
]);
// Databases fetched under this prefix always come from the Elias set: its leparisien and
// la_croix are not the guni corpora the app otherwise uses for those papers.
export const ELIAS_PREFIX = 'elias:';

const isElias = (corpus) => ELIAS_CORPORA.has(corpus) || corpus.startsWith(ELIAS_PREFIX);

export const usesNgramRoute = (corpus) =>
  Object.prototype.hasOwnProperty.call(NGRAM_ROUTE_CORPORA, corpus) || isElias(corpus);

export const ngramDbName = (corpus) =>
  isElias(corpus) ? corpus.replace(ELIAS_PREFIX, '') : NGRAM_ROUTE_CORPORA[corpus];

// The corpus parameters of an ngram route URL.
export const ngramCorpusParams = (corpus) =>
  `corpus=${ngramDbName(corpus)}${isElias(corpus) ? '&elias=true' : ''}`;

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
