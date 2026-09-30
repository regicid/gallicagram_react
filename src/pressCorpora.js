// Context for the modern press corpora (the Agoragram web-article corpora).
//
// Each newspaper's own search engine is used, restricted to the period that was clicked.
// Two families:
//
// - PRESS_PANEL: the search can be run from here and its results listed in the context
//   panel, like Le Monde. Some sources answer the browser directly (they send CORS
//   headers); the others go through api/press.js, which holds their URL templates.
// - PRESS_LINK_OUT: the site's search cannot be restricted to a date, cannot be reached
//   at all (bot protection), or could not be found. A click opens a Google search limited
//   to the site and to the period instead, which is the closest thing to a dated search.
//
// Every panel source falls back to that same Google link when it fails, since the keys
// and page layouts below belong to the newspapers and can change without notice.

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// The period covered by a point of the curve, as YYYY-MM-DD strings, both ends included.
// Points carry the first day of their period at UTC midnight (weeks are dated to their
// Monday), so UTC getters are used throughout.
export const pressPeriod = (dateISO, resolution) => {
  const d = new Date(dateISO);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  let start, end;
  switch (resolution) {
    case 'jour':
      start = end = new Date(Date.UTC(y, m, day));
      break;
    case 'semaine':
      start = new Date(Date.UTC(y, m, day));
      end = new Date(Date.UTC(y, m, day + 6));
      break;
    case 'mois':
      start = new Date(Date.UTC(y, m, 1));
      end = new Date(Date.UTC(y, m + 1, 0));
      break;
    case 'decennie': {
      const decade = Math.floor(y / 10) * 10;
      start = new Date(Date.UTC(decade, 0, 1));
      end = new Date(Date.UTC(decade + 9, 11, 31));
      break;
    }
    default:
      start = new Date(Date.UTC(y, 0, 1));
      end = new Date(Date.UTC(y, 11, 31));
  }
  return { start: isoDay(start), end: isoDay(end) };
};

const shiftDay = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(Date.UTC(y, m - 1, d + days)));
};

// Google's after:/before: operators are exclusive, so the period is widened by a day on
// each side. The word is quoted so that Google does not swap it for a synonym.
export const googleSiteSearchUrl = ({ site, word, start, end }) => {
  const q = `site:${site} "${word}" after:${shiftDay(start, -1)} before:${shiftDay(end, 1)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
};

// --- Parsing helpers -------------------------------------------------------------------

const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const absolute = (href, base) => {
  if (!href) return '';
  try { return new URL(href, base).href; } catch { return ''; }
};
// Titles and excerpts from JSON APIs sometimes come as HTML (entities, <p>, <mark>).
const plain = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return text(doc.body);
};
const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');

const viaProxy = async (source, { word, start, end }) => {
  const params = new URLSearchParams({ source, q: word, start, end });
  const response = await fetch(`/api/press?${params}`);
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  return response.text();
};

// --- Sources answering the browser directly ------------------------------------------

// Queryly powers the search of Libération and Le Parisien. The key is the public one each
// site prints in its own pages.
const queryly = (key, base) => async ({ word, start, end }) => {
  const [sy, sm, sd] = start.split('-');
  const [ey, em, ed] = end.split('-');
  const params = new URLSearchParams({
    queryly_key: key,
    query: word,
    endindex: '0',
    batchsize: '20',
    daterange: `${sm}/${sd}/${sy},${em}/${ed}/${ey}`,
  });
  const response = await fetch(`https://api.queryly.com/json.aspx?${params}`);
  if (!response.ok) throw new Error(`Queryly: HTTP ${response.status}`);
  const data = await response.json();
  return (data.items || []).map(item => ({
    title: plain(item.title),
    href: absolute(item.link, base),
    description: plain(item.description),
    date: item.pubdate || '',
  }));
};

// La Provence and La Tribune share an Algolia application (both CMA Media), each with a
// search-only key restricted to its own index. The credentials go in the query string so
// that the request needs no CORS preflight.
const algolia = ({ index, key, dateField, base }) => async ({ word, start, end }) => {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const from = Date.UTC(sy, sm - 1, sd) / 1000;
  const to = Date.UTC(ey, em - 1, ed + 1) / 1000;
  const params = new URLSearchParams({
    'x-algolia-application-id': '2T4YB30CMP',
    'x-algolia-api-key': key,
    query: word,
    hitsPerPage: '20',
    numericFilters: `${dateField}>=${from},${dateField}<${to}`,
    attributesToRetrieve: 'header,share,category,timestampCreated,timestamp',
    attributesToHighlight: '',
  });
  const response = await fetch(`https://2T4YB30CMP-dsn.algolia.net/1/indexes/${index}?${params}`);
  if (!response.ok) throw new Error(`Algolia: HTTP ${response.status}`);
  const data = await response.json();
  return (data.hits || []).map(hit => {
    const seconds = Number(hit.timestamp?.published || hit.timestampCreated);
    return {
      title: hit.header?.title || '',
      href: absolute(hit.share?.canonical || hit.share?.url, base),
      description: hit.header?.subtitle || '',
      date: seconds ? new Date(seconds * 1000).toLocaleDateString('fr-FR') : '',
      section: hit.category?.main?.label || '',
    };
  });
};

