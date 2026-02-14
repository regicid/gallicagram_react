import { server } from './_lib/mcp_server.mjs';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Global transport instance
let transport;

export default async function handler(req, res) {
    console.log(`${req.method} ${req.url}`);

    try {
        // Initialize transport if needed
        if (!transport) {
            console.log("Initializing StreamableHTTPServerTransport");
            transport = new StreamableHTTPServerTransport();
            await server.connect(transport);
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
    } catch (e) {
        console.error("Transport error:", e);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        }
    }
}
