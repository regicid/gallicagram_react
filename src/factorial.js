// Principal component analysis (ACP) and correspondence analysis (AFC) of a dates × words
// table, as Gallicagram's Shiny app drew them with FactoMineR. Dates are the individuals
// (rows), the series are the variables (columns). The tables are small (a few series), so
// the decompositions are done on the columns' p × p matrix with a Jacobi eigensolver.

// Eigenvalues (descending) and unit eigenvectors (as columns) of a symmetric matrix.
export const symmetricEigen = (matrix) => {
  const p = matrix.length;
  const a = matrix.map(row => [...row]);
  const v = a.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) off += a[i][j] * a[i][j];
    if (off < 1e-22) break;
    for (let i = 0; i < p; i++) {
      for (let j = i + 1; j < p; j++) {
        if (Math.abs(a[i][j]) < 1e-300) continue;
        const theta = (a[j][j] - a[i][i]) / (2 * a[i][j]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < p; k++) {
          const aki = a[k][i], akj = a[k][j];
          a[k][i] = c * aki - s * akj;
          a[k][j] = s * aki + c * akj;
        }
        for (let k = 0; k < p; k++) {
          const aik = a[i][k], ajk = a[j][k];
          a[i][k] = c * aik - s * ajk;
          a[j][k] = s * aik + c * ajk;
        }
        for (let k = 0; k < p; k++) {
          const vki = v[k][i], vkj = v[k][j];
          v[k][i] = c * vki - s * vkj;
          v[k][j] = s * vki + c * vkj;
        }
      }
    }
  }
  const order = a.map((_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  const values = order.map(i => Math.max(0, a[i][i]));
  // Orient each axis so its largest loading is positive: the sign is arbitrary, and this
  // keeps the picture from flipping between two runs on nearly the same data.
  const vectors = order.map(i => {
    const col = v.map(row => row[i]);
    const big = col.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
    return big < 0 ? col.map(x => -x) : col;
  });
  return { values, vectors };
};

const percentages = (values) => {
  const sum = values.reduce((s, x) => s + x, 0);
  return values.map(x => (sum > 0 ? (100 * x) / sum : 0));
};

// Normed PCA (FactoMineR's PCA(scale.unit = TRUE)): columns centred and divided by their
// population standard deviation. A constant column carries no information and stays at 0.
// Returns the rows' coordinates, the columns' coordinates (their correlations with the
// axes) and the share of variance of each axis.
export const pca = (table) => {
  const n = table.length;
  const p = table[0].length;
  const means = Array.from({ length: p }, (_, j) => table.reduce((s, row) => s + row[j], 0) / n);
  const sds = means.map((m, j) => Math.sqrt(table.reduce((s, row) => s + (row[j] - m) ** 2, 0) / n));
  const z = table.map(row => row.map((x, j) => (sds[j] > 0 ? (x - means[j]) / sds[j] : 0)));
  const corr = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => z.reduce((s, row) => s + row[i] * row[j], 0) / n));
  const { values, vectors } = symmetricEigen(corr);
  const dims = Math.min(p, n - 1);
  return {
    rows: z.map(row => vectors.slice(0, dims).map(u => u.reduce((s, x, j) => s + x * row[j], 0))),
    columns: Array.from({ length: p }, (_, j) => vectors.slice(0, dims).map((u, k) => u[j] * Math.sqrt(values[k]))),
    explained: percentages(values).slice(0, dims),
  };
};

// Correspondence analysis of a contingency table (FactoMineR's CA): rows and columns in
// principal coordinates, for a symmetric biplot. Rows or columns without any count are
// left out by the caller.
export const ca = (table) => {
  const n = table.length;
  const p = table[0].length;
  const grand = table.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  const r = table.map(row => row.reduce((a, b) => a + b, 0) / grand);
  const c = Array.from({ length: p }, (_, j) => table.reduce((s, row) => s + row[j], 0) / grand);
  // Standardised residuals: (p_ij - r_i c_j) / sqrt(r_i c_j).
  const s = table.map((row, i) => row.map((x, j) => (x / grand - r[i] * c[j]) / Math.sqrt(r[i] * c[j])));
  const sts = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => s.reduce((acc, row) => acc + row[i] * row[j], 0)));
  const { values, vectors } = symmetricEigen(sts);
  // The trivial axis is already removed by centring, which leaves min(n, p) - 1 axes.
  const dims = Math.min(n, p) - 1;
  const axes = vectors.slice(0, dims);
  return {
    rows: s.map((row, i) => axes.map(u => u.reduce((acc, x, j) => acc + x * row[j], 0) / Math.sqrt(r[i]))),
    columns: Array.from({ length: p }, (_, j) => axes.map((u, k) => (u[j] * Math.sqrt(values[k])) / Math.sqrt(c[j]))),
    explained: percentages(values.slice(0, dims)),
  };
};

// The dates × series table behind both analyses, built from the plot's traces. A date is
// kept only where every series has a value: like the Shiny app, which went through
// spread(), an analysis can't place a date with a missing word. The PCA reads frequencies,
// the AFC raw counts (a correspondence analysis is defined on counts; series computed
// without them, like a difference, fall back to their values).
export const buildTable = (traces, useCounts) => {
  const columns = traces.map(trace => {
    const values = useCounts && Array.isArray(trace.n) ? trace.n : trace.y;
    const byDate = new Map();
    (trace.x || []).forEach((d, i) => {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) return;
      byDate.set(new Date(d).getTime(), v);
    });
    return byDate;
  });
  const dates = [...columns[0].keys()]
    .filter(t => columns.every(col => col.has(t)))
    .sort((a, b) => a - b);
  return {
    dates: dates.map(t => new Date(t)),
    table: dates.map(t => columns.map(col => col.get(t))),
  };
};

// The Bézier curve with the points as control points, sampled at `samples` positions: the
// smooth trajectory the Shiny app drew through the dates (bezier::bezier, degree n - 1). It
// starts and ends on the first and last dates and in between follows their drift, without
// the year-to-year back and forth. The Bernstein weights are computed in log space, which
// stays exact for the hundreds of control points of a monthly series.
export const bezierCurve = (points, samples = 200) => {
  const n = points.length - 1;
  if (n < 1) return points.map(p => [...p]);
  const logFactorial = [0];
  for (let i = 1; i <= n; i++) logFactorial.push(logFactorial[i - 1] + Math.log(i));
  return Array.from({ length: samples }, (_, s) => {
    const t = s / (samples - 1);
    if (t === 0) return [...points[0]];
    if (t === 1) return [...points[n]];
    const lt = Math.log(t), lu = Math.log(1 - t);
    const curve = points[0].map(() => 0);
    points.forEach((p, i) => {
      const w = Math.exp(logFactorial[n] - logFactorial[i] - logFactorial[n - i] + i * lt + (n - i) * lu);
      p.forEach((x, k) => { curve[k] += w * x; });
    });
    return curve;
  });
};
