import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function MCPPage() {
    const [copied, setCopied] = React.useState(false);
    const { t } = useTranslation();
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
            <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontSize: '1rem' }}>
                ← {t('Back to Gallicagram')}
            </Link>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Gallicagram MCP Server
                </Typography>

                <Typography variant="body1" paragraph>
                    Ce projet expose un serveur MCP (Model Context Protocol) permettant à des assistants IA compatibles MCP
                    d'interagir directement avec les données de Gallicagram pour générer des graphiques et des analyses.
                </Typography>

                <Box sx={{ my: 4, p: 3, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        URL du serveur MCP (Streamable HTTP) :
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
                    Utiliser avec Le Chat (Mistral) ou tout client MCP moderne (Streamable HTTP)
                </Typography>

                <Typography variant="body2" component="div">
                    <ol>
                        <li>Ouvrez les paramètres de votre client compatible MCP (ex : Le Chat avec plugins MCP)</li>
                        <li>Ajoutez un nouveau serveur MCP avec :</li>
                    </ol>

                    <Box component="pre" sx={{ bgcolor: '#2d2d2d', color: '#fff', p: 2, borderRadius: 1, overflowX: 'auto', fontSize: '0.85rem' }}>
{`{
  "name": "gallicagram",
  "url": "${sseUrl}",
  "transport": "streamable-http"
}`}
                    </Box>

                    <ol start="3">
                        <li>Rechargez votre assistant ou démarrez une nouvelle conversation</li>
                        <li>Demandez par exemple :
                            <Box component="pre" sx={{ bgcolor: '#f5f5f5', p: 1.5, borderRadius: 1, mt: 1 }}>
                                Compare l’évolution des mots "révolution" et "liberté" dans la presse du XIXe siècle
                            </Box>
                        </li>
                    </ol>
                </Typography>

            </Paper>
        </Container>
    );
}

export default MCPPage;
