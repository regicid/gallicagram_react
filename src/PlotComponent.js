import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';

const zscore = (data) => {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const stdDev = Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / data.length);
  return data.map(x => (x - mean) / stdDev);
};

const PlotComponent = ({ data, onPointClick, advancedOptions, plotType }) => {
  const { t } = useTranslation();

  const plotData = advancedOptions?.rescale && data.length > 0 && plotType === 'line'
    ? data.map(trace => ({ ...trace, y: zscore(trace.y) }))
    : data;

  const yAxisTitle = advancedOptions?.rescale && plotType === 'line' ? t('Z-score') : t('Frequency in the corpus');

  return (
    <Plot
      data={plotData}
      layout={{
        width: 800,
        height: 600,
        title: t('Frequency over time'),
        font: {
          family: 'Lato, sans-serif'
        },
        xaxis: {
          title: t('Date')
        },
        yaxis: {
          title: yAxisTitle,
          rangemode: plotType === 'area' ? 'tozero' : 'normal'
        }
      }}
      onClick={onPointClick}
    />
  );
};

export default PlotComponent;