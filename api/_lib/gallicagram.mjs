// api/_lib/gallicagram.mjs
import fetch from 'node-fetch';
import 'canvas';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import 'chartjs-adapter-date-fns'; // Requis pour l'axe temporel (mois)

// Initialiser les moteurs de rendu (configurés une seule fois)
const chartCanvas = new ChartJSNodeCanvas({ width: 1000, height: 500, backgroundColour: 'white' });
const chartCanvasTotals = new ChartJSNodeCanvas({ width: 1000, height: 600, backgroundColour: 'white' });

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
    "subtitles": "Sous-titres de films (FR) (1935-2020)",
    "subtitles_en": "Sous-titres de films (EN) (1930-2020)",
    "rap": "Rap (Genius) (1989-2024)"
};

const CORPUS_MIN_RESOLUTION = {
    "lemonde": "jour", "lemonde_rubriques": "jour", "presse": "mois",
    "livres": "annee", "ddb": "mois", "american_stories": "annee",
    "paris": "jour", "moniteur": "jour", "journal_des_debats": "jour",
    "la_presse": "jour", "constitutionnel": "jour", "figaro": "jour",
    "temps": "jour", "petit_journal": "jour", "petit_parisien": "jour",
    "huma": "jour", "subtitles": "annee", "subtitles_en": "annee",
    "rap": "annee"
};

const COLORS = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080',
    '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000075', '#808080', '#000000',
    '#ff6f61', '#6b5b95', '#88b04b', '#f7cac9', '#92a8d1',
    '#955251', '#b565a7', '#009b77', '#dd4124', '#45b8ac'
];

function movingAverage(data, windowSize = 5) {
    if (windowSize <= 1) return [...data];
    const result = [];
    const halfWindow = Math.floor(windowSize / 2);
    for (let i = 0; i < data.length; i++) {
        if (i < halfWindow || i >= data.length - halfWindow) {
            result.push(data[i]);
        } else {
            const start = i - halfWindow;
            const end = i + halfWindow + 1;
            const window = data.slice(start, end);
            const sum = window.reduce((a, b) => a + b, 0);
            result.push(sum / window.length);
        }
    }
    return result;
}

function getOptimalResolution(corpus, from_year, to_year) {
    const minRes = CORPUS_MIN_RESOLUTION[corpus] || "annee";
    if (minRes === "annee") return "annee";
    if (!from_year || !to_year) return "annee";
    const span = to_year - from_year;
    if (span < 10 && (minRes === "jour" || minRes === "mois")) return "mois";
    return "annee";
}

function getOptimalSmoothWindow(dataLength) {
    if (dataLength <= 5) return 1;
    if (dataLength <= 10) return 3;
    if (dataLength <= 30) return 4;
    return 5;
}

function formatDate(annee, mois = null, resolution = "annee") {
    if (resolution === "annee") return annee.toString();
    if (resolution === "mois" && mois) {
        const moisStr = mois.toString().padStart(2, '0');
        return `${annee}-${moisStr}`;
    }
    return annee.toString();
}

