import fetch from 'node-fetch';
import Papa from 'papaparse';

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

// Lissage simple (moyenne mobile)
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

// Récupération des données Gallicagram
async function fetchData(mot, corpus, from_year, to_year) {
    const params = new URLSearchParams({
        mot,
        corpus,
        resolution: 'annee'
    });
    if (from_year) params.append('from', from_year);
    if (to_year) params.append('to', to_year);

    const response = await fetch(`https://shiny.ens-paris-saclay.fr/guni/query?${params}`);
    if (!response.ok) throw new Error('Erreur API Gallicagram');

    const text = await response.text();
    if (!text || !text.trim()) return [];

    // Parse CSV robustement avec PapaParse
    // transformation des headers en minuscules et trim pour uniformiser ('annee','n','total')
    const parsed = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: h => (h || '').toString().trim().toLowerCase()
    });

    // Si parse produit une seule colonne (mauvais séparateur), retenter avec ';'
    if (parsed.data.length > 0 && Object.keys(parsed.data[0]).length === 1) {
        const reparsed = Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            delimiter: ';',
            transformHeader: h => (h || '').toString().trim().toLowerCase()
        });
        // si reparsed donne mieux, on l'utilise
        if (reparsed.data.length > 0 && Object.keys(reparsed.data[0]).length > 1) {
            parsed.data = reparsed.data;
        }
    }

    // Map rows en objets { annee, n, total } en tolérant noms de colonnes variés
    const rows = parsed.data.map(row => {
        // row keys are already lowercased and trimmed
        const keys = Object.keys(row || {});
        const get = keyCandidates => {
            for (const k of keyCandidates) {
                if (k in row && row[k] !== null && row[k] !== undefined && row[k] !== '') return row[k];
            }
            return undefined;
        };

        const anneeRaw = get(['annee', 'year', 'annee ']);
        const nRaw = get(['n', 'count', 'nombre']);
        const totalRaw = get(['total', 'tot', 'sum']);

        const annee = anneeRaw !== undefined ? parseInt(anneeRaw, 10) : NaN;
        const n = nRaw !== undefined ? parseFloat(String(nRaw).replace(',', '.')) : 0;
        const total = totalRaw !== undefined ? parseFloat(String(totalRaw).replace(',', '.')) : 0;

        return {
            annee: isNaN(annee) ? null : annee,
            n: isNaN(n) ? 0 : n,
            total: isNaN(total) ? 0 : total
        };
    });

    // Filtrer : supprimer lignes sans année ou total <= 0
    return rows
        .filter(r => r.annee !== null && Number.isFinite(r.total) && r.total > 0)
        .sort((a, b) => a.annee - b.annee);
}

// ⭐ Nouveau renderer QuickChart (remplace chartjs-node-canvas)
async function renderChart(configuration, width = 1000, height = 500) {
    const encoded = encodeURIComponent(JSON.stringify(configuration));
    const url = `https://quickchart.io/chart?c=${encoded}&width=${width}&height=${height}&format=png`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Erreur génération graphique');

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
}

// Génération du graphique
export async function generateChart(mots, corpus, from_year, to_year, smooth) {
    const width = 1000;
    const height = 500;

    const datasets = [];
    const colors = [
        '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
        '#ffff33', '#a65628', '#f781bf', '#999999', '#66c2a5'
    ];

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        try {
            const data = await fetchData(mot, corpus, from_year, to_year);
            if (data.length === 0) continue;

            const years = data.map(d => d.annee);
            let frequencies = data.map(d => d.n / d.total);

            if (smooth && frequencies.length > 3) {
                frequencies = movingAverage(frequencies, 11);
            }

            datasets.push({
                label: mot,
                data: years.map((year, idx) => ({ x: year, y: frequencies[idx] })),
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '33',
                borderWidth: 2.5,
                pointRadius: 2,
                pointHoverRadius: 4,
                fill: false,
                tension: smooth ? 0.3 : 0
            });
        } catch (err) {
            console.error(`Erreur pour "${mot}":`, err);
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
                    position: 'top'
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: { display: false }
                },
                y: {
                    title: { display: true, text: 'Fréquence relative' },
                    ticks: { display: false },
                    grid: { color: '#e0e0e0' }
                }
            }
        }
    };

    return await renderChart(configuration, width, height);
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
