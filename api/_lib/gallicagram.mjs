import fetch from 'node-fetch';
import { createCanvas, registerFont } from 'canvas';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Chart, registerables } from 'chart.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

Chart.register(...registerables);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, 'fonts');

function tryRegisterFont(file, family, options = {}) {
    try {
        registerFont(join(FONTS_DIR, file), { family, ...options });
    } catch {
    }
}

tryRegisterFont('Poppins-Regular.ttf', 'Poppins');
tryRegisterFont('Poppins-Bold.ttf', 'Poppins', { weight: 'bold' });

const FONT_FAMILY = 'Poppins';

const sourcePlugin = {
    id: 'sourcePlugin',
    afterDraw: (chart) => {
        const { ctx, canvas } = chart;
        const text = chart.options.plugins.sourcePlugin?.text;
        if (!text) return;
        ctx.save();
        ctx.font = `italic 24px ${FONT_FAMILY}`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, canvas.width - 40, canvas.height - 30);
        ctx.restore();
    }
};

function createCanvasInstance(width, height) {
    return new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: 'white',
        chartCallback: (ChartJS) => {
            ChartJS.defaults.font.family = FONT_FAMILY;
            ChartJS.defaults.font.size = 22;
            ChartJS.defaults.color = '#444';
            ChartJS.register(sourcePlugin);
        }
    });
}

