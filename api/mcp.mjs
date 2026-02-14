import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { generateChart, generateAnalysisPrompt, CORPUS_LABELS } from './_lib/gallicagram.mjs';

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
            inputSchema: {
                type: "object",
                properties: {
                    mot: { 
                        type: "string", 
                        description: "Mot(s) à analyser, séparés par des virgules (ex: 'révolution,liberté')" 
                    },
                    corpus: { 
                        type: "string", 
                        description: "Code du corpus (ex: presse, lemonde, livres)",
                        default: "presse"
                    },
                    from_year: { 
                        type: "number", 
                        description: "Année de début (optionnel)" 
                    },
                    to_year: { 
                        type: "number", 
                        description: "Année de fin (optionnel)" 
                    },
                    smooth: { 
                        type: "boolean", 
                        description: "Appliquer un lissage des courbes",
                        default: true 
                    }
                },
                required: ["mot"]
            },
            outputSchema: {
                type: "object",
                properties: {
                    content: {
                        type: "array",
                        items: {
                            oneOf: [
                                {
                                    type: "object",
                                    properties: {
                                        type: { type: "string", enum: ["image"] },
                                        data: { type: "string", description: "Image base64 encodée" },
                                        mimeType: { type: "string", enum: ["image/png"] }
                                    },
                                    required: ["type", "data", "mimeType"]
                                },
                                {
                                    type: "object",
                                    properties: {
                                        type: { type: "string", enum: ["text"] },
                                        text: { type: "string", description: "Prompt d'analyse et métadonnées" }
                                    },
                                    required: ["type", "text"]
                                }
                            ]
                        },
                        description: "Graphique PNG + prompt d'analyse pour VLM"
                    },
                    isError: {
                        type: "boolean",
                        description: "Indique si une erreur s'est produite"
                    }
                },
                required: ["content"]
            }
        },
        async ({ mot, corpus = "presse", from_year, to_year, smooth = true }) => {
            try {
                if (!mot) {
                    return {
                        content: [{ type: "text", text: "Erreur: Le paramètre 'mot' est requis" }],
                        isError: true
                    };
                }

                const mots = mot.split(',').map(m => m.trim()).filter(Boolean);
                const imageBase64 = await generateChart(mots, corpus, from_year, to_year, smooth);
                const analysisPrompt = generateAnalysisPrompt(mots, corpus, from_year, to_year);

                return {
                    content: [
                        {
                            type: "image",
                            data: imageBase64,
                            mimeType: "image/png"
                        },
                        {
                            type: "text",
                            text: `📊 Graphique généré pour ${mot}\n\n${analysisPrompt}`
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Erreur: ${error.message}` }],
                    isError: true
                };
            }
        }
    );

    server.registerTool(
        "list_corpus",
        {
            description: "Liste tous les corpus disponibles pour l'analyse lexicale",
            inputSchema: {
                type: "object",
                properties: {},
                required: []
            },
            outputSchema: {
                type: "object",
                properties: {
                    content: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["text"] },
                                text: { type: "string", description: "Liste formatée des corpus disponibles" }
                            },
                            required: ["type", "text"]
                        },
                        description: "Liste des corpus avec leurs codes et labels"
                    }
                },
                required: ["content"]
            }
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
