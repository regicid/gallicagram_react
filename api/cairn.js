// Cairn search proxy.
//
// A plain Vercel rewrite cannot be used here: it forwards X-Forwarded-Host, and Cairn's
// backend trusts that header to work out which site is being served. It then decides the
// request is for an unknown host and answers 404 with "Le contenu auquel vous voulez
// accéder n'est pas disponible à l'adresse ...<our vercel domain>". Issuing the request
// from a function instead means we control the headers and send none of that.
//
// The target host and path are fixed and only the query string is passed through, so this
// cannot be used as an open proxy.
const CAIRN_SEARCH = 'https://shs.cairn.info/recherche';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }

  const query = (req.url || '').split('?')[1] || '';
  const target = query ? `${CAIRN_SEARCH}?${query}` : CAIRN_SEARCH;

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      redirect: 'follow',
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/html; charset=utf-8');
    // The same search returns the same page for everyone; let the edge absorb repeats
    // rather than sending every click at Cairn.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.send(body);
  } catch (err) {
    res.status(502).send(`Cairn request failed: ${err.message}`);
  }
};
