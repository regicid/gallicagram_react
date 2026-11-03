// A drop-in for fetch() on the series routes that remembers answers for an hour. A
// factorial analysis over many words, corpora and wildcards re-asks the same series at
// every change of word list, period or plot; the databases change at most a few times a
// day, so an answer an hour old is as good as a new one.
// The cache holds the response's text, never a parsed object: callers parse it themselves
// and are free to mutate what they get. It lives in memory, for the page's lifetime.
// Requests in flight are shared too, so the same series asked twice at once (two tabs on
// the same word) is fetched once.

export const CACHE_TTL_MS = 60 * 60 * 1000;
// Beyond this many answers, the least recently used are dropped: a daily series over a
// long period weighs a few hundred kB.
export const CACHE_MAX_ENTRIES = 1000;

const cache = new Map();

export const clearFetchCache = () => cache.clear();

export const cachedFetch = (url, { now = Date.now, fetchImpl = fetch } = {}) => {
  const hit = cache.get(url);
  if (hit && now() - hit.time < CACHE_TTL_MS) {
    // Re-inserted, so that the Map's order is the order of last use.
    cache.delete(url);
    cache.set(url, hit);
    return hit.answer.then(toResponse);
  }
  const answer = fetchImpl(url).then(async response => ({
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type'),
    text: await response.text(),
  }));
  const entry = { time: now(), answer };
  cache.set(url, entry);
  // Errors and refusals are not kept: the next try asks the server again.
  answer.then(
    ({ ok }) => { if (!ok && cache.get(url) === entry) cache.delete(url); },
    () => { if (cache.get(url) === entry) cache.delete(url); });
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return answer.then(toResponse);
};

// A fresh Response for each caller, as a body can only be read once.
const toResponse = ({ status, contentType, text }) =>
  new Response(text, { status, headers: contentType ? { 'content-type': contentType } : {} });
