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

const FormComponent = ({ formData, onFormChange, onPlot }) => {
  const { word, startDate, endDate, corpus, resolution } = formData;
  const [advancedOptions, setAdvancedOptions] = useState({
    option1: false,
    option2: false,
    option3: false,
  });


  const corpora = [
    { value: 'lemonde', label: 'Le Monde' },
    { value: 'presse', label: 'Presse de Gallica' },
    { value: 'livres', label: 'Livres de Gallica' },
    { value: 'ddb', label: 'Deutsches Zeitungsportal (DDB)' },
    { value: 'american_stories', label: 'American Stories' },
    { value: 'paris', label: 'Journal de Paris' },
    { value: 'moniteur', label: 'Moniteur Universel' },
    { value: 'journal_des_debats', label: 'Journal des Débats' },
    { value: 'la_presse', label: 'La Presse' },
    { value: 'constitutionnel', label: 'Le Constitutionnel' },
    { value: 'figaro', label: 'Le Figaro' },
    { value: 'temps', label: 'Le Temps' },
    { value: 'petit_journal', label: 'Le Petit Journal' },
    { value: 'petit_parisien', label: 'Le Petit Parisien' },
    { value: 'huma', label: 'L’Humanité' },
    { value: 'subtitles', label: 'Opensubtitles (français)' },
    { value: 'subtitles_en', label: 'Opensubtitles (anglais)' },
    { value: 'rap', label: 'Rap (Genius)' },
    { value: 'persee', label: 'Persée' },
    { value: 'google', label: 'Ngram Viewer' },
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
    setAdvancedOptions({
      ...advancedOptions,
      [event.target.name]: event.target.checked,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onPlot();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
        <label style={{ marginRight: '1rem' }}>Word:</label>
        <input type="text" name="word" value={word} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: 300 }}>
          <TextField
            name="startDate"
            label="Start Date"
            type="number"
            value={startDate}
            onChange={handleDateInputChange}
            inputProps={{ min: 1600, max: 2025 }}
          />
          <TextField
            name="endDate"
            label="End Date"
            type="number"
            value={endDate}
            onChange={handleDateInputChange}
            inputProps={{ min: 1600, max: 2025 }}
          />
        </Box>
        <Box sx={{ width: 300 }}>
          <Slider
            getAriaLabel={() => 'Date range'}
            value={[startDate, endDate]}
            onChange={handleSliderChange}
            valueLabelDisplay="off"
            min={1600}
            max={2025}
          />
        </Box>
      </div>
      <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>Corpus:</label>
        <select name="corpus" value={corpus} onChange={handleChange}>
          {corpora.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Resolution:</label>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="radio"
              name="resolution"
              value="annee"
              checked={resolution === 'annee'}
              onChange={handleChange}
            />
            Année
          </label>
          <label className="checkbox-label">
            <input
              type="radio"
              name="resolution"
              value="mois"
              checked={resolution === 'mois'}
              onChange={handleChange}
            />
            Mois
          </label>
          <label className="checkbox-label">
            <input
              type="radio"
              name="resolution"
              value="jour"
              checked={resolution === 'jour'}
              onChange={handleChange}
            />
            Jour
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
          <Typography>Advanced Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Checkbox
                checked={advancedOptions.option1}
                onChange={handleAdvancedOptionsChange}
                name="option1"
              />
            }
            label="Option 1"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={advancedOptions.option2}
                onChange={handleAdvancedOptionsChange}
                name="option2"
              />
            }
            label="Option 2"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={advancedOptions.option3}
                onChange={handleAdvancedOptionsChange}
                name="option3"
              />
            }
            label="Option 3"
          />
        </AccordionDetails>
      </Accordion>
    </form>
  );
};

export default FormComponent;