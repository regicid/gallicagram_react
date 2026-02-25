import React from 'react';
import {
    Box, Typography, Paper, Container, Grid, Divider, Chip, List, ListItem,
    ListItemText, ListItemIcon, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HistoryIcon from '@mui/icons-material/History';
import ListIcon from '@mui/icons-material/List';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function ToolCard({ name, description, parameters, example, icon }) {
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
                sx={{
                    px: 3,
                    py: 1,
                    '& .MuiAccordionSummary-content': { alignItems: 'center' }
                }}
            >
                <Box sx={{
                    p: 1.2,
                    bgcolor: 'rgba(25, 118, 210, 0.08)',
                    borderRadius: '10px',
                    mr: 2,
                    display: 'flex',
                    color: '#1976d2'
                }}>
                    {React.cloneElement(icon, { sx: { fontSize: 24 } })}
                </Box>
                <Box>
                    <Typography variant="subtitle1" component="div" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a237e' }}>
                        {name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {description.substring(0, 60)}...
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 3, pt: 0 }}>
                <Divider sx={{ mb: 2, opacity: 0.6 }} />
                <Typography variant="body2" color="text.secondary" paragraph sx={{ lineHeight: 1.6 }}>
                    {description}
                </Typography>

                <Typography variant="subtitle2" gutterBottom fontWeight="700" sx={{ color: '#546e7a', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', mt: 2 }}>
                    Paramètres
                </Typography>
                <Box sx={{ mb: 2.5 }}>
                    {parameters.length > 0 ? (
                        parameters.map((param, index) => (
                            <Chip
                                key={index}
                                label={param}
                                size="small"
                                sx={{
                                    mr: 0.5,
                                    mb: 0.5,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    bgcolor: 'rgba(0,0,0,0.04)',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    '& .MuiChip-label': { px: 1 }
                                }}
                            />
                        ))
                    ) : (
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>Aucun paramètre</Typography>
                    )}
                </Box>

                <Typography variant="subtitle2" gutterBottom fontWeight="700" sx={{ color: '#546e7a', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                    Exemple
                </Typography>
                <Box component="pre" sx={{
                    bgcolor: '#263238',
                    color: '#eceff1',
                    p: 2,
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    overflowX: 'auto',
                    border: '1px solid #37474f',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.2)',
                    fontFamily: '"Fira Code", "Roboto Mono", monospace'
                }}>
                    {example}
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}

function MCPPage() {
    const [copied, setCopied] = React.useState(false);
    const { t } = useTranslation();
    const origin = window.location.origin;
    const sseUrl = `${origin}/api/mcp`;

    const handleCopy = () => {
        navigator.clipboard.writeText(sseUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tools = [
        {
            name: "gallicagram_chart",
            icon: <ShowChartIcon color="primary" />,
            description: "Génère un graphique de fréquence lexicale (ligne + points) pour comparer l'évolution de mots dans le temps.",
            parameters: ["mot (requis)", "corpus", "from_year", "to_year", "smooth"],
            example: "Compare 'révolution' et 'liberté' dans le corpus 'presse' entre 1789 et 1815"
        },
        {
            name: "gallicagram_histogram",
            icon: <BarChartIcon color="primary" />,
            description: "Génère un histogramme vertical montrant le nombre brut d'occurrences (n). Idéal pour les mots rares.",
            parameters: ["mot (requis)", "corpus", "from_year", "to_year"],
            example: "Affiche l'histogramme des occurrences du mot 'télégraphe' au XIXe siècle"
        },
        {
            name: "gallicagram_totals",
            icon: <BarChartIcon sx={{ transform: 'rotate(90deg)', color: '#1976d2' }} />,
            description: "Génère un graphique à barres horizontales pour comparer la somme totale des occurrences de plusieurs mots.",
            parameters: ["mot (requis)", "corpus", "from_year", "to_year"],
            example: "Quels sont les totaux pour 'vélo', 'bicyclette' et 'automobile' entre 1880 et 1910 ?"
        },
        {
            name: "gallicagram_context",
            icon: <DescriptionIcon color="primary" />,
            description: "Récupère des extraits de texte (contexte) autour d'un mot pour une date ou période précise.",
            parameters: ["mot (requis)", "date (requis)", "corpus", "limit"],
            example: "Donne-moi des extraits de presse contenant le mot 'Bastille' en juillet 1789"
        },
        {
            name: "list_corpus",
            icon: <ListIcon color="primary" />,
            description: "Liste tous les corpus disponibles (presse, livres, lemonde, persee, rap, etc.).",
            parameters: [],
            example: "Quels sont les corpus disponibles ?"
        }
    ];

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
                                    {sseUrl}
                                </Typography>
                                <Tooltip title={copied ? "Copié !" : "Copier"}>
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
                            {`{
  "name": "gallicagram",
  "url": "${sseUrl}",
  "transport": "streamable-http"
}`}
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

                <Grid item xs={12} md={7}>
                    <Typography variant="h5" gutterBottom fontWeight="800" sx={{ mb: 3, color: '#1a237e', display: 'flex', alignItems: 'center' }}>
                        <ListIcon sx={{ mr: 1.5, color: '#1976d2' }} />
                        Outils disponibles
                    </Typography>

                    <Box sx={{ mb: 6 }}>
                        {tools.map((tool, index) => (
                            <ToolCard key={index} {...tool} />
                        ))}
                    </Box>

                    <Typography variant="h5" gutterBottom fontWeight="800" sx={{ mb: 3, color: '#1a237e', display: 'flex', alignItems: 'center' }}>
                        <HistoryIcon sx={{ mr: 1.5, color: '#1976d2' }} />
                        Corpus Principaux
                    </Typography>

                    <Paper elevation={0} sx={{ p: 1, borderRadius: 3, border: '1px solid #e0e6ed', bgcolor: '#fff' }}>
                        <List disablePadding>
                            {[
                                { code: 'presse', label: 'Presse & Livres (Gallica)', desc: 'Plus de 150 milliards de mots du XVIIe au XXe siècle.' },
                                { code: 'lemonde', label: 'Archives Le Monde', desc: 'Le quotidien de référence depuis 1944.' },
                                { code: 'persee', label: 'Persée', desc: 'Revues scientifiques et académiques.' },
                                { code: 'rap', label: 'Corpus Rap', desc: 'Paroles de rap français (1990-2024).' }
                            ].map((c, i) => (
                                <React.Fragment key={c.code}>
                                    <ListItem alignItems="flex-start" sx={{ py: 2, px: 3, borderRadius: 2, '&:hover': { bgcolor: '#f8faff' } }}>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                    <Box component="span" sx={{
                                                        fontWeight: 'bold',
                                                        fontFamily: 'monospace',
                                                        bgcolor: '#e3f2fd',
                                                        color: '#1976d2',
                                                        px: 1,
                                                        py: 0.3,
                                                        borderRadius: 1,
                                                        mr: 2,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {c.code}
                                                    </Box>
                                                    <Typography component="span" variant="subtitle2" sx={{ fontWeight: 700, color: '#1a237e' }}>
                                                        {c.label}
                                                    </Typography>
                                                </Box>
                                            }
                                            secondary={
                                                <Typography variant="body2" color="text.secondary">
                                                    {c.desc}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                    {i < 3 && <Divider component="li" sx={{ mx: 2, opacity: 0.5 }} />}
                                </React.Fragment>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
}

export default MCPPage;
