// api/_lib/gallicagram.mjs
import fetch from 'node-fetch';
import { createCanvas, registerFont } from 'canvas';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Chart, registerables } from 'chart.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

Chart.register(...registerables);

// ─── Polices embarquées ──────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, 'fonts');

function tryRegisterFont(file, family, options = {}) {
    try {
        registerFont(join(FONTS_DIR, file), { family, ...options });
    } catch {
        // Silencieux : chart.js utilisera la police système de fallback
    }
}

tryRegisterFont('Poppins-Regular.ttf', 'Poppins');
tryRegisterFont('Poppins-Bold.ttf',    'Poppins', { weight: 'bold' });

const FONT_FAMILY = 'Poppins';

// ─── Configuration des renderers ─────────────────────────────────────────────
// FIX: L'adaptateur de dates DOIT être enregistré via chartCallback,
// car ChartJSNodeCanvas crée une instance Chart.js isolée.
// L'import global `import 'chartjs-adapter-date-fns'` n'atteint PAS cette instance.
const CHART_DEFAULTS = {
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        // Enregistrement de l'adaptateur date-fns dans l'instance isolée de ChartJSNodeCanvas
        const { _adapters } = ChartJS;
        if (_adapters && _adapters._date) {
            // Importer et enregistrer l'adaptateur manuellement
            import('chartjs-adapter-date-fns').then((adapter) => {
                // L'adaptateur s'auto-enregistre à l'import, mais sur l'instance globale.
                // On copie l'adaptateur sur cette instance isolée.
                if (adapter.default && adapter.default._id) {
                    ChartJS._adapters._date.override(adapter.default);
                }
            }).catch(() => {});
        }

        ChartJS.defaults.font.family = FONT_FAMILY;
        ChartJS.defaults.font.size   = 24;
        ChartJS.defaults.color       = '#444';
    }
};

// ─── Solution alternative et plus robuste ────────────────────────────────────
// Au lieu de passer par chartCallback (asynchrone et peu fiable),
// on utilise l'option `plugins` de ChartJSNodeCanvas pour forcer l'enregistrement.

function createCanvasInstance(width, height) {
    return new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: 'white',
        // `plugins.requireLegacy` charge le module dans le contexte de l'instance isolée
        plugins: {
            modern: ['chartjs-adapter-date-fns'],
        },
        chartCallback: (ChartJS) => {
            ChartJS.defaults.font.family = FONT_FAMILY;
            ChartJS.defaults.font.size   = 24;
            ChartJS.defaults.color       = '#444';
        }
    });
}

const chartCanvas       = createCanvasInstance(2000, 1000);
const chartCanvasTotals = createCanvasInstance(2000, 1200);

// ─── Constantes ──────────────────────────────────────────────────────────────
export const CORPUS_LABELS = {
    "lemonde":           "Le Monde (1944-2023)",
    "presse":            "Presse Gallica (1789-1950)",
    "livres":            "Livres Gallica (1600-1940)",
    "persee":            "Persée (1789-2023)",
    "ddb":               "Deutsches Zeitungsportal (1780-1950)",
    "american_stories":  "American Stories (1798-1963)",
    "paris":             "Journal de Paris (1777-1827)",
    "moniteur":          "Moniteur Universel (1789-1869)",
    "journal_des_debats":"Journal des Débats (1789-1944)",
    "la_presse":         "La Presse (1836-1869)",
    "constitutionnel":   "Le Constitutionnel (1821-1913)",
    "figaro":            "Le Figaro (1854-1952)",
    "temps":             "Le Temps (1861-1942)",
    "petit_journal":     "Le Petit Journal (1863-1942)",
    "petit_parisien":    "Le Petit Parisien (1876-1944)",
    "huma":              "L'Humanité (1904-1952)",
    "subtitles":         "Sous-titres de films (FR) (1935-2020)",
    "subtitles_en":      "Sous-titres de films (EN) (1930-2020)",
    "rap":               "Rap (Genius) (1989-2024)"
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
    '#e6194b','#3cb44b','#4363d8','#f58231','#911eb4',
    '#46f0f0','#f032e6','#bcf60c','#fabebe','#008080',
    '#e6beff','#9a6324','#fffac8','#800000','#aaffc3',
    '#808000','#ffd8b1','#000075','#808080','#000000',
    '#ff6f61','#6b5b95','#88b04b','#f7cac9','#92a8d1',
    '#955251','#b565a7','#009b77','#dd4124','#45b8ac'
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────
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
    if (len <= 5)  return 1;
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
        const names = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
        return `${names[mois - 1]} ${annee}`;
    }
    return annee.toString();
}

