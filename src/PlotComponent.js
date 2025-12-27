import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';

export const zscore = (data) => {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const stdDev = Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / data.length);
  return data.map(x => (x - mean) / stdDev);
};

// Set1 palette
export const defaultPalette = [
  '#377EB8FF', // blue
  '#E41A1CFF', // red
  '#4DAF4AFF', // green
  '#984EA3FF', // purple
  '#FF7F00FF', // orange
  '#FFFF33FF', // yellow
  '#A65628FF', // brown
  '#F781BFFF', // pink
  '#999999FF', // grey
];

// Paul Tol's colorblind-safe palette (bright scheme)
// Reference: https://personal.sron.nl/~pault/
export const colorblindPalette = [
  '#4477AA', // blue
  '#EE6677', // red
  '#228833', // green
  '#CCBB44', // yellow
  '#66CCEE', // cyan
  '#AA3377', // purple
  '#BBBBBB', // grey
  '#EE9944', // orange
];

const PlotComponent = ({ data, onPointClick, advancedOptions, plotType }) => {
  const { t } = useTranslation();

  let plotData = advancedOptions?.rescale && data.length > 0 && plotType === 'line'
    ? data.map(trace => ({ ...trace, y: zscore(trace.y) }))
    : data;

  // Apply color palette (colorblind or default)
  if (plotData.length > 0) {
    const palette = advancedOptions?.colorblindPalette ? colorblindPalette : defaultPalette;
    plotData = plotData.map((trace, index) => ({
      ...trace,
      line: trace.line ? { ...trace.line, color: palette[index % palette.length] } : { color: palette[index % palette.length] },
      marker: trace.marker ? { ...trace.marker, color: palette[index % palette.length] } : { color: palette[index % palette.length] }
    }));
  }

  const yAxisTitle = advancedOptions?.rescale && plotType === 'line' ? t('Z-score') : t('Frequency in the corpus');

  return (
    <Plot
      data={plotData}
      layout={{
        autosize: true,
        title: t('Frequency over time'),
        font: {
          family: 'EB Garamond, Georgia, serif'
        },
        xaxis: {
          title: t('Date')
        },
        yaxis: {
          title: yAxisTitle,
          rangemode: plotType === 'area' ? 'tozero' : 'normal'
        }
      }}
      useResizeHandler={true}
      className="plot-component"
      style={{ width: '100%', height: '100%' }}
      onClick={onPointClick}
    />
  );
};

export default PlotComponent;