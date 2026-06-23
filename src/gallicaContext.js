// Client-side replacement for the server's `/api/context` endpoint.
//
// Gallica blocks the gallica-getter server IP, and Gallica's ContentSearch
// service does not send CORS headers, so the browser can't hit it directly
// either. We therefore route through a same-origin proxy (/api/content-search)
// configured in vercel.json (prod) and setupProxy.js (dev), exactly like the
// existing /api/sru proxy. The proxy fetches Gallica server-side and relays
// the XML, which we then parse client-side.
//
// Mirrors:
//   - app/queries.py        -> ContentQuery (endpoint + params)
//   - app/context.py        -> Context.get / HTMLContext / GallicaPage
//   - app/utils/parse_xml.py -> get_num_results_and_pages_for_context
//   - app/main.py           -> parse_spans_to_rows / build_row_record_from_ContentSearch_response

const GALLICA_CONTENT_SEARCH_URL = '/api/content-search';

/**
 * Fetch context rows directly from Gallica's ContentSearch API.
 *
 * @param {Object} args
 * @param {string} args.ark   - Gallica ark id (e.g. "cb32895690j")
 * @param {string[]} args.terms - search terms (multi-word terms should already be quoted)
 * @param {string} args.url   - origin url of the document, used to build page links
 * @returns {Promise<Array<{pivot:string,left_context:string,right_context:string,page_url:string,page_num:number|null}>>}
 */
export async function fetchContext({ ark, terms, url }) {
  const params = new URLSearchParams();
  params.append('ark', ark);
  terms.forEach((term) => params.append('query', term));

  const response = await fetch(`${GALLICA_CONTENT_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: 'application/xml, text/xml, */*' },
  });
  if (!response.ok) {
    throw new Error(`Gallica ContentSearch returned ${response.status}`);
  }
  const xmlText = await response.text();

  const pages = parseContentSearchXml(xmlText);
  if (pages.length === 0) {
    throw new Error('No results found');
  }

  const rows = [];
  for (const page of pages) {
    rows.push(...buildRowsForPage(page, terms, url));
  }
  return rows;
}

/**
 * Parse the ContentSearch XML response into a list of pages
 * ({ page_label, context, page_num }).
 */
function parseContentSearchXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

  // Detect parse errors (e.g. Cloudflare block page returned as HTML).
  if (doc.querySelector('parsererror') || !doc.documentElement) {
    throw new Error('Failed to parse Gallica ContentSearch response');
  }
  const root = doc.documentElement;
  // The root carries a `countResults` attribute when the response is valid.
  if (!root.getAttribute('countResults')) {
    throw new Error('Gallica ContentSearch response was blocked or malformed');
  }

  // Root's second child holds the <item> elements (see get_num_results_and_pages_for_context).
  const itemsContainer = root.children[1] || root;
  const items = Array.from(itemsContainer.getElementsByTagName('item'));

  return items.map((item) => {
    const pIdEl = item.getElementsByTagName('p_id')[0];
    const contentEl = item.getElementsByTagName('content')[0];
    const pageLabel = pIdEl ? pIdEl.textContent : '';
    const context = contentEl ? contentEl.textContent : '';
    return {
      pageLabel,
      context,
      pageNum: parsePageNum(pageLabel),
    };
  });
}

function parsePageNum(pageLabel) {
  const last = pageLabel.split('_').pop();
  return /^\d+$/.test(last) ? parseInt(last, 10) : null;
}

/**
 * Split a page's HTML context blob into one row per highlighted occurrence.
 * Mirrors parse_spans_to_rows / build_row_record_from_ContentSearch_response.
 */
function buildRowsForPage(page, terms, url) {
  const htmlDoc = new DOMParser().parseFromString(page.context, 'text/html');
  const spans = Array.from(htmlDoc.querySelectorAll('span.highlight'));

  const rows = [];
  let i = 0;
  while (i < spans.length) {
    const span = spans[i];
    let pivot = span.textContent;

    // left context: previous sibling text, split on Gallica's "(...)" ellipsis, take last chunk
    let leftContext = '';
    const prev = span.previousSibling;
    if (prev) {
      const parts = stringifyAndSplit(prev);
      leftContext = parts[parts.length - 1];
    }

    // right context: next sibling text, split on "(...)", take first chunk
    let rightContext = '';
    const next = span.nextSibling;
    if (next) {
      const parts = stringifyAndSplit(next);
      rightContext = parts[0];

      // Gallica sometimes splits a multi-word pivot with an erroneous "(...)"
      // in the middle; rejoin with the following span when it reconstructs a term.
      if (
        terms.some((t) => t.trim().split(' ').length > 1) &&
        i < spans.length - 1 &&
        rightContext === ''
      ) {
        const nextPivot = spans[i + 1].textContent;
        const rejoined = `"${pivot} ${nextPivot}"`;
        if (terms.some((t) => rejoined.toLowerCase() === t.toLowerCase())) {
          pivot = `${pivot} ${nextPivot}`;
          const newNext = spans[i + 1].nextSibling;
          if (newNext) {
            const parts2 = stringifyAndSplit(newNext);
            rightContext = parts2[0];
          }
          i += 1; // skip the span we just absorbed
        }
      }
    }

    rows.push({
      pivot,
      left_context: leftContext,
      right_context: rightContext,
      page_url: page.pageNum != null ? `${url}/f${page.pageNum}.image.r=${pivot}` : null,
      page_num: page.pageNum,
    });
    i += 1;
  }
  return rows;
}

function stringifyAndSplit(node) {
  const text = (node.textContent || '').trim();
  return text.split('(...)');
}
