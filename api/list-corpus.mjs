/**
 * Liste les corpus disponibles
 */

const CORPUS_LABELS = {
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

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
        success: true,
        corpus: Object.entries(CORPUS_LABELS).map(([code, label]) => ({
            code,
            label
        }))
    });
}
