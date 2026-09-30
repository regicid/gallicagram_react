// Google Books Ngram Viewer, one corpus per language, queried through the /ngrams proxy
// (setupProxy.js, vercel.json). 'google' is the French one: it came first, and keeping its
// code keeps the plots already shared working. Google answers an unknown language code
// with the English data instead of an error, so each code here was checked against the API.
export const GOOGLE_NGRAM_CORPORA = {
  google: { lang: 'fr', name: 'Ngram Viewer (français)' },
  google_en: { lang: 'en', name: 'Ngram Viewer (anglais)' },
  google_de: { lang: 'de', name: 'Ngram Viewer (allemand)' },
  google_es: { lang: 'es', name: 'Ngram Viewer (espagnol)' },
};

// The recommended period, as corpus.tsv gives one for the other corpora: Google's own
// default. The data itself spans DATA_START-DATA_END.
export const GOOGLE_NGRAM_PERIOD = { start: 1800, end: 2022 };
const DATA_START = 1500;
const DATA_END = 2022;

export const isGoogleNgram = (corpus) =>
  Object.prototype.hasOwnProperty.call(GOOGLE_NGRAM_CORPORA, corpus);

// The API clips the years to its data and returns only those, with nothing for the years
// left out, so the series starts at the clipped year, not at the one asked for.
export const googleNgramYears = (start, end) => {
  const years = [];
  for (let year = Math.max(parseInt(start, 10), DATA_START); year <= Math.min(parseInt(end, 10), DATA_END); year++) {
    years.push(year);
  }
  return years;
};

export const googleNgramUrl = (corpus, word, start, end) =>
  `/ngrams/json?content=${encodeURIComponent(word.trim())}&year_start=${start}&year_end=${end}&corpus=${GOOGLE_NGRAM_CORPORA[corpus].lang}&smoothing=0`;
