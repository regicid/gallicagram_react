import React, { useState } from 'react';
import Button from '@mui/material/Button';

const GALLICA_PROXY_API_URL = 'https://gallica-proxy-production.up.railway.app';

const Occurrence = ({ record }) => {
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const ensureMultiWordIsWrapped = (terms) => {
    return terms.map((t) =>
      t.trim().split(' ').length > 1 ? `"${t.trim()}"` : t.trim()
    );
  }

  const fetchContext = async () => {
    if (context) { // toggle
        setContext(null);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const terms = ensureMultiWordIsWrapped(record.terms).map(term => term.split('+')[0]);
      const params = new URLSearchParams({
        ark: record.ark,
        url: record.url,
      });
      terms.forEach(term => params.append('terms', term));

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
  };

  return (
    <div className="occurrence-card">
      <h4>
        <a href={record.url} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'none', color: 'inherit'}}>
          {record.paper_title}
        </a>
      </h4>
      <p>{record.date}</p>
      <Button variant="contained" color="success" onClick={fetchContext} disabled={isLoading}>
        {isLoading ? 'Loading...' : (context ? 'Hide context' : 'Show context')}
      </Button>
      {error && <div className="error" style={{color: 'red'}}>{error}</div>}
      {context && (
        <div className="context-view">
          {context.map((c, index) => (
            <p key={`${c.left_context}${c.page_num}${c.right_context}${index}`}>
              ...{c.left_context} <span className="pivot" style={{backgroundColor: 'yellow', fontWeight: 'bold'}}>{c.pivot}</span> {c.right_context}...
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default Occurrence;
