
import React, { useState, useEffect } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const FormComponent = ({ formData, onFormChange, onPlot }) => {
  const { t } = useTranslation();
  const { word, corpus, resolution } = formData;
  const [corpora, setCorpora] = useState([]);

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

  const handleChange = (e) => {
    onFormChange({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const selectedCorpus = corpora.find(c => c.value === corpus);
    if (selectedCorpus && selectedCorpus.maxLength) {
      const wordCount = Math.max(...word.split('+').map(segment => segment.split(/[ -]/).filter(w => w).length));
      if (wordCount > selectedCorpus.maxLength) {
        alert(`Your query is too long for the selected corpus. Maximum length is ${selectedCorpus.maxLength} words.`);
        return;
      }
    }

    onPlot();
  };

  const selectedCorpus = corpora.find(c => c.value === corpus);
  const maxResolution = selectedCorpus ? selectedCorpus.resolution : 'Journalière';

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
      <div className="form-group">
        <label>{t('Resolution:')}</label>
        <div className="checkbox-group" style={{ display: 'flex', justifyContent: 'center' }}>
          <label className="checkbox-label">
            <input
              type="radio"
              name="resolution"
              value="annee"
              checked={resolution === 'annee'}
              onChange={handleChange}
            />
            {t('Année')}
          </label>
          {(maxResolution === 'Mensuelle' || maxResolution === 'Journalière') &&
            <label className="checkbox-label">
              <input
                type="radio"
                name="resolution"
                value="mois"
                checked={resolution === 'mois'}
                onChange={handleChange}
              />
              {t('Mois')}
            </label>}
          {maxResolution === 'Journalière' &&
            <label className="checkbox-label">
              <input
                type="radio"
                name="resolution"
                value="jour"
                checked={resolution === 'jour'}
                onChange={handleChange}
              />
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
