// api/_lib/gallicagram.mjs
import fetch from 'node-fetch';

export const CORPUS_LABELS = {
  lemonde: "Le Monde (1944-2023)",
  presse: "Presse Gallica (1789-1950)",
  livres: "Livres Gallica (1600-1940)",
  persee: "Persée (1789-2023)",
  ddb: "Deutsches Zeitungsportal (1780-1950)",
  american_stories: "American Stories (1798-1963)",
  paris: "Journal de Paris (1777-1827)",
  moniteur: "Moniteur Universel (1789-1869)",
  journal_des_debats: "Journal des Débats (1789-1944)",
  la_presse: "La Presse (1836-1869)",
  constitutionnel: "Le Constitutionnel (1821-1913)",
  figaro: "Le Figaro (1854-1952)",
  temps: "Le Temps (1861-1942)",
  petit_journal: "Le Petit Journal (1863-1942)",
  petit_parisien: "Le Petit Parisien (1876-1944)",
  huma: "L'Humanité (1904-1952)",
  subtitles: "Sous-titres de films (FR) (1935-2020)",
  subtitles_en: "Subtitles de films (EN) (1930-2020)",
  rap: "Rap (Genius) (1989-2024)"
};

function movingAverage(data, windowSize = 3) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
    const sum = data.slice(start, end).reduce((a, b) => a + b, 0);
    result.push(sum / (end - start));
  }
  return result;
}

async function fetchData(mot, corpus, from_year, to_year) {
  const params = new URLSearchParams({
    mot,
    corpus,
    resolution: 'annee'
  });
  if (from_year) params.append('from', from_year);
  if (to_year) params.append('to', to_year);

  const response = await fetch(`https://shiny.ens-paris-saclay.fr/guni/query?${params}`);
  if (!response.ok) throw new Error(`Erreur API Gallicagram : ${response.status}`);
  const text = await response.text();
  if (!text.trim()) return [];

  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

  const yearIdx = headers.findIndex(h => ['annee', 'year'].includes(h));
  const nIdx = headers.findIndex(h => ['n', 'count', 'nombre'].includes(h));
  const totalIdx = headers.findIndex(h => ['total', 'tot', 'sum'].includes(h));

  const csvRows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter);
    const annee = parseInt(parts[yearIdx], 10);
    const n = parseInt(parts[nIdx], 10) || 0;
    const total = parseInt(parts[totalIdx], 10);
    if (!annee || !total) continue;

    csvRows.push({ annee, frequency: n / total });
  }

  const dataMap = new Map(csvRows.map(r => [r.annee, r]));
  const minYear = from_year || Math.min(...csvRows.map(r => r.annee));
  const maxYear = to_year || Math.max(...csvRows.map(r => r.annee));

  const complete = [];
  for (let y = minYear; y <= maxYear; y++) {
    complete.push(dataMap.get(y) || { annee: y, frequency: 0 });
  }
  return complete;
}

export async function generateChart(mots, corpus, from_year, to_year, smooth) {
  const datasets = [];
  const colors = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd'];

  for (let i = 0; i < mots.length; i++) {
    const data = await fetchData(mots[i], corpus, from_year, to_year);
    const years = data.map(d => d.annee);

    // ✅ Conversion en fréquence par milliard
    let frequencies = data.map(d => d.frequency * 1e9);

    if (smooth && frequencies.length > 5) {
      frequencies = movingAverage(frequencies, 3);
    }
    
    frequencies = frequencies.toFixed(2);

    datasets.push({
      label: mots[i],
      data: years.map((x, idx) => ({ x, y: frequencies[idx] })),
      borderColor: colors[i % colors.length],
      borderWidth: 2,
      pointRadius: 0,
      tension: smooth ? 0.2 : 0,
      fill: false
    });
  }

  const config = {
    type: 'line',
    data: { datasets },
    options: {
      plugins: {
        title: {
          display: true,
          text: CORPUS_LABELS[corpus] || corpus,
          align: 'end',
          font: { size: 11, style: 'italic' }
        },
        legend: { display: true }
      },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12,
            callback: v => Math.round(v)
          },
          grid: { display: false } // ❌ pas de lignes verticales
        },
        y: {
          title: { display: true, text: 'Occurrences par milliard de mots' },
          beginAtZero: true,
          grace: '5%',
          ticks: { precision: 0 },
          grid: { display: false } // ❌ pas de lignes horizontales
        }
      },
      elements: {
        line: { borderJoinStyle: 'round' }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  const url = `https://quickchart.io/chart?c=${encoded}&backgroundColor=white&format=png`;

  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString('base64');
}