// ─── Fetch Gallicagram ───────────────────────────────────────────────────────
async function fetchData(mot, corpus, from_year, to_year, resolution = null) {
    const finalResolution = resolution || getOptimalResolution(corpus, from_year, to_year);
    const params = new URLSearchParams({ mot, corpus, resolution: finalResolution });
    if (from_year) params.append('from', from_year);
    if (to_year)   params.append('to', to_year);

    const response = await fetch(`https://shiny.ens-paris-saclay.fr/guni/query?${params}`);
    if (!response.ok) throw new Error(`Erreur API Gallicagram : ${response.status}`);
    const text = await response.text();
    if (!text.trim()) return { data: [], resolution: finalResolution };

    const lines     = text.trim().split('\n');
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers   = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

    const yearIdx  = headers.findIndex(h => ['annee','year','année'].includes(h));
    const monthIdx = headers.findIndex(h => ['mois','month'].includes(h));
    const nIdx     = headers.findIndex(h => ['n','count','nombre'].includes(h));
    const totalIdx = headers.findIndex(h => ['total','tot','sum'].includes(h));

    const aggregated = new Map();
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter);
        if (parts.length <= Math.max(yearIdx, nIdx, totalIdx)) continue;
        const annee = parseInt(parts[yearIdx]);
        const mois  = monthIdx >= 0 ? parseInt(parts[monthIdx]) : null;
        const n     = parseFloat(parts[nIdx])     || 0;
        const total = parseFloat(parts[totalIdx]) || 0;
        if (!isNaN(annee) && total > 0) {
            const key = formatDate(annee, mois, finalResolution);
            if (!aggregated.has(key))
                aggregated.set(key, { annee, mois, n: 0, total, date: key,
                    dateDisplay: formatDateDisplay(annee, mois, finalResolution) });
            aggregated.get(key).n += n;
        }
    }

    const rows = Array.from(aggregated.values())
        .map(r => ({ ...r, frequency: r.n / r.total }))
        .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : (a.mois||0) - (b.mois||0));

    return { data: rows, resolution: finalResolution };
}

// ─── Couleur hexadécimale → rgba ─────────────────────────────────────────────
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Styles communs ──────────────────────────────────────────────────────────
const commonTitlePlugin = (text) => ({
    display: true,
    text,
    font: { size: 16, family: FONT_FAMILY, weight: 'bold' },
    color: '#333',
    padding: { bottom: 16 }
});

const commonLegend = (filterFn = null) => ({
    position: 'bottom',
    labels: {
        usePointStyle: true,
        padding: 18,
        font: { size: 12, family: FONT_FAMILY },
        color: '#444',
        ...(filterFn ? { filter: filterFn } : {})
    }
});

