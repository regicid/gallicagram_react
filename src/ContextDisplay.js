import React, { useEffect, useRef, useState } from 'react';
import Occurrence from './Occurrence';
import { useTranslation } from 'react-i18next';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Papa from 'papaparse';
import Button from '@mui/material/Button';
import { CAIRN_CORPUS, PERSEE_CORPUS, isTvCorpus, cairnSearchUrl, corpusCredit } from './revueCorpora';
import { PRESS_PANEL, PRESS_LINK_OUT, isPressPanelCorpus, isPressLinkOutCorpus, hasOwnSearch, pressPeriod, googleSiteSearchUrl, pressLinkOutUrl } from './pressCorpora';
import { resolveWildcards, rapPattern } from './contextWord';

// Cached across renders: both files are static and only needed for Cairn context.
let cairnMetaPromise = null;
const loadCairnMeta = () => {
  if (!cairnMetaPromise) {
    cairnMetaPromise = Promise.all([
      fetch('/revues_cairn.json').then(r => r.json()),
      fetch('/cairn_disciplines.json').then(r => r.json()),
    ]).then(([revueMap, disciplineIds]) => ({ revueMap, disciplineIds }))
      .catch(() => ({ revueMap: null, disciplineIds: null }));
  }
  return cairnMetaPromise;
};

