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
    "subtitles": "Sous-titres de films (FR) (1935-2020)",
    "subtitles_en": "Sous-titres de films (EN) (1930-2020)",
    "rap": "Rap (Genius) (1989-2024)"
};

// Correspondance corpus -> résolution minimale (d'après le swagger)
const CORPUS_MIN_RESOLUTION = {
    "lemonde": "jour",
    "lemonde_rubriques": "jour",
    "presse": "mois",
    "livres": "annee",
    "ddb": "mois",
    "american_stories": "annee",
    "paris": "jour",
    "moniteur": "jour",
    "journal_des_debats": "jour",
    "la_presse": "jour",
    "constitutionnel": "jour",
    "figaro": "jour",
    "temps": "jour",
    "petit_journal": "jour",
    "petit_parisien": "jour",
    "huma": "jour",
    "subtitles": "annee",
    "subtitles_en": "annee",
    "rap": "annee"
};

const COLORS = [
    '#E63946', '#457B9D', '#2A9D8F', '#F4A261', '#E76F51',
    '#6A4C93', '#1982C4', '#8AC926', '#FFCA3A', '#FF595E'
];

function movingAverage(data, windowSize = 5) {
    if (windowSize <= 1) return [...data];
    
    const result = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < data.length; i++) {
        // Pour éviter les artefacts de bord, on utilise une fenêtre centrée stricte
        // et on garde les valeurs originales sur les bords
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

/**
 * Détermine la meilleure résolution selon la période et le corpus
 */
function getOptimalResolution(corpus, from_year, to_year) {
    const minRes = CORPUS_MIN_RESOLUTION[corpus] || "annee";
    
    // Si le corpus ne supporte que l'année, on reste sur année
    if (minRes === "annee") return "annee";
    
    // Si pas de période définie, on utilise année par défaut
    if (!from_year || !to_year) return "annee";
    
    const span = to_year - from_year;
    
    // Pour les petites périodes (< 10 ans), on privilégie le mois si disponible
    if (span < 10 && (minRes === "jour" || minRes === "mois")) {
        return "mois";
    }
    
    return "annee";
}

/**
 * Calcule la taille de fenêtre de lissage optimale
 */
function getOptimalSmoothWindow(dataLength) {
    if (dataLength <= 5) return 1;  // Pas de lissage pour très petites séries
    if (dataLength <= 10) return 3;  // Très petites séries
    if (dataLength <= 30) return 4;  // Petites séries
    return 5;  // Séries normales (max 5)
}

/**
 * Formate une date selon la résolution - VERSION CORRIGÉE
 * Pour la résolution mois, retourne un format ISO compatible avec Chart.js time axis
 */
function formatDate(annee, mois = null, resolution = "annee") {
    if (resolution === "annee") return annee.toString();
    if (resolution === "mois" && mois) {
        // Format ISO pour Chart.js : "1944-01" au lieu de "Jan 1944"
        const moisStr = mois.toString().padStart(2, '0');
        return `${annee}-${moisStr}`;
    }
    return annee.toString();
}

/**
 * Formate une date pour l'affichage dans les tooltips
 */
function formatDateDisplay(annee, mois = null, resolution = "annee") {
    if (resolution === "annee") return annee.toString();
    if (resolution === "mois" && mois) {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${monthNames[mois - 1]} ${annee}`;
    }
    return annee.toString();
}

async function fetchData(mot, corpus, from_year, to_year, resolution = null) {
    // Détermine la résolution optimale si non spécifiée
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

    const csvRows = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        if (parts.length <= Math.max(yearIdx, nIdx, totalIdx)) continue;
        
        const annee = parseInt(parts[yearIdx]);
        const mois = monthIdx >= 0 ? parseInt(parts[monthIdx]) : null;
        const n = parseFloat(parts[nIdx]) || 0;
        const total = parseFloat(parts[totalIdx]);
        
        if (!isNaN(annee) && total > 0) {
            csvRows.push({ 
                annee, 
                mois,
                n,
                frequency: n / total,
                date: formatDate(annee, mois, finalResolution),
                dateDisplay: formatDateDisplay(annee, mois, finalResolution)
            });
        }
    }

    return { data: csvRows, resolution: finalResolution };
}

export async function generateChart(mots, corpus, from_year, to_year, smooth = true) {
    const allDatasets = [];
    let usedResolution = "annee";

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data, resolution } = await fetchData(mot, corpus, from_year, to_year);
        usedResolution = resolution; // On garde trace de la résolution utilisée
        
        if (data.length === 0) continue;

        const color = COLORS[i % COLORS.length];
        const rawFrequencies = data.map(d => d.frequency * 1e6); // ppm

        // Calcul de la fenêtre de lissage adaptative
        const smoothWindow = getOptimalSmoothWindow(data.length);

        // Lissage des fréquences si demandé
        let lineFrequencies = [...rawFrequencies];
        if (smooth && lineFrequencies.length > smoothWindow) {
            lineFrequencies = movingAverage(lineFrequencies, smoothWindow);
        }

        // 1. DATASET LIGNE LISSÉE (sans points)
        allDatasets.push({
            label: mot,
            data: data.map((d, idx) => ({ 
                x: usedResolution === "mois" ? d.date : parseInt(d.date),  // Nombre pour linear axis
                y: parseFloat(lineFrequencies[idx].toFixed(4))
            })),
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 0,  // Pas de points sur la ligne
            pointHoverRadius: 0,
            fill: false,
            tension: smooth ? 0.4 : 0,
            showLine: true,
            spanGaps: false,  // Ne pas relier les gaps (évite les boucles)
            order: 2  // Ligne en arrière-plan
        });

        // 2. DATASET POINTS BRUTS (sans ligne)
        allDatasets.push({
            label: mot + ' (données brutes)',
            data: data.map((d, idx) => ({ 
                x: usedResolution === "mois" ? d.date : parseInt(d.date),  // Nombre pour linear axis
                y: parseFloat(rawFrequencies[idx].toFixed(4))
            })),
            borderColor: 'transparent',
            backgroundColor: color + '80',  // Semi-transparent
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: color,
            pointBorderWidth: 1,
            showLine: false,  // Pas de ligne, seulement des points
            fill: false,
            order: 1  // Points au premier plan
        });
    }

    if (allDatasets.length === 0) throw new Error('Aucune donnée trouvée');

    // Configuration avec axes adaptés à la résolution
    const xAxisConfig = {
        type: usedResolution === "mois" ? 'time' : 'linear',
        position: 'bottom',
        gridLines: { display: false },
        ticks: {}
    };

    if (usedResolution === "mois") {
        // Configuration time axis pour format ISO
        xAxisConfig.time = {
            parser: 'YYYY-MM',
            unit: 'month',
            displayFormats: {
                month: 'MMM YYYY'
            },
            tooltipFormat: 'MMM YYYY'
        };
    } else {
        // Pour l'axe linear avec années
        xAxisConfig.ticks = {
            callback: "REPLACE_ME_TICK_FUNCTION"
        };
    }

    const configuration = {
        type: 'line',
        data: { datasets: allDatasets },
        options: {
            title: {
                display: true,
                text: `${CORPUS_LABELS[corpus] || corpus}`,
                fontSize: 18,
                fontColor: '#555'
            },
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    filter: "REPLACE_ME_FILTER_FUNCTION"
                }
            },
            tooltips: {
                callbacks: {
                    // Afficher la valeur brute dans le tooltip
                    label: "REPLACE_ME_TOOLTIP_FUNCTION"
                }
            },
            scales: {
                xAxes: [xAxisConfig],
                yAxes: [{
                    scaleLabel: { display: true, labelString: 'Fréquence en mots\npar million de mots' },
                    ticks: { beginAtZero: true }
                }]
            }
        }
    };

    let configStr = JSON.stringify(configuration);

    // Injection des fonctions JS
    
    // Filtre pour cacher les datasets "données brutes" de la légende
    configStr = configStr.replace(
        '"REPLACE_ME_FILTER_FUNCTION"',
        'function(item) { return !item.text.includes("(données brutes)"); }'
    );

    // Callback pour formater les années sur l'axe X
    if (usedResolution !== "mois") {
        configStr = configStr.replace(
            '"REPLACE_ME_TICK_FUNCTION"',
            'function(val) { return Math.round(val).toString(); }'
        );
    }

    // Tooltip personnalisé pour afficher les données brutes
    configStr = configStr.replace(
        '"REPLACE_ME_TOOLTIP_FUNCTION"',
        `function(tooltipItem, data) {
            var dataset = data.datasets[tooltipItem.datasetIndex];
            var label = dataset.label || '';
            var value = tooltipItem.yLabel;
            // Nettoyer le label pour la légende
            if (label.includes('(données brutes)')) {
                label = label.replace(' (données brutes)', '');
            }
            return label + ': ' + value.toFixed(2) + ' ppm';
        }`
    );

    const encoded = encodeURIComponent(configStr);
    const url = `https://quickchart.io/chart?c=${encoded}&width=1000&height=500&backgroundColor=white&version=2.9.4`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Erreur QuickChart');

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
}

export async function generateHistogram(mots, corpus, from_year, to_year) {
    const datasets = [];
    let usedResolution = "annee";
    let allDataPoints = new Map(); // Stocke toutes les données brutes par mot

    // Collecte des données pour tous les mots
    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data, resolution } = await fetchData(mot, corpus, from_year, to_year);
        usedResolution = resolution;
        
        if (data.length === 0) continue;

        allDataPoints.set(mot, {
            data: data,
            color: COLORS[i % COLORS.length]
        });
    }

    if (allDataPoints.size === 0) throw new Error('Aucune donnée trouvée');

    // Détermine la gamme complète de dates (min à max)
    let minYear = Infinity, maxYear = -Infinity;
    let minMonth = null, maxMonth = null;
    
    for (const [mot, info] of allDataPoints) {
        for (const d of info.data) {
            if (d.annee < minYear) {
                minYear = d.annee;
                minMonth = d.mois;
            }
            if (d.annee > maxYear) {
                maxYear = d.annee;
                maxMonth = d.mois;
            }
        }
    }

    // Crée la liste complète des labels chronologiques
    const allLabels = [];
    if (usedResolution === "mois") {
        // Générer tous les mois entre min et max
        for (let y = minYear; y <= maxYear; y++) {
            const startMonth = (y === minYear) ? (minMonth || 1) : 1;
            const endMonth = (y === maxYear) ? (maxMonth || 12) : 12;
            for (let m = startMonth; m <= endMonth; m++) {
                allLabels.push(formatDateDisplay(y, m, "mois"));
            }
        }
    } else {
        // Générer toutes les années entre min et max
        for (let y = minYear; y <= maxYear; y++) {
            allLabels.push(y.toString());
        }
    }

    // Créer les datasets avec toutes les dates
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

    const labels = allLabels;

    const configuration = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            title: {
                display: true,
                text: `${CORPUS_LABELS[corpus] || corpus}`,
                fontSize: 18,
                fontColor: '#555'
            },
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 20
                }
            },
            scales: {
                xAxes: [{
                    stacked: false,
                    gridLines: { display: false },
                    ticks: {
                        maxTicksLimit: 20,
                        autoSkip: true
                    }
                }],
                yAxes: [{
                    stacked: false,
                    scaleLabel: { display: true, labelString: 'Nombre d\'occurrences (n)' },
                    ticks: { beginAtZero: true }
                }]
            }
        }
    };

    const encoded = encodeURIComponent(JSON.stringify(configuration));
    const url = `https://quickchart.io/chart?c=${encoded}&width=1000&height=500&backgroundColor=white&version=2.9.4`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Erreur QuickChart');

    return Buffer.from(await response.arrayBuffer());
}

