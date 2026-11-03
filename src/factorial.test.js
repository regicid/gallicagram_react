import { symmetricEigen, pca, ca, buildTable, buildCorpusTable, varimax, bezierCurve } from './factorial';

const close = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('symmetricEigen', () => {
  test('finds A v = λ v, eigenvalues in decreasing order', () => {
    const m = [[4, 1, 2], [1, 3, 0.5], [2, 0.5, 5]];
    const { values, vectors } = symmetricEigen(m);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    expect(values[1]).toBeGreaterThanOrEqual(values[2]);
    values.forEach((lambda, k) => {
      const v = vectors[k];
      m.forEach((row, i) => close(row.reduce((s, x, j) => s + x * v[j], 0), lambda * v[i]));
      close(v.reduce((s, x) => s + x * x, 0), 1);
    });
    close(values.reduce((a, b) => a + b, 0), 12);
  });
});

describe('pca', () => {
  test('two perfectly correlated series share a single axis', () => {
    const { explained, columns, rows } = pca([[1, 10], [2, 20], [3, 30], [4, 40]]);
    close(explained[0], 100);
    close(columns[0][0], 1);
    close(columns[1][0], 1);
    // Rows lie along the first axis, ordered like the data.
    expect(rows.map(r => r[0])).toEqual([...rows.map(r => r[0])].sort((a, b) => a - b));
    rows.forEach(r => close(r[1], 0));
  });

  test('variances of the row coordinates are the eigenvalues', () => {
    const table = [[1, 5, 2], [3, 1, 4], [2, 2, 2], [5, 0, 1], [4, 3, 3]];
    const { rows, explained } = pca(table);
    const variances = [0, 1, 2].map(k => rows.reduce((s, r) => s + (r[k] || 0) ** 2, 0) / rows.length);
    const total = variances.reduce((a, b) => a + b, 0);
    close(total, 3); // three standardised variables
    variances.forEach((v, k) => close((100 * v) / total, explained[k], 1e-6));
  });

  test('a constant series does not break the analysis', () => {
    const { rows } = pca([[1, 7, 2], [2, 7, 1], [3, 7, 5]]);
    rows.flat().forEach(x => expect(Number.isFinite(x)).toBe(true));
  });
});

describe('ca', () => {
  const table = [[20, 5, 10], [10, 15, 5], [5, 10, 25], [8, 8, 8]];

  test('total inertia is the chi-square over the grand total', () => {
    const grand = table.flat().reduce((a, b) => a + b, 0);
    const r = table.map(row => row.reduce((a, b) => a + b, 0));
    const c = [0, 1, 2].map(j => table.reduce((s, row) => s + row[j], 0));
    let chi2 = 0;
    table.forEach((row, i) => row.forEach((x, j) => {
      const e = (r[i] * c[j]) / grand;
      chi2 += (x - e) ** 2 / e;
    }));
    const { rows } = ca(table);
    const inertia = rows.reduce((s, coords, i) => s + (r[i] / grand) * coords.reduce((a, x) => a + x * x, 0), 0);
    close(inertia, chi2 / grand);
  });

  test('row coordinates are centred on the average profile', () => {
    const grand = table.flat().reduce((a, b) => a + b, 0);
    const { rows, columns, explained } = ca(table);
    expect(explained).toHaveLength(2);
    expect(columns).toHaveLength(3);
    [0, 1].forEach(k => close(rows.reduce((s, coords, i) => s + (table[i].reduce((a, b) => a + b, 0) / grand) * coords[k], 0), 0));
  });
});

