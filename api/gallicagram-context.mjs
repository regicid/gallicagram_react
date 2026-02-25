import fetch from 'node-fetch';
import Papa from 'papaparse';

const GALLICA_PROXY_API_URL = 'https://shiny.ens-paris-saclay.fr/guni';

/**
 * Parses a date string into year, month, and day components.
 */
function parseDate(dateStr) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parts.length > 1 ? parseInt(parts[1]) : null;
    const day = parts.length > 2 ? parseInt(parts[2]) : null;
    return { year, month, day };
}

/**
 * Formats Gallica results with snippets.
 */
async function fetchGallicaContext(mot, date, corpus, limit) {
    const { year, month, day } = parseDate(date);

    // Helper to wrap multi-word terms in quotes (mimic Occurrence.js)
    const processedMot = mot.trim().split(' ').length > 1 ? `"${mot.trim()}"` : mot.trim();
    const finalMot = processedMot.replace(/’/g, "'");

    const params = new URLSearchParams({
        terms: finalMot,
        year: year,
        limit: limit,
        cursor: 0,
        sort: 'relevance'
    });

    if (month !== null) {
        params.append('month', month);
        if (day !== null) {
            params.append('day', day);
        }
    }

    const corpusConfigs = {
        "presse": { filter: { source: "periodical" } },
        "livres": { filter: { source: "book" } },
        "journal_des_debats": { filter: { source: "periodical", code: "cb327986871" } },
        "moniteur": { filter: { source: "periodical", code: "cb344019391" } }
    };

    const config = corpusConfigs[corpus];
    if (config && config.filter) {
        Object.entries(config.filter).forEach(([k, v]) => params.append(k, v));
    }

    const occUrl = `${GALLICA_PROXY_API_URL}/api/occurrences_no_context?${params.toString()}`;
    const occRes = await fetch(occUrl);
    if (!occRes.ok) throw new Error(`Erreur API occurrences: ${occRes.status}`);
    const occData = await occRes.json();

    if (!occData.records || occData.records.length === 0) {
        return `Aucune occurrence trouvée pour "${mot}" le ${date} dans le corpus Gallica (${corpus}).`;
    }

    const results = [];
    for (const record of occData.records) {
        try {
            const contextParams = new URLSearchParams({
                ark: record.ark,
                url: record.url,
                terms: finalMot
            });

            // Use exact date from record if available for context accuracy
            const recordDate = new Date(record.date);
            if (!isNaN(recordDate.getTime())) {
                contextParams.append('month', recordDate.getMonth() + 1);
                contextParams.append('day', recordDate.getDate());
            } else if (month !== null) {
                contextParams.append('month', month);
                if (day !== null) {
                    contextParams.append('day', day);
                }
            }

            if (config && config.filter) {
                Object.entries(config.filter).forEach(([k, v]) => contextParams.append(k, v));
            }

            const contextUrl = `${GALLICA_PROXY_API_URL}/api/context?${contextParams.toString()}`;
            const contextRes = await fetch(contextUrl);
            if (contextRes.ok) {
                const contextData = await contextRes.json();
                results.push({
                    title: record.paper_title,
                    date: record.date.split('T')[0],
                    url: record.url,
                    context: contextData.map(c => `...${c.left_context} **${c.pivot}** ${c.right_context}...`).join('\n')
                });
            }
        } catch (err) {
            console.error(`Error fetching context for ${record.ark}:`, err);
        }
    }

    return results.map(r =>
        `### [${r.title}](${r.url})\n**Date:** ${r.date}\n\n${r.context}`
    ).join('\n\n---\n\n');
}

/**
 * Fetches context from Le Monde by scraping their search page.
 */
