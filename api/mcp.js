
import { server } from './_lib/mcp.js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";

// Global transport instance
// In a serverless environment, if the container is reused, this will persist.
// If not, a new one is created.
// StreamableHTTPServerTransport handles connection management internally for the request duration.
let transport;

if (!transport) {
    console.log("Initializing global StreamableHTTPServerTransport");
    transport = new StreamableHTTPServerTransport();
    server.connect(transport);
}

export default async function handler(req, res) {
    console.log(`${req.method} ${req.url}`);

    // Re-ensure transport exists (just in case)
    if (!transport) {
        transport = new StreamableHTTPServerTransport();
        await server.connect(transport);
    }

    try {
        // Handle the request
        // Vercel parses JSON body automatically.
        // transport.handleRequest(req, res, parsedBody)
        await transport.handleRequest(req, res, req.body);
    } catch (e) {
        console.error("Transport error:", e);
        if (!res.headersSent) {
            res.status(500).send(e.message);
        }
    }
}
