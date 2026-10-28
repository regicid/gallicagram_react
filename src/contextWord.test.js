import { hasWildcard, gallicaTerms, rapPattern, resolveWildcards } from './contextWord';

const answer = (status, body) => jest.fn().mockResolvedValue({ ok: status === 200, text: () => Promise.resolve(body) });

describe('context word', () => {
  afterEach(() => { delete global.fetch; });

  test('spots the ngram wildcards, not a _ inside a word', () => {
    expect(hasWildcard('grèv*')).toBe(true);
    expect(hasWildcard('grèv?s')).toBe(true);
    expect(hasWildcard('guerre _ allemagne')).toBe(true);
    expect(hasWildcard('_ retraites')).toBe(true);
    expect(hasWildcard('mot_clé')).toBe(false);
    expect(hasWildcard('grève générale')).toBe(false);
  });

  test('gives Gallica * for a whole word', () => {
    expect(gallicaTerms('guerre _ allemagne')).toBe('guerre * allemagne');
    expect(gallicaTerms('grèv*')).toBe('grèv*');
  });

  test('gives the rap search a regular expression', () => {
    expect(rapPattern('amo*')).toBe('amo\\w*');
    expect(rapPattern('gr?ve')).toBe('gr\\wve');
    expect(rapPattern('mon _ amour')).toBe('mon \\S+ amour');
    expect(rapPattern('3.14 (pi)')).toBe('3\\.14 \\(pi\\)');
  });

  test('resolves a pattern to its most frequent form, dropping the word the joker adds', async () => {
    global.fetch = answer(200, 'tot,gram\n393,grève de\n198,grèves des\n319,grève générale\n250,grèves et\n');
    await expect(resolveWildcards('grèv*', 'le_monde', 2010)).resolves.toBe('grève');
    expect(global.fetch.mock.calls[0][0]).toContain('corpus=le_monde&elias=true&from=2010&to=2010');
  });

  test('keeps the joker forms whole when the pattern has a _', async () => {
    global.fetch = answer(200, 'tot,gram\n4,guerre en allemagne\n2,guerre contre allemagne\n');
    await expect(resolveWildcards('guerre _ allemagne', 'lemonde_rubriques', 2010)).resolves.toBe('guerre en allemagne');
  });

  test('falls back to the word without its wildcards', async () => {
    global.fetch = answer(400, "le premier mot ne peut pas être '_'");
    await expect(resolveWildcards('_ retraites', 'le_figaro', 2010)).resolves.toBe('retraites');
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(resolveWildcards('grèv*', 'le_monde', 2010)).resolves.toBe('grèv');
  });

  test('leaves a plain word alone, without a request', async () => {
    global.fetch = jest.fn();
    await expect(resolveWildcards('grève', 'le_monde', 2010)).resolves.toBe('grève');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
