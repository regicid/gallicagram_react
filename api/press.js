// Search proxy for the modern press corpora whose search cannot be called from the browser.
//
// Three reasons land a site here rather than in a direct fetch from the page: it serves its
// results as HTML with no CORS header (Gala, L'Obs, Atlantico, La Dépêche, Midi Libre),
// its API only allows its own origin (Les Échos), or its CORS headers are malformed
// (Valeurs Actuelles sends two Access-Control-Allow-Origin values). A Vercel rewrite is
// not an option either: it forwards X-Forwarded-Host, which some backends trust to decide
// which site is being served (that is what broke Cairn), and it cannot set the
// browser-like headers that Les Échos' bot protection insists on.
//
// Every source is a fixed URL template filled with a validated word and date range, so
// this cannot be used as an open proxy. The response is passed through untouched; the
// parsing happens in the page, next to the rendering.
const UA_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
// Les Échos sits behind Akamai, which rejects a short or missing User-Agent. These are the
// headers a lesechos.fr page sends to its own API.
const LESECHOS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0',
  'Accept': '*/*',
  'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.lesechos.fr/',
  'content-type': 'application/json',
  'Origin': 'https://www.lesechos.fr',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
};

// `start` and `end` arrive as YYYY-MM-DD; the sites each want their own spelling.
const parts = (iso) => { const [y, m, d] = iso.split('-'); return { y, m, d }; };
const ddmmyyyy = (iso, sep) => { const { y, m, d } = parts(iso); return `${d}${sep}${m}${sep}${y}`; };
const enc = encodeURIComponent;

// La Dépêche and Midi Libre filter on a year, optionally narrowed to a month and a day, and
// list the newest articles up to that point. The narrowest filter that still covers the
// whole period is used, so a click on a day or a month lands on it exactly.
const ladepecheDate = (start, end) => {
  const s = parts(start), e = parts(end);
  if (s.y !== e.y || s.m !== e.m) return `&year=${e.y}`;
  if (s.d !== e.d) return `&year=${e.y}&month=${Number(e.m)}`;
  return `&year=${e.y}&month=${Number(e.m)}&day=${Number(e.d)}`;
};

const SOURCES = {
  gala: ({ q, start, end }) => ({
    url: `https://recherche.gala.fr/recherche/${enc(q)}/?publication=gala.fr&datemin=${ddmmyyyy(start, '-')}&datemax=${ddmmyyyy(end, '-')}`,
  }),
  le_nouvel_observateur: ({ q, start, end }) => ({
    // d=3 is "between d1 and d2".
    url: `https://www.nouvelobs.com/recherche?q=${enc(q)}&d=3&d1=${start}&d2=${end}`,
  }),
  atlantico: ({ q, start, end }) => ({
    url: `https://atlantico.fr/search?searchTerm=${enc(q)}&afterDate=${start}&beforeDate=${end}`,
  }),
  la_depeche: ({ q, start, end }) => ({
    url: `https://www.ladepeche.fr/recherche?q=${enc(q)}${ladepecheDate(start, end)}`,
  }),
  midilibre: ({ q, start, end }) => ({
    url: `https://www.midilibre.fr/recherche?q=${enc(q)}${ladepecheDate(start, end)}`,
  }),
  les_echos: ({ q, start, end }) => ({
    url: `https://api.lesechos.fr/api/v2/search?limit=20&page=1&query=${enc(q)}&startDate=${start}&endDate=${end}`,
    headers: LESECHOS_HEADERS,
  }),
  valeurs_actuelles: ({ q, start, end }) => ({
    url: `https://www.valeursactuelles.com/wp-json/wp/v2/posts?search=${enc(q)}&after=${start}T00:00:00&before=${end}T23:59:59&per_page=20&_fields=date,link,title,excerpt`,
    headers: { 'User-Agent': UA_CHROME, 'Accept': 'application/json' },
  }),
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }

  const params = new URL(req.url, 'http://localhost').searchParams;
  const source = params.get('source');
  const q = (params.get('q') || '').trim();
  const start = params.get('start') || '';
  const end = params.get('end') || '';

  if (!Object.prototype.hasOwnProperty.call(SOURCES, source)) {
    res.status(400).send('Unknown source');
    return;
  }
  if (!q || q.length > 200 || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    res.status(400).send('Expected q, start=YYYY-MM-DD and end=YYYY-MM-DD');
    return;
  }

  const { url, headers } = SOURCES[source]({ q, start, end });

  try {
    const upstream = await fetch(url, {
      headers: headers || {
        'User-Agent': UA_CHROME,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      redirect: 'follow',
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/html; charset=utf-8');
    // A search over a past period returns the same page for everyone; let the edge absorb
    // repeats rather than sending every click at the newspaper.
    if (upstream.ok) res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.send(body);
  } catch (err) {
    res.status(502).send(`${source} request failed: ${err.message}`);
  }
};
