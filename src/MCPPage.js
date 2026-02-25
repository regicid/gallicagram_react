import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Container, Grid, Divider,
    Accordion, AccordionSummary, AccordionDetails,
    TextField, Button, CircularProgress, Alert, Skeleton
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ListIcon from '@mui/icons-material/List';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const MCP_URL = 'https://www.gallicagram.com/api/mcp';

const MCP_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
};

async function mcpFetch(method, params = {}, id = 1) {
    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: MCP_HEADERS,
        body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle SSE / text-event-stream response
    if (contentType.includes('text/event-stream')) {
        const text = await response.text();
        // SSE format: "event: message\ndata: {...}\n"
        // Find the data line that follows an "event: message" block
        const blocks = text.split('\n\n').filter(Boolean);
        for (const block of blocks.reverse()) {
            if (block.includes('event: message') || block.includes('event:message')) {
                const dataLine = block.split('\n').find(l => l.startsWith('data:'));
                if (dataLine) {
                    return JSON.parse(dataLine.replace(/^data:\s*/, ''));
                }
            }
        }
        // Fallback: take the last data: line
        const dataLines = text.split('\n').filter(l => l.startsWith('data:'));
        if (!dataLines.length) throw new Error('Réponse SSE vide ou format inattendu');
        return JSON.parse(dataLines[dataLines.length - 1].replace(/^data:\s*/, ''));
    }

    return response.json();
}

const getToolIcon = (name) => {
    if (name.includes('chart')) return <ShowChartIcon color="primary" />;
    if (name.includes('histogram') || name.includes('bar')) return <BarChartIcon color="primary" />;
    if (name.includes('totals')) return <BarChartIcon sx={{ transform: 'rotate(90deg)', color: '#1976d2' }} />;
    if (name.includes('context') || name.includes('text')) return <DescriptionIcon color="primary" />;
    if (name.includes('list')) return <ListIcon color="primary" />;
    return <HelpOutlineIcon color="primary" />;
};

