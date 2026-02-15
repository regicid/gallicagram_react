import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { generateChart, generateAnalysisPrompt, CORPUS_LABELS } from './_lib/gallicagram.mjs';
import { uploadToS3 } from './_lib/s3.mjs';

// Factory function to create a new server instance
function createServer() {
    const server = new McpServer({
        name: "Gallicagram",
        version: "1.0.0"
    });

    // Register Tools
    server.registerTool(
        "gallicagram_chart",
        {
            description: "Génère un graphique de fréquence lexicale pour un ou plusieurs mots dans un corpus historique",
            inputSchema: z.object({
                mot: z.string().describe("Mot(s) à analyser, séparés par des virgules (ex: 'révolution,liberté')"),
                corpus: z.string().default("presse").describe("Code du corpus (ex: presse, lemonde, livres)"),
                from_year: z.number().optional().describe("Année de début (optionnel)"),
                to_year: z.number().optional().describe("Année de fin (optionnel)"),
                smooth: z.boolean().default(true).describe("Appliquer un lissage des courbes")
            })
        },
        async ({ mot, corpus = "presse", from_year, to_year, smooth = true }) => {
            // Toujours retourner un objet conforme à l'outputSchema.
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

                // Appel au générateur de graphique
                let imageBuffer;
                try {
                    imageBuffer = await generateChart(mots, corpus, from_year, to_year, smooth);
                } catch (genErr) {
                    // generateChart peut lever une erreur (ex: pas de données) — renvoyer une réponse structurée
                    const msg = genErr && genErr.message ? genErr.message : String(genErr);
                    return {
                        content: [{ type: "text", text: `Erreur génération graphique: ${msg}` }],
                        isError: true
                    };
                }

                // Si aucun buffer/image n'a été renvoyé (null/undefined/""), renvoyer message d'erreur structuré
                if (!imageBuffer) {
                    return {
                        content: [{ type: "text", text: "Erreur: Aucune image générée (pas de données disponibles pour ces mots)" }],
                        isError: true
                    };
                }

                // Upload vers S3
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

                // Retour conforme au schema : image + prompt d'analyse
                return {
                    content: [
                        {
                            type: "text",
                            text: imageUrl
                        }
                    ]
                };

            } catch (error) {
                // Catch ultime : s'assurer d'un format valide même en cas d'erreur d'exécution inattendue
                const msg = error && error.message ? error.message : String(error);
                console.error('gallicagram_chart unexpected error:', error);
                return {
                    content: [{ type: "text", text: `Erreur interne: ${msg}` }],
                    isError: true
                };
            }
        }
    );

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
