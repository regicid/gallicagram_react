import fs from 'fs';
import path from 'path';
import {
  pressPeriod, googleSiteSearchUrl, pressLinkOutUrl,
  PRESS_PANEL, PRESS_LINK_OUT, isPressPanelCorpus, isPressLinkOutCorpus,
} from './pressCorpora';

describe('pressPeriod', () => {
  const point = '2016-02-29T00:00:00.000Z';

  test('covers the clicked period, both ends included', () => {
    expect(pressPeriod(point, 'jour')).toEqual({ start: '2016-02-29', end: '2016-02-29' });
    expect(pressPeriod(point, 'mois')).toEqual({ start: '2016-02-01', end: '2016-02-29' });
    expect(pressPeriod(point, 'annee')).toEqual({ start: '2016-01-01', end: '2016-12-31' });
  });

  test('a week runs from its Monday to its Sunday, across a month boundary', () => {
    expect(pressPeriod(point, 'semaine')).toEqual({ start: '2016-02-29', end: '2016-03-06' });
  });

  test('a decade covers its ten years', () => {
    expect(pressPeriod('2010-01-01T00:00:00.000Z', 'decennie')).toEqual({ start: '2010-01-01', end: '2019-12-31' });
  });

  test('an unknown resolution falls back to the year', () => {
    expect(pressPeriod(point, undefined)).toEqual({ start: '2016-01-01', end: '2016-12-31' });
  });
});

describe('googleSiteSearchUrl', () => {
  test('widens the period by a day, since after: and before: are exclusive', () => {
    const url = googleSiteSearchUrl({ site: 'mediapart.fr', word: 'retraites', start: '2016-06-01', end: '2016-06-30' });
    expect(new URL(url).searchParams.get('q'))
      .toBe('site:mediapart.fr "retraites" after:2016-05-31 before:2016-07-01');
  });
});

describe('pressLinkOutUrl', () => {
  test('builds the Google search for a click on a link-out corpus', () => {
    const url = pressLinkOutUrl('le_capital', 'inflation', '2022-03-01T00:00:00.000Z', 'mois');
    expect(new URL(url).searchParams.get('q'))
      .toBe('site:capital.fr "inflation" after:2022-02-28 before:2022-04-01');
  });

  // Its bot protection stops the proxy, not a reader: the click opens the dated search.
  test("opens Le Figaro's own search, limited to the period", () => {
    expect(pressLinkOutUrl('le_figaro', 'la guerre', '2017-07-05T00:00:00.000Z', 'jour'))
      .toBe('https://recherche.lefigaro.fr/recherche/la%20guerre/?datemin=05-07-2017&datemax=05-07-2017');
    expect(pressLinkOutUrl('le_figaro', 'coucou', '2020-01-01T00:00:00.000Z', 'annee'))
      .toBe('https://recherche.lefigaro.fr/recherche/coucou/?datemin=01-01-2020&datemax=31-12-2020');
  });

  test('returns null outside the press corpora', () => {
    expect(pressLinkOutUrl('lemonde_rubriques', 'x', '2022-03-01T00:00:00.000Z', 'mois')).toBeNull();
  });
});

describe('registry', () => {
  // Every modern press corpus in corpus.tsv needs a context: its own search, a Google
  // link-out, or the Le Monde search. A corpus added to the TSV without one would
  // silently fall back to "no context", so it fails here instead.
  const LE_MONDE = ['lemonde_rubriques', 'le_monde'];
  // The sum of all the outlets has no single search to send a click to.
  const NO_CONTEXT = ['presse_moderne'];

  test('covers every modern press corpus exactly once', () => {
    const tsv = fs.readFileSync(path.join(__dirname, '..', 'public', 'corpus.tsv'), 'utf8');
    const codes = tsv.trim().split('\n').slice(1)
      .map(line => line.split('\t'))
      .filter(cols => (cols[10] || '').trim() === 'Modern press')
      .map(cols => cols[3].trim())
      .filter(code => !NO_CONTEXT.includes(code));

    expect(codes.length).toBeGreaterThan(0);
    codes.forEach(code => {
      const handlers = [isPressPanelCorpus(code), isPressLinkOutCorpus(code), LE_MONDE.includes(code)];
      expect({ code, handled: handlers.filter(Boolean).length }).toEqual({ code, handled: 1 });
    });
  });

  test('has no entry for a corpus that does not exist', () => {
    const tsv = fs.readFileSync(path.join(__dirname, '..', 'public', 'corpus.tsv'), 'utf8');
    const known = new Set(tsv.trim().split('\n').slice(1).map(line => line.split('\t')[3].trim()));
    [...Object.keys(PRESS_PANEL), ...Object.keys(PRESS_LINK_OUT)].forEach(code => {
      expect({ code, known: known.has(code) }).toEqual({ code, known: true });
    });
  });
});
