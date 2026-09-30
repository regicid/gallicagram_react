import { sumSeries } from './series';
import { usesNgramRoute, ngramDbName, ngramCorpusParams, ngramFieldParams } from './ngramRoute';
import { CAIRN_CORPUS, PERSEE_CORPUS, buildRevueFilter, isCombinedCorpus } from './revueCorpora';

describe('ngram route', () => {
  test('maps the app corpus codes to the server database names', () => {
    expect(ngramDbName('presse')).toBe('presse');
    expect(ngramDbName('tv_bfmtv')).toBe('bfmtv');
    expect(ngramDbName('lemonde_rubriques')).toBe('lemonde_rubriques');
    expect(ngramDbName(CAIRN_CORPUS)).toBe('cairn');
    expect(ngramDbName(PERSEE_CORPUS)).toBe('persee');
    expect(ngramDbName('livres')).toBe('livres');
    expect(usesNgramRoute('lemonde')).toBe(false);
  });

  // Every corpus of the picker is served by the ngram routes, apart from the ones made
  // of several parts, which are summed from their parts' series.
  test('serves every corpus of corpus.tsv through the ngram routes', () => {
    const fs = require('fs');
    const path = require('path');
    const SUMMED = ['presse_livres', 'presse_moderne'];
    const codes = fs.readFileSync(path.join(__dirname, '../public/corpus.tsv'), 'utf8')
      .split('\n').slice(1).filter(Boolean).map(line => line.split('\t')[3])
      .filter(code => !isCombinedCorpus(code) && !SUMMED.includes(code));
    expect(codes).toContain(CAIRN_CORPUS);
    expect(codes.filter(code => !usesNgramRoute(code))).toEqual([]);
  });

  // The web press databases sit elsewhere on the server, which elias=true selects.
  test('sends the web press corpora with elias=true', () => {
    expect(ngramCorpusParams('le_figaro')).toBe('corpus=le_figaro&elias=true');
    expect(ngramCorpusParams('elias:leparisien')).toBe('corpus=leparisien&elias=true');
    expect(ngramCorpusParams('tv_bfmtv')).toBe('corpus=bfmtv');
    // Without the prefix, Le Parisien is the guni corpus.
    expect(ngramCorpusParams('leparisien')).toBe('corpus=leparisien');
  });

  test('builds the field filters, leaving empty selections out', () => {
    expect(ngramFieldParams({ rubrique: ['sport', 'science/technologie'] }))
      .toBe('&rubrique=sport%2Cscience%2Ftechnologie');
    expect(ngramFieldParams({ rubrique: [] }, ['rubrique'])).toBe('&by_rubrique=True');
    expect(ngramFieldParams({ rubrique: undefined })).toBe('');
  });

  // The ngram routes take commas between revues and know the discipline names with one.
  test('writes the revue filter in the ngram syntax', () => {
    const revueMap = { 'Info, Communication': { RFSIC: 'x', COMMU: 'y' }, Sociologie: { RFS: 'z', ARSS: 'w' } };
    expect(buildRevueFilter(['RFSIC', 'COMMU', 'RFS'], revueMap, true))
      .toBe('&discipline=Info%2C%20Communication&revue=RFS');
    // Persée ignores `discipline`: its codes are always listed.
    expect(buildRevueFilter(['RFSIC', 'COMMU', 'RFS'], revueMap, false))
      .toBe('&revue=RFSIC%2CCOMMU%2CRFS');
  });
});

describe('sumSeries', () => {
  // Each part is its own corpus: the frequency of the whole is (n1 + n2) / (total1 + total2).
  test('sums occurrences and corpus sizes, matching rows on their date', () => {
    const a = [{ annee: 1900, mois: 1, n: 2, total: 100 }, { annee: 1900, mois: 2, n: 1, total: 50 }];
    const b = [{ annee: 1900, mois: 1, n: 3, total: 100 }];
    expect(sumSeries([a, b])).toEqual([
      { annee: 1900, mois: 1, n: 5, total: 200 },
      { annee: 1900, mois: 2, n: 1, total: 50 },
    ]);
  });
});
