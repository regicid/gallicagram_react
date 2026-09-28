import { sumSeries } from './series';
import { usesNgramRoute, ngramDbName, ngramFieldParams } from './ngramRoute';
import { CAIRN_CORPUS, buildRevueFilter } from './revueCorpora';

describe('ngram route', () => {
  test('maps the app corpus codes to the server database names', () => {
    expect(ngramDbName('presse')).toBe('presse');
    expect(ngramDbName('tv_bfmtv')).toBe('bfmtv');
    expect(ngramDbName('lemonde_rubriques')).toBe('lemonde_rubriques');
    expect(ngramDbName(CAIRN_CORPUS)).toBe('cairn');
    expect(usesNgramRoute('lemonde')).toBe(false);
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
    expect(buildRevueFilter(['RFSIC', 'COMMU', 'RFS'], revueMap, true, true))
      .toBe('&discipline=Info%2C%20Communication&revue=RFS');
    expect(buildRevueFilter(['RFSIC', 'COMMU', 'RFS'], revueMap, true))
      .toBe('&revue=RFSIC%20COMMU%20RFS');
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