async function fetchLeMondeContext(mot, date, limit) {
    const year = date.split('-')[0];
    const queryParams = `?search_keywords=${encodeURIComponent(mot)}&page_recherche=1&start_at=01/01/${year}&end_at=31/12/${year}`;
    const fetchUrl = `https://www.lemonde.fr/recherche/${queryParams}`;

    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('Failed to fetch Le Monde content');
    const html = await res.text();

    const results = [];
    // More robust regex for Le Monde teasers
    const teaserRegex = /<section[^>]*class="teaser[^"]*"[^>]*>([\s\S]*?)<\/section>/g;
    let match;
    let count = 0;

    while ((match = teaserRegex.exec(html)) !== null && count < limit) {
        const content = match[1];
        const titleMatch = /<h3[^>]*class="teaser__title"[^>]*>([\s\S]*?)<\/h3>/.exec(content);
        const linkMatch = /<a[^>]*class="teaser__link"[^>]*href="([^"]+)"/.exec(content);
        const descMatch = /<p[^>]*class="teaser__desc"[^>]*>([\s\S]*?)<\/p>/.exec(content);
        const dateMatch = /<span[^>]*class="meta__date"[^>]*>([\s\S]*?)<\/span>/.exec(content);

        if (titleMatch && linkMatch) {
            results.push({
                title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
                href: linkMatch[1],
                description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',
                date: dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : ''
            });
            count++;
        }
    }

    if (results.length === 0) return `Aucun résultat trouvé dans Le Monde pour "${mot}" en ${year}.`;

    return results.map(r =>
        `### [${r.title}](${r.href})\n**Date:** ${r.date}\n\n${r.description}`
    ).join('\n\n---\n\n');
}

/**
 * Fetches context from Persée.
 */
async function fetchPerseeContext(mot, date, limit) {
    const year = date.split('-')[0];
    const queryParams = `?l=fre&da=${year}&q=%22${encodeURIComponent(mot)}%22`;
    const fetchUrl = `https://www.persee.fr/search${queryParams}`;

    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('Failed to fetch Persée content');
    const html = await res.text();

    const results = [];
    // Persée uses div.doc-result
    const docRegex = /<div[^>]*class="doc-result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;
    let count = 0;

    while ((match = docRegex.exec(html)) !== null && count < limit) {
        const content = match[1];
        const titleMatch = /<a[^>]*class="title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(content);
        const authorMatch = /<span[^>]*class="name"[^>]*>([\s\S]*?)<\/span>/.exec(content);
        const snipMatch = /<div[^>]*class="searchContext"[^>]*>([\s\S]*?)<\/div>/.exec(content);

        if (titleMatch) {
            results.push({
                title: titleMatch[2].replace(/<[^>]+>/g, '').trim(),
                href: 'https://www.persee.fr' + titleMatch[1],
                author: authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : '',
                snippet: snipMatch ? snipMatch[1].replace(/<[^>]+>/g, '').replace(/<span class="highlight">/g, '**').replace(/<\/span>/g, '**').trim() : ''
            });
            count++;
        }
    }

    if (results.length === 0) return `Aucun résultat trouvé dans Persée pour "${mot}" en ${year}.`;

    return results.map(r =>
        `### [${r.title}](${r.href})\n**Auteur:** ${r.author}\n\n${r.snippet}`
    ).join('\n\n---\n\n');
}

/**
 * Fetches context from RAP.
 */
async function fetchRapContext(mot, date, limit) {
    const year = date.split('-')[0];
    const url = `${GALLICA_PROXY_API_URL}/source_rap?mot=${encodeURIComponent(mot.replace(/’/g, "'"))}&year=${year}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch Rap data');
    const csvText = await res.text();

    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error('Error parsing CSV');

    const data = parsed.data
        .sort((a, b) => (parseInt(b.counts) || 0) - (parseInt(a.counts) || 0))
        .slice(0, limit);

    if (data.length === 0) return `Aucun résultat trouvé dans le corpus RAP pour "${mot}" en ${year}.`;

    return data.map(row => {
        let url = row.url || row.URL || '#';
        if (url.includes('<a ')) {
            const m = url.match(/href=['"]([^'"]+)['"]/);
            url = m ? m[1] : '#';
        }
        return `### [${row.title || row.titre || 'Sans titre'}](${url})\n**Artiste:** ${row.artist || row.artiste || 'Inconnu'}\n**Album:** ${row.album || '-'}\n**Occurrences:** ${row.counts}`;
    }).join('\n\n---\n\n');
}

/**
 * Main function to get context for any corpus.
 */
export async function getContext(mot, date, corpus, limit = 5) {
    if (corpus === 'lemonde' || corpus === 'lemonde_rubriques') {
        return await fetchLeMondeContext(mot, date, limit);
    } else if (corpus === 'persee' || corpus === 'route à part (query_persee)') {
        return await fetchPerseeContext(mot, date, limit);
    } else if (corpus === 'rap') {
        return await fetchRapContext(mot, date, limit);
    } else {
        // Assume Gallica-like corpus (presse, livres, etc.)
        return await fetchGallicaContext(mot, date, corpus, limit);
    }
}