function formatDateDisplay(annee, mois = null, resolution = "annee") {
    if (resolution === "annee") return annee.toString();
    if (resolution === "mois" && mois) {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${monthNames[mois - 1]} ${annee}`;
    }
    return annee.toString();
}

async function fetchData(mot, corpus, from_year, to_year, resolution = null) {
    const finalResolution = resolution || getOptimalResolution(corpus, from_year, to_year);
    const params = new URLSearchParams({ mot, corpus, resolution: finalResolution });
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
    const monthIdx = headers.findIndex(h => ['mois', 'month'].includes(h));
    const nIdx = headers.findIndex(h => ['n', 'count', 'nombre'].includes(h));
    const totalIdx = headers.findIndex(h => ['total', 'tot', 'sum'].includes(h));

    const aggregatedData = new Map();

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        if (parts.length <= Math.max(yearIdx, nIdx, totalIdx)) continue;
        
        const annee = parseInt(parts[yearIdx]);
        const mois = monthIdx >= 0 ? parseInt(parts[monthIdx]) : null;
        const n = parseFloat(parts[nIdx]) || 0;
        const total = parseFloat(parts[totalIdx]) || 0;
        
        if (!isNaN(annee) && total > 0) {
            const dateKey = formatDate(annee, mois, finalResolution);
            if (!aggregatedData.has(dateKey)) {
                aggregatedData.set(dateKey, { 
                    annee, mois, n: 0, total: total, date: dateKey,
                    dateDisplay: formatDateDisplay(annee, mois, finalResolution)
                });
            }
            aggregatedData.get(dateKey).n += n;
        }
    }

    const csvRows = Array.from(aggregatedData.values()).map(row => ({
        ...row, frequency: row.n / row.total
    }));

    csvRows.sort((a, b) => {
        if (a.annee !== b.annee) return a.annee - b.annee;
        if (a.mois !== b.mois) return (a.mois || 0) - (b.mois || 0);
        return 0;
    });

    return { data: csvRows, resolution: finalResolution };
}

export async function generateChart(mots, corpus, from_year, to_year, smooth = true) {
    const allDatasets = [];
    let usedResolution = "annee";

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data, resolution } = await fetchData(mot, corpus, from_year, to_year);
        usedResolution = resolution; 
        if (data.length === 0) continue;

        const color = COLORS[i % COLORS.length];
        const rawFrequencies = data.map(d => d.frequency * 1e6);
        const smoothWindow = getOptimalSmoothWindow(data.length);
        let lineFrequencies = [...rawFrequencies];
        
        if (smooth && lineFrequencies.length > smoothWindow) {
            lineFrequencies = movingAverage(lineFrequencies, smoothWindow);
        }

        allDatasets.push({
            label: mot,
            data: data.map((d, idx) => ({ 
                x: usedResolution === "mois" ? d.date : parseInt(d.date),
                y: parseFloat(lineFrequencies[idx].toFixed(4))
            })),
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: smooth ? 0.4 : 0,
            showLine: true,
            spanGaps: false,
            order: 2
        });

        allDatasets.push({
            label: mot + ' (données brutes)',
            data: data.map((d, idx) => ({ 
                x: usedResolution === "mois" ? d.date : parseInt(d.date),
                y: parseFloat(rawFrequencies[idx].toFixed(4))
            })),
            borderColor: 'transparent',
            backgroundColor: color + '80',
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: color,
            pointBorderWidth: 1,
            showLine: false,
            fill: false,
            order: 1
        });
    }

    if (allDatasets.length === 0) throw new Error('Aucune donnée trouvée');

    const configuration = {
        type: 'line',
        data: { datasets: allDatasets },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: `${CORPUS_LABELS[corpus] || corpus}`,
                    font: { size: 18 },
                    color: '#555'
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        // Plus besoin de stringifier ! On met le JS natif :
                        filter: function(item) {
                            return !item.text.includes("(données brutes)");
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            let value = context.parsed.y;
                            if (label.includes('(données brutes)')) {
                                label = label.replace(' (données brutes)', '');
                            }
                            return label + ': ' + value.toFixed(2) + ' ppm';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: usedResolution === "mois" ? 'time' : 'linear',
                    position: 'bottom',
                    grid: { display: true, drawOnChartArea: true, color: '#eee' },
                    ticks: usedResolution !== "mois" ? {
                        callback: function(val) { return Math.round(val).toString(); }
                    } : undefined,
                    time: usedResolution === "mois" ? {
                        parser: 'yyyy-MM', // date-fns format
                        unit: 'month',
                        displayFormats: { month: 'MMM yyyy' },
                        tooltipFormat: 'MMM yyyy'
                    } : undefined
                },
                y: {
                    title: { display: true, text: 'Fréquence en mots\npar million de mots' },
                    beginAtZero: true,
                    grid: { display: false }
                }
            }
        }
    };

    // Génération et retour direct du buffer PNG
    return await chartCanvas.renderToBuffer(configuration);
}

export async function generateHistogram(mots, corpus, from_year, to_year) {
    const datasets = [];
    let usedResolution = "annee";
    let allDataPoints = new Map();

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data, resolution } = await fetchData(mot, corpus, from_year, to_year);
        usedResolution = resolution;
        if (data.length === 0) continue;
        allDataPoints.set(mot, { data: data, color: COLORS[i % COLORS.length] });
    }

    if (allDataPoints.size === 0) throw new Error('Aucune donnée trouvée');

    let minYear = Infinity, maxYear = -Infinity;
    let minMonth = null, maxMonth = null;
    
    for (const [mot, info] of allDataPoints) {
        for (const d of info.data) {
            if (d.annee < minYear) { minYear = d.annee; minMonth = d.mois; }
            if (d.annee > maxYear) { maxYear = d.annee; maxMonth = d.mois; }
        }
    }

    const allLabels = [];
    if (usedResolution === "mois") {
        for (let y = minYear; y <= maxYear; y++) {
            const startMonth = (y === minYear) ? (minMonth || 1) : 1;
            const endMonth = (y === maxYear) ? (maxMonth || 12) : 12;
            for (let m = startMonth; m <= endMonth; m++) {
                allLabels.push(formatDateDisplay(y, m, "mois"));
            }
        }
    } else {
        for (let y = minYear; y <= maxYear; y++) {
            allLabels.push(y.toString());
        }
    }

    for (const [mot, info] of allDataPoints) {
        const dataMap = new Map(info.data.map(d => [d.dateDisplay, d.n]));
        datasets.push({
            label: mot,
            data: allLabels.map(date => dataMap.get(date) || 0),
            backgroundColor: info.color,
            borderColor: info.color,
            borderWidth: 1
        });
    }

    const configuration = {
        type: 'bar',
        data: { labels: allLabels, datasets: datasets },
        options: {
            plugins: {
                title: { display: true, text: `${CORPUS_LABELS[corpus] || corpus}`, font: { size: 18 }, color: '#555' },
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            },
            scales: {
                x: { stacked: false, grid: { display: false }, ticks: { maxTicksLimit: 20, autoSkip: true } },
                y: { stacked: false, title: { display: true, text: 'Nombre d\'occurrences (n)' }, beginAtZero: true }
            }
        }
    };

    return await chartCanvas.renderToBuffer(configuration);
}

export async function generateTotalsChart(mots, corpus, from_year, to_year) {
    const totals = [];

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data } = await fetchData(mot, corpus, from_year, to_year);
        if (data.length === 0) continue;
        const totalOccurrences = data.reduce((sum, d) => sum + d.n, 0);
        totals.push({ mot, total: totalOccurrences, color: COLORS[i % COLORS.length] });
    }

    if (totals.length === 0) throw new Error('Aucune donnée trouvée');
    totals.sort((a, b) => b.total - a.total);

    const configuration = {
        type: 'bar', // En Chart.js v4, 'horizontalBar' n'existe plus...
        data: {
            labels: totals.map(t => t.mot),
            datasets: [{
                label: 'Occurrences totales',
                data: totals.map(t => t.total),
                backgroundColor: totals.map(t => t.color),
                borderColor: totals.map(t => t.color),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // ...c'est ceci qui rend le graphique horizontal
            plugins: {
                title: { display: true, text: `${CORPUS_LABELS[corpus] || corpus}`, font: { size: 18 }, color: '#555' },
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: 'Nombre total d\'occurrences' }, beginAtZero: true },
                y: { grid: { display: false } }
            }
        }
    };

    return await chartCanvasTotals.renderToBuffer(configuration);
}

export function generateAnalysisPrompt(mots, corpus, from, to) {
    return `Agis en tant qu'historien expert. Analyse l'évolution de la fréquence de "${mots.join(', ')}" dans le corpus "${CORPUS_LABELS[corpus] || corpus}" entre ${from || 'le début'} et ${to || 'la fin'}. 
Sur le graphique, les points représentent les données annuelles brutes et la ligne représente la tendance lissée. Identifie les événements historiques, culturels ou sociaux qui pourraient expliquer les pics ou les déclins observés.`;
}