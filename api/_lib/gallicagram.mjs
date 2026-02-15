// api/_lib/gallicagram.mjs
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

const COLORS = [
    '#E63946', '#457B9D', '#2A9D8F', '#F4A261', '#E76F51',
    '#6A4C93', '#1982C4', '#8AC926', '#FFCA3A', '#FF595E'
];

function movingAverage(data, windowSize = 5) {
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
    const params = new URLSearchParams({ mot, corpus, resolution: 'annee' });
    if (from_year) params.append('from', from_year);
    if (to_year) params.append('to', to_year);

    const response = await fetch(`https://shiny.ens-paris-saclay.fr/guni/query?${params}`);
    if (!response.ok) throw new Error(`Erreur API Gallicagram : ${response.status}`);
    const text = await response.text();
    if (!text.trim()) return [];

    const lines = text.trim().split('\n');
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

    const yearIdx = headers.findIndex(h => ['annee', 'year', 'année'].includes(h));
    const nIdx = headers.findIndex(h => ['n', 'count', 'nombre'].includes(h));
    const totalIdx = headers.findIndex(h => ['total', 'tot', 'sum'].includes(h));

    const csvRows = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        if (parts.length <= Math.max(yearIdx, nIdx, totalIdx)) continue;
        const annee = parseInt(parts[yearIdx]);
        const n = parseFloat(parts[nIdx]) || 0;
        const total = parseFloat(parts[totalIdx]);
        if (!isNaN(annee) && total > 0) {
            csvRows.push({ annee, frequency: n / total });
        }
    }

    // Tri et complétion des années manquantes
    csvRows.sort((a, b) => a.annee - b.annee);
    if (csvRows.length === 0) return [];

    const minYear = from_year || csvRows[0].annee;
    const maxYear = to_year || csvRows[csvRows.length - 1].annee;
    const dataMap = new Map(csvRows.map(r => [r.annee, r.frequency]));
    
    const completeData = [];
    for (let y = minYear; y <= maxYear; y++) {
        completeData.push({ annee: y, frequency: dataMap.get(y) || 0 });
    }
    return completeData;
}

export async function generateChart(mots, corpus, from_year, to_year, smooth = true) {
    const allDatasets = [];

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const data = await fetchData(mot, corpus, from_year, to_year);
        if (data.length === 0) continue;

        const color = COLORS[i % COLORS.length];
        const rawFrequencies = data.map(d => d.frequency * 1e6); // ppm (parts per million)

        // 1. DATASET LIGNE (Tendance lissée)
        let lineFrequencies = [...rawFrequencies];
        if (smooth && lineFrequencies.length > 5) {
            lineFrequencies = movingAverage(lineFrequencies, 5);
        }

        allDatasets.push({
            label: mot,
            data: data.map((d, idx) => ({ x: d.annee, y: parseFloat(lineFrequencies[idx].toFixed(4)) })),
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 0,
            fill: false,
            tension: smooth ? 0.4 : 0,
            showLine: true
        });

        // 2. DATASET POINTS (Données brutes - masqué de la légende)
        allDatasets.push({
            label: `__hidden__${mot}_pts`,
            data: data.map((d, idx) => ({ x: d.annee, y: parseFloat(rawFrequencies[idx].toFixed(4)) })),
            borderColor: 'transparent',
            backgroundColor: color + '66', // semi-transparent
            pointRadius: 3,
            pointBackgroundColor: color,
            showLine: false,
            fill: false
        });
    }

    if (allDatasets.length === 0) throw new Error('Aucune donnée trouvée');

    const configuration = {
        type: 'line',
        data: { datasets: allDatasets },
        options: {
            title: {
                display: true,
                text: `Gallicagram : ${CORPUS_LABELS[corpus] || corpus}`,
                fontSize: 18,
                fontStyle: 'bold'
            },
            legend: {
                position: 'bottom',
                labels: {
                    // Filtre pour ne pas afficher les datasets de points dans la légende
                    filter: (item) => !item.text.startsWith('__hidden__'),
                    usePointStyle: true,
                    padding: 20
                }
            },
            scales: {
                xAxes: [{
                    type: 'linear',
                    position: 'bottom',
                    scaleLabel: { display: true, labelString: 'Année' },
                    gridLines: { display: false },
                    ticks: { callback: (val) => val.toString() }
                }],
                yAxes: [{
                    scaleLabel: { display: true, labelString: 'Fréquence (ppm)' },
                    ticks: { beginAtZero: true }
                }]
            }
        }
    };

    const encoded = encodeURIComponent(JSON.stringify(configuration));
    const url = `https://quickchart.io/chart?c=${encoded}&width=1000&height=500&backgroundColor=white&version=2.9.4`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erreur QuickChart');

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
}

export function generateAnalysisPrompt(mots, corpus, from, to) {
    return `Agis en tant qu'historien expert. Analyse l'évolution de la fréquence de "${mots.join(', ')}" dans le corpus "${CORPUS_LABELS[corpus] || corpus}" entre ${from || 'le début'} et ${to || 'la fin'}. 
    
Sur le graphique, les points représentent les données annuelles brutes et la ligne représente la tendance lissée. 
Identifie les événements historiques, culturels ou sociaux qui pourraient expliquer les pics ou les déclins observés.`;
}