// Valeurs Actuelles runs WordPress with its REST API open, dates included.
const valeursActuelles = async ({ word, start, end }) => {
  const params = new URLSearchParams({
    search: word,
    after: `${start}T00:00:00`,
    before: `${end}T23:59:59`,
    per_page: '20',
    _fields: 'date,link,title,excerpt',
  });
  const response = await fetch(`https://www.valeursactuelles.com/wp-json/wp/v2/posts?${params}`);
  if (!response.ok) throw new Error(`Valeurs Actuelles: HTTP ${response.status}`);
  const posts = await response.json();
  return posts.map(post => ({
    title: plain(post.title?.rendered),
    href: post.link,
    description: plain(post.excerpt?.rendered),
    date: post.date ? new Date(post.date).toLocaleDateString('fr-FR') : '',
  }));
};

// --- Sources going through api/press.js -----------------------------------------------

// Le Figaro and Gala share one search engine, and so one page layout.
const figaroEngine = (source, base) => async (args) => {
  const doc = parseHtml(await viaProxy(source, args));
  return [...doc.querySelectorAll('article.fig-profil')].map(article => {
    const link = article.querySelector('.fig-profil-headline a');
    const time = article.querySelector('time');
    return {
      title: text(link),
      href: absolute(link?.getAttribute('href'), base),
      description: text(article.querySelector('.fig-profil-chapo')),
      date: text(time).replace(/^Publié le /, ''),
      section: text(article.querySelector('.fig-tools-rubrique')),
    };
  }).filter(item => item.title && item.href);
};

const nouvelObs = async (args) => {
  const doc = parseHtml(await viaProxy('le_nouvel_observateur', args));
  return [...doc.querySelectorAll('article a.link--box')].map(link => ({
    title: text(link.querySelector('h2')),
    href: absolute(link.getAttribute('href'), 'https://www.nouvelobs.com'),
    date: text(link.querySelector('time')),
  })).filter(item => item.title && item.href);
};

// Atlantico's result cards carry the section and the title but no date; the search is
// already restricted to the period, so that is enough. Results use the large title style;
// the smaller one belongs to the "most read" sidebar.
const atlantico = async (args) => {
  const doc = parseHtml(await viaProxy('atlantico', args));
  return [...doc.querySelectorAll('a.font-bitter.text-xl[href^="/article/"]')].map(link => {
    const card = link.closest('.border-b');
    return {
      title: text(link),
      href: absolute(link.getAttribute('href'), 'https://atlantico.fr'),
      section: text(card?.querySelector('p.uppercase')),
    };
  }).filter(item => item.title && item.href);
};