// One article from a newspaper's search engine: Le Monde, and the modern press corpora.
const ArticleCard = ({ item, buttonLabel }) => (
  <div className="occurrence-card" style={{
    border: '1px solid #ccc',
    borderRadius: '5px',
    padding: '15px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  }}>
    <h4 style={{ marginTop: 0, marginBottom: '10px' }}>
      <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#2c3e50' }}>
        {item.title}
      </a>
    </h4>
    {(item.date || item.section) && (
      <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px', fontStyle: 'italic' }}>
        {[item.date, item.section].filter(Boolean).join(' · ')}
      </p>
    )}
    {item.description && (
      <p style={{ marginBottom: '15px' }}>
        {item.description}
      </p>
    )}
    <Button
      variant="contained"
      color="success"
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {buttonLabel}
    </Button>
  </div>
);

const SpecialContextDisplay = ({ record, corpus, category }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [externalUrl, setExternalUrl] = useState(null);

  useEffect(() => {
    const getDates = () => {
      let year, month, day;
      const dateObj = new Date(record.date);

      // Points are dated at UTC midnight: local getters would give the day before west of UTC.
      if (!isNaN(dateObj.getTime())) {
        year = dateObj.getUTCFullYear();
        month = dateObj.getUTCMonth() + 1;
        day = dateObj.getUTCDate();
      } else {
        year = parseInt(record.date);
        month = 1;
        day = 1;
      }

      const resolution = record.resolution || 'annee';

      let start_day, start_month, start_year, end_day, end_month, end_year;

      if (resolution === 'jour') {
        start_day = day; start_month = month; start_year = year;
        end_day = day; end_month = month; end_year = year;
      } else if (resolution === 'mois') {
        start_day = 1; start_month = month; start_year = year;
        const lastDay = new Date(year, month, 0).getDate();
        end_day = lastDay; end_month = month; end_year = year;
      } else {
        start_day = 1; start_month = 1; start_year = year;
        end_day = 31; end_month = 12; end_year = year;
      }
      return { start_day, start_month, start_year, end_day, end_month, end_year, year };
    };

    const fetchContext = async () => {
      setIsLoading(true);
      setError(null);
      setExternalUrl(null);

      try {
        const rawWord = record.terms[0];
        const word = rawWord.split('+')[0].trim();
        const { year } = getDates();
        // The newspapers' and journals' own search engines know nothing of * ? and _.
        const searchWord = () => resolveWildcards(word, corpus, year);

        // le_monde is the Agoragram corpus of the same paper; its context is the same search.
        if (corpus === 'lemonde_rubriques' || corpus === 'le_monde') {
          // The search takes DD/MM/YYYY, both ends included: the clicked point's own period.
          const { start, end } = pressPeriod(record.date, record.resolution);
          const frDate = (iso) => iso.split('-').reverse().join('/');
          const queryParams = `?search_keywords=${encodeURIComponent(await searchWord())}&page_recherche=1&start_at=${frDate(start)}&end_at=${frDate(end)}`;
          const externalSearchUrl = `https://www.lemonde.fr/recherche/${queryParams}`;
          const fetchUrl = `/api/lemonde${queryParams}`;

          setExternalUrl({ url: externalSearchUrl, label: t('All documents') });

          const response = await fetch(fetchUrl);
          if (!response.ok) throw new Error('Failed to fetch Le Monde content');
          const text = await response.text();

          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const section = doc.querySelector('section.js-river-search');
          if (!section) throw new Error('No results section found');

          const results = [];
          const teasers = section.querySelectorAll('section.teaser');
          teasers.forEach(teaser => {
            const link = teaser.querySelector('a.teaser__link');
            const href = link ? link.href : '';
            const titleEl = teaser.querySelector('.teaser__title');
            const title = titleEl ? titleEl.innerText.trim() : '';

            const descEl = teaser.querySelector('.teaser__desc');
            const description = descEl ? descEl.innerText.trim() : '';

            const dateEl = teaser.querySelector('.meta__date');
            const date = dateEl ? dateEl.innerText.trim() : '';

            if (title && href) {
              results.push({ title, href, description, date });
            }
          });
          setData({ type: 'lemonde', content: results });

        } else if (corpus === PERSEE_CORPUS) {
          const queryParams = `?l=fre&da=${year}&q=%22${encodeURIComponent(await searchWord())}%22`;
          const externalSearchUrl = `https://www.persee.fr/search${queryParams}`;
          const fetchUrl = `/api/persee${queryParams}`;

          setExternalUrl({ url: externalSearchUrl, label: t('All documents') });

          const response = await fetch(fetchUrl);
          if (!response.ok) throw new Error('Failed to fetch Persée content');
          const text = await response.text();

          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const content = doc.getElementById('content-search-results');
          if (!content) throw new Error('No results content found');

          const results = [];
          const docResults = content.querySelectorAll('div.doc-result');
          docResults.forEach(div => {
            const titleLink = div.querySelector('a.title.title-free');
            if (!titleLink) return;
            const href = titleLink.href;
            const title = titleLink.innerText.trim();
            const author = div.querySelector('.name')?.innerText.trim() || '';
            const collection = div.querySelector('.collection')?.innerText.trim() || '';
            const searchContext = div.querySelector('.searchContext')?.innerHTML || '';

            results.push({ title, href, author, collection, searchContext });
          });
          setData({ type: 'persee', content: results });

        } else if (corpus === CAIRN_CORPUS) {
          // Cairn sits behind bot protection, which started serving CAPTCHA challenges to
          // the proxy, so the results are not fetched here. The search is handed over as a
          // link instead: opened in the browser it also applies the year, which the
          // server-rendered page ignores.
          const { revueMap, disciplineIds } = await loadCairnMeta();
          // The click handler already opened this in a new tab; the panel repeats the link
          // for the case where a pop-up blocker stopped it. No externalUrl here: the header
          // it belongs to is hidden for this type, and it would only duplicate the button.
          const url = cairnSearchUrl({ word: await searchWord(), year, revues: record.revues, revueMap, disciplineIds });
          setData({ type: 'cairn_link', content: url });

        } else if (isPressPanelCorpus(corpus)) {
          const source = PRESS_PANEL[corpus];
          const period = pressPeriod(record.date, record.resolution);
          const resolved = await searchWord();
          const googleUrl = googleSiteSearchUrl({ site: source.site, word: resolved, ...period });
          try {
            const items = await source.search({ word: resolved, ...period });
            setExternalUrl({ url: googleUrl, label: t('Search on Google') });
            setData({ type: 'press', content: items, source });
          } catch (err) {
            // The keys and page layouts used here belong to the newspapers and can change
            // without notice; a failure should still leave the reader somewhere useful.
            console.warn(`Press context for ${corpus} failed:`, err);
            setData({ type: 'press_link', content: googleUrl, name: source.name, site: source.site, failed: true });
          }

        } else if (isPressLinkOutCorpus(corpus)) {
          // The click handler already opened this in a new tab; the panel repeats the link
          // for the case where a pop-up blocker stopped it.
          const url = pressLinkOutUrl(corpus, await searchWord(), record.date, record.resolution);
          setData({ type: 'press_link', content: url, site: PRESS_LINK_OUT[corpus], ownSearch: hasOwnSearch(corpus) });

        } else if (isTvCorpus(corpus)) {
          // No per-occurrence context for the transcripts; what matters to a reader
          // looking at a dip is that the recording itself has gaps.
          setData({ type: 'tv_note', content: null });

        } else if (corpus === 'rap') {
          const searchUrl = `https://shiny.ens-paris-saclay.fr/guni/source_rap?mot=${encodeURIComponent(rapPattern(word.replace(/’/g, "'")))}&year=${year}`;
          setExternalUrl({ url: 'https://huggingface.co/datasets/regicid/LRFAF', label: t('Corpus') });

          const response = await fetch(searchUrl);
          if (!response.ok) throw new Error('Failed to fetch Rap data');
          const csvText = await response.text();

          const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
          if (parsed.errors.length) throw new Error('Error parsing CSV');

          const sortedData = parsed.data.sort((a, b) => (b.counts || 0) - (a.counts || 0));
          setData({ type: 'rap', content: sortedData });
        } else {
          setError(t('We do not handle the context (yet?) for this corpus'));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContext();
  }, [record, corpus, t]);

  // Shown on every path, including the "no context for this corpus" message, which is
  // where the Majinbook corpora end up.
  // The label is a separate string from the name so the name can be a link; the French
  // translation carries its own space before the colon.
  const credit = corpusCredit(corpus, category);
  const creditLine = credit
    ? (
      <p style={{ fontSize: '0.85em', color: '#777', margin: '0 0 0.75rem' }}>
        {t('Credit')}{' '}
        {credit.url
          ? <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.name}</a>
          : credit.name}
      </p>
    )
    : null;

  if (isLoading) return <>{creditLine}<div>{t('Loading...')}</div></>;
  if (error) return <>{creditLine}<div style={{ color: 'inherit' }}>{error}</div></>;
  if (!data) return <>{creditLine}<div>{t('No data')}</div></>;

  // These corpora show no occurrences at all — a note, or a link out — so heading them
  // "Context for <word> (<date>)" would announce something that is not there.
  const hasOccurrences = data.type !== 'tv_note' && data.type !== 'cairn_link' && data.type !== 'press_link';

  return (
    <div className="special-context-display">
      {creditLine}
      {hasOccurrences && (
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>{t('Context for')} {record.terms[0]} ({record.date.split('T')[0]})</h3>
          {externalUrl && (
            <a href={externalUrl.url} target="_blank" rel="noopener noreferrer" className="external-link-button">
              {externalUrl.label}
            </a>
          )}
        </div>
      )}

      {data.type === 'lemonde' && (
        <>
          <p style={{ fontStyle: 'italic', fontSize: '0.9em', marginBottom: '1rem' }}>{t('le_monde_warning')}</p>
          <div className="records-list">
            {data.content.map((item, i) => (
              <ArticleCard key={i} item={item} buttonLabel={t('Read on Le Monde')} />
            ))}
          </div>
        </>
      )}

      {data.type === 'press' && (
        <>
          <p style={{ fontStyle: 'italic', fontSize: '0.9em', marginBottom: '1rem' }}>
            {t('press_search_warning', { name: data.source.name })}
            {data.source.looseMatching && <> {t('press_loose_matching_note')}</>}
            {data.source.upToEnd && <> {t('press_up_to_end_note')}</>}
          </p>
          {data.content.length === 0
            ? <p>{t('press_no_results')}</p>
            : (
              <div className="records-list">
                {data.content.map((item, i) => (
                  <ArticleCard key={i} item={item} buttonLabel={t('Read on {{name}}', { name: data.source.name })} />
                ))}
              </div>
            )}
        </>
      )}

      {data.type === 'press_link' && (
        <div style={{ fontSize: '0.95em', lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>
            {data.failed
              ? t('press_failed_note', { name: data.name, site: data.site })
              : t(data.ownSearch ? 'press_own_search_note' : 'press_link_note', { site: data.site })}
          </p>
          <a href={data.content} target="_blank" rel="noopener noreferrer" className="external-link-button">
            {data.ownSearch ? t('search_on_site', { site: data.site }) : t('Search on Google')}
          </a>
        </div>
      )}

      {data.type === 'persee' && (
        <div className="persee-list">
          {data.content.map((item, i) => (
            <div key={i} className="persee-item" style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
              <div>
                <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold' }}>{item.title}</a>
              </div>
              <div style={{ fontSize: '0.9em', color: '#555' }}>
                {item.author && <span>{item.author} - </span>}
                {item.collection && <span>{item.collection}</span>}
              </div>
              {item.searchContext && (
                <div className="searchContext" dangerouslySetInnerHTML={{ __html: item.searchContext }} style={{ fontSize: '0.9em', marginTop: '5px' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {data.type === 'tv_note' && (
        <div style={{ fontSize: '0.95em', lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>{t('tv_corpus_gaps_note')}</p>
          <p style={{ marginBottom: 0 }}>{t('tv_corpus_asr_note')}</p>
        </div>
      )}

      {data.type === 'cairn_link' && (
        <div style={{ fontSize: '0.95em', lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>{t('cairn_context_link_note')}</p>
          <a href={data.content} target="_blank" rel="noopener noreferrer" className="external-link-button">
            {t('Search on Cairn')}
          </a>
        </div>
      )}

      {data.type === 'rap' && (
        <div className="rap-table-container" style={{ overflowX: 'auto' }}>
          {data.content.length === 0 ? <div>{t('No data')}</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {Object.keys(data.content[0])
                    .filter(h => h.toLowerCase() !== 'url')
                    .map(h => (
                      <th key={h} style={{ borderBottom: '1px solid #ccc', padding: '5px', textAlign: 'left', backgroundColor: '#f5f5f5' }}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data.content.map((row, i) => (
                  <tr key={i}>
                    {Object.keys(row)
                      .filter(key => key.toLowerCase() !== 'url')
                      .map((key, j) => {
                        const val = row[key];
                        const isTitle = key.toLowerCase() === 'title' || key.toLowerCase() === 'titre';
                        // Look for URL in case-insensitive keys
                        const urlKey = Object.keys(row).find(k => k.toLowerCase() === 'url');
                        let url = urlKey ? row[urlKey] : null;

                        // Extract plain URL if API returned an HTML anchor tag
                        if (url && url.includes('<a ')) {
                          const match = url.match(/href=['"]([^'"]+)['"]/);
                          url = match ? match[1] : null;
                        }

                        if (isTitle && url) {
                          return (
                            <td key={j} style={{ padding: '5px', borderBottom: '1px solid #eee' }}>
                              <a href={url} target="_blank" rel="noopener noreferrer">{val}</a>
                            </td>
                          );
                        }
                        return <td key={j} style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{val}</td>;
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const ContextDisplay = ({ records, totalRecords, onPageChange, searchParams, isLoading, corpus, corpusConfigs, resolution }) => {
  const { t } = useTranslation();
  const observerTarget = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  const numPages = Math.ceil(totalRecords / (searchParams?.limit ?? 10));
  const currentPage = Math.floor((searchParams?.cursor ?? 0) / (searchParams?.limit ?? 10)) + 1;
  const hasMorePages = currentPage < numPages;

  // Filter records based on search term
  const filteredRecords = records.filter(record =>
    record.paper_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMorePages && !isLoading) {
          onPageChange(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMorePages, isLoading, currentPage, onPageChange]);

  // Check for dummy record indicating special corpus handling
  if (records.length > 0 && records[0].dummy) {
    return <SpecialContextDisplay record={records[0]} corpus={corpus} category={corpusConfigs?.[corpus]?.category} />;
  }

  if (isLoading && records.length === 0) {
    return <div>{t('Loading occurrences...')}</div>;
  }

  if (!records || records.length === 0) {
    return <div>{t('No occurrences found for this selection.')}</div>;
  }

  return (
    <div className="context-display">
      <h3>{totalRecords.toLocaleString()} {t('occurrences found')}</h3>
      <TextField
        fullWidth
        variant="outlined"
        size="small"
        placeholder={t('Search by title...')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ marginBottom: 2 }}
      />
      {filteredRecords.length === 0 && searchTerm && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          {t('No results match your search')}
        </div>
      )}
      <div className="records-list">
        {filteredRecords.map((record, index) => (
          <Occurrence
            key={record.ark + record.url + index}
            record={record}
            corpus={corpus}
            corpusConfigs={corpusConfigs}
            resolution={resolution}
          />
        ))}
      </div>
      {hasMorePages && (
        <div ref={observerTarget} style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          {isLoading && <CircularProgress color="success" />}
        </div>
      )}
      {!hasMorePages && records.length > 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          {t('No more results')}
        </div>
      )}
    </div>
  );
};

export default ContextDisplay;