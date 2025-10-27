import React from 'react';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

const TabsComponent = ({ queries, activeQueryId, onTabClick, onAddTab, onRemoveTab, isOnlyQuery }) => {
  const { t } = useTranslation();

  return (
    <div className="tabs">
      {queries.map(query => (
        <div
          key={query.id}
          className={`tab ${query.id === activeQueryId ? 'active' : ''}`}
          onClick={() => onTabClick(query.id)}
        >
          {query.word || `${t('Query')} ${query.id}`}
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