import { leMondeSource, mergeLeMonde } from './leMonde';

describe('Le Monde', () => {
  test('sends a query to lemonde_rubriques only when it needs the rubriques', () => {
    expect(leMondeSource({ corpus: 'le_monde', rubriques: [] })).toBe('le_monde');
    expect(leMondeSource({ corpus: 'le_monde', rubriques: ['sport'] })).toBe('lemonde_rubriques');
    expect(leMondeSource({ corpus: 'le_monde', byRubrique: true })).toBe('lemonde_rubriques');
    expect(leMondeSource({ corpus: 'le_monde', searchMode: 'article' })).toBe('lemonde_rubriques');
    expect(leMondeSource({ corpus: 'le_monde', searchMode: 'joker' })).toBe('le_monde');
    expect(leMondeSource({ corpus: 'presse', rubriques: ['sport'] })).toBe('presse');
  });

  test('shows the two databases as one entry offering the modes of both', () => {
    const merged = mergeLeMonde([
      { value: 'lemonde_rubriques', availableModes: ['article', 'joker', 'nearby'] },
      { value: 'presse', availableModes: [] },
      { value: 'le_monde', availableModes: ['joker', 'nearby'] },
    ]);
    // In the place of lemonde_rubriques, at the top.
    expect(merged.map(c => c.value)).toEqual(['le_monde', 'presse']);
    expect(merged[0].availableModes.sort()).toEqual(['article', 'joker', 'nearby']);
  });
});
