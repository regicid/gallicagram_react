import React, { useState, useEffect, useCallback } from 'react';
import Button from '@mui/material/Button';
import { fetchContext } from './gallicaContext';

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
      const terms = ensureMultiWordIsWrapped(record.terms).map(term => term.split('+')[0]);

      // Fetch context directly from Gallica client-side (the server IP gets
      // blocked by Gallica). Only ark, terms and url are needed by Gallica's
      // ContentSearch service; the corpus/resolution params were ignored
      // server-side too.
      const data = await fetchContext({
        ark: record.ark,
        terms,
        url: record.url,
      });
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