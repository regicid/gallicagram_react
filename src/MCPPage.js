import React from 'react';
import { Box, Typography, Paper, Container, Grid, Divider, Chip, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HistoryIcon from '@mui/icons-material/History';
import ListIcon from '@mui/icons-material/List';
import DescriptionIcon from '@mui/icons-material/Description';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function ToolCard({ name, description, parameters, example, icon }) {
    return (
        <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #eee', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ p: 1, bgcolor: '#e3f2fd', borderRadius: 1, mr: 2, display: 'flex' }}>
                    {icon}
                </Box>
                <Typography variant="h6" component="div" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1976d2' }}>
                    {name}
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
                {description}
            </Typography>

            <Typography variant="subtitle2" gutterBottom fontWeight="bold">Paramètres :</Typography>
            <Box sx={{ mb: 2 }}>
                {parameters.map((param, index) => (
                    <Chip key={index} label={param} size="small" sx={{ mr: 0.5, mb: 0.5, fontSize: '0.75rem' }} />
                ))}
            </Box>

            <Typography variant="subtitle2" gutterBottom fontWeight="bold">Exemple :</Typography>
            <Box component="pre" sx={{ bgcolor: '#f8f9fa', p: 1.5, borderRadius: 1, fontSize: '0.85rem', overflowX: 'auto', border: '1px solid #e0e0e0' }}>
                {example}
            </Box>
        </Paper>
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
                    <Paper elevation={3} sx={{ p: 4, borderRadius: 3, position: 'sticky', top: 24 }}>
                        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" sx={{ color: '#1976d2' }}>
                            Gallicagram MCP
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        <Typography variant="body1" paragraph>
                            Utilisez toute la puissance de Gallicagram directement dans vos assistants IA (Mistral, Claude, ChatGPT via client MCP).
                        </Typography>

                        <Box sx={{ my: 4, p: 3, bgcolor: '#f5f7fa', borderRadius: 2, border: '1px solid #e0e6ed' }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="text.secondary">
                                URL DU SERVEUR (HTTP SSE)
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'white', p: 1.5, borderRadius: 1.5, border: '1px solid #ced4da' }}>
                                <Typography variant="body2" sx={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {sseUrl}
                                </Typography>
                                <Tooltip title={copied ? "Copié !" : "Copier l'URL"}>
                                    <IconButton onClick={handleCopy} size="small" color="primary">
                                        <HistoryIcon sx={{ transform: copied ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }} />
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        <Typography variant="h6" gutterBottom fontWeight="bold">
                            Configuration du client
                        </Typography>
                        <Box component="pre" sx={{ bgcolor: '#212529', color: '#f8f9fa', p: 2, borderRadius: 2, fontSize: '0.8rem', overflowX: 'auto', mb: 3 }}>
                            {`{
  "name": "gallicagram",
  "url": "${sseUrl}",
  "transport": "streamable-http"
}`}
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                            <HelpOutlineIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                            Compatible avec <strong>Le Chat (Mistral)</strong>, <strong>Claude Desktop</strong> et tout client supportant le transport <code>streamable-http</code>.
                        </Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={7}>
                    <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                        <ListItemIcon sx={{ minWidth: 40 }}><ListIcon color="primary" /></ListItemIcon>
                        Outils disponibles
                    </Typography>

                    {tools.map((tool, index) => (
                        <ToolCard key={index} {...tool} />
                    ))}

                    <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mt: 6, mb: 3, display: 'flex', alignItems: 'center' }}>
                        <ListItemIcon sx={{ minWidth: 40 }}><HistoryIcon color="primary" /></ListItemIcon>
                        Corpus Principaux
                    </Typography>

                    <Paper elevation={1} sx={{ p: 0, borderRadius: 2, overflow: 'hidden', border: '1px solid #eee' }}>
                        <List disablePadding>
                            {[
                                { code: 'presse', label: 'Presse & Livres (Gallica)', desc: 'Plus de 150 milliards de mots du XVIIe au XXe siècle.' },
                                { code: 'lemonde', label: 'Archives Le Monde', desc: 'Le quotidien de référence depuis 1944.' },
                                { code: 'persee', label: 'Persée', desc: 'Revues scientifiques et académiques.' },
                                { code: 'rap', label: 'Corpus Rap', desc: 'Paroles de rap français (1990-2024).' }
                            ].map((c, i) => (
                                <React.Fragment key={c.code}>
                                    <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                                        <ListItemText
                                            primary={<Box component="span" sx={{ fontWeight: 'bold', fontFamily: 'monospace', bgcolor: '#f0f0f0', px: 1, borderRadius: 1, mr: 1 }}>{c.code}</Box>}
                                            secondary={
                                                <Box component="span" sx={{ display: 'block' }}>
                                                    <Typography component="span" variant="body2" color="text.primary" sx={{ fontWeight: 'bold' }}>{c.label}</Typography>
                                                    {" — " + c.desc}
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                    {i < 3 && <Divider component="li" />}
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
