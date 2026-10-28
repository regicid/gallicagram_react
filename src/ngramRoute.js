import { CAIRN_CORPUS, PERSEE_CORPUS } from './revueCorpora';

// Corpora served by the query_ngram / joker_ngram / associated_ngram routes, which read a
// token-indexed database ({name}_ngram.db) and answer far faster than /query and /joker.
// Same CSV columns. App corpus code -> database name on the server.
// Every route also filters on the corpus's own fields (rubrique on lemonde_rubriques,
// revue on Cairn and Persée): see ngramFieldParams.
export const NGRAM_ROUTE_CORPORA = {
  presse: 'presse',
  livres: 'livres',
  ddb: 'ddb',
  american_stories: 'american_stories',
  guardian: 'guardian',
  paris: 'paris',
  moniteur: 'moniteur',
  journal_des_debats: 'journal_des_debats',
  la_presse: 'la_presse',
  constitutionnel: 'constitutionnel',
  figaro: 'figaro',
  temps: 'temps',
  petit_journal: 'petit_journal',
  petit_parisien: 'petit_parisien',
  journal_officiel: 'journal_officiel',
  huma: 'huma',
  lacroix: 'lacroix',
  subtitles: 'subtitles',
  subtitles_en: 'subtitles_en',
  rap: 'rap',
  ouest: 'ouest',
  prenoms: 'prenoms',
  jorf: 'jorf',
  leparisien: 'leparisien',
  // majinbook: 'majinbook',
  // spa_majinbook: 'spa_majinbook',
  // eng_majinbook: 'eng_majinbook',
  // deu_majinbook: 'deu_majinbook',
  tv_bfmtv: 'bfmtv',
  tv_cnews: 'cnews',
  tv_franceinfo: 'franceinfo',
  lemonde_rubriques: 'lemonde_rubriques',
  [CAIRN_CORPUS]: 'cairn',
  [PERSEE_CORPUS]: 'persee',
};

// The contemporary web press (Elias Echikr's databases, once served by the Agoragram API)
// goes through the same routes with elias=true; the app corpus code is the database name.
// Written here so that the routing never waits for corpus.tsv; once the file is loaded,
// its "Elias" column adds the corpora this list does not have yet (it never takes any out).
export const ELIAS_CORPORA = new Set([
  '20minutes', 'atlantico', 'bfmtv', 'blast', 'challenges', 'cnews', 'francesoir',
  'gala', 'l_opinion', 'la_depeche', 'laprovence', 'latribune',
  'le_capital', 'le_courrier_de_l_ouest', 'le_figaro', 'le_journal_du_dimanche',
  'le_maine_libre', 'le_marin', 'le_monde', 'le_nouvel_observateur',
  'le_telegramme', 'les_echos', 'liberation', 'marianne', 'mediapart',
  'midilibre', 'nice_matin', 'ouest_france', 'paris_match', 'paris_normandie',
  'presse_ocean', 'sud_ouest', 'telerama', 'valeurs_actuelles', 'voici',
  'voiles_et_voiliers',
]);

// The codes of corpus.tsv whose "Elias" column is true.
export const eliasCorporaFromTsv = (tsv) => {
  const [header, ...lines] = tsv.split('\n');
  const headers = header.split('\t').map(name => name.trim());
  const code = headers.indexOf('Code API');
  const elias = headers.indexOf('Elias');
  if (elias === -1) return [];
  return lines
    .map(line => line.split('\t'))
    .filter(columns => columns[elias]?.trim() === 'true')
    .map(columns => columns[code].trim());
};

export const addEliasCorpora = (tsv) =>
  eliasCorporaFromTsv(tsv).forEach(corpus => ELIAS_CORPORA.add(corpus));

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
