/**
 * Gallicagram Chart Generator - Vercel Serverless Function
 * Génère des graphiques de fréquence lexicale + prompt d'analyse pour VLM
 */

import { generateChart, generateAnalysisPrompt, CORPUS_LABELS } from './_lib/gallicagram.js';

// API Handler
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { mot, corpus = 'presse', from_year, to_year, smooth = 'true' } = req.query;

        if (!mot) {
            return res.status(400).json({ error: 'Le paramètre "mot" est requis' });
        }

        const mots = mot.split(',').map(m => m.trim()).filter(Boolean);
        const shouldSmooth = smooth === 'true' || smooth === '1';
        const from = from_year ? parseInt(from_year) : null;
        const to = to_year ? parseInt(to_year) : null;

        // Générer le graphique
        const imageBase64 = await generateChart(mots, corpus, from, to, shouldSmooth);

        // Générer le prompt d'analyse
        const analysisPrompt = generateAnalysisPrompt(mots, corpus, from, to);

        // Retourner la réponse MCP-compatible
        return res.status(200).json({
            success: true,
            data: {
                image_base64: imageBase64,
                image_data_url: `data:image/png;base64,${imageBase64}`,
                analysis_prompt: analysisPrompt,
                metadata: {
                    words: mots,
                    corpus: corpus,
                    corpus_label: CORPUS_LABELS[corpus] || corpus,
                    from_year: from,
                    to_year: to,
                    smoothed: shouldSmooth
                }
            }
        });

    } catch (error) {
        console.error('Erreur:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

