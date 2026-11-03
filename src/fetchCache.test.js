import { cachedFetch, clearFetchCache, CACHE_TTL_MS } from './fetchCache';

const server = (status = 200) => {
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    return Promise.resolve(new Response(`answer ${calls.length}`, { status, headers: { 'content-type': 'text/csv' } }));
  };
  return { calls, fetchImpl };
};

beforeEach(() => clearFetchCache());

test('a series asked again within the hour is not fetched again', async () => {
  const { calls, fetchImpl } = server();
  let time = 0;
  const now = () => time;
  expect(await (await cachedFetch('a', { now, fetchImpl })).text()).toBe('answer 1');
  time = CACHE_TTL_MS - 1;
  const again = await cachedFetch('a', { now, fetchImpl });
  expect(await again.text()).toBe('answer 1');
  expect(again.headers.get('content-type')).toBe('text/csv');
  expect(calls).toEqual(['a']);
});

test('after an hour it is fetched again', async () => {
  const { calls, fetchImpl } = server();
  let time = 0;
  const now = () => time;
  await cachedFetch('a', { now, fetchImpl });
  time = CACHE_TTL_MS;
  expect(await (await cachedFetch('a', { now, fetchImpl })).text()).toBe('answer 2');
  expect(calls).toHaveLength(2);
});

test('two requests at once share one fetch', async () => {
  const { calls, fetchImpl } = server();
  const [r1, r2] = await Promise.all([cachedFetch('a', { fetchImpl }), cachedFetch('a', { fetchImpl })]);
  expect(await r1.text()).toBe('answer 1');
  expect(await r2.text()).toBe('answer 1');
  expect(calls).toHaveLength(1);
});

test('refusals and network errors are not kept', async () => {
  const refusing = server(400);
  const refused = await cachedFetch('a', { fetchImpl: refusing.fetchImpl });
  expect(refused.ok).toBe(false);
  await cachedFetch('a', { fetchImpl: refusing.fetchImpl });
  expect(refusing.calls).toHaveLength(2);

  const failing = () => Promise.reject(new Error('down'));
  await expect(cachedFetch('b', { fetchImpl: failing })).rejects.toThrow('down');
  const { calls, fetchImpl } = server();
  await cachedFetch('b', { fetchImpl });
  expect(calls).toEqual(['b']);
});
