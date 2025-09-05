import React from 'react';

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
  ];

  const handleChange = (e) => {
    onFormChange({ ...formData, [e.target.name]: e.target.value });
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
      <div className="form-row">
        <div className="form-group">
          <label>Start Date:</label>
          <input type="number" name="startDate" value={startDate} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>End Date:</label>
          <input type="number" name="endDate" value={endDate} onChange={handleChange} />
        </div>
      </div>
      <div className="form-group">
        <label>Corpus:</label>
        <select name="corpus" value={corpus} onChange={handleChange}>
          {corpora.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Resolution:</label>
        <select name="resolution" value={resolution} onChange={handleChange}>
          <option value="annee">Année</option>
          <option value="mois">Mois</option>
          <option value="jour">Jour</option>
        </select>
      </div>
      <button type="submit" style={{ display: 'none' }} />
    </form>
  );
};

export default FormComponent;