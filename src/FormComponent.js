
import React, { useState, useEffect } from 'react';
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
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const FormComponent = ({ formData, onFormChange, onPlot }) => {
  const { t } = useTranslation();
  const { word, startDate, endDate, corpus, resolution } = formData;
  const [advancedOptions, setAdvancedOptions] = useState({
    rescale: false,
    option2: false,
    option3: false,
  });
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

    const selectedCorpus = corpora.find(c => c.value === corpus);
    if (selectedCorpus && selectedCorpus.maxLength) {
      const wordCount = word.split(/[ -]/).filter(w => w).length;
      if (wordCount > selectedCorpus.maxLength) {
        alert(`Your query is too long for the selected corpus. Maximum length is ${selectedCorpus.maxLength} words.`);
        return;
      }
    }

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
      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <FormControl sx={{ width: 300 }}>
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
