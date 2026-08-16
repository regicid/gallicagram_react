import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Grid,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Skeleton,
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const REAL_MCP_URL = 'https://shiny.ens-paris-saclay.fr/guni/v2/mcp/mcp';

const getMcpClientUrl = () => {
  if (typeof window === 'undefined') {
    return REAL_MCP_URL;
  }
  // Toujours passer par le proxy dans le navigateur pour éviter CORS / 405
  return new URL('/mcp-proxy', window.location.origin).toString();
};

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
        if (!prop) {
          cleanedArgs[key] = value;
          return;
        }

        if (prop.type === 'number' || prop.type === 'integer') {
          cleanedArgs[key] = value === '' || value === null || value === undefined ? undefined : Number(value);
        } else if (prop.type === 'boolean') {
          cleanedArgs[key] = value === 'true' || value === true;
        } else {
          cleanedArgs[key] = value;
        }
      });

      const data = await onExecute(name, cleanedArgs);
      if (data?.isError) {
        setError(data.content?.[0]?.text || 'Une erreur est survenue');
      } else {
        setResult(data?.content || []);
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'exécution');
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
          transform: 'translateY(-2px)',
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon color="primary" />}
        sx={{ px: 3, py: 1, '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
      >
        <Box
          sx={{
            p: 1.2,
            bgcolor: 'rgba(25, 118, 210, 0.08)',
            borderRadius: '10px',
            mr: 2,
            display: 'flex',
            color: '#1976d2',
          }}
        >
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
        
        {/* Description de l'outil en Markdown */}
        <Box sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6, mb: 2 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {description}
          </ReactMarkdown>
        </Box>

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
                    // Rendu de la description de l'argument en Markdown
                    helperText={
                    prop.description ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {prop.description}
                        </ReactMarkdown>
                    ) : null
                    }
                    FormHelperTextProps={{
                    component: 'div', // Important pour autoriser les balises de bloc Markdown sans warning React
                    sx: {
                        fontSize: '0.7rem',
                        color: 'text.secondary',
                        mt: 0.5,
                        lineHeight: 1.4,
                        '& p': { m: 0 },
                        '& code': {
                        fontFamily: 'monospace',
                        bgcolor: 'rgba(0, 0, 0, 0.06)',
                        px: 0.5,
                        py: 0.1,
                        borderRadius: '4px',
                        color: '#d32f2f',
                        },
                        '& a': {
                        color: '#1976d2',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                        },
                        '& strong': { fontWeight: 600 },
                        '& ul, & ol': { pl: 2, m: 0 },
                    },
                    }}
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

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {result && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="700" sx={{ color: '#546e7a', textTransform: 'uppercase', fontSize: '0.7rem', mb: 1 }}>
              Résultat
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: '#f8f9fa',
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                maxWidth: '100%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                // Style soigné pour le contenu Markdown
                '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                '& pre': { bgcolor: '#1e1e1e', color: '#f8f9fa', p: 1.5, borderRadius: 1.5, overflowX: 'auto' },
                '& code': { fontFamily: 'monospace', bgcolor: 'rgba(0,0,0,0.06)', px: 0.6, py: 0.2, borderRadius: 1 },
                '& pre code': { bgcolor: 'transparent', p: 0 },
                '& table': { borderCollapse: 'collapse', width: '100%', my: 1 },
                '& th, & td': { border: '1px solid #cbd5e1', p: '6px 10px', fontSize: '0.85rem' },
                '& th': { bgcolor: '#f1f5f9', fontWeight: 600 },
                '& ul, & ol': { pl: 3, my: 0.5 },
              }}
            >
              {result.map((item, idx) => {
                // 1. Images Base64
                if (item?.type === 'image' && item.data) {
                  const mimeType = item.mimeType || 'image/png';
                  return (
                    <Box key={idx} sx={{ textAlign: 'center', my: 1 }}>
                      <Box
                        component="img"
                        src={`data:${mimeType};base64,${item.data}`}
                        alt={`Résultat outil ${name}`}
                        sx={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
                      />
                    </Box>
                  );
                }

                // 2. Texte rendu en Markdown
                if (item?.type === 'text') {
                  if (item.text?.startsWith('http') && item.text.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)) {
                    return (
                      <Box key={idx} sx={{ textAlign: 'center', my: 1 }}>
                        <Box
                          component="img"
                          src={item.text}
                          alt="Résultat"
                          sx={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        />
                      </Box>
                    );
                  }
                  return (
                    <Box key={idx} sx={{ fontSize: '0.85rem', color: '#24292f' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.text}
                      </ReactMarkdown>
                    </Box>
                  );
                }

                // 3. Objets / JSON bruts
                if (item && typeof item === 'object') {
                  return (
                    <Typography key={idx} variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem', m: 0 }}>
                      {JSON.stringify(item, null, 2)}
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
  const [copied, setCopied] = useState(false);
  const [tools, setTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [client, setClient] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    let mountedClient = null;

    const connectToMcp = async () => {
      try {
        const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
          import('@modelcontextprotocol/sdk/client/index.js'),
          import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
        ]);

        const clientUrl = getMcpClientUrl();
        const transport = new StreamableHTTPClientTransport(new URL(clientUrl, window.location.origin));
        const nextClient = new Client(
          { name: 'gallicagram-web-client', version: '1.0.0' },
          { capabilities: {} }
        );

        mountedClient = nextClient;
        await nextClient.connect(transport);
        if (cancelled) {
          await nextClient.close();
          return;
        }

        const result = await nextClient.listTools();
        setClient(nextClient);
        setTools(result.tools || []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to connect to MCP server:', err);

          const message = String(err?.message || '');
          const normalized = message.toLowerCase();

          if (normalized.includes('unexpected content type') || normalized.includes('text/html') || normalized.includes('406') || normalized.includes('405')) {
            setFetchError('Le client navigateur envoie des en-têtes MCP spécifiques (mcp-session-id / mcp-protocol-version) et le backend ou le proxy ne les autorise pas en CORS. C’est ce qui provoque le HTML/406 au lieu d’un flux MCP JSON. Vérifiez les headers CORS du serveur et la route MCP.');
          } else {
            setFetchError(message || 'Impossible d\'établir la connexion MCP');
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingTools(false);
        }
      }
    };

    connectToMcp();

    return () => {
      cancelled = true;
      if (mountedClient && typeof mountedClient.close === 'function') {
        mountedClient.close().catch(() => {});
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(REAL_MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const callTool = async (toolName, args) => {
    if (!client) {
      throw new Error('Client MCP non connecté');
    }

    const response = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return response;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ mb: 4 }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
          <Typography variant="body1">← {t('Back to Gallicagram')}</Typography>
        </Link>
      </Box>

      <Grid container spacing={4}>
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
              boxShadow: '0 10px 40px rgba(25, 118, 210, 0.05)',
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
                mb: 1,
              }}
            >
              Gallicagram MCP
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
                  {REAL_MCP_URL}
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
            <Box
              component="pre"
              sx={{
                bgcolor: '#1e1e1e',
                color: '#e0e0e0',
                p: 2.5,
                borderRadius: 3,
                fontSize: '0.8rem',
                overflowX: 'auto',
                mb: 3,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                border: '1px solid #333',
              }}
            >
              {`{\n  "name": "gallicagram",\n  "url": "${REAL_MCP_URL}",\n  "transport": "streamable-http"\n}`}
            </Box>
          </Paper>
        </Grid>

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
            <Alert severity="error">Impossible de charger la liste des outils : {fetchError}</Alert>
          ) : (
            tools.map((tool, index) => <ToolCard key={index} tool={tool} onExecute={callTool} />)
          )}
        </Grid>
      </Grid>
    </Container>
  );
}

export default MCPPage;
