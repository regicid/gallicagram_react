import { encodeUrlState, decodeUrlState } from './urlState';
import { CAIRN_CORPUS, PERSEE_CORPUS } from './revueCorpora';

const base = { startDate: 1789, endDate: 1950 };

describe('encodeUrlState', () => {
  // A simple plot keeps the link it always had.
  test('writes a one-tab plot with the historical names only', () => {
    const search = encodeUrlState({ ...base, queries: [{ word: 'liberté', corpus: 'presse', searchMode: 'ngram', resolution: 'annee' }] });
    expect(search).toBe('word=libert%C3%A9&corpus=presse&mode=ngram&start=1789&end=1950');
  });

  test('leaves out the settings of the modes not in use', () => {
    const search = encodeUrlState({ ...base, queries: [{ word: 'guerre', corpus: 'presse', searchMode: 'ngram', n_joker: 50, word2: 'paix' }] });
    expect(search).not.toMatch(/n_joker|word2/);
  });

  // The whole corpus is what a revue picker starts with, so it needs no parameter.
  test('writes a revue selection only when it filters something', () => {
    const revueMap = { Sociologie: { RFS: 'x', ARSS: 'y' }, 'Info, Communication': { RFSIC: 'z' } };
    const all = { disciplines: ['Sociologie', 'Info, Communication'], revues: ['RFS', 'ARSS', 'RFSIC'] };
    const query = (selection) => ({ word: 'genre', corpus: CAIRN_CORPUS, revueSelection: { [CAIRN_CORPUS]: selection } });
    const whole = new URLSearchParams(encodeUrlState({ ...base, queries: [query(all)] }, { [CAIRN_CORPUS]: revueMap }));
    expect([...whole.keys()].filter(name => name.startsWith('cairn.'))).toEqual([]);
    const search = encodeUrlState({ ...base, queries: [query({ disciplines: ['Info, Communication'], revues: ['RFSIC'] })] }, { [CAIRN_CORPUS]: revueMap });
    expect(new URLSearchParams(search).getAll('cairn.discipline')).toEqual(['Info, Communication']);
    expect(new URLSearchParams(search).get('cairn.revues')).toBe('RFSIC');
  });
});

describe('decodeUrlState', () => {
  test('reads the links written before tabs and resolutions were saved', () => {
    const state = decodeUrlState('?word=guerre&corpus=lemonde&start=1945&end=2020&mode=document&smoothing=3&plotType=bar');
    expect(state.queries).toEqual([{ word: 'guerre', corpus: 'le_monde', searchMode: 'article' }]);
    expect(state).toMatchObject({ startDate: 1945, endDate: 2020, smoothing: 3, plotType: 'bar', activeIndex: 0 });
  });

  test('names no plot without a word and a corpus', () => {
    expect(decodeUrlState('')).toBeNull();
    expect(decodeUrlState('?corpus=presse&start=1800&end=1900')).toBeNull();
  });

  test('leaves the dates to the caller when the link has none', () => {
    expect(decodeUrlState('?word=grève&corpus=libe')).toMatchObject({ startDate: null, endDate: null });
  });
});

describe('round trip', () => {
  test('gives back every tab with its own settings, the active tab and the options', () => {
    const queries = [
      { word: 'guerre+guerres', corpus: 'le_monde', searchMode: 'ngram', resolution: 'mois', rubriques: ['sport', 'science/technologie'], byRubrique: true },
      { word: 'grève', corpus: 'tv_bfmtv', searchMode: 'ngram', resolution: 'semaine' },
      { word: 'crise', corpus: 'libe', searchMode: 'joker', n_joker: 30, length: 3, stopwords: 100, score: 'llr', min_count: 5 },
      { word: 'école', corpus: 'presse', searchMode: 'cooccurrence', word2: 'laïque', distance: 5 },
      {
        word: 'genre', corpus: 'route à part (persee+cairn)', searchMode: 'ngram',
        revueSelection: {
          [PERSEE_CORPUS]: { disciplines: ["Arts (Histoire de l'art, Architecture)"], revues: ['arch', 'item'] },
          [CAIRN_CORPUS]: { disciplines: [], revues: [] },
        },
      },
    ];
    const state = {
      queries, activeIndex: 2, startDate: 1990, endDate: 2026, smoothing: 4, plotType: 'area',
      advancedOptions: { rescale: true, showConfidenceInterval: false, base100: true, base100Year: 2000 },
    };
    const decoded = decodeUrlState(`?${encodeUrlState(state)}`);
    expect(decoded.queries).toEqual(queries);
    expect(decoded).toMatchObject({ activeIndex: 2, startDate: 1990, endDate: 2026, smoothing: 4, plotType: 'area' });
    expect(decoded.advancedOptions).toEqual({ rescale: true, showConfidenceInterval: false, base100: true, base100Year: 2000 });
  });
});
