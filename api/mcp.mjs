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
    server.tool(
        "gallicagram_chart",
        {
            mot: { type: "string", description: "Mot(s) à analyser, séparés par des virgules" },
            corpus: { type: "string", description: "Code corpus (ex: presse, lemonde)", default: "presse" },
            from_year: { type: "number", description: "Année de début" },
            to_year: { type: "number", description: "Année de fin" },
            smooth: { type: "boolean", description: "Lissage", default: true }
        },
        async ({ mot, corpus = "presse", from_year, to_year, smooth = true }) => {
            try {
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

    server.tool(
        "list_corpus",
        {},
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
