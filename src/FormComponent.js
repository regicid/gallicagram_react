
import React, { useState, useEffect, useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton, TextField, Button, Box, OutlinedInput, ListItemText, Divider, InputAdornment } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const FormComponent = ({ formData, onFormChange, onPlot, perseeData }) => {
  const { t } = useTranslation();
  const { word, corpus, resolution, revues, rubriques, byRubrique, searchMode, word2, distance, n_joker, length, stopwords } = formData;
  const [corpora, setCorpora] = useState([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [disciplineSearch, setDisciplineSearch] = useState('');
  const [journalSearch, setJournalSearch] = useState('');
  const [hasInitializedPersee, setHasInitializedPersee] = useState(false);

  useEffect(() => {
    fetch('/corpus.tsv')
      .then(response => response.text())
      .then(data => {
        const lines = data.split('\n');
        const corporaData = lines.slice(1).map(line => {
          const columns = line.split('\t');
          return {
            label: `${columns[0]} (${columns[1]})`,
            value: columns[3],
            resolution: columns[5],
            maxLength: parseInt(columns[4], 10),
            contextFilter: columns[8] || '',
            availableModes: columns[9] ? columns[9].split('|').map(m => m.trim()).filter(m => m) : []
          };
        }).filter(c => c.value);
        setCorpora([...corporaData, { value: 'google', label: t('Ngram Viewer'), resolution: 'Annuelle' }]);
      });
  }, [t]);

  const { allDisciplines, codeToName } = useMemo(() => {
    if (!perseeData) return { allDisciplines: [], codeToName: {} };
    const disciplines = Object.keys(perseeData).sort();
    const mapping = {};
    Object.values(perseeData).forEach(d => {
      Object.entries(d).forEach(([code, name]) => {
        mapping[code] = name;
      });
    });
    return { allDisciplines: disciplines, codeToName: mapping };
  }, [perseeData]);

  useEffect(() => {
    if (corpus === 'route à part (query_persee)' && perseeData && !hasInitializedPersee) {
      // Only initialize if we haven't done so yet for this session/mount
      setSelectedDisciplines(Object.keys(perseeData));

      const allCodes = Object.values(perseeData).flatMap(d => Object.keys(d));
      const uniqueCodes = [...new Set(allCodes)];
      onFormChange({ ...formData, revues: uniqueCodes });

      setHasInitializedPersee(true);
    }
  }, [corpus, perseeData, hasInitializedPersee, formData, onFormChange]);

  const availableJournals = useMemo(() => {
    if (!perseeData) return [];
    const codes = new Set();
    selectedDisciplines.forEach(disc => {
      const journalMap = perseeData[disc];
      if (journalMap) {
        Object.keys(journalMap).forEach(code => codes.add(code));
      }
    });
    return Array.from(codes).map(code => ({ code, name: codeToName[code] })).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedDisciplines, perseeData, codeToName]);

  const filteredDisciplines = useMemo(() => {
    return allDisciplines.filter(d => d.toLowerCase().includes(disciplineSearch.toLowerCase()));
  }, [allDisciplines, disciplineSearch]);

  const filteredJournals = useMemo(() => {
    return availableJournals.filter(j => j.name.toLowerCase().includes(journalSearch.toLowerCase()));
  }, [availableJournals, journalSearch]);

  const handleChange = (e) => {
    onFormChange({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDisciplineChange = (event) => {
    const value = event.target.value;
    setSelectedDisciplines(value);

    const newAvailableCodes = new Set();
    value.forEach(disc => {
      if (perseeData[disc]) {
        Object.keys(perseeData[disc]).forEach(c => newAvailableCodes.add(c));
      }
    });

    const currentRevues = revues || [];
    const newRevues = currentRevues.filter(r => newAvailableCodes.has(r));
    onFormChange({ ...formData, revues: newRevues });
  };

  const handleJournalChange = (event) => {
    onFormChange({ ...formData, revues: event.target.value });
  };

  const handleRubriqueChange = (event) => {
    onFormChange({ ...formData, rubriques: event.target.value });
  };

  const handleSelectAllDisciplines = (e) => {
    e.stopPropagation();
    setSelectedDisciplines(allDisciplines);
    const allCodes = Object.values(perseeData).flatMap(d => Object.keys(d));
    onFormChange({ ...formData, revues: [...new Set(allCodes)] });
  };

  const handleUnselectAllDisciplines = (e) => {
    e.stopPropagation();
    setSelectedDisciplines([]);
    onFormChange({ ...formData, revues: [] });
  };

  const handleSelectAllJournals = (e) => {
    e.stopPropagation();
    onFormChange({ ...formData, revues: availableJournals.map(j => j.code) });
  };

  const handleUnselectAllJournals = (e) => {
    e.stopPropagation();
    onFormChange({ ...formData, revues: [] });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onPlot();
  };

  const selectedCorpus = corpora.find(c => c.value === corpus);
  const maxResolution = selectedCorpus ? selectedCorpus.resolution : 'Journalière';
  const availableModes = selectedCorpus?.availableModes || [];

  // Available search modes with descriptions
  const searchModes = [
    { value: 'ngram', label: 'By ngram', description: 'Search mode ngram description' },
  ];

  // Add modes based on what's available for this corpus
  if (availableModes.includes('article')) {
    searchModes.push({
      value: 'article',
      label: 'By article',
      description: 'Search mode article description'
    });
  }

  if (availableModes.includes('document')) {
    searchModes.push({
      value: 'document',
      label: 'By document',
      description: 'Search mode document description'
    });
  }

  if (availableModes.includes('cooccurrence_article')) {
    searchModes.push({
      value: 'cooccurrence_article',
      label: 'Cooccurrence in articles',
      description: 'Search mode cooccurrence article description'
    });
  }

  if (availableModes.includes('cooccurrence')) {
    searchModes.push({
      value: 'cooccurrence',
      label: 'By cooccurrence',
      description: 'Search mode cooccurrence description'
    });
  }

  if (availableModes.includes('joker')) {
    searchModes.push({ value: 'joker', label: 'By Joker', description: 'Search mode joker description' });
  }

  if (availableModes.includes('nearby')) {
    searchModes.push({ value: 'nearby', label: 'By nearby word', description: 'Search mode nearby description' });
  }

  if (availableModes.includes('associated_article')) {
    searchModes.push({ value: 'associated_article', label: 'By word in the same article', description: 'Search mode associated article description' });
  }

  const helpTooltipContent = (
    <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
      <strong>{t('Query Syntax:')}</strong>
      <br />
      <br />
      <strong>&:</strong> {t('Use & to plot multiple words as separate lines')}
      <br />
      <em>{t('Example:')} liberté&égalité</em>
      <br />
      <br />
      <strong>+:</strong> {t('Use + to combine multiple words into one line')}
      <br />
      <em>{t('Example:')} liberté+égalité</em>
      <br />
      <br />
      <strong>+ {t('button:')}</strong> {t('Add a new tab to compare different corpora or resolutions')}
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
        <label style={{ marginRight: '1rem' }}>{t('Word:')}</label>
        <input type="text" name="word" value={word} onChange={handleChange} required />
        <Tooltip title={helpTooltipContent} arrow placement="right">
          <IconButton size="small" style={{ marginLeft: '0.5rem' }}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <FormControl fullWidth>
          <InputLabel id="corpus-select-label">{t('Corpus:')}</InputLabel>
          <Select
            labelId="corpus-select-label"
            id="corpus-select"
            value={corpus}
            label={t('Corpus:')}
            name="corpus"
            onChange={handleChange}
            sx={{ fontFamily: 'serif' }}
          >
            {corpora.map(c => (
              <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {(searchModes.length > 1) && (
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <FormControl fullWidth>
            <InputLabel id="search-mode-select-label">{t('Search Mode')}</InputLabel>
            <Select
              labelId="search-mode-select-label"
              id="search-mode-select"
              value={searchMode || 'ngram'}
              label={t('Search Mode')}
              name="searchMode"
              onChange={handleChange}
              sx={{ fontFamily: 'serif' }}
            >
              {searchModes.map(m => (
                <MenuItem key={m.value} value={m.value} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t(m.label)}</span>
                  <Tooltip title={t(m.description)} arrow placement="right">
                    <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      )}

      {searchMode === 'cooccurrence' && (
        <div className="form-group" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <TextField
            label={t('Second Word')}
            name="word2"
            value={word2 || ''}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label={t('Distance')}
            name="distance"
            type="number"
            value={distance ?? ''}
            onChange={handleChange}
            sx={{ width: '150px' }}
          />
        </div>
      )}

      {(searchMode === 'joker' || searchMode === 'nearby' || searchMode === 'associated_article') && (
        <div className="form-group" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <TextField
            label={t('N Joker')}
            name="n_joker"
            type="number"
            value={n_joker ?? ''}
            onChange={handleChange}
            sx={{ flex: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={t('n_joker_help')} arrow placement="right">
                    <HelpOutlineIcon fontSize="small" sx={{ color: 'action.secondary', fontSize: '16px', cursor: 'help' }} />
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label={t('Length')}
            name="length"
            type="number"
            value={length ?? ''}
            onChange={handleChange}
            sx={{ flex: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={t('length_help')} arrow placement="right">
                    <HelpOutlineIcon fontSize="small" sx={{ color: 'action.secondary', fontSize: '16px', cursor: 'help' }} />
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label={t('Stopwords')}
            name="stopwords"
            type="number"
            value={stopwords ?? ''}
            onChange={handleChange}
            sx={{ flex: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={t('stopwords_help')} arrow placement="right">
                    <HelpOutlineIcon fontSize="small" sx={{ color: 'action.secondary', fontSize: '16px', cursor: 'help' }} />
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </div>
      )}

      {(corpus === 'lemonde_rubriques' && (!searchMode || searchMode === 'ngram')) && (
        <FormControl fullWidth style={{ marginBottom: '1rem' }}>
          <InputLabel id="rubriques-label">{t('Rubriques')}</InputLabel>
          <Select
            labelId="rubriques-label"
            multiple
            value={rubriques || []}
            onChange={handleRubriqueChange}
            input={<OutlinedInput label={t('Rubriques')} />}
            renderValue={(selected) => selected.join(', ')}
          >
            {['politique', 'international', 'société', 'économie', 'culture', 'sport', 'science/technologie', 'inclassable'].map((name) => (
              <MenuItem key={name} value={name}>
                <Checkbox checked={(rubriques || []).indexOf(name) > -1} />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!byRubrique}
                onChange={(e) => onFormChange({ ...formData, byRubrique: e.target.checked })}
                name="byRubrique"
              />
            }
            label={t('By rubrique')}
            style={{ marginTop: '0.5rem' }}
          />
        </FormControl>
      )}

      {corpus === 'route à part (query_persee)' && (
        <>
          <FormControl fullWidth style={{ marginBottom: '1rem' }}>
            <InputLabel id="disciplines-label">{t('Disciplines')}</InputLabel>
            <Select
              labelId="disciplines-label"
              multiple
              value={selectedDisciplines}
              onChange={handleDisciplineChange}
              input={<OutlinedInput label={t('Disciplines')} />}
              renderValue={(selected) => selected.length === allDisciplines.length ? t('All Disciplines') : `${selected.length} ${t('selected')}`}
            >
              <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button fullWidth size="small" variant="outlined" onClick={handleSelectAllDisciplines}>{t('All')}</Button>
                <Button fullWidth size="small" variant="outlined" onClick={handleUnselectAllDisciplines}>{t('None')}</Button>
              </Box>
              <Box sx={{ p: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={t('Search disciplines...')}
                  value={disciplineSearch}
                  onChange={(e) => setDisciplineSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </Box>
              <Divider />
              {filteredDisciplines.map((name) => (
                <MenuItem key={name} value={name}>
                  <Checkbox checked={selectedDisciplines.indexOf(name) > -1} />
                  <ListItemText primary={name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth style={{ marginBottom: '1rem' }}>
            <InputLabel id="journals-label">{t('Journals')}</InputLabel>
            <Select
              labelId="journals-label"
              multiple
              value={revues || []}
              onChange={handleJournalChange}
              input={<OutlinedInput label={t('Journals')} />}
              renderValue={(selected) => selected.length === availableJournals.length ? t('All Journals') : `${selected.length} ${t('selected')}`}
            >
              <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button fullWidth size="small" variant="outlined" onClick={handleSelectAllJournals}>{t('All')}</Button>
                <Button fullWidth size="small" variant="outlined" onClick={handleUnselectAllJournals}>{t('None')}</Button>
              </Box>
              <Box sx={{ p: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={t('Search journals...')}
                  value={journalSearch}
                  onChange={(e) => setJournalSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </Box>
              <Divider />
              {filteredJournals.map((j) => (
                <MenuItem key={j.code} value={j.code}>
                  <Checkbox checked={(revues || []).indexOf(j.code) > -1} />
                  <ListItemText primary={j.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      <div className="form-group">
        <label>{t('Resolution:')}</label>
        <div className="checkbox-group" style={{ display: 'flex', justifyContent: 'center' }}>
          <label className="checkbox-label">
            <input type="radio" name="resolution" value="decennie" checked={resolution === 'decennie'} onChange={handleChange} />
            {t('Décennie')}
          </label>
          <label className="checkbox-label">
            <input type="radio" name="resolution" value="annee" checked={resolution === 'annee'} onChange={handleChange} />
            {t('Année')}
          </label>
          {(maxResolution === 'Mensuelle' || maxResolution === 'Journalière') &&
            <label className="checkbox-label">
              <input type="radio" name="resolution" value="mois" checked={resolution === 'mois'} onChange={handleChange} />
              {t('Mois')}
            </label>}
          {maxResolution === 'Journalière' &&
            <label className="checkbox-label">
              <input type="radio" name="resolution" value="jour" checked={resolution === 'jour'} onChange={handleChange} />
              {t('Jour')}
            </label>}
        </div>
      </div>
      <button type="submit" style={{ display: 'none' }} />
    </form>
  );
};

export const AdvancedOptionsComponent = ({ advancedOptions, onAdvancedOptionsChange }) => {
  const { t } = useTranslation();

  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel1a-content"
        id="panel1a-header"
      >
        <Typography>{t('Advanced Options')}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.rescale}
              onChange={onAdvancedOptionsChange}
              name="rescale"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Rescale all curves')}
              <Tooltip title={t('Rescale help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.ratio}
              onChange={onAdvancedOptionsChange}
              name="ratio"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Ratio')}
              <Tooltip title={t('Ratio help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.difference}
              onChange={onAdvancedOptionsChange}
              name="difference"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Difference')}
              <Tooltip title={t('Difference help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.loessSmoothing}
              onChange={onAdvancedOptionsChange}
              name="loessSmoothing"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Loess Smoothing')}
              <Tooltip title={t('Loess Smoothing help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.showConfidenceInterval !== false}
              onChange={onAdvancedOptionsChange}
              name="showConfidenceInterval"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Show Confidence Interval')}
              <Tooltip title={t('Show Confidence Interval help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.showTotalBarplot || false}
              onChange={onAdvancedOptionsChange}
              name="showTotalBarplot"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Show Total Barplot')}
              <Tooltip title={t('Show Total Barplot help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.extendYScale || false}
              onChange={onAdvancedOptionsChange}
              name="extendYScale"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Extend Y-scale to 0')}
              <Tooltip title={t('Extend Y-scale to 0 help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
      </AccordionDetails>
    </Accordion>
  );
};

export default FormComponent;
