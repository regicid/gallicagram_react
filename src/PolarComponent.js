import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { useTranslation } from 'react-i18next';
import { FormControlLabel, Switch, Box } from '@mui/material';
import { defaultPalette, colorblindPalette, plotlyThemeFor, toPlotlyDate, revisionOf, useRenderAfterMount, FIGURE_DIV_ID } from './PlotComponent';
import { toMonthly, detrend, seasonalProfile } from './seasonality';

// Each month is an angle, January at the top, clockwise. In the seasonal view a word draws
// one closed loop, its average over the years; in the spiral view every year goes round
// once, so the years can be compared. A click on the spiral asks for that month's context;
// onTable receives the values drawn, for the CSV download.

// The spiral's years go from blue (the first) to red (the last). A line has one colour in
// Plotly, so each year is its own trace; with several words, the line style tells them apart.
const OLDEST = [33, 102, 172];
const LATEST = [178, 24, 43];
const yearColor = (fraction) => `rgb(${OLDEST.map((v, k) => Math.round(v + (LATEST[k] - v) * fraction)).join(',')})`;
const DASHES = ['solid', 'dot', 'dash', 'dashdot', 'longdash', 'longdashdot'];

const PolarComponent = ({ data, monthly, advancedOptions, darkMode, onPointClick, onTable }) => {
  const { t, i18n } = useTranslation();
  const [removeTrend, setRemoveTrend] = useState(true);
  const [seasonal, setSeasonal] = useState(true);
  const palette = advancedOptions?.colorblindPalette ? colorblindPalette : defaultPalette;

  const monthNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.language, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, m) => format.format(new Date(Date.UTC(2000, m))));
  }, [i18n.language]);

  const series = useMemo(() => {
    if (!monthly) return [];
    return (data || []).map(trace => {
      const monthlySeries = toMonthly(trace);
      return removeTrend ? detrend(monthlySeries) : monthlySeries;
    });
  }, [data, monthly, removeTrend]);

  const table = useMemo(() => {
    // Without months there is nothing drawn, so nothing to export.
    if (!monthly) return null;
    const names = (data || []).map(trace => trace.name);
    if (seasonal) {
      const profiles = series.map(seasonalProfile);
      return {
        fields: ['month', ...names],
        data: monthNames.map((month, m) => Object.fromEntries([['month', month], ...names.map((name, j) => [name, profiles[j][m]])])),
      };
    }
    const rows = new Map();
    series.forEach((s, j) => s.x.forEach((d, i) => {
      const key = d.toISOString().slice(0, 7);
      rows.set(key, { ...(rows.get(key) || { date: key }), [names[j]]: s.y[i] });
    }));
    return { fields: ['date', ...names], data: [...rows.keys()].sort().map(key => rows.get(key)) };
  }, [data, monthly, series, seasonal, monthNames]);

  useEffect(() => {
    if (onTable) onTable(table);
  }, [table, onTable]);

  const traces = useMemo(() => {
    if (seasonal) {
      return series.map((monthlySeries, index) => {
        const color = palette[index % palette.length];
        const profile = seasonalProfile(monthlySeries);
        return {
          type: 'scatterpolar',
          mode: 'lines+markers',
          r: [...profile, profile[0]],
          theta: [...profile.map((_, m) => m * 30), 360],
          text: [...monthNames, monthNames[0]],
          hovertemplate: '%{text}: %{r:.3~g}',
          line: { shape: 'spline', color, width: 3 },
          marker: { color, size: 6 },
          connectgaps: true,
          name: data[index].name,
        };
      });
    }
    const years = series.flatMap(monthlySeries => monthlySeries.x.map(d => d.getUTCFullYear()));
    if (years.length === 0) return [];
    const firstYear = Math.min(...years);
    const lastYear = Math.max(...years);
    const fraction = year => (lastYear > firstYear ? (year - firstYear) / (lastYear - firstYear) : 0);
    const several = series.length > 1;
    const traces = series.flatMap((monthlySeries, index) => {
      const trace = data[index];
      const dash = several ? DASHES[index % DASHES.length] : 'solid';
      const byYear = new Map();
      monthlySeries.x.forEach((d, i) => {
        const year = d.getUTCFullYear();
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year).push(i);
      });
      // In the legend, a word stands for all its years: clicking it hides or shows them.
      const legendEntry = {
        type: 'scatterpolar',
        mode: 'lines',
        r: [null],
        theta: [null],
        line: { color: darkMode ? '#bbbbbb' : '#555555', dash, width: 2 },
        name: trace.name,
        legendgroup: trace.name,
        hoverinfo: 'skip',
      };
      return [legendEntry, ...[...byYear.entries()].map(([year, indices]) => {
        // Each year runs on into the next January, so the spiral stays unbroken.
        const next = byYear.get(year + 1);
        const points = next ? [...indices, next[0]] : indices;
        return {
          type: 'scatterpolar',
          mode: 'lines',
          r: points.map(i => monthlySeries.y[i]),
          theta: points.map((i, k) => (k === indices.length ? 360 : monthlySeries.x[i].getUTCMonth() * 30)),
          text: points.map(i => `${monthNames[monthlySeries.x[i].getUTCMonth()]} ${monthlySeries.x[i].getUTCFullYear()}`),
          hovertemplate: `%{text}: %{r:.3~g}<extra>${trace.name}</extra>`,
          line: { shape: 'spline', color: yearColor(fraction(year)), width: 1.5, dash },
          name: trace.name,
          legendgroup: trace.name,
          showlegend: false,
          customdata: points.map(i => toPlotlyDate(monthlySeries.x[i])),
          // The context of a point is that of its month, whatever resolution was fetched.
          meta: { ...trace.meta, resolution: 'mois' },
        };
      })];
    });
    // The colour scale of the years, drawn by a trace without points.
    traces.push({
      type: 'scatterpolar',
      mode: 'markers',
      r: [null, null],
      theta: [null, null],
      marker: {
        color: [firstYear, lastYear],
        cmin: firstYear,
        cmax: lastYear,
        colorscale: [[0, yearColor(0)], [1, yearColor(1)]],
        showscale: true,
        colorbar: { title: { text: t('Date') }, tickformat: 'd', thickness: 12 },
      },
      showlegend: false,
      hoverinfo: 'skip',
    });
    return traces;
  }, [data, series, seasonal, palette, monthNames, darkMode, t]);

  // The averaged months belong to no year in particular: only the spiral is clickable.
  const handleClick = (event) => {
    const point = event.points?.[0];
    if (seasonal || !point?.customdata || !onPointClick) return;
    onPointClick({ points: [{ ...point, x: point.customdata }] });
  };

  useRenderAfterMount(monthly);

  if (!monthly) {
    return <div className="plot-component" style={{ padding: '2rem' }}>{t('Polar needs months')}</div>;
  }

  const theme = plotlyThemeFor(darkMode);
  const gridcolor = darkMode ? '#0f3460' : '#dddddd';

  return (
    <div>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, paddingLeft: 2 }}>
        <FormControlLabel
          control={<Switch checked={seasonal} onChange={e => setSeasonal(e.target.checked)} />}
          label={t('Average by month')}
        />
        <FormControlLabel
          control={<Switch checked={removeTrend} onChange={e => setRemoveTrend(e.target.checked)} />}
          label={t('Remove the trend')}
        />
      </Box>
      <Plot
        divId={FIGURE_DIV_ID}
        data={traces}
        layout={{
          autosize: true,
          margin: { t: 40 },
          paper_bgcolor: theme.paper_bgcolor,
          font: theme.font,
          showlegend: true,
          // In the spiral, the colour scale of the years takes the right-hand side.
          legend: seasonal
            ? { font: { size: 16 } }
            : { font: { size: 16 }, orientation: 'h', x: 0.5, xanchor: 'center', y: -0.05, yanchor: 'top' },
          polar: {
            bgcolor: theme.plot_bgcolor,
            angularaxis: {
              direction: 'clockwise',
              rotation: 90,
              tickmode: 'array',
              tickvals: monthNames.map((_, m) => m * 30),
              ticktext: monthNames,
              tickfont: { size: 14 },
              gridcolor,
              linecolor: gridcolor,
            },
            radialaxis: { tickfont: { size: 11 }, gridcolor, linecolor: gridcolor, exponentformat: 'e' },
          },
          // The switches change the scale of the radius: they rescale it, like new data.
          uirevision: `${revisionOf(data)}-${seasonal}-${removeTrend}`,
        }}
        config={{ displayModeBar: true, scrollZoom: false }}
        useResizeHandler={true}
        onClick={handleClick}
        className="plot-component"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default React.memo(PolarComponent);
