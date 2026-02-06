import React from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

const TabsComponent = ({ queries, activeQueryId, onTabClick, onAddTab, onRemoveTab, isOnlyQuery }) => {

  return (
    <div className="tabs">
      {queries.map((query, index) => (
        <div
          key={query.id}
          className={`tab ${query.id === activeQueryId ? 'active' : ''}`}
          onClick={() => onTabClick(query.id)}
        >
          {index + 1}
          {!isOnlyQuery && (
            <IconButton size="small" className="remove-tab-btn" onClick={(e) => { e.stopPropagation(); onRemoveTab(query.id); }}><CloseIcon fontSize="small" /></IconButton>
          )}
        </div>
      ))}
      <IconButton className="add-tab-btn" onClick={onAddTab}><AddIcon /></IconButton>
    </div>
  );
};

export default TabsComponent;