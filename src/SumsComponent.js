import React from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { defaultPalette, colorblindPalette } from './PlotComponent';

const SumsComponent = ({ data, darkMode, advancedOptions }) => {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div>{t('No data to display')}</div>;
  }

  // Choose palette
  const palette = advancedOptions?.colorblindPalette ? colorblindPalette : defaultPalette;

  const plotData = data.map((d, index) => ({
    x: [d.total],
    y: [d.word],
    name: d.name || d.word, // Fallback for list modes or legacy data
    type: 'bar',
    orientation: 'h',
    marker: { color: palette[index % palette.length] }
  }));

  // Calculate dynamic font size based on number of items
  // More items = smaller font to prevent overlap
  const numItems = data.length;
  const yTickFontSize = Math.max(8, Math.min(14, 200 / numItems));

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
          tickfont: { size: yTickFontSize },
          gridcolor: darkMode ? '#0f3460' : undefined
        }
      }}
      useResizeHandler={true}
      style={{ width: '100%', height: '100%', minHeight: '600px' }}
    />
  );
};

export default SumsComponent;
