import React from 'react';
import Occurrence from './Occurrence';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';

const ContextDisplay = ({ records, totalRecords, onPageChange, searchParams, isLoading }) => {
  const { t } = useTranslation();

  if (isLoading) {
      return <div>{t('Loading occurrences...')}</div>;
  }
  
  if (!records || records.length === 0) {
    return <div>{t('No occurrences found for this selection.')}</div>;
  }

  const numPages = Math.ceil(totalRecords / (searchParams?.limit ?? 10));
  const currentPage = Math.floor((searchParams?.cursor ?? 0) / 10) + 1;

  return (
    <div className="context-display">
      <h3>{totalRecords.toLocaleString()} {t('occurrences found')}</h3>
      <div className="records-list">
        {records.map(record => (
          <Occurrence key={record.ark + record.url} record={record} />
        ))}
      </div>
      {totalRecords > (searchParams?.limit ?? 10) && (
        <div className="pagination">
            <Button variant="contained" color="success" onClick={() => onPageChange(currentPage - 2)} disabled={currentPage <= 1}>&lt; {t('Previous')}</Button>
            <span> {t('Page')} {currentPage} {t('of')} {numPages.toLocaleString()} </span>
            <Button variant="contained" color="success" onClick={() => onPageChange(currentPage)} disabled={currentPage >= numPages}>{t('Next')} &gt;</Button>
        </div>
      )}
    </div>
  );
};

export default ContextDisplay;