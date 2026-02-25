import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { generateChart, generateHistogram, generateTotalsChart, generateAnalysisPrompt, CORPUS_LABELS } from './_lib/gallicagram.mjs';
import { uploadToS3 } from './_lib/s3.mjs';
import { getContext } from './gallicagram-context.mjs';

// Factory function to create a new server instance
function createServer() {
    const server = new McpServer({
        name: "Gallicagram",
        version: "1.0.0"
    });

    // Register Tools

    // 1. TOOL PRINCIPAL : Graphique ligne/points avec fréquences (DEFAULT)
    server.registerTool(
        "gallicagram_chart",
        {
            description: "Génère un graphique de fréquence lexicale (ligne + points) pour un ou plusieurs mots dans un corpus historique. C'est le graphique par défaut à utiliser.",
            inputSchema: z.object({
                mot: z.string().describe("Mot(s) à analyser, séparés par des virgules (ex: 'révolution,liberté')"),
                corpus: z.string().default("presse").describe("Code du corpus (ex: presse, lemonde, livres)"),
                from_year: z.number().optional().describe("Année de début (optionnel)"),
                to_year: z.number().optional().describe("Année de fin (optionnel)"),
                smooth: z.boolean().default(true).describe("Appliquer un lissage des courbes (adaptatif selon la taille de la série)")
            })
        },
        async ({ mot, corpus = "presse", from_year, to_year, smooth = true }) => {
            try {
                if (!mot || String(mot).trim() === "") {
                    return {
                        content: [{ type: "text", text: "Erreur: Le paramètre 'mot' est requis" }],
                        isError: true
                    };
                }

                const mots = String(mot).split(',').map(m => m.trim()).filter(Boolean);
                if (mots.length === 0) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucun mot valide fourni après parsing" }],
                        isError: true
                    };
                }

                let imageBuffer;
                try {
                    imageBuffer = await generateChart(mots, corpus, from_year, to_year, smooth);
                } catch (genErr) {
                    const msg = genErr && genErr.message ? genErr.message : String(genErr);
                    return {
                        content: [{ type: "text", text: `Erreur génération graphique: ${msg}` }],
                        isError: true
                    };
                }

                if (!imageBuffer) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucune image générée (pas de données disponibles pour ces mots)" }],
                        isError: true
                    };
                }

                let imageUrl;
                try {
                    const filename = `chart_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
                    imageUrl = await uploadToS3(imageBuffer, filename, "image/png");
                } catch (s3Err) {
                    console.error('S3 upload error:', s3Err);
                    const msg = s3Err && s3Err.message ? s3Err.message : String(s3Err);
                    return {
                        content: [{ type: "text", text: `Erreur upload S3: ${msg}` }],
                        isError: true
                    };
                }

                const analysisPrompt = generateAnalysisPrompt(mots, corpus, from_year, to_year);

                return {
                    content: [
                        {
                            type: "text",
                            text: imageUrl
                        }
                    ]
                };

            } catch (error) {
                const msg = error && error.message ? error.message : String(error);
                console.error('gallicagram_chart unexpected error:', error);
                return {
                    content: [{ type: "text", text: `Erreur interne: ${msg}` }],
                    isError: true
                };
            }
        }
    );

    // 2. NOUVEAU TOOL : Histogramme vertical des occurrences (n)
    server.registerTool(
        "gallicagram_histogram",
        {
            description: "Génère un histogramme vertical montrant le nombre d'occurrences (n) plutôt que les fréquences. Utile pour les mots rares où les fréquences relatives sont peu significatives. À utiliser uniquement si explicitement demandé par l'utilisateur.",
            inputSchema: z.object({
                mot: z.string().describe("Mot(s) à analyser, séparés par des virgules"),
                corpus: z.string().default("presse").describe("Code du corpus"),
                from_year: z.number().optional().describe("Année de début"),
                to_year: z.number().optional().describe("Année de fin")
            })
        },
        async ({ mot, corpus = "presse", from_year, to_year }) => {
            try {
                if (!mot || String(mot).trim() === "") {
                    return {
                        content: [{ type: "text", text: "Erreur: Le paramètre 'mot' est requis" }],
                        isError: true
                    };
                }

                const mots = String(mot).split(',').map(m => m.trim()).filter(Boolean);
                if (mots.length === 0) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucun mot valide" }],
                        isError: true
                    };
                }

                let imageBuffer;
                try {
                    imageBuffer = await generateHistogram(mots, corpus, from_year, to_year);
                } catch (genErr) {
                    const msg = genErr && genErr.message ? genErr.message : String(genErr);
                    return {
                        content: [{ type: "text", text: `Erreur génération histogramme: ${msg}` }],
                        isError: true
                    };
                }

                if (!imageBuffer) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucune donnée disponible" }],
                        isError: true
                    };
                }

                const filename = `histogram_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
                const imageUrl = await uploadToS3(imageBuffer, filename, "image/png");

                return {
                    content: [
                        {
                            type: "text",
                            text: imageUrl
                        }
                    ]
                };

            } catch (error) {
                const msg = error && error.message ? error.message : String(error);
                console.error('gallicagram_histogram error:', error);
                return {
                    content: [{ type: "text", text: `Erreur interne: ${msg}` }],
                    isError: true
                };
            }
        }
    );

    // 3. NOUVEAU TOOL : Barres horizontales des totaux
    server.registerTool(
        "gallicagram_totals",
        {
            description: "Génère un graphique à barres horizontales montrant la somme totale des occurrences de chaque mot sur toute la période. Utile pour comparer rapidement la fréquence globale de plusieurs mots. À utiliser uniquement si explicitement demandé par l'utilisateur.",
            inputSchema: z.object({
                mot: z.string().describe("Mot(s) à comparer, séparés par des virgules"),
                corpus: z.string().default("presse").describe("Code du corpus"),
                from_year: z.number().optional().describe("Année de début"),
                to_year: z.number().optional().describe("Année de fin")
            })
        },
        async ({ mot, corpus = "presse", from_year, to_year }) => {
            try {
                if (!mot || String(mot).trim() === "") {
                    return {
                        content: [{ type: "text", text: "Erreur: Le paramètre 'mot' est requis" }],
                        isError: true
                    };
                }

                const mots = String(mot).split(',').map(m => m.trim()).filter(Boolean);
                if (mots.length === 0) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucun mot valide" }],
                        isError: true
                    };
                }

                let imageBuffer;
                try {
                    imageBuffer = await generateTotalsChart(mots, corpus, from_year, to_year);
                } catch (genErr) {
                    const msg = genErr && genErr.message ? genErr.message : String(genErr);
                    return {
                        content: [{ type: "text", text: `Erreur génération graphique totaux: ${msg}` }],
                        isError: true
                    };
                }

                if (!imageBuffer) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucune donnée disponible" }],
                        isError: true
                    };
                }

                const filename = `totals_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
                const imageUrl = await uploadToS3(imageBuffer, filename, "image/png");

                return {
                    content: [
                        {
                            type: "text",
                            text: imageUrl
                        }
                    ]
                };

            } catch (error) {
                const msg = error && error.message ? error.message : String(error);
                console.error('gallicagram_totals error:', error);
                return {
                    content: [{ type: "text", text: `Erreur interne: ${msg}` }],
                    isError: true
                };
            }
        }
    );

    // 4. TOOL : Liste des corpus
    server.registerTool(
        "list_corpus",
        {
            description: "Liste tous les corpus disponibles pour l'analyse lexicale",
            inputSchema: z.object({})
        },
        async () => {
            const list = Object.entries(CORPUS_LABELS)
                .map(([code, label]) => `• ${code}: ${label}`)
                .join('\n');
            return {
                content: [{ type: "text", text: `Corpus disponibles:\n\n${list}` }]
            };
        }
    );

    // 5. NOUVEAU TOOL : Contexte (extraits)
    server.registerTool(
        "gallicagram_context",
        {
            description: "Récupère le contexte (extraits de texte) d'un ngram donné pour une date donnée (année, mois ou jour) dans les corpus Gallica, Le Monde, Persée ou RAP. Utile pour comprendre comment un mot était utilisé à une période précise.",
            inputSchema: z.object({
                mot: z.string().describe("Le mot ou ngram à rechercher"),
                date: z.string().describe("La date précise (ex: '1789', '1789-07', '1789-07-14')"),
                corpus: z.string().default("presse").describe("Code du corpus (presse, livres, lemonde, persee, rap, etc.)"),
                limit: z.number().default(5).describe("Nombre maximum d'occurrences à renvoyer (max 10)")
            })
        },
        async ({ mot, date, corpus = "presse", limit = 5 }) => {
            try {
                const text = await getContext(mot, date, corpus, limit);
                return {
                    content: [{ type: "text", text }]
                };
            } catch (error) {
                console.error('gallicagram_context error:', error);
                return {
                    content: [{ type: "text", text: `Erreur: ${error.message}` }],
                    isError: true
                };
            }
        }
    );

    return server;
}

// Vercel serverless function handler
export default async function handler(req, res) {
    console.log(`${req.method} ${req.url}`);

    // CRITICAL: Create fresh instances for EACH request (stateless mode)
    // This prevents request ID collisions and ensures proper isolation
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined  // undefined = stateless mode
    });

    try {
        // Clean up when the request closes
        res.on('close', () => {
            console.log('Request closed, cleaning up...');
            transport.close();
            server.close();
        });

        // Connect and handle the request
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);

    } catch (error) {
        console.error('MCP handler error:', error);

        // Ensure cleanup on error
        try {
            transport.close();
            server.close();
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

        // Send error response if headers not sent
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error'
                },
                id: null
            });
        }
    }
}
