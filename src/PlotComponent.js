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

const PlotComponent = ({ data, onPointClick, advancedOptions, plotType, darkMode, plotRevision }) => {
  const { t } = useTranslation();

  let plotData = advancedOptions?.rescale && data.length > 0 && plotType === 'line'
    ? data.map(trace => ({ ...trace, y: zscore(trace.y) }))
    : data;

  // Apply color palette (colorblind or default)
  const palette = advancedOptions?.colorblindPalette ? colorblindPalette : defaultPalette;

  if (plotData.length > 0) {
    plotData = plotData.map((trace, index) => ({
      ...trace,
      line: trace.line ? { ...trace.line, color: palette[index % palette.length] } : { color: palette[index % palette.length] },
      marker: trace.marker ? { ...trace.marker, color: palette[index % palette.length] } : { color: palette[index % palette.length] }
    }));
  }

  // Add confidence interval traces for line plots
  const showCI = advancedOptions?.showConfidenceInterval !== false && plotType === 'line' && !advancedOptions?.rescale;
  let finalPlotData = plotData;

  if (showCI && plotData.length > 0) {
    const ciTraces = [];
    plotData.forEach((trace, index) => {
      const color = palette[index % palette.length];
      // Extract alpha or use 0.2 opacity for fill
      const fillColor = color.substring(0, 7) + '33'; // Add 20% opacity

      if (!trace.y || !trace.n || !trace.total || !trace.x) {
        return; // Skip if no data available
      }

      // Split into segments at gaps (where total is null/0)
      // Each segment becomes a separate pair of traces
      let currentSegment = { x: [], lower: [], upper: [] };
      const segments = [];

      for (let i = 0; i < trace.y.length; i++) {
        const freq = trace.y[i];
        const n = trace.n[i];
        const total = trace.total[i];

        // Check if this is a gap point (no data)
        const isGap = total === null || total === undefined || total <= 0;

        if (isGap) {
          // End current segment if it has data
          if (currentSegment.x.length > 0) {
            segments.push(currentSegment);
            currentSegment = { x: [], lower: [], upper: [] };
          }
        } else {
          // Calculate CI bounds
          let ciLower, ciUpper;
          if (n === 0) {
            ciLower = 0;
            ciUpper = 3 / total;
          } else if (freq !== null && freq !== undefined) {
            const se = 1.96 * Math.sqrt(freq * (1 - freq) / total);
            ciLower = Math.max(0, freq - se);
            ciUpper = freq + se;
          } else {
            ciLower = freq;
            ciUpper = freq;
          }

          currentSegment.x.push(trace.x[i]);
          currentSegment.lower.push(ciLower);
          currentSegment.upper.push(ciUpper);
        }
      }

      // Don't forget the last segment
      if (currentSegment.x.length > 0) {
        segments.push(currentSegment);
      }

      // Create trace pairs for each segment
      segments.forEach(segment => {
        // Lower bound trace (invisible, just for fill base)
        ciTraces.push({
          x: segment.x,
          y: segment.lower,
          mode: 'lines',
          line: { width: 0, shape: 'spline' },
          showlegend: false,
          hoverinfo: 'skip',
          fillcolor: 'transparent'
        });

        // Upper bound trace with fill to previous
        ciTraces.push({
          x: segment.x,
          y: segment.upper,
          mode: 'lines',
          line: { width: 0, shape: 'spline' },
          fill: 'tonexty',
          fillcolor: fillColor,
          showlegend: false,
          hoverinfo: 'skip'
        });
      });
    });

    // Put CI traces first so main lines are on top
    finalPlotData = [...ciTraces, ...plotData];
  }

  // Calculate y-axis range: default to auto-scale, only cap when CI blows up the plot
  let yAxisRange;
  if (showCI && plotData.length > 0) {
    let maxYFromMainLines = 0;
    let maxYFromCI = 0;

    // Get max Y from main line traces
    plotData.forEach(trace => {
      if (trace.y) {
        const validYs = trace.y.filter(val => typeof val === 'number' && !isNaN(val));
        if (validYs.length > 0) {
          const m = Math.max(...validYs);
          if (m > maxYFromMainLines) maxYFromMainLines = m;
        }
      }
    });

    // Check the CI upper bounds
    finalPlotData.forEach(trace => {
      if (!trace.name && trace.y) {
        const validYs = trace.y.filter(val => typeof val === 'number' && !isNaN(val));
        if (validYs.length > 0) {
          const m = Math.max(...validYs);
          if (m > maxYFromCI) maxYFromCI = m;
        }
      }
    });

    // Only cap if CI is blowing up the plot (> 110% of main line max)
    const threshold = maxYFromMainLines * 1.1;
    if (maxYFromMainLines > 0 && maxYFromCI > threshold) {
      yAxisRange = [undefined, threshold];
    }
  }

  const yAxisTitle = advancedOptions?.rescale && plotType === 'line' ? t('Z-score') : t('Frequency in the corpus');

  const isTouchScreen = (('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0));

  // Dark mode styling for Plotly
  const plotlyTheme = darkMode ? {
    paper_bgcolor: '#1a1a2e',
    plot_bgcolor: '#16213e',
    font: { color: '#eaeaea', family: 'EB Garamond, Georgia, serif' },
    xaxis: { gridcolor: '#0f3460', linecolor: '#0f3460' },
    yaxis: { gridcolor: '#0f3460', linecolor: '#0f3460' }
  } : {
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    font: { family: 'EB Garamond, Georgia, serif' }
  };

  // Show Total Barplot option
  const showTotalBarplot = advancedOptions?.showTotalBarplot && plotType === 'line';

  // Create total bar traces if enabled
  let totalBarTraces = [];
  if (showTotalBarplot && plotData.length > 0) {
    plotData.forEach((trace, index) => {
      if (trace.total) {
        const color = palette[index % palette.length];
        totalBarTraces.push({
          x: trace.x,
          y: trace.total.map(v => v ? v : null),
          type: 'bar',
          marker: { color: color },
          name: `${trace.name} (Total)`,
          showlegend: false,
          xaxis: 'x',
          yaxis: 'y2',
          hovertemplate: '%{x}: %{customdata:,}<extra></extra>',
          customdata: trace.total
        });
      }
    });
  }

  // Combine all data
  let allPlotData = showTotalBarplot
    ? [...finalPlotData.map(t => ({ ...t, yaxis: 'y' })), ...totalBarTraces]
    : finalPlotData;

  // Layout configuration
  const baseLayout = {
    autosize: true,
    title: t('Frequency over time'),
    ...plotlyTheme,
    dragmode: isTouchScreen ? false : 'zoom',
    xaxis: {
      title: showTotalBarplot ? undefined : t('Date'),
      fixedrange: isTouchScreen,
      tickfont: { size: 14 },
      ...(plotlyTheme.xaxis || {})
    },
    yaxis: {
      title: yAxisTitle,
      rangemode: (plotType === 'area' || advancedOptions?.extendYScale) ? 'tozero' : 'normal',
      fixedrange: isTouchScreen,
      tickfont: { size: 14 },
      ...(plotlyTheme.yaxis || {}),
      domain: showTotalBarplot ? [0.35, 1] : [0, 1],
      range: yAxisRange
    },
    // Use uirevision to prevent Plotly from resetting the layout (zoom, pan, margins)
    // We bind this to a known state, or just 'true' to persist user interactions.
    // However, if we want it to reset when plotType changes, we can use plotType.
    uirevision: plotType,
    datarevision: plotRevision // Use the passed revision key
  };

  // Add second y-axis for total barplot
  if (showTotalBarplot) {
    baseLayout.yaxis2 = {
      title: t('Total'),
      domain: [0, 0.25],
      tickfont: { size: 14 },
      gridcolor: plotlyTheme.yaxis?.gridcolor,
      linecolor: plotlyTheme.yaxis?.linecolor,
      autorange: 'reversed' // This makes bars point downward
    };
    baseLayout.xaxis.anchor = 'y';
  }

  return (
    <Plot
      data={allPlotData}
      layout={baseLayout}
      config={{
        displayModeBar: !isTouchScreen,
        scrollZoom: false
      }
      }
      useResizeHandler={true}
      className="plot-component"
      style={{ width: '100%', height: '100%' }}
      onClick={onPointClick}
    />
  );
};

export default React.memo(PlotComponent);