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
    return series.map((monthlySeries, index) => {
      const trace = data[index];
      const color = palette[index % palette.length];
      if (seasonal) {
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
          name: trace.name,
        };
      }
      const first = monthlySeries.x.length > 0 ? monthlySeries.x[0].getUTCFullYear() : 0;
      return {
        type: 'scatterpolar',
        mode: 'lines',
        r: monthlySeries.y,
        theta: monthlySeries.x.map(d => (d.getUTCFullYear() - first) * 360 + d.getUTCMonth() * 30),
        text: monthlySeries.x.map(d => `${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`),
        hovertemplate: '%{text}: %{r:.3~g}',
        line: { shape: 'spline', color, width: 1.5 },
        name: trace.name,
        customdata: monthlySeries.x.map(toPlotlyDate),
        // The context of a point is that of its month, whatever resolution was fetched.
        meta: { ...trace.meta, resolution: 'mois' },
      };
    });
  }, [data, series, seasonal, palette, monthNames]);

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
          title: { text: removeTrend ? t('Seasonality (gap to the trend)') : t('Seasonality') },
          paper_bgcolor: theme.paper_bgcolor,
          font: theme.font,
          showlegend: true,
          legend: { font: { size: 16 } },
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
