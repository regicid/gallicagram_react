import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';

const WordCloudComponent = ({ data, darkMode }) => {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div>{t('No data to display')}</div>;
  }

  const words = data.map((d, i) => {
    const angle = data.length > 1 ? (i / (data.length - 1)) * 2 * Math.PI : 0;
    const maxTotal = data.length > 0 && data[0].total > 0 ? data[0].total : 1;
    return {
      ...d,
      x: Math.cos(angle),
      y: Math.sin(angle),
      size: 10 + (d.total / maxTotal) * 50 // Scale font size
    };
  });

  const plotData = [{
    x: words.map(w => w.x),
    y: words.map(w => w.y),
    text: words.map(w => w.word),
    mode: 'text',
    textfont: {
      size: words.map(w => w.size),
      color: darkMode ? '#eaeaea' : 'black'
    }
  }];

  const plotlyTheme = darkMode ? {
    paper_bgcolor: '#1a1a2e',
    plot_bgcolor: '#16213e',
    font: { color: '#eaeaea', family: 'EB Garamond, Georgia, serif' }
  } : {
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    font: { family: 'EB Garamond, Georgia, serif' }
  };

  return (
    <Plot
      data={plotData}
      layout={{
        autosize: true,
        title: t('Word Cloud'),
        ...plotlyTheme,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false }
      }}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%', minHeight: '600px' }}
    />
  );
};

export default WordCloudComponent;