// La Dépêche and Midi Libre (same group, same layout). Their date filter lists the
// newest articles up to the end of the period, so for a whole year it shows its end.
// Midi Libre's cards have no date element, but the date is in every article URL.
const dateFromPath = (href) => {
  const m = /\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(href || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const depecheEngine = (source, base) => async (args) => {
  const doc = parseHtml(await viaProxy(source, args));
  return [...doc.querySelectorAll('article.article')].map(article => {
    const link = article.querySelector('.article__title a');
    const chapo = article.querySelector('.article__chapo');
    chapo?.querySelector('.article__topic')?.remove();
    return {
      title: text(link),
      href: absolute(link?.getAttribute('href'), base),
      description: text(chapo),
      date: text(article.querySelector('.article__date')).replace(/^Publié le /, '')
        || dateFromPath(link?.getAttribute('href')),
      section: text(article.querySelector('.article__topic')),
    };
  }).filter(item => item.title && item.href);
};

// Les Échos' API only allows its own origin in CORS, hence the proxy.
const lesEchos = async (args) => {
  const data = JSON.parse(await viaProxy('les_echos', args));
  return (data.items || []).map(item => ({
    title: plain(item.title),
    href: absolute(item.path, 'https://www.lesechos.fr'),
    description: plain(item.shortDescription),
    date: item.publicationDate ? new Date(item.publicationDate).toLocaleDateString('fr-FR') : '',
  }));
};

// --- Registry ---------------------------------------------------------------------------

// `site` is used for the Google fallback. `looseMatching` flags the engines that also
// return near matches ("retraites" finds "retrait"), which the panel says.
export const PRESS_PANEL = {
  libe: { name: 'Libération', site: 'liberation.fr', looseMatching: true,
    search: queryly('794b8320c4a14952', 'https://www.liberation.fr') },
  leparisien: { name: 'Le Parisien', site: 'leparisien.fr', looseMatching: true,
    search: queryly('b41c54fed8224931', 'https://www.leparisien.fr') },
  laprovence: { name: 'La Provence', site: 'laprovence.com', looseMatching: true,
    search: algolia({ index: 'prod_CONTENT', key: '1c3c52e551ceb852a2f7f5f5d8de89ab', dateField: 'timestampCreated', base: 'https://www.laprovence.com/' }) },
  latribune: { name: 'La Tribune', site: 'latribune.fr', looseMatching: true,
    search: algolia({ index: 'lt_prod_CONTENT', key: '100c5111cb518ce8cda6b9dc694273ae', dateField: 'timestamp.published', base: 'https://www.latribune.fr/' }) },
  valeurs_actuelles: { name: 'Valeurs Actuelles', site: 'valeursactuelles.com',
    search: valeursActuelles },
  le_figaro: { name: 'Le Figaro', site: 'lefigaro.fr',
    search: figaroEngine('le_figaro', 'https://www.lefigaro.fr') },
  gala: { name: 'Gala', site: 'gala.fr',
    search: figaroEngine('gala', 'https://www.gala.fr') },
  // Typographic apostrophe: i18next HTML-escapes a straight one when interpolating.
  le_nouvel_observateur: { name: 'L’Obs', site: 'nouvelobs.com',
    search: nouvelObs },
  atlantico: { name: 'Atlantico', site: 'atlantico.fr', looseMatching: true,
    search: atlantico },
  la_depeche: { name: 'La Dépêche', site: 'ladepeche.fr', looseMatching: true, upToEnd: true,
    search: depecheEngine('la_depeche', 'https://www.ladepeche.fr') },
  midilibre: { name: 'Midi Libre', site: 'midilibre.fr', looseMatching: true, upToEnd: true,
    search: depecheEngine('midilibre', 'https://www.midilibre.fr') },
  // Newest first, with no way to sort otherwise: a year shows its last days.
  les_echos: { name: 'Les Échos', site: 'lesechos.fr', upToEnd: true,
    search: lesEchos },
};

// Corpus code -> site, for the corpora whose context is a Google search.
export const PRESS_LINK_OUT = {
  // Searchable, but not by date.
  mediapart: 'mediapart.fr',
  le_capital: 'capital.fr',
  voici: 'voici.fr',
  le_telegramme: 'letelegramme.fr',
  l_opinion: 'lopinion.fr',
  lacroix: 'la-croix.com',
  sud_ouest: 'sudouest.fr',
  marianne: 'marianne.net',
  telerama: 'telerama.fr',
  '20minutes': '20minutes.fr',
  nice_matin: 'nicematin.com',
  // No search of their own: Challenges only has a daily archive, France Soir's search box
  // is Google's, and Paris Match and BFM TV have none.
  challenges: 'challenges.fr',
  paris_match: 'parismatch.com',
  francesoir: 'francesoir.fr',
  bfmtv: 'bfmtv.com',
  // Behind bot protection.
  cnews: 'cnews.fr',
  le_journal_du_dimanche: 'lejdd.fr',
  paris_normandie: 'paris-normandie.fr',
  ouest_france: 'ouest-france.fr',
  le_courrier_de_l_ouest: 'courrierdelouest.fr',
  le_maine_libre: 'lemainelibre.fr',
  presse_ocean: 'presseocean.fr',
  voiles_et_voiliers: 'voilesetvoiliers.com',
  le_marin: 'lemarin.fr',
};

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
export const isPressPanelCorpus = (corpus) => has(PRESS_PANEL, corpus);
export const isPressLinkOutCorpus = (corpus) => has(PRESS_LINK_OUT, corpus);

export const pressSite = (corpus) =>
  isPressPanelCorpus(corpus) ? PRESS_PANEL[corpus].site : PRESS_LINK_OUT[corpus];

// The Google search for a click on `corpus` at `dateISO`, or null for other corpora.
export const pressLinkOutUrl = (corpus, word, dateISO, resolution) => {
  const site = pressSite(corpus);
  if (!site) return null;
  return googleSiteSearchUrl({ site, word, ...pressPeriod(dateISO, resolution) });
};
