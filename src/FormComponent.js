
import React, { useState, useEffect, useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton, TextField, Button, Box, OutlinedInput, ListItemText, Divider } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const FormComponent = ({ formData, onFormChange, onPlot, perseeData }) => {
  const { t } = useTranslation();
  const { word, corpus, resolution, revues } = formData;
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
          return { label: `${columns[0]} (${columns[1]})`, value: columns[3], resolution: columns[5], maxLength: parseInt(columns[4], 10) };
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

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
        <label style={{ marginRight: '1rem' }}>{t('Word:')}</label>
        <input type="text" name="word" value={word} onChange={handleChange} required />
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
          label={t('Rescale all curves')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.ratio}
              onChange={onAdvancedOptionsChange}
              name="ratio"
            />
          }
          label={t('Ratio')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.option3}
              onChange={onAdvancedOptionsChange}
              name="option3"
            />
          }
          label={t('Option 3')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.loessSmoothing}
              onChange={onAdvancedOptionsChange}
              name="loessSmoothing"
            />
          }
          label={t('Loess Smoothing')}
        />
      </AccordionDetails>
    </Accordion>
  );
};

export default FormComponent;
