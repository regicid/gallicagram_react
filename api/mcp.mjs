import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { generateChart, generateHistogram, generateTotalsChart, generateAnalysisPrompt, CORPUS_LABELS } from './_lib/gallicagram.mjs';
import { uploadToS3 } from './_lib/s3.mjs';

// Factory function to create a new server instance
function createServer() {
    const server = new McpServer({
        name: "Gallicagram",
        version: "1.0.0"
    });

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

                generateAnalysisPrompt(mots, corpus, from_year, to_year);

                return {
                    content: [
                        {
                            type: "text",
                            url: imageUrl
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

    // 2. Histogramme
    server.registerTool(
        "gallicagram_histogram",
        {
            description: "Génère un histogramme vertical montrant le nombre d'occurrences (n).",
            inputSchema: z.object({
                mot: z.string().describe("Mot(s) à analyser, séparés par des virgules"),
                corpus: z.string().default("presse"),
                from_year: z.number().optional(),
                to_year: z.number().optional()
            })
        },
        async ({ mot, corpus = "presse", from_year, to_year }) => {
            try {
                const mots = String(mot).split(',').map(m => m.trim()).filter(Boolean);
                const imageBuffer = await generateHistogram(mots, corpus, from_year, to_year);
                const filename = `histogram_${Date.now()}.png`;
                const imageUrl = await uploadToS3(imageBuffer, filename, "image/png");

                return {
                    content: [{ type: "image", url: imageUrl }]
                };
            } catch (e) {
                return { content: [{ type: "text", text: e.message }], isError: true };
            }
        }
    );

    // 3. Totaux
    server.registerTool(
        "gallicagram_totals",
        {
            description: "Graphique à barres horizontales des totaux.",
            inputSchema: z.object({
                mot: z.string(),
                corpus: z.string().default("presse"),
                from_year: z.number().optional(),
                to_year: z.number().optional()
            })
        },
        async ({ mot, corpus = "presse", from_year, to_year }) => {
            try {
                const mots = String(mot).split(',').map(m => m.trim()).filter(Boolean);
                const imageBuffer = await generateTotalsChart(mots, corpus, from_year, to_year);
                const filename = `totals_${Date.now()}.png`;
                const imageUrl = await uploadToS3(imageBuffer, filename, "image/png");

                return {
                    content: [{ type: "image", url: imageUrl }]
                };
            } catch (e) {
                return { content: [{ type: "text", text: e.message }], isError: true };
            }
        }
    );

    // 4. Liste corpus
    server.registerTool("list_corpus", {
        description: "Liste tous les corpus disponibles",
        inputSchema: z.object({})
    }, async () => {
        const list = Object.entries(CORPUS_LABELS)
            .map(([code, label]) => `• ${code}: ${label}`)
            .join('\n');
        return { content: [{ type: "text", text: `Corpus disponibles:\n\n${list}` }] };
    });

    return server;
}

export default async function handler(req, res) {
    console.log(`${req.method} ${req.url}`);

    // --- CORS + Accept headers (FIX MCP) ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    const accept = req.headers.accept || "";
    if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
        res.status(406).json({
            jsonrpc: "2.0",
            error: {
                code: -32000,
                message: "Not Acceptable: Client must accept both application/json and text/event-stream"
            },
            id: null
        });
        return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
    });

    try {
        res.on("close", () => {
            transport.close();
            server.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res);
    } catch (error) {
        console.error("MCP handler error:", error);

        try {
            transport.close();
            server.close();
        } catch {}

        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null
            });
        }
    }
}