export async function generateTotalsChart(mots, corpus, from_year, to_year) {
    const totals = [];

    // Collecte des totaux pour chaque mot
    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data } = await fetchData(mot, corpus, from_year, to_year);
        
        if (data.length === 0) continue;

        const totalOccurrences = data.reduce((sum, d) => sum + d.n, 0);
        const color = COLORS[i % COLORS.length];
        
        totals.push({
            mot,
            total: totalOccurrences,
            color
        });
    }

    if (totals.length === 0) throw new Error('Aucune donnée trouvée');

    // Trier par total décroissant
    totals.sort((a, b) => b.total - a.total);

    const configuration = {
        type: 'horizontalBar',
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
            title: {
                display: true,
                text: `${CORPUS_LABELS[corpus] || corpus}`,
                fontSize: 18,
                fontColor: '#555'
            },
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    scaleLabel: { 
                        display: true, 
                        labelString: 'Nombre total d\'occurrences' 
                    },
                    ticks: { beginAtZero: true }
                }],
                yAxes: [{
                    gridLines: { display: false }
                }]
            }
        }
    };

    const encoded = encodeURIComponent(JSON.stringify(configuration));
    const url = `https://quickchart.io/chart?c=${encoded}&width=1000&height=600&backgroundColor=white&version=2.9.4`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Erreur QuickChart');

    return Buffer.from(await response.arrayBuffer());
}

export function generateAnalysisPrompt(mots, corpus, from, to) {
    return `Agis en tant qu'historien expert. Analyse l'évolution de la fréquence de "${mots.join(', ')}" dans le corpus "${CORPUS_LABELS[corpus] || corpus}" entre ${from || 'le début'} et ${to || 'la fin'}. 
    
Sur le graphique, les points représentent les données annuelles brutes et la ligne représente la tendance lissée. 
Identifie les événements historiques, culturels ou sociaux qui pourraient expliquer les pics ou les déclins observés.`;
}