const chartCanvas = createCanvasInstance(2000, 1000);
const chartCanvasTotals = createCanvasInstance(2000, 1200);

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

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function movingAverage(data, windowSize = 5) {
    if (windowSize <= 1) return [...data];
    const result = [];
    const half = Math.floor(windowSize / 2);
    for (let i = 0; i < data.length; i++) {
        if (i < half || i >= data.length - half) {
            result.push(data[i]);
        } else {
            const slice = data.slice(i - half, i + half + 1);
            result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
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

function getOptimalSmoothWindow(len) {
    if (len <= 5) return 1;
    if (len <= 10) return 3;
    if (len <= 30) return 4;
    return 5;
}

function formatDate(annee, mois, resolution) {
    if (resolution === "mois" && mois)
        return `${annee}-${mois.toString().padStart(2, '0')}`;
    return annee.toString();
}

function formatDateDisplay(annee, mois, resolution) {
    if (resolution === "mois" && mois) {
        return `${MONTH_NAMES[mois - 1]} ${annee}`;
    }
    return annee.toString();
}

function toDecimalYear(annee, mois) {
    if (!mois) return annee;
    return annee + (mois - 1) / 12;
}

function decimalYearToLabel(value, resolution) {
    const annee = Math.floor(value + 0.001);
    if (resolution !== "mois") return annee.toString();
    const moisIdx = Math.round((value - annee) * 12);
    if (moisIdx === 0) return annee.toString();
    return MONTH_NAMES[moisIdx] || '';
}

function decimalYearToTooltip(value, resolution) {
    const annee = Math.floor(value + 0.001);
    if (resolution !== "mois") return annee.toString();
    const moisIdx = Math.round((value - annee) * 12);
    return `${MONTH_NAMES[moisIdx] || '?'} ${annee}`;
}

function getCleanCorpusLabel(corpus) {
    const label = CORPUS_LABELS[corpus] || corpus;
    return label.replace(/\s*\(.*\)\s*$/, "").trim();
}

async function fetchData(mot, corpus, from_year, to_year, resolution = null) {
    const finalResolution = resolution || getOptimalResolution(corpus, from_year, to_year);
    const params = new URLSearchParams({ mot, corpus, resolution: finalResolution });
    if (from_year) params.append('from', from_year);
    if (to_year) params.append('to', to_year);

    const response = await fetch(`https://shiny.ens-paris-saclay.fr/guni/query?${params}`);
    if (!response.ok) throw new Error(`Erreur API Gallicagram : ${response.status}`);
    const text = await response.text();
    if (!text.trim()) return { data: [], resolution: finalResolution };

    const lines = text.trim().split('\n');
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

    const yearIdx = headers.findIndex(h => ['annee', 'year', 'année'].includes(h));
    const monthIdx = headers.findIndex(h => ['mois', 'month'].includes(h));
    const nIdx = headers.findIndex(h => ['n', 'count', 'nombre'].includes(h));
    const totalIdx = headers.findIndex(h => ['total', 'tot', 'sum'].includes(h));

    const aggregated = new Map();
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        if (parts.length <= Math.max(yearIdx, nIdx, totalIdx)) continue;
        const annee = parseInt(parts[yearIdx]);
        const mois = monthIdx >= 0 ? parseInt(parts[monthIdx]) : null;
        const n = parseFloat(parts[nIdx]) || 0;
        const total = parseFloat(parts[totalIdx]) || 0;
        if (!isNaN(annee) && total > 0) {
            const key = formatDate(annee, mois, finalResolution);
            if (!aggregated.has(key))
                aggregated.set(key, {
                    annee, mois, n: 0, total, date: key,
                    dateDisplay: formatDateDisplay(annee, mois, finalResolution)
                });
            aggregated.get(key).n += n;
        }
    }

    const rows = Array.from(aggregated.values())
        .map(r => ({ ...r, frequency: r.n / r.total }))
        .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : (a.mois || 0) - (b.mois || 0));

    return { data: rows, resolution: finalResolution };
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

export async function generateChart(mots, corpus, from_year, to_year, smooth = true) {
    const datasets = [];
    let resolution = "annee";

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data, resolution: res } = await fetchData(mot, corpus, from_year, to_year);
        resolution = res;
        if (data.length === 0) continue;

        const color = COLORS[i % COLORS.length];
        const rawFreq = data.map(d => d.frequency * 1e6);
        const winSize = getOptimalSmoothWindow(data.length);
        const lineFreq = (smooth && data.length > winSize)
            ? movingAverage(rawFreq, winSize)
            : [...rawFreq];

        const xVal = (d) => toDecimalYear(d.annee, resolution === "mois" ? d.mois : null);

        datasets.push({
            label: mot,
            data: data.map((d, idx) => ({ x: xVal(d), y: parseFloat(lineFreq[idx].toFixed(4)) })),
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 4,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: smooth ? 0.4 : 0,
            showLine: true,
            spanGaps: false,
            order: 2
        });

        datasets.push({
            label: mot + ' (données brutes)',
            data: data.map((d, idx) => ({ x: xVal(d), y: parseFloat(rawFreq[idx].toFixed(4)) })),
            borderColor: 'transparent',
            backgroundColor: hexToRgba(color, 0.45),
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: color,
            pointBorderWidth: 1,
            showLine: false,
            fill: false,
            order: 1
        });
    }

    if (datasets.length === 0) throw new Error('Aucune donnée trouvée');

    // Calculer les bornes min/max pour l'axe X pour éviter les blancs
    let minX = Infinity;
    let maxX = -Infinity;
    datasets.forEach(ds => {
        ds.data.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
        });
    });

    const _resolution = resolution;

    const config = {
        type: 'line',
        data: { datasets },
        options: {
            animation: false,
            responsive: false,
            layout: { padding: { bottom: 80, top: 20, left: 20, right: 20 } },
            plugins: {
                title: { display: false },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 30,
                        font: { size: 28, family: FONT_FAMILY },
                        color: '#444',
                        filter: (item) => !item.text.includes('(données brutes)')
                    }
                },
                sourcePlugin: { text: `Source : ${getCleanCorpusLabel(corpus)}` },
                tooltip: {
                    callbacks: {
                        title: (items) => items.length ? decimalYearToTooltip(items[0].parsed.x, _resolution) : '',
                        label: (ctx) => {
                            let lbl = ctx.dataset.label || '';
                            if (lbl.includes('(données brutes)')) lbl = lbl.replace(' (données brutes)', '');
                            return `${lbl}: ${ctx.parsed.y.toFixed(2)} ppm`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: minX,
                    max: maxX,
                    grid: { color: '#eee', drawBorder: false },
                    ticks: {
                        font: { family: FONT_FAMILY, size: 22 },
                        color: '#555',
                        maxTicksLimit: _resolution === "mois" ? 20 : 12,
                        callback: (value) => decimalYearToLabel(value, _resolution)
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Fréquence (ppm)',
                        font: { size: 28, family: FONT_FAMILY, weight: 'bold' },
                        color: '#666'
                    },
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { font: { family: FONT_FAMILY, size: 22 }, color: '#555' }
                }
            }
        }
    };

    return chartCanvas.renderToBuffer(config);
}

