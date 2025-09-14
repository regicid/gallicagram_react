import React from 'react';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';

const FormComponent = ({ formData, onFormChange, onPlot }) => {
  const { word, startDate, endDate, corpus, resolution } = formData;

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

  const handleSubmit = (e) => {
    e.preventDefault();
    onPlot();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Word:</label>
        <input type="text" name="word" value={word} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Date Range:</label>
        <Box sx={{ width: 300 }}>
          <Slider
            getAriaLabel={() => 'Date range'}
            value={[startDate, endDate]}
            onChange={handleSliderChange}
            valueLabelDisplay="on"
            min={1600}
            max={2025}
          />
        </Box>
      </div>
      <div className="form-group">
        <label>Corpus:</label>
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
    </form>
  );
};

export default FormComponent;