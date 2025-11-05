import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';

const SumsComponent = ({ data }) => {
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

  return (
    <Plot
      data={plotData}
      layout={{
        width: 800,
        height: 600,
        title: t('Total Occurrences per Query'),
        font: {
          family: 'Lato, sans-serif'
        },
        xaxis: {
          title: t('Total Occurrences')
        },
        yaxis: {
          title: t('Query'),
          autorange: 'reversed'
        }
      }}
    />
  );
};

export default SumsComponent;
