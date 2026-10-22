// Monthly series for the polar chart, as Gallicagram's Shiny app drew its "Polaires" view:
// each month is an angle, so a word's seasonality shows as a loop pushed towards the months
// where it is used most.

const has = v => v !== null && v !== undefined && !Number.isNaN(v);

// Rolls a trace up to one point per month. Daily and weekly series add up their counts and
// corpus sizes, so a month's frequency stays occurrences / words printed that month; a
// series without counts (a difference, a ratio) averages its values instead.
export const toMonthly = (trace) => {
  const withCounts = Array.isArray(trace.n) && Array.isArray(trace.total);
  const byMonth = new Map();
  (trace.x || []).forEach((d, i) => {
    const date = new Date(d);
    const key = Date.UTC(date.getUTCFullYear(), date.getUTCMonth());
    const acc = byMonth.get(key) || { n: 0, total: 0, sum: 0, count: 0 };
    if (withCounts && has(trace.n[i]) && trace.total[i] > 0) {
      acc.n += trace.n[i];
      acc.total += trace.total[i];
    } else if (!withCounts && has(trace.y[i])) {
      acc.sum += trace.y[i];
      acc.count += 1;
    }
    byMonth.set(key, acc);
  });
  const keys = [...byMonth.keys()].sort((a, b) => a - b);
  return {
    x: keys.map(k => new Date(k)),
    y: keys.map(k => {
      const acc = byMonth.get(k);
      if (withCounts) return acc.total > 0 ? acc.n / acc.total : null;
      return acc.count > 0 ? acc.sum / acc.count : null;
    }),
    n: withCounts ? keys.map(k => byMonth.get(k).n) : undefined,
    total: withCounts ? keys.map(k => byMonth.get(k).total) : undefined,
  };
};

// Takes out the long-run trend, so that what is left is the seasonal swing: from each month
// is subtracted the frequency over the 13 months centred on it (counts and corpus sizes
// summed over the window, as the Shiny app weighted its moving average by the corpus size).
export const detrend = (monthly) => {
  const half = 6;
  return {
    ...monthly,
    y: monthly.y.map((v, i) => {
      if (!has(v)) return null;
      let n = 0, total = 0, sum = 0, count = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(monthly.y.length - 1, i + half); j++) {
        if (!has(monthly.y[j])) continue;
        if (monthly.n && monthly.total) {
          n += monthly.n[j];
          total += monthly.total[j];
        } else {
          sum += monthly.y[j];
          count += 1;
        }
      }
      const trend = monthly.n && monthly.total ? (total > 0 ? n / total : null) : sum / count;
      return has(trend) ? v - trend : null;
    }),
  };
};

// The average of each calendar month over all years: twelve values, January first, null for
// a month that never has data.
export const seasonalProfile = (monthly) => {
  const sums = Array(12).fill(0);
  const counts = Array(12).fill(0);
  monthly.x.forEach((d, i) => {
    const v = monthly.y[i];
    if (!has(v)) return;
    const m = new Date(d).getUTCMonth();
    sums[m] += v;
    counts[m] += 1;
  });
  return sums.map((s, m) => (counts[m] > 0 ? s / counts[m] : null));
};
