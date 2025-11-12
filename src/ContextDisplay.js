import React, { useEffect, useRef, useState } from 'react';
import Occurrence from './Occurrence';
import { useTranslation } from 'react-i18next';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';

const ContextDisplay = ({ records, totalRecords, onPageChange, searchParams, isLoading }) => {
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
          <Occurrence key={record.ark + record.url + index} record={record} />
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