function ToolCard({ tool, onExecute }) {
    const { name, description, inputSchema } = tool;
    const properties = inputSchema?.properties || {};
    const required = inputSchema?.required || [];

    const [params, setParams] = useState(() => {
        const defaults = {};
        Object.entries(properties).forEach(([key, value]) => {
            if (value.default !== undefined) defaults[key] = String(value.default);
        });
        return defaults;
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleParamChange = (pName, value) => {
        setParams(prev => ({ ...prev, [pName]: value }));
    };

    const handleRun = async (e) => {
        e.stopPropagation();
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const cleanedArgs = {};
            Object.entries(params).forEach(([key, value]) => {
                const prop = properties[key];
                if (!prop) { cleanedArgs[key] = value; return; }
                if (prop.type === 'number' || prop.type === 'integer') {
                    cleanedArgs[key] = parseFloat(value);
                } else if (prop.type === 'boolean') {
                    cleanedArgs[key] = value === 'true' || value === true;
                } else {
                    cleanedArgs[key] = value;
                }
            });

            const data = await onExecute(name, cleanedArgs);
            if (data.isError) {
                setError(data.content?.[0]?.text || 'Une erreur est survenue');
            } else {
                setResult(data.content);
            }
        } catch (err) {
            setError(err.message || "Erreur lors de l'exécution");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Accordion
            elevation={0}
            sx={{
                mb: 2,
                borderRadius: '12px !important',
                border: '1px solid #e0e6ed',
                overflow: 'hidden',
                '&:before': { display: 'none' },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                    borderColor: '#1976d2',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    transform: 'translateY(-2px)'
                }
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon color="primary" />}
                sx={{ px: 3, py: 1, '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
            >
                <Box sx={{
                    p: 1.2,
                    bgcolor: 'rgba(25, 118, 210, 0.08)',
                    borderRadius: '10px',
                    mr: 2,
                    display: 'flex',
                    color: '#1976d2'
                }}>
                    {getToolIcon(name)}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" component="div" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a237e' }}>
                        {name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {description?.substring(0, 80)}...
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                <Divider sx={{ mb: 2, opacity: 0.6 }} />
                <Typography variant="body2" color="text.secondary" paragraph sx={{ lineHeight: 1.6 }}>
                    {description}
                </Typography>

                <Typography variant="subtitle2" gutterBottom fontWeight="700" sx={{ color: '#546e7a', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', mt: 2 }}>
                    Arguments
                </Typography>
                <Box sx={{ mb: 2.5 }}>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        {Object.entries(properties).map(([pName, prop], index) => {
                            const isRequired = required.includes(pName);
                            return (
                                <Grid item xs={12} sm={6} key={index}>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        label={pName + (isRequired ? ' *' : '')}
                                        variant="outlined"
                                        value={params[pName] || ''}
                                        onChange={(e) => handleParamChange(pName, e.target.value)}
                                        placeholder={prop.description || ''}
                                        helperText={prop.description}
                                        FormHelperTextProps={{ sx: { fontSize: '0.65rem' } }}
                                        sx={{ '& .MuiInputLabel-root': { fontSize: '0.8rem' } }}
                                    />
                                </Grid>
                            );
                        })}
                        {Object.keys(properties).length === 0 && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                    Cet outil ne prend aucun argument.
                                </Typography>
                            </Grid>
                        )}
                    </Grid>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                        onClick={handleRun}
                        disabled={loading}
                        sx={{ borderRadius: '20px', px: 3, textTransform: 'none' }}
                    >
                        {loading ? 'Exécution...' : "Tester l'outil"}
                    </Button>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
                )}

                {result && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom fontWeight="700" sx={{ color: '#546e7a', textTransform: 'uppercase', fontSize: '0.7rem', mb: 1 }}>
                            Résultat
                        </Typography>
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f8f9fa',
                            borderRadius: 2,
                            border: '1px solid #e0e0e0',
                            maxWidth: '100%',
                            overflow: 'auto'
                        }}>
                            {result.map((item, idx) => {
                                if (item.type === 'text') {
                                    if (item.text.startsWith('http')) {
                                        return <Box key={idx} component="img" src={item.text} sx={{ maxWidth: '100%', borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />;
                                    }
                                    return (
                                        <Typography key={idx} variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {item.text}
                                        </Typography>
                                    );
                                }
                                return null;
                            })}
                        </Box>
                    </Box>
                )}
            </AccordionDetails>
        </Accordion>
    );
}

function MCPPage() {
    const [copied, setCopied] = React.useState(false);
    const [tools, setTools] = useState([]);
    const [loadingTools, setLoadingTools] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        mcpFetch('tools/list')
            .then(data => {
                if (data.error) throw new Error(data.error.message);
                setTools(data.result?.tools || []);
            })
            .catch(err => {
                console.error('Failed to fetch tools:', err);
                setFetchError(err.message);
            })
            .finally(() => setLoadingTools(false));
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(MCP_URL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const callTool = async (toolName, args) => {
        const data = await mcpFetch('tools/call', { name: toolName, arguments: args }, Date.now());
        if (data.error) throw new Error(data.error.message || 'Erreur MCP');
        return data.result;
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
            <Box sx={{ mb: 4 }}>
                <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1">← {t('Back to Gallicagram')}</Typography>
                </Link>
            </Box>

            <Grid container spacing={4}>
                {/* Left panel */}
                <Grid item xs={12} md={5}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 4,
                            borderRadius: 4,
                            position: 'sticky',
                            top: 24,
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
                            border: '1px solid #e3f2fd',
                            boxShadow: '0 10px 40px rgba(25, 118, 210, 0.05)'
                        }}
                    >
                        <Typography
                            variant="h4"
                            component="h1"
                            gutterBottom
                            fontWeight="800"
                            sx={{
                                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 1
                            }}
                        >
                            Gallicagram MCP
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
                            Model Context Protocol
                        </Typography>

                        <Divider sx={{ mb: 3, opacity: 0.6 }} />

                        <Typography variant="body1" paragraph sx={{ color: '#455a64', lineHeight: 1.7 }}>
                            Intégrez Gallicagram dans vos assistants IA (Mistral, Claude, etc.) pour des analyses historiques et linguistiques sans quitter votre chat.
                        </Typography>

                        <Box sx={{ my: 4, p: 3, bgcolor: '#f1f5f9', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="700" color="#64748b" sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                URL DU SERVEUR
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'white', p: 1, pl: 2, borderRadius: 2, border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <Typography variant="body2" sx={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {MCP_URL}
                                </Typography>
                                <Tooltip title={copied ? 'Copié !' : 'Copier'}>
                                    <IconButton onClick={handleCopy} size="small" sx={{ color: copied ? '#4caf50' : '#1976d2', ml: 1 }}>
                                        <ContentCopyIcon fontSize="small" sx={{ transform: copied ? 'scale(1.1)' : 'none', transition: 'all 0.3s' }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        <Typography variant="subtitle2" gutterBottom fontWeight="700" sx={{ color: '#546e7a', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                            Configuration (JSON)
                        </Typography>
                        <Box component="pre" sx={{
                            bgcolor: '#1e1e1e',
                            color: '#e0e0e0',
                            p: 2.5,
                            borderRadius: 3,
                            fontSize: '0.8rem',
                            overflowX: 'auto',
                            mb: 3,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            border: '1px solid #333'
                        }}>
                            {`{\n  "name": "gallicagram",\n  "url": "${MCP_URL}",\n  "transport": "streamable-http"\n}`}
                        </Box>

                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(25, 118, 210, 0.02)', borderColor: 'rgba(25, 118, 210, 0.1)' }}>
                            <Typography variant="body2" color="#455a64" sx={{ display: 'flex', alignItems: 'start' }}>
                                <HelpOutlineIcon sx={{ fontSize: 18, mr: 1, mt: 0.2, color: '#1976d2' }} />
                                <span>
                                    Compatible avec <strong>Le Chat (Mistral)</strong>, <strong>Claude Desktop</strong> et tout client supportant <code>streamable-http</code>.
                                </span>
                            </Typography>
                        </Paper>
                    </Paper>
                </Grid>

                {/* Right panel — tools only */}
                <Grid item xs={12} md={7}>
                    <Typography variant="h5" gutterBottom fontWeight="800" sx={{ mb: 3, color: '#1a237e', display: 'flex', alignItems: 'center' }}>
                        <ListIcon sx={{ mr: 1.5, color: '#1976d2' }} />
                        Outils disponibles
                    </Typography>

                    {loadingTools ? (
                        [1, 2, 3].map(i => (
                            <Skeleton key={i} variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 3 }} />
                        ))
                    ) : fetchError ? (
                        <Alert severity="error">
                            Impossible de charger la liste des outils : {fetchError}
                        </Alert>
                    ) : (
                        tools.map((tool, index) => (
                            <ToolCard key={index} tool={tool} onExecute={callTool} />
                        ))
                    )}
                </Grid>
            </Grid>
        </Container>
    );
}

export default MCPPage;
