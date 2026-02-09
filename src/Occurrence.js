import React, { useState, useEffect, useCallback } from 'react';
import Button from '@mui/material/Button';

const GALLICA_PROXY_API_URL = 'https://shiny.ens-paris-saclay.fr/guni';

const Occurrence = ({ record, corpus, corpusConfigs, resolution }) => {
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const ensureMultiWordIsWrapped = (terms) => {
    return terms.map((t) =>
      t.trim().split(' ').length > 1 ? `"${t.trim()}"` : t.trim()
    );
  }

  const performFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try to fetch from local context first
      const localResponse = await fetch(`/contexts/${record.ark}.json`);
      if (localResponse.ok) {
        const data = await localResponse.json();
        setContext(data);
        return;
      }

      // Fallback to API if local fetch fails
      const terms = ensureMultiWordIsWrapped(record.terms).map(term => term.split('+')[0]);
      const params = new URLSearchParams({
        ark: record.ark,
        url: record.url,
      });
      terms.forEach(term => params.append('terms', term));

      // Handle resolution specific parameters (month, day)
      if (resolution === 'mois' || resolution === 'jour') {
        const dateObj = new Date(record.date);
        if (!isNaN(dateObj.getTime())) {
          params.append('month', dateObj.getMonth() + 1);
          if (resolution === 'jour') {
            params.append('day', dateObj.getDate());
          }
        }
      }

      // Add corpus specific filters if available
      const config = corpusConfigs?.[corpus];
      if (config && config.filter) {
        const filterParams = new URLSearchParams(config.filter);
        filterParams.forEach((value, key) => {
          params.append(key, value);
        });
      } else if (corpus === 'livres') {
        params.append('source', 'book');
      } else if (['presse', 'journal_des_debats', 'moniteur'].includes(corpus)) {
        if (!params.has('source')) {
          params.append('source', 'periodical');
        }
      }

      const response = await fetch(`${GALLICA_PROXY_API_URL}/api/context?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.[0]?.msg || 'Failed to fetch context');
      }
      const data = await response.json();
      setContext(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [record, corpus, corpusConfigs, resolution]);

  useEffect(() => {
    performFetch();
  }, [performFetch]);

  const handleToggleContext = () => {
    if (context) {
      setContext(null);
    } else {
      performFetch();
    }
  };

  return (
    <div className="occurrence-card">
      <h4>
        <a href={record.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
          {record.paper_title}
        </a>
      </h4>
      <p>{record.date}</p>
      <Button variant="contained" color="success" onClick={handleToggleContext} disabled={isLoading}>
        {isLoading ? 'Loading...' : (context ? 'Hide context' : 'Show context')}
      </Button>
      {error && <div className="error" style={{ color: 'red' }}>{error}</div>}
      {context && (
        <div className="context-view">
          {context.map((c, index) => (
            <p key={`${c.left_context}${c.page_num}${c.right_context}${index}`}>
              ...{c.left_context} <span className="pivot" style={{ backgroundColor: 'yellow', fontWeight: 'bold' }}>{c.pivot}</span> {c.right_context}...
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default Occurrence;