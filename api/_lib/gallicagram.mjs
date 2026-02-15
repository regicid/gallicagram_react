// api/_lib/gallicagram.mjs (version qui comble TOUTES les années manquantes avec fréquence=0)

import fetch from 'node-fetch';

export const CORPUS_LABELS = {
  "lemonde": "Le Monde (1944-2023)",
  "presse": "Presse Gallica (1789-1950)",
  "livres": "Livres Gallica (1600-1940)",
  "persee": "Persée (1789-2023)",
  "ddb": "Deutsches Zeitungsportal (1780-1950)",
  "american_stories": "American Stories (1798-1963)",
  "paris": "Journal de Paris (1777-1827)",
  "moniteur": "Moniteur Universel (1789-1869)",
  "journal_des_debats": "Journal des Débats (1789-1944)",
  "la_presse": "La Presse (1836-1869)",
  "constitutionnel": "Le Constitutionnel (1821-1913)",
  "figaro": "Le Figaro (1854-1952)",
  "temps": "Le Temps (1861-1942)",
  "petit_journal": "Le Petit Journal (1863-1942)",
  "petit_parisien": "Le Petit Parisien (1876-1944)",
  "huma": "L'Humanité (1904-1952)",
  "subtitles": "Sous-titres (FR) (1935-2020)",
  "subtitles_en": "Subtitles (EN) (1930-2020)",
  "rap": "Rap (Genius) (1989-2024)"
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

  // 1. Détection du délimiteur
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';

  // 2. Extraction des noms de colonnes
  const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

  // 3. Indices des colonnes obligatoires
  const yearIdx = headers.findIndex(h => ['annee', 'year'].includes(h));
  const nIdx = headers.findIndex(h => ['n', 'count', 'nombre'].includes(h));
  const totalIdx = headers.findIndex(h => ['total', 'tot', 'sum'].includes(h));

  if (yearIdx === -1 || nIdx === -1 || totalIdx === -1) {
    throw new Error('Colonnes requises (annee, n, total) introuvables dans le CSV');
  }

  // 4. Parser toutes les lignes du CSV
  const csvRows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(delimiter);
    if (parts.length <= Math.max(yearIdx, nIdx, totalIdx)) continue;

    const annee = parseInt(parts[yearIdx].trim(), 10);
    const n = parseInt(parts[nIdx].trim(), 10) || 0;
    const total = parseInt(parts[totalIdx].trim(), 10);

    if (isNaN(annee) || isNaN(total) || total <= 0) continue;

    csvRows.push({
      annee,
      n: n,
      total,
      frequency: n / total
    });
  }

  if (csvRows.length === 0) return [];

  // 5. CRITICAL: Créer un Map pour accès rapide par année
  const dataMap = new Map(csvRows.map(r => [r.annee, r]));

  // 6. Déterminer la plage complète d'années
  const minYear = from_year || Math.min(...csvRows.map(r => r.annee));
  const maxYear = to_year || Math.max(...csvRows.map(r => r.annee));

  // 7. COMBLER TOUTES LES ANNÉES MANQUANTES avec fréquence = 0
  const completeData = [];
  for (let year = minYear; year <= maxYear; year++) {
    if (dataMap.has(year)) {
      // Année présente dans le CSV
      completeData.push(dataMap.get(year));
    } else {
      // Année MANQUANTE dans le CSV → fréquence = 0
      completeData.push({
        annee: year,
        n: 0,
        total: 1, // On met 1 pour éviter division par 0
        frequency: 0
      });
    }
  }

  return completeData;
}

export async function generateChart(mots, corpus, from_year, to_year, smooth) {
  const width = 1000;
  const height = 500;

  const datasets = [];
  const colors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];

  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i].trim();
    try {
      const data = await fetchData(mot, corpus, from_year, to_year);
      if (data.length === 0) continue;

      const years = data.map(d => d.annee);
      let frequencies = data.map(d => d.frequency * 1e9)

      if (smooth && frequencies.length > 5) {
        frequencies = movingAverage(frequencies, 11);
      }

      datasets.push({
        label: mot,
        data: years.map((year, idx) => ({ x: year, y: frequencies[idx] })),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33',
        borderWidth: 2.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: colors[i % colors.length],
        pointBorderColor: 'white',
        pointBorderWidth: 1,
        fill: false,
        tension: smooth ? 0.2 : 0,
        showLine: true,
        spanGaps: false // Important: ne pas sauter les 0
      });
    } catch (err) {
      console.error(`Erreur pour "${mot}":`, err.message);
    }
  }

  if (datasets.length === 0) {
    throw new Error('Aucune donnée disponible pour ces mots');
  }

  const configuration = {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: CORPUS_LABELS[corpus] || corpus,
          align: 'end',
          color: '#666',
          font: { size: 11, style: 'italic' }
        },
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, boxWidth: 6 }
        }
      },
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          title: { display: false }
        },
        y: {
          title: { display: true, text: 'Fréquence relative' },
          ticks: { display: false },
          grid: { color: '#e0e0e0', drawBorder: false },
          beginAtZero: false
        }
      },
      elements: {
        line: { borderJoinStyle: 'round' }
      },
      layout: {
        padding: { top: 20, bottom: 10 }
      }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(configuration));
  const url = `https://quickchart.io/chart?c=${encoded}&width=${width}&height=${height}&format=png&backgroundColor=white`;
  console.log('QuickChart URL:', url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erreur génération graphique QuickChart');

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

export function generateAnalysisPrompt(mots, corpus, from, to) {
  return `Analyse ce graphique de fréquence lexicale.

Instructions :
- Décris les tendances principales visibles sur le graphique
- Identifie les pics historiques significatifs et leur période
- Compare l'évolution des différents mots entre eux
- Propose une interprétation historique ou culturelle des variations observées

Contexte :
- Corpus : ${CORPUS_LABELS[corpus] || corpus}
- Mots analysés : ${mots.join(', ')}
- Période : ${from || 'début'} - ${to || 'fin'}

Note : Les graphiques montrent la fréquence relative (proportion par rapport au total des mots du corpus).`;
}
