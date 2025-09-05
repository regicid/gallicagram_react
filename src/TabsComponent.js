
import React from 'react';

const TabsComponent = ({ queries, activeQueryId, onTabClick, onAddTab, onRemoveTab, isOnlyQuery }) => {
  return (
    <div className="tabs">
      {queries.map(query => (
        <div
          key={query.id}
          className={`tab ${query.id === activeQueryId ? 'active' : ''}`}
          onClick={() => onTabClick(query.id)}
        >
          {query.word || `Query ${query.id}`}
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
