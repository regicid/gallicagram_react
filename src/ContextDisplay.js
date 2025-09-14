import React from 'react';
import Occurrence from './Occurrence';

const ContextDisplay = ({ records, totalRecords, onPageChange, searchParams, isLoading }) => {
  if (isLoading) {
      return <div>Loading occurrences...</div>;
  }
  
  if (!records || records.length === 0) {
    return <div>No occurrences found for this selection.</div>;
  }

  const numPages = Math.ceil(totalRecords / (searchParams?.limit ?? 10));
  const currentPage = Math.floor((searchParams?.cursor ?? 0) / 10) + 1;

  return (
    <div className="context-display">
      <h3>{totalRecords.toLocaleString()} occurrences found</h3>
      <div className="records-list">
        {records.map(record => (
          <Occurrence key={record.ark + record.url} record={record} />
        ))}
      </div>
      {totalRecords > (searchParams?.limit ?? 10) && (
        <div className="pagination">
            <button onClick={() => onPageChange(currentPage - 2)} disabled={currentPage <= 1}>&lt; Previous</button>
            <span> Page {currentPage} of {numPages.toLocaleString()} </span>
            <button onClick={() => onPageChange(currentPage)} disabled={currentPage >= numPages}>Next &gt;</button>
        </div>
      )}
    </div>
  );
};

export default ContextDisplay;
