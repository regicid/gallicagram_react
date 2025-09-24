import React from 'react';
import { useTranslation } from 'react-i18next';

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
            <button className="remove-tab-btn" onClick={(e) => { e.stopPropagation(); onRemoveTab(query.id); }}>x</button>
          )}
        </div>
      ))}
      <button className="add-tab-btn" onClick={onAddTab}>+</button>
    </div>
  );
};

export default TabsComponent;