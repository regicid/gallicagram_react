import { usesNgramRoute, ngramCorpusParams } from './ngramRoute';

// The context of a curve is searched with the word it was plotted for, but the ngram
// syntax (* and ? inside a word, _ for a whole word) means nothing to most of the engines
// that search for it. Each gets the word in a form it understands.

const API_URL = 'https://shiny.ens-paris-saclay.fr/guni';

const ANY_WORD = /(^|\s)_(?=\s|$)/g;

export const hasWildcard = (word) => /[*?]/.test(word) || /(^|\s)_(\s|$)/.test(word);

// Gallica's search already takes * and ? inside a word, and * on its own for any word.
export const gallicaTerms = (word) => word.replace(ANY_WORD, '$1*');

// source_rap reads a regular expression.
export const rapPattern = (word) => word.trim().split(/\s+/).map(token => (token === '_'
  ? '\\S+'
  : token.split('').map(c => (c === '*' ? '\\w*' : c === '?' ? '\\w'
    : c.replace(/[.^$+{}()|[\]\\]/g, '\\$&'))).join(''))).join(' ');

// The word without its wildcards, for when nothing better is known: "guerre _ allemagne"
// becomes "guerre allemagne", "grèv*" becomes "grèv".
const stripWildcards = (word) => word.replace(ANY_WORD, ' ').replace(/[*?]/g, '').replace(/\s+/g, ' ').trim();

// For the newspapers' and journals' own search engines: the pattern's most frequent form
// in `corpus` that year ("grèv*" -> "grève", "guerre _ allemagne" -> "guerre en
// allemagne"), found with the joker route. Without a _, the joker adds a word after the
// pattern, which is dropped and its counts added up per form.
export const resolveWildcards = async (word, corpus, year) => {
  const pattern = word.trim();
  if (!hasWildcard(pattern)) return pattern;
  if (!usesNgramRoute(corpus)) return stripWildcards(pattern);
  try {
    const url = `${API_URL}/joker_ngram?mot=${encodeURIComponent(pattern.replace(/’/g, "'"))}&${ngramCorpusParams(corpus)}&from=${year}&to=${year}&n_joker=50&stopwords=0`;
    const response = await fetch(url);
    // Refused, e.g. a pattern starting with _ or one too long for the corpus.
    if (!response.ok) return stripWildcards(pattern);
    const size = pattern.split(/\s+/).length;
    const appended = !/(^|\s)_(\s|$)/.test(pattern);
    const counts = new Map();
    (await response.text()).split('\n').slice(1).forEach(line => {
      const comma = line.indexOf(',');
      if (comma < 0) return;
      const gram = line.slice(comma + 1).trim().replace(/^"|"$/g, '');
      const form = appended ? gram.split(/\s+/).slice(0, size).join(' ') : gram;
      if (form) counts.set(form, (counts.get(form) || 0) + (Number(line.slice(0, comma)) || 0));
    });
    let best = null;
    counts.forEach((count, form) => { if (!best || count > best[1]) best = [form, count]; });
    return best ? best[0] : stripWildcards(pattern);
  } catch {
    return stripWildcards(pattern);
  }
};
