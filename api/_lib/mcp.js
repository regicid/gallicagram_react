import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateChart, generateAnalysisPrompt, CORPUS_LABELS } from './gallicagram.js';

// Singleton server instance
export const server = new McpServer({
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