export async function generateHistogram(mots, corpus, from_year, to_year) {
    const allDataPoints = new Map();
    let resolution = "annee";

    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data, resolution: res } = await fetchData(mot, corpus, from_year, to_year);
        resolution = res;
        if (data.length === 0) continue;
        allDataPoints.set(mot, { data, color: COLORS[i % COLORS.length] });
    }

    if (allDataPoints.size === 0) throw new Error('Aucune donnée trouvée');

    let minYear = Infinity, maxYear = -Infinity, minMonth = null, maxMonth = null;
    for (const { data } of allDataPoints.values()) {
        for (const d of data) {
            if (d.annee < minYear) { minYear = d.annee; minMonth = d.mois; }
            if (d.annee > maxYear) { maxYear = d.annee; maxMonth = d.mois; }
        }
    }

    const allLabels = [];
    if (resolution === "mois") {
        for (let y = minYear; y <= maxYear; y++) {
            const s = (y === minYear) ? (minMonth || 1) : 1;
            const e = (y === maxYear) ? (maxMonth || 12) : 12;
            for (let m = s; m <= e; m++)
                allLabels.push(formatDateDisplay(y, m, "mois"));
        }
    } else {
        for (let y = minYear; y <= maxYear; y++) allLabels.push(y.toString());
    }

    const datasets = [];
    for (const [mot, { data, color }] of allDataPoints) {
        const dataMap = new Map(data.map(d => [d.dateDisplay, d.n]));
        datasets.push({
            label: mot,
            data: allLabels.map(l => dataMap.get(l) || 0),
            backgroundColor: hexToRgba(color, 0.75),
            borderColor: color,
            borderWidth: 1
        });
    }

    const config = {
        type: 'bar',
        data: { labels: allLabels, datasets },
        options: {
            animation: false,
            responsive: false,
            layout: { padding: { bottom: 80, top: 20 } },
            plugins: {
                title: { display: false },
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 28, family: FONT_FAMILY }, padding: 30 }
                },
                sourcePlugin: { text: `Source : ${getCleanCorpusLabel(corpus)}` }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: FONT_FAMILY, size: 22 }, color: '#555', maxTicksLimit: 20 }
                },
                y: {
                    title: {
                        display: true, text: "Nombre d'occurrences (n)",
                        font: { size: 28, family: FONT_FAMILY, weight: 'bold' }, color: '#666'
                    },
                    beginAtZero: true,
                    ticks: { font: { family: FONT_FAMILY, size: 22 }, color: '#555' }
                }
            }
        }
    };

    return chartCanvas.renderToBuffer(config);
}

export async function generateTotalsChart(mots, corpus, from_year, to_year) {
    const totals = [];
    for (let i = 0; i < mots.length; i++) {
        const mot = mots[i].trim();
        const { data } = await fetchData(mot, corpus, from_year, to_year);
        if (data.length === 0) continue;
        totals.push({
            mot,
            total: data.reduce((s, d) => s + d.n, 0),
            color: COLORS[i % COLORS.length]
        });
    }
    if (totals.length === 0) throw new Error('Aucune donnée trouvée');
    totals.sort((a, b) => b.total - a.total);

    const config = {
        type: 'bar',
        data: {
            labels: totals.map(t => t.mot),
            datasets: [{
                label: 'Occurrences totales',
                data: totals.map(t => t.total),
                backgroundColor: totals.map(t => hexToRgba(t.color, 0.75)),
                borderColor: totals.map(t => t.color),
                borderWidth: 1.5
            }]
        },
        options: {
            indexAxis: 'y',
            animation: false,
            responsive: false,
            layout: { padding: { bottom: 80, top: 20, right: 40 } },
            plugins: {
                title: { display: false },
                legend: { display: false },
                sourcePlugin: { text: `Source : ${getCleanCorpusLabel(corpus)}` }
            },
            scales: {
                x: {
                    title: {
                        display: true, text: "Nombre total d'occurrences",
                        font: { size: 28, family: FONT_FAMILY, weight: 'bold' }, color: '#666'
                    },
                    beginAtZero: true,
                    grid: { color: '#eee', drawBorder: false },
                    ticks: { font: { family: FONT_FAMILY, size: 22 }, color: '#555' }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: FONT_FAMILY, size: 24 }, color: '#333' }
                }
            }
        }
    };

    return chartCanvasTotals.renderToBuffer(config);
}

export function generateAnalysisPrompt(mots, corpus, from, to) {
    return `Agis en tant qu'historien expert. Analyse l'évolution de la fréquence de "${mots.join(', ')}" dans le corpus "${getCleanCorpusLabel(corpus)}" entre ${from || 'le début'} et ${to || 'la fin'}. 
Sur le graphique, les points représentent les données annuelles brutes et la ligne représente la tendance lissée. Identifie les événements historiques, culturels ou sociaux qui pourraient expliquer les pics ou les déclins observés.`;
}