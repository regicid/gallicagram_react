import { sumSeries } from './series';
import { usesNgramRoute, ngramDbName } from './ngramRoute';

describe('ngram route', () => {
  test('maps the app corpus codes to the server database names', () => {
    expect(ngramDbName('presse')).toBe('presse');
    expect(ngramDbName('tv_bfmtv')).toBe('bfmtv');
    expect(usesNgramRoute('lemonde')).toBe(false);
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
