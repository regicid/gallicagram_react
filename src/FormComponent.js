
import React, { useState } from 'react';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';

const FormComponent = ({ formData, onFormChange, onPlot }) => {
  const { t } = useTranslation();
  const { word, startDate, endDate, corpus, resolution } = formData;
  const [advancedOptions, setAdvancedOptions] = useState({
    rescale: false,
    option2: false,
    option3: false,
  });


  const corpora = [
    { value: 'lemonde', label: t('Le Monde') },
    { value: 'presse', label: t('Presse de Gallica') },
    { value: 'livres', label: t('Livres de Gallica') },
    { value: 'ddb', label: t('Deutsches Zeitungsportal (DDB)') },
    { value: 'american_stories', label: t('American Stories') },
    { value: 'paris', label: t('Journal de Paris') },
    { value: 'moniteur', label: t('Moniteur Universel') },
    { value: 'journal_des_debats', label: t('Journal des Débats') },
    { value: 'la_presse', label: t('La Presse') },
    { value: 'constitutionnel', label: t('Le Constitutionnel') },
    { value: 'figaro', label: t('Le Figaro') },
    { value: 'temps', label: t('Le Temps') },
    { value: 'petit_journal', label: t('Le Petit Journal') },
    { value: 'petit_parisien', label: t('Le Petit Parisien') },
    { value: 'huma', label: t('L’Humanité') },
    { value: 'subtitles', label: t('Opensubtitles (français)') },
    { value: 'subtitles_en', label: t('Opensubtitles (anglais)') },
    { value: 'rap', label: t('Rap (Genius)') },
    { value: 'persee', label: t('Persée') },
    { value: 'google', label: t('Ngram Viewer') },
  ];

  const handleChange = (e) => {
    onFormChange({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSliderChange = (event, newValue) => {
    onFormChange({ ...formData, startDate: newValue[0], endDate: newValue[1] });
  };

  const handleDateInputChange = (e) => {
    const { name, value } = e.target;
    const intValue = value === '' ? '' : parseInt(value, 10);
    onFormChange({ ...formData, [name]: intValue });
  };

  const handleAdvancedOptionsChange = (event) => {
    const newAdvancedOptions = {
      ...advancedOptions,
      [event.target.name]: event.target.checked,
    };
    setAdvancedOptions(newAdvancedOptions);
    onFormChange({ ...formData, advancedOptions: newAdvancedOptions });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onPlot();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
        <label style={{ marginRight: '1rem' }}>{t('Word:')}</label>
        <input type="text" name="word" value={word} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: 300 }}>
          <TextField
            name="startDate"
            label={t('Start Date')}
            type="number"
            value={startDate}
            onChange={handleDateInputChange}
            inputProps={{ min: 1600, max: 2025 }}
          />
          <TextField
            name="endDate"
            label={t('End Date')}
            type="number"
            value={endDate}
            onChange={handleDateInputChange}
            inputProps={{ min: 1600, max: 2025 }}
          />
        </Box>
        <Box sx={{ width: 300 }}>
          <Slider
            getAriaLabel={() => t('Date range')}
            value={[startDate, endDate]}
            onChange={handleSliderChange}
            valueLabelDisplay="off"
            min={1600}
            max={2025}
          />
        </Box>
      </div>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>{t('Corpus:')}</label>
        <select name="corpus" value={corpus} onChange={handleChange}>
          {corpora.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>{t('Resolution:')}</label>
        <div className="checkbox-group">
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
          <label className="checkbox-label">
            <input
              type="radio"
              name="resolution"
              value="mois"
              checked={resolution === 'mois'}
              onChange={handleChange}
            />
            {t('Mois')}
          </label>
          <label className="checkbox-label">
            <input
              type="radio"
              name="resolution"
              value="jour"
              checked={resolution === 'jour'}
              onChange={handleChange}
            />
            {t('Jour')}
          </label>
        </div>
      </div>
      <button type="submit" style={{ display: 'none' }} />
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
                onChange={handleAdvancedOptionsChange}
                name="rescale"
              />
            }
            label={t('Rescale all curves')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={advancedOptions.option2}
                onChange={handleAdvancedOptionsChange}
                name="option2"
              />
            }
            label={t('Option 2')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={advancedOptions.option3}
                onChange={handleAdvancedOptionsChange}
                name="option3"
              />
            }
            label={t('Option 3')}
          />
        </AccordionDetails>
      </Accordion>
    </form>
  );
};

export default FormComponent;
