// Client-side replacement for the server's `/api/occurrences_no_context` endpoint.
//
// Gallica blocks the gallica-getter server IP, so we hit Gallica's SRU API
// directly from the browser. SRU doesn't send CORS headers, so we route
// through the existing same-origin `/api/sru` proxy (vercel.json + setupProxy.js),
// exactly like App.js already does for record-count queries.
//
// Mirrors:
//   - app/queries.py        -> VolumeQuery (CQL build + SRU params)
//   - app/utils/base_query_builds.py -> make_wide_groupings_for_all_search / get_one_month_interval
//   - app/volumeOccurrence.py -> VolumeOccurrence.parse / VolumeRecord
//   - app/utils/parse_xml.py -> get_records_from_xml + field extractors

const SRU_PROXY_URL = '/api/sru';

const SRW_NS = 'http://www.loc.gov/zing/srw/';
const DC_NS = 'http://purl.org/dc/elements/1.1/';

/**
 * Fetch occurrence records (no page-level context) directly from Gallica's SRU API.
 *
 * @param {Object} args
 * @param {string|string[]} args.terms - search term(s)
 * @param {number} args.year
 * @param {number} [args.month] - 1-indexed (resolution mois/jour)
 * @param {number} [args.day]  - ignored, matches server behavior (date_params has no day)
 * @param {number} [args.cursor=0]   - startRecord
 * @param {number} [args.limit=10]   - maximumRecords
 * @param {string} [args.sort='relevance']
 * @param {string} [args.source]     - 'book' | 'periodical' | 'all'
 * @param {string|string[]} [args.codes] - paper code(s) e.g. 'cb327986698'
 * @returns {Promise<{records: Array, total_records: number, origin_urls: string[]}>}
 */
export async function fetchOccurrencesNoContext({
  terms,
  year,
  month,
  day,
  cursor = 0,
  limit = 10,
  sort = 'relevance',
  source,
  codes,
}) {
  const termList = Array.isArray(terms) ? terms : [terms];

  const cql = buildCql({
    terms: termList,
    year,
    month,
    sort,
    source,
    codes,
  });

  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    exactSearch: 'True',
    version: '1.2',
    startRecord: String(cursor),
    maximumRecords: String(limit),
    collapsing: 'false',
    query: cql,
  });

  const response = await fetch(`${SRU_PROXY_URL}?${params.toString()}`);
  const xmlText = await response.text();
  if (!response.ok) {
    throw new Error(`Gallica SRU returned ${response.status}`);
  }
  // Gallica is behind Cloudflare; if the proxy got challenged we receive an
  // HTML interstitial ("Just a moment..." / "Attention Required") instead of
  // XML. Detect that and surface a clear error rather than empty results.
  if (xmlText.includes('Just a moment') || xmlText.includes('cf-challenge')
      || xmlText.includes('Attention Required') || xmlText.includes('cloudflare')) {
    throw new Error('Gallica is blocking the request (Cloudflare challenge). ' +
      'The proxy IP appears to be flagged by Gallica.');
  }
  return parseSruResponse(xmlText, termList);
}

// --- CQL building (mirrors VolumeQuery.build_cql_string) ---

function buildCql({ terms, year, month, sort, source, codes }) {
  const components = [];

  const termCql = buildTermCql(terms);
  if (termCql) components.push(termCql);

  const dateCql = buildDateCql(year, month);
  if (dateCql) components.push(dateCql);

  const sourceCql = buildSourceCql(source, codes);
  if (sourceCql) components.push(sourceCql);

  let cql = components.join(' and ');
  if (sort === 'date') {
    cql += ' sortby dc.date/sort.ascending';
  }
  return cql;
}

function buildTermCql(terms) {
  if (!terms || terms.length === 0) return '';
  return '(text adj "' + terms.join('" or text adj "') + '")';
}

// Mirrors make_wide_groupings_for_all_search + VolumeQuery.build_date_cql.
// month is 1-indexed (as passed by the app) or undefined.
function buildDateCql(year, month) {
  if (!year) return '';
  let start;
  let end;
  if (month) {
    [start, end] = oneMonthInterval(month, year);
  } else {
    start = `${year}-01-01`;
    end = `${parseInt(year, 10) + 1}-01-01`;
  }
  if (start && end && start !== end) {
    return `gallicapublication_date>="${start}" and gallicapublication_date<"${end}"`;
  }
  return `gallicapublication_date="${start}"`;
}

