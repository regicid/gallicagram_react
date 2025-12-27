import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';

const SumsComponent = ({ data, darkMode }) => {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div>{t('No data to display')}</div>;
  }

  const plotData = [{
    x: data.map(d => d.total),
    y: data.map(d => d.word),
    type: 'bar',
    orientation: 'h'
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
        title: t('Total Occurrences per Query'),
        ...plotlyTheme,
        margin: {
          l: 150,
          r: 20,
          t: 50,
          b: 50,
          pad: 4
        },
        xaxis: {
          title: t('Total Occurrences'),
          tickfont: { size: 14 },
          gridcolor: darkMode ? '#0f3460' : undefined
        },
        yaxis: {
          title: t('Query'),
          autorange: 'reversed',
          automargin: true,
          tickfont: { size: 14 },
          gridcolor: darkMode ? '#0f3460' : undefined
        }
      }}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%', minHeight: '600px' }}
    />
  );
};

export default SumsComponent;
