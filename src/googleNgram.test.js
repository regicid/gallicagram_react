import { googleNgramYears, googleNgramUrl, isGoogleNgram } from './googleNgram';

describe('googleNgramYears', () => {
  test('clips the range to the years the API has data for', () => {
    expect(googleNgramYears(1490, 1502)).toEqual([1500, 1501, 1502]);
    expect(googleNgramYears('2020', '2026')).toEqual([2020, 2021, 2022]);
  });
});

describe('googleNgramUrl', () => {
  test('asks for the language of the corpus', () => {
    expect(googleNgramUrl('google', 'vélo', 1900, 1950)).toContain('&corpus=fr&');
    expect(googleNgramUrl('google_en', 'bike', 1900, 1950)).toContain('&corpus=en&');
    expect(googleNgramUrl('google_es', 'bici', 1900, 1950)).toContain('&corpus=es&');
  });

  test('encodes the word', () => {
    expect(googleNgramUrl('google', ' vélo & co ', 1900, 1950)).toContain('content=v%C3%A9lo%20%26%20co&');
  });
});

describe('isGoogleNgram', () => {
  test('recognises every language, French under its historical code', () => {
    expect(isGoogleNgram('google')).toBe(true);
    expect(isGoogleNgram('google_de')).toBe(true);
    expect(isGoogleNgram('presse')).toBe(false);
  });
});