// Mirrors get_one_month_interval(month, year). month is 1-indexed int.
function oneMonthInterval(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (m === 1) return [`${y}-01-02`, `${y}-02-01`];
  if (m === 12) return [`${y}-12-01`, `${y + 1}-01-01`];
  return [`${y}-${String(m).padStart(2, '0')}-01`, `${y}-${String(m + 1).padStart(2, '0')}-01`];
}

// Mirrors VolumeQuery.build_source_sql.
function buildSourceCql(source, codes) {
  const codeList = toArray(codes).filter(Boolean);
  if (codeList.length > 0) {
    const formatted = codeList.map((c) => `${c}_date`);
    return 'arkPress adj "' + formatted.join('" or arkPress adj "') + '"';
  }
  if (source === 'periodical') return 'dc.type all "fascicule"';
  if (source === 'book') return 'dc.type all "monographie"';
  return 'dc.type all "fascicule" or dc.type all "monographie"';
}

function toArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(',').map((s) => s.trim());
}

// --- SRU XML parsing (mirrors VolumeOccurrence.parse + parse_xml extractors) ---

function parseSruResponse(xmlText, terms) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.documentElement) {
    throw new Error('Gallica SRU response was not valid XML ' +
      '(possibly a Cloudflare block page).');
  }

  const totalRecords = parseTotalRecords(doc);
  // If there's no numberOfRecords element at all, this isn't a real SRU response.
  if (totalRecords === 0 && doc.getElementsByTagNameNS(SRW_NS, 'numberOfRecords').length === 0) {
    throw new Error('Gallica SRU response had no numberOfRecords ' +
      '(possibly a Cloudflare block page).');
  }

  const recordEls = doc.getElementsByTagNameNS(SRW_NS, 'record');
  const records = [];
  for (let i = 0; i < recordEls.length; i++) {
    records.push(parseRecord(recordEls[i], terms));
  }

  return {
    records,
    total_records: totalRecords,
    origin_urls: [],
  };
}

function parseTotalRecords(doc) {
  const el = doc.getElementsByTagNameNS(SRW_NS, 'numberOfRecords')[0];
  if (el && el.textContent) {
    const n = parseInt(el.textContent, 10);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function parseRecord(recordEl, terms) {
  const dc = getDcContainer(recordEl);
  const extra = recordEl.getElementsByTagNameNS(SRW_NS, 'extraRecordData')[0];

  return {
    paper_title: getDcText(dc, 'title'),
    paper_code: parsePaperCode(getDcText(dc, 'relation')),
    date: getDcText(dc, 'date'),
    ark: getExtraText(extra, 'uri'),
    url: getDcText(dc, 'identifier'),
    author: getDcText(dc, 'creator'),
    publisher: getDcText(dc, 'publisher') || null,
    ocr_quality: parseFloat(getExtraText(extra, 'nqamoyen')) || 0.0,
    terms,
  };
}

// recordData > oai_dc:dc (first child of recordData)
function getDcContainer(recordEl) {
  const recordData = recordEl.getElementsByTagNameNS(SRW_NS, 'recordData')[0];
  if (!recordData) return null;
  return recordData.firstElementChild;
}

function getDcText(dcContainer, localName) {
  if (!dcContainer) return '';
  const el = dcContainer.getElementsByTagNameNS(DC_NS, localName)[0];
  return el ? (el.textContent || '') : '';
}

function getExtraText(extraEl, localName) {
  if (!extraEl) return '';
  // Gallica's extra fields (uri, nqamoyen, ...) live in no namespace.
  const el = extraEl.getElementsByTagName(localName)[0];
  return el ? (el.textContent || '') : '';
}

// Mirrors get_paper_code_from_record_xml: last 11 chars of dc:relation text.
function parsePaperCode(relationText) {
  if (!relationText) return '';
  return relationText.slice(-11);
}
