import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';

const WordCloudComponent = ({ data }) => {
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
      color: 'black'
    }
  }];

  return (
    <Plot
      data={plotData}
      layout={{
        width: 800,
        height: 600,
        title: t('Word Cloud'),
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false }
      }}
    />
  );
};

export default WordCloudComponent;