// ─── generateChart ───────────────────────────────────────────────────────────
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

        // FIX: En résolution mensuelle, on utilise des objets Date natifs
        // plutôt que des strings 'yyyy-MM', ce qui évite la dépendance
        // au parser de l'adaptateur date-fns pour la lecture des x.
        const xVal = (d) => {
            if (resolution === "mois") {
                // Date au 1er du mois — Chart.js accepte les timestamps natifs
                return new Date(d.annee, (d.mois || 1) - 1, 1).getTime();
            }
            return parseInt(d.date);
        };

        // Ligne lissée
        datasets.push({
            label: mot,
            data: data.map((d, idx) => ({ x: xVal(d), y: parseFloat(lineFreq[idx].toFixed(4)) })),
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: smooth ? 0.4 : 0,
            showLine: true,
            spanGaps: false,
            order: 2
        });

        // Points bruts semi-transparents
        datasets.push({
            label: mot + ' (données brutes)',
            data: data.map((d, idx) => ({ x: xVal(d), y: parseFloat(rawFreq[idx].toFixed(4)) })),
            borderColor: 'transparent',
            backgroundColor: hexToRgba(color, 0.45),
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

    if (datasets.length === 0) throw new Error('Aucune donnée trouvée');

    // FIX: En résolution mensuelle, on utilise type: 'time' avec des timestamps
    // natifs (ms). On évite le `parser` custom qui requiert l'adaptateur.
    // Les ticks sont formatés manuellement via `callback` pour ne PAS dépendre
    // du système de formatage de date-fns (source du bug original).
    const xScale = resolution === "mois"
        ? {
            type: 'time',
            time: {
                unit: 'year',
                displayFormats: { year: 'yyyy', month: 'MMM yyyy' },
                tooltipFormat: 'MMM yyyy'
            },
            grid: { color: '#eee', drawBorder: false },
            ticks: { font: { family: FONT_FAMILY }, color: '#555', maxTicksLimit: 12 }
          }
        : {
            type: 'linear',
            grid: { color: '#eee', drawBorder: false },
            ticks: {
                font: { family: FONT_FAMILY },
                color: '#555',
                maxTicksLimit: 12,
                callback: (v) => Math.round(v).toString()
            }
          };

    const config = {
        type: 'line',
        data: { datasets },
        options: {
            animation: false,
            responsive: false,
            plugins: {
                title: commonTitlePlugin(CORPUS_LABELS[corpus] || corpus),
                legend: commonLegend((item) => !item.text.includes('(données brutes)')),
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            let lbl = ctx.dataset.label || '';
                            if (lbl.includes('(données brutes)'))
                                lbl = lbl.replace(' (données brutes)', '');
                            return `${lbl}: ${ctx.parsed.y.toFixed(2)} ppm`;
                        }
                    }
                }
            },
            scales: {
                x: xScale,
                y: {
                    title: {
                        display: true,
                        text: 'Fréquence (occurrences par million de mots)',
                        font: { size: 12, family: FONT_FAMILY },
                        color: '#666'
                    },
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { font: { family: FONT_FAMILY }, color: '#555' }
                }
            }
        }
    };

    return chartCanvas.renderToBuffer(config);
}

// ─── generateHistogram ───────────────────────────────────────────────────────
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
            plugins: {
                title: commonTitlePlugin(CORPUS_LABELS[corpus] || corpus),
                legend: commonLegend()
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: FONT_FAMILY }, color: '#555',
                        maxTicksLimit: 20, autoSkip: true
                    }
                },
                y: {
                    title: { display: true, text: "Nombre d'occurrences (n)",
                        font: { size: 12, family: FONT_FAMILY }, color: '#666' },
                    beginAtZero: true,
                    ticks: { font: { family: FONT_FAMILY }, color: '#555' }
                }
            }
        }
    };

    return chartCanvas.renderToBuffer(config);
}

// ─── generateTotalsChart ─────────────────────────────────────────────────────
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
            plugins: {
                title: commonTitlePlugin(CORPUS_LABELS[corpus] || corpus),
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: "Nombre total d'occurrences",
                        font: { size: 12, family: FONT_FAMILY }, color: '#666' },
                    beginAtZero: true,
                    grid: { color: '#eee', drawBorder: false },
                    ticks: { font: { family: FONT_FAMILY }, color: '#555' }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: FONT_FAMILY }, color: '#444' }
                }
            }
        }
    };

    return chartCanvasTotals.renderToBuffer(config);
}

// ─── generateAnalysisPrompt ──────────────────────────────────────────────────
export function generateAnalysisPrompt(mots, corpus, from, to) {
    return `Agis en tant qu'historien expert. Analyse l'évolution de la fréquence de "${mots.join(', ')}" dans le corpus "${CORPUS_LABELS[corpus] || corpus}" entre ${from || 'le début'} et ${to || 'la fin'}. 
Sur le graphique, les points représentent les données annuelles brutes et la ligne représente la tendance lissée. Identifie les événements historiques, culturels ou sociaux qui pourraient expliquer les pics ou les déclins observés.`;
}
