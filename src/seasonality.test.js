import { toMonthly, detrend, seasonalProfile } from './seasonality';

const months = (year, count) => Array.from({ length: count }, (_, m) => new Date(Date.UTC(year + Math.floor(m / 12), m % 12)));

describe('toMonthly', () => {
  test('adds up the days of a month before dividing', () => {
    const x = [Date.UTC(1900, 0, 1), Date.UTC(1900, 0, 2), Date.UTC(1900, 1, 1)].map(t => new Date(t));
    const monthly = toMonthly({ x, y: [0.5, 0, 0.1], n: [1, 0, 1], total: [2, 8, 10] });
    expect(monthly.x.map(d => d.getUTCMonth())).toEqual([0, 1]);
    expect(monthly.y).toEqual([0.1, 0.1]);
    expect(monthly.n).toEqual([1, 1]);
  });

  test('averages a series without counts', () => {
    const x = [Date.UTC(1900, 0, 1), Date.UTC(1900, 0, 8)].map(t => new Date(t));
    expect(toMonthly({ x, y: [1, 3] }).y).toEqual([2]);
  });

  test('a month without data stays empty', () => {
    const x = months(1900, 2);
    expect(toMonthly({ x, y: [null, 0.2], n: [null, 2], total: [null, 10] }).y).toEqual([null, 0.2]);
  });
});

describe('detrend', () => {
  test('a steady frequency leaves nothing', () => {
    const x = months(1900, 24);
    const monthly = { x, y: x.map(() => 0.1), n: x.map(() => 1), total: x.map(() => 10) };
    detrend(monthly).y.forEach(v => expect(Math.abs(v)).toBeLessThan(1e-12));
  });

  test('keeps a summer peak above the trend', () => {
    const x = months(1900, 36);
    const n = x.map(d => (d.getUTCMonth() === 6 ? 13 : 1));
    const monthly = { x, y: n.map(v => v / 100), n, total: x.map(() => 100) };
    const y = detrend(monthly).y;
    expect(y[18]).toBeGreaterThan(0); // July 1901
    expect(y[12]).toBeLessThan(0); // January 1901
  });
});

describe('seasonalProfile', () => {
  test('averages each calendar month across years', () => {
    const x = months(1900, 24);
    const profile = seasonalProfile({ x, y: x.map(d => d.getUTCFullYear() - 1900 + d.getUTCMonth()) });
    expect(profile).toHaveLength(12);
    expect(profile[0]).toBe(0.5);
    expect(profile[11]).toBe(11.5);
  });
});
