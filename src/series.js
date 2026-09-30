// Adds several series together, matching rows on their date (year, and month and day
// when the resolution has them). Both the occurrences and the corpus size have to be
// summed, so that the frequency of the whole is (n1 + n2) / (total1 + total2) — unlike
// the multi-word combiner downstream, where every word shares a single denominator.
export const sumSeries = (seriesList) => {
  const byDate = new Map();
  seriesList.forEach(rows => {
    (rows || []).forEach(row => {
      const year = row.annee ?? row.date ?? row.year;
      if (year === null || year === undefined || Number.isNaN(Number(year))) return;
      const key = `${year}-${row.mois ?? ''}-${row.jour ?? ''}`;
      const acc = byDate.get(key);
      if (acc) {
        acc.n += Number(row.n) || 0;
        acc.total += Number(row.total) || 0;
      } else {
        byDate.set(key, { ...row, annee: year, n: Number(row.n) || 0, total: Number(row.total) || 0 });
      }
    });
  });
  return [...byDate.values()].sort((a, b) =>
    (a.annee - b.annee) || ((a.mois ?? 0) - (b.mois ?? 0)) || ((a.jour ?? 0) - (b.jour ?? 0)));
};
