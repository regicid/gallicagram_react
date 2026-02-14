
import React from 'react';
import { Box, Typography, Paper, Container, Link } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

function MCPPage() {
    const [copied, setCopied] = React.useState(false);

    // Use window.location to get the current origin
    const origin = window.location.origin;
    const sseUrl = `${origin}/api/mcp`;

    const handleCopy = () => {
        navigator.clipboard.writeText(sseUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Gallicagram MCP Server
                </Typography>

                <Typography variant="body1" paragraph>
                    Ce projet expose un serveur MCP (Model Context Protocol) permettant à des assistants IA (comme Claude Desktop) d'interagir directement avec les données de Gallicagram pour générer des graphiques et des analyses.
                </Typography>

                <Box sx={{ my: 4, p: 3, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        URL de connexion SSE :
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'white', p: 1, borderRadius: 1, border: '1px solid #ddd' }}>
                        <Typography variant="body2" sx={{ flexGrow: 1, fontFamily: 'monospace', ml: 1 }}>
                            {sseUrl}
                        </Typography>
                        <Tooltip title={copied ? "Copié !" : "Copier l'URL"}>
                            <IconButton onClick={handleCopy} size="small">
                                <ContentCopyIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                <Typography variant="h6" gutterBottom>
                    Comment l'utiliser avec Claude Desktop ?
                </Typography>

                <Typography variant="body2" component="div">
                    <ol>
                        <li>Ouvrez votre fichier de configuration <code>claude_desktop_config.json</code></li>
                        <li>Ajoutez la configuration suivante :</li>
                    </ol>
                    <Box component="pre" sx={{ bgcolor: '#2d2d2d', color: '#fff', p: 2, borderRadius: 1, overflowX: 'auto', fontSize: '0.85rem' }}>
                        {`{
  "mcpServers": {
    "gallicagram-sse": {
      "command": "",
      "url": "${sseUrl}",
      "transport": "sse"
    }
  }
}`}
                    </Box>
                    <ol start="3">
                        <li>Redémarrez Claude Desktop</li>
                    </ol>
                </Typography>

                <Box sx={{ mt: 4 }}>
                    <Typography variant="caption" color="text.secondary">
                        Note : Cette implémentation utilise Vercel Serverless Functions. La connexion SSE peut être interrompue après une période d'inactivité ou par les limites de temps d'exécution de Vercel. Si cela se produit, Claude devrait se reconnecter automatiquement lors de la prochaine requête.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
}

export default MCPPage;