describe('buildTable', () => {
  const x = [Date.UTC(1900, 0), Date.UTC(1901, 0), Date.UTC(1902, 0)].map(t => new Date(t));

  test('keeps only the dates where every series has a value', () => {
    const { dates, table } = buildTable([
      { x, y: [0.1, null, 0.3], n: [1, 0, 3] },
      { x, y: [0.2, 0.2, 0.4], n: [2, 2, 4] },
    ], false);
    expect(dates.map(d => d.getUTCFullYear())).toEqual([1900, 1902]);
    expect(table).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  test('reads counts for the correspondence analysis', () => {
    const { table } = buildTable([
      { x, y: [0.1, 0.2, 0.3], n: [1, 2, 3] },
      { x, y: [0.4, 0.5, 0.6] },
    ], true);
    expect(table).toEqual([[1, 0.4], [2, 0.5], [3, 0.6]]);
  });
});

describe('bezierCurve', () => {
  test('runs from the first point to the last', () => {
    const curve = bezierCurve([[0, 0], [1, 5], [2, -3], [3, 1]], 50);
    expect(curve).toHaveLength(50);
    expect(curve[0]).toEqual([0, 0]);
    expect(curve[49]).toEqual([3, 1]);
  });

  test('a quadratic curve has its known midpoint', () => {
    const [, mid] = bezierCurve([[0, 0], [1, 2], [2, 0]], 3);
    close(mid[0], 1);
    close(mid[1], 1);
  });

  test('stays finite with hundreds of control points', () => {
    const points = Array.from({ length: 1200 }, (_, i) => [Math.cos(i), Math.sin(i)]);
    bezierCurve(points).flat().forEach(x => expect(Number.isFinite(x)).toBe(true));
  });
});

describe('buildCorpusTable', () => {
  const trace = (word, corpus, years, n, total) => ({
    x: years.map(y => new Date(Date.UTC(y, 0))),
    n,
    total,
    meta: { word, corpus },
  });

  test('sums each word over the years every corpus covers', () => {
    const traces = [
      trace('a', 'A', [1900, 1901, 1902], [1, 2, 100], [10, 10, 10]),
      trace('b', 'A', [1900, 1901, 1902], [3, 4, 100], [10, 10, 10]),
      trace('a', 'B', [1899, 1900, 1901], [100, 5, 6], [20, 20, 20]),
      trace('b', 'B', [1899, 1900, 1901], [100, 7, 8], [20, 20, 20]),
    ];
    const counts = buildCorpusTable(traces, true);
    expect([counts.from, counts.to]).toEqual([1900, 1901]);
    expect(counts.corpora).toEqual(['A', 'B']);
    expect(counts.words).toEqual(['a', 'b']);
    expect(counts.table).toEqual([[3, 7], [11, 15]]);
    const freqs = buildCorpusTable(traces, false);
    close(freqs.table[0][0], 3 / 20);
    close(freqs.table[1][1], 15 / 40);
  });

  test('leaves out a corpus missing one of the words', () => {
    const traces = [
      trace('a', 'A', [1900], [1], [10]),
      trace('b', 'A', [1900], [2], [10]),
      trace('a', 'B', [1900], [3], [10]),
    ];
    expect(buildCorpusTable(traces, true).corpora).toEqual(['A']);
  });
});

describe('varimax', () => {
  // Kaiser's criterion on the normalised loadings: the variance of their squares.
  const criterion = (columns) => [0, 1].reduce((sum, k) => {
    const sq = columns.map(([x, y]) => [x, y][k] ** 2 / (x * x + y * y));
    const mean = sq.reduce((a, b) => a + b, 0) / sq.length;
    return sum + sq.reduce((a, b) => a + (b - mean) ** 2, 0);
  }, 0);
  const turn = (phi) => ([x, y]) => [x * Math.cos(phi) + y * Math.sin(phi), -x * Math.sin(phi) + y * Math.cos(phi)];
  const table = [[10, 2, 5, 1], [8, 3, 6, 2], [2, 9, 1, 7], [1, 10, 2, 8], [5, 5, 9, 4], [3, 4, 2, 9]];

  test.each([['pca', pca], ['ca', ca]])('%s: no other angle scores higher, and nothing but the frame moves', (_, analyse) => {
    const result = analyse(table);
    const rotated = varimax(result);
    const best = criterion(rotated.columns);
    for (let i = 0; i < 360; i++) {
      expect(criterion(result.columns.map(turn((i * Math.PI) / 180)))).toBeLessThanOrEqual(best + 1e-9);
    }
    // A rotation: distances between rows and words are kept.
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    result.rows.forEach((r, i) => result.columns.forEach((c, j) =>
      close(dist(r, c), dist(rotated.rows[i], rotated.columns[j]))));
    close(rotated.explained[0] + rotated.explained[1], result.explained[0] + result.explained[1]);
    expect(rotated.explained[0]).toBeGreaterThanOrEqual(rotated.explained[1]);
    expect(rotated.explained.slice(2)).toEqual(result.explained.slice(2));
  });
});
