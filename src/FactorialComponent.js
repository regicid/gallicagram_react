import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { FormControlLabel, Switch, Box, Link, Typography } from '@mui/material';
import { defaultPalette, colorblindPalette, plotlyThemeFor, toPlotlyDate, revisionOf, useRenderAfterMount, FIGURE_DIV_ID } from './PlotComponent';
import { pca, ca, buildTable, bezierCurve } from './factorial';

// Above this many dates, their years would cover the plane: they become dots.
const MAX_LABELLED_DATES = 400;

// Viridis, from the oldest date to the latest. Its yellow end is unreadable as text on
// white, and its dark purple on the dark theme: each theme keeps the part it can show.
const VIRIDIS = ['#440154', '#472c7a', '#3b518b', '#2c718e', '#21908d', '#27ad81', '#5cc863', '#aadc32', '#fde725'];
const viridis = (fraction) => {
  const x = Math.min(1, Math.max(0, fraction)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  const rgb = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
  const [a, b] = [rgb(VIRIDIS[i]), rgb(VIRIDIS[i + 1])];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * (x - i))).join(',')})`;
};
const dateColor = (fraction, darkMode) => viridis(darkMode ? 0.25 + 0.75 * fraction : 0.8 * fraction);

const dateLabel = (dates) => {
  const yearly = dates.every(d => d.getUTCMonth() === 0 && d.getUTCDate() === 1);
  const monthly = dates.every(d => d.getUTCDate() === 1);
  return d => (yearly ? String(d.getUTCFullYear())
    : monthly ? d.toISOString().slice(0, 7)
      : d.toISOString().slice(0, 10));
};

// Biplot of the dates (coloured from the oldest to the latest) and the series, on the
// first two axes of a PCA ('pca') or a correspondence analysis ('ca'), each date written as
// its year. With the trajectory on, a smooth curve follows the dates in time order, as the
// Shiny app's "Épurer" option did, after Hyperbase.
// A click on a date asks for its context, for the word that date leans towards (the series
// it projects furthest onto); onTable receives the coordinates, for the CSV download.
const FactorialComponent = ({ data, method, advancedOptions, darkMode, onPointClick, onTable }) => {
  const { t } = useTranslation();
  const [trajectory, setTrajectory] = useState(false);
  const palette = advancedOptions?.colorblindPalette ? colorblindPalette : defaultPalette;

  const analysis = useMemo(() => {
    const traces = (data || []).filter(trace => Array.isArray(trace.x) && trace.x.length > 0);
    if (traces.length === 0) return { error: t('No data to display') };
    let { dates, table } = buildTable(traces, method === 'ca');
    let names = traces.map(trace => trace.name);
    let colors = traces.map((_, i) => palette[i % palette.length]);
    let metas = traces.map(trace => trace.meta);
    if (method === 'ca') {
      // A date or a word without any occurrence has no profile to place.
      const keepRows = table.map(row => row.reduce((a, b) => a + b, 0) > 0);
      dates = dates.filter((_, i) => keepRows[i]);
      table = table.filter((_, i) => keepRows[i]);
      const keepCols = names.map((_, j) => table.some(row => row[j] > 0));
      table = table.map(row => row.filter((_, j) => keepCols[j]));
      names = names.filter((_, j) => keepCols[j]);
      colors = colors.filter((_, j) => keepCols[j]);
      metas = metas.filter((_, j) => keepCols[j]);
    }
    const minSeries = method === 'ca' ? 3 : 2;
    if (names.length < minSeries) return { error: t(method === 'ca' ? 'AFC needs three series' : 'ACP needs two series') };
    if (dates.length < 3) return { error: t('Factorial needs dates') };
    const result = method === 'ca' ? ca(table) : pca(table);
    const leaning = result.rows.map(row => {
      const scores = result.columns.map(col => row[0] * col[0] + row[1] * col[1]);
      return scores.indexOf(Math.max(...scores));
    });
    return { dates, names, colors, metas, leaning, ...result };
  }, [data, method, palette, t]);

  useEffect(() => {
    if (!onTable) return;
    if (analysis.error) {
      onTable(null);
      return;
    }
    const { dates, names, rows, columns, explained } = analysis;
    const dims = explained.map((_, k) => `Dim ${k + 1} (${explained[k].toFixed(2)} %)`);
    const line = (kind, label, coords) => Object.fromEntries([['type', kind], ['label', label], ...dims.map((dim, k) => [dim, coords[k]])]);
    const label = dateLabel(dates);
    onTable({
      fields: ['type', 'label', ...dims],
      data: [
        ...rows.map((coords, i) => line('date', label(dates[i]), coords)),
        ...columns.map((coords, j) => line('word', names[j], coords)),
      ],
    });
  }, [analysis, onTable]);

  useRenderAfterMount(!analysis.error);

  if (analysis.error) {
    return <div className="plot-component" style={{ padding: '2rem' }}>{analysis.error}</div>;
  }

  const { dates, names, colors, metas, leaning, rows, columns, explained } = analysis;
  const label = dateLabel(dates);
  const labels = dates.map(label);
  const showYears = dates.length <= MAX_LABELLED_DATES;
  const theme = plotlyThemeFor(darkMode);
  const textColor = darkMode ? '#bbbbbb' : '#555555';

  // PCA variables are correlations (within the unit circle): stretched to the spread of the
  // dates so the arrows can be read against them, as factoextra's biplot does.
  const maxAbs = points => Math.max(...points.flatMap(p => [Math.abs(p[0]), Math.abs(p[1])]), 1e-12);
  const stretch = method === 'pca' ? (0.9 * maxAbs(rows)) / maxAbs(columns) : 1;
  const tips = columns.map(c => [c[0] * stretch, c[1] * stretch]);

  const traces = [];
  if (trajectory) {
    const curve = bezierCurve(rows.map(r => [r[0], r[1]]));
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: curve.map(p => p[0]),
      y: curve.map(p => p[1]),
      line: { color: textColor, width: 2 },
      hoverinfo: 'skip',
      showlegend: false,
    });
  }
  const first = dates[0].getTime();
  const span = dates[dates.length - 1].getTime() - first || 1;
  const dateColors = dates.map(d => dateColor((d.getTime() - first) / span, darkMode));
  traces.push({
    type: 'scatter',
    mode: showYears ? 'text' : 'markers',
    x: rows.map(r => r[0]),
    y: rows.map(r => r[1]),
    text: dates.map(d => String(d.getUTCFullYear())),
    customdata: dates.map((d, i) => [toPlotlyDate(d), names[leaning[i]], labels[i]]),
    textfont: { size: 12, color: dateColors },
    marker: { size: 7, color: dateColors },
    hovertemplate: '%{customdata[2]} → %{customdata[1]}<extra></extra>',
    showlegend: false,
  });
  names.forEach((name, j) => {
    traces.push({
      type: 'scatter',
      mode: 'text',
      x: [tips[j][0] * (method === 'pca' ? 1.08 : 1)],
      y: [tips[j][1] * (method === 'pca' ? 1.08 : 1)],
      text: [`<b>${name}</b>`],
      textfont: { size: 16, color: colors[j] },
      hovertemplate: `${name}<extra></extra>`,
      name,
      showlegend: false,
    });
  });
  const annotations = method === 'pca'
    ? tips.map((tip, j) => ({
      x: tip[0], y: tip[1], ax: 0, ay: 0, xref: 'x', yref: 'y', axref: 'x', ayref: 'y',
      text: '', showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 2, arrowcolor: colors[j],
    }))
    : [];

  const handleClick = (event) => {
    const point = event.points?.[0];
    if (!onPointClick || !Array.isArray(point?.customdata)) return;
    const word = leaning[point.pointIndex];
    onPointClick({ points: [{ ...point, x: point.customdata[0], data: { ...point.data, meta: metas[word] } }] });
  };

  const axis = k => ({
    title: { text: `${t('Dim.')} ${k + 1} (${explained[k].toFixed(1)} %)` },
    zeroline: true,
    zerolinecolor: textColor,
    tickfont: { size: 12 },
    ...(theme.xaxis || {}),
  });

  return (
    <div>
      <Box sx={{ paddingLeft: 2 }}>
        <FormControlLabel
          control={<Switch checked={trajectory} onChange={e => setTrajectory(e.target.checked)} />}
          label={t('Show the trajectory')}
        />
      </Box>
      <Plot
        divId={FIGURE_DIV_ID}
        data={traces}
        layout={{
          autosize: true,
          title: { text: method === 'pca' ? t('Principal component analysis') : t('Correspondence analysis') },
          paper_bgcolor: theme.paper_bgcolor,
          plot_bgcolor: theme.plot_bgcolor,
          font: theme.font,
          hovermode: 'closest',
          xaxis: axis(0),
          yaxis: { ...axis(1), scaleanchor: 'x', scaleratio: 1 },
          annotations,
          uirevision: `${method}-${revisionOf(data)}`,
        }}
        config={{ displayModeBar: true, scrollZoom: false }}
        useResizeHandler={true}
        onClick={handleClick}
        className="plot-component"
        style={{ width: '100%', height: '100%' }}
      />
      <Typography variant="body2" sx={{ paddingLeft: 2, opacity: 0.8, fontStyle: 'italic' }}>
        {t('Hyperbase tribute')}{' '}
        <Link href="https://hyperbase.unice.fr" target="_blank" rel="noopener noreferrer">Hyperbase</Link>
        {t('Hyperbase tribute end')}
      </Typography>
    </div>
  );
};

export default React.memo(FactorialComponent);
