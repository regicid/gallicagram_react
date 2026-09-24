
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton, TextField, Button, Box, OutlinedInput, ListItemText, Divider, InputAdornment, Menu, MenuList, Popper, Paper } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { REVUE_CORPORA, revueCorpusParts, getSelection, isTvCorpus } from './revueCorpora';

// Order of the category dropdown. Values match the "Catégorie" column of corpus.tsv
// and are translation keys, like every other user-facing string.
const MISC_CATEGORY = 'Miscellaneous';
const CORPUS_CATEGORIES = ['Gallica', 'Modern press', 'TV transcripts', 'Academic journals', 'Majinbook', 'Foreign corpora', MISC_CATEGORY];

// Corpus picker as a cascading menu: categories on the left, the corpora of the
// hovered/tapped category in a submenu on the right. With over sixty corpora a flat
// list is unusable, and this keeps it to one control instead of two chained selects.
const CorpusMenu = ({ corpora, categories, corpus, currentCategory, onSelect }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);
  // The submenu anchor is the category row's DOM node. It has to live in state, not in
  // a ref: refs attach during commit, so a Popper reading one while rendering would see
  // null on the first open and nothing would re-render to correct it.
  const [submenuAnchor, setSubmenuAnchor] = useState(null);
  const itemRefs = useRef({});

  const selectedLabel = corpora.find(c => c.value === corpus)?.label || '';

  const open = (e) => {
    // Anchor on the Select's outlined box so the menu lines up with the field.
    setAnchorEl(e.currentTarget.closest('.MuiFormControl-root') || e.currentTarget);
    setOpenCategory(currentCategory); // start on the category we are already in
  };
  const close = () => {
    setAnchorEl(null);
    setOpenCategory(null);
    setSubmenuAnchor(null);
  };

  const openSubmenu = (cat, el) => {
    setOpenCategory(cat);
    setSubmenuAnchor(el);
  };

  // Covers the category opened automatically when the menu appears, whose row has no
  // pointer event to supply the anchor. Runs after commit, so the ref exists by then.
  useEffect(() => {
    if (!anchorEl || !openCategory) return;
    setSubmenuAnchor(prev => prev || itemRefs.current[openCategory] || null);
  }, [anchorEl, openCategory]);

  const byCategory = useMemo(() => {
    const groups = {};
    corpora.forEach(c => { (groups[c.category] = groups[c.category] || []).push(c); });
    return groups;
  }, [corpora]);

  return (
    <>
      {/* A real Select renders the same markup and classes as the other dropdowns, so it
          matches them exactly. Its own menu never opens: `open` is pinned false and
          `onOpen` hands the click to the cascading menu below. */}
      <FormControl fullWidth>
        <InputLabel id="corpus-select-label">{t('Corpus:')}</InputLabel>
        <Select
          labelId="corpus-select-label"
          id="corpus-select"
          label={t('Corpus:')}
          value={selectedLabel ? corpus : ''}
          open={false}
          onOpen={open}
          sx={{ fontFamily: 'serif' }}
        >
          {corpora.map(c => (
            <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 260, overflow: 'visible' } } }}
        MenuListProps={{ sx: { py: 0.5 } }}
      >
        {categories.map((cat) => (
          <MenuItem
            key={cat}
            ref={(el) => { itemRefs.current[cat] = el; }}
            selected={cat === openCategory}
            // Hover drives it on desktop; tapping the row opens the submenu on touch,
            // where there is no hover to rely on.
            onMouseEnter={(e) => openSubmenu(cat, e.currentTarget)}
            onClick={(e) => openSubmenu(cat, e.currentTarget)}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
          >
            <ListItemText primary={t(cat)} />
            <ChevronRightIcon fontSize="small" sx={{ opacity: 0.6 }} />
          </MenuItem>
        ))}

        {/* Rendered inside the Menu so clicks stay within its modal rather than
            landing on the backdrop and closing everything. */}
        <Popper
          open={Boolean(openCategory) && Boolean(submenuAnchor)}
          anchorEl={submenuAnchor}
          placement="right-start"
          modifiers={[{ name: 'offset', options: { offset: [-4, 4] } },
                      { name: 'preventOverflow', options: { padding: 8 } }]}
          sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
        >
          <Paper elevation={8} sx={{ maxHeight: '60vh', overflowY: 'auto', minWidth: 300 }}>
            <MenuList sx={{ py: 0.5 }}>
              {(byCategory[openCategory] || []).map((c) => (
                <MenuItem
                  key={c.value}
                  selected={c.value === corpus}
                  onClick={() => { onSelect(c.value); close(); }}
                  sx={{ fontFamily: 'serif' }}
                >
                  {c.label}
                </MenuItem>
              ))}
            </MenuList>
          </Paper>
        </Popper>
      </Menu>
    </>
  );
};

// Discipline + revue pickers for one revue corpus. A combined corpus mounts one of
// these per part, which is why the two taxonomies are never merged into a single list:
// they share only 10 discipline names, and 41 revue codes differ solely by case.
const RevuePicker = ({ corpus, revueMap, selection, onSelectionChange, showCorpusName }) => {
  const { t } = useTranslation();
  const [disciplineSearch, setDisciplineSearch] = useState('');
  const [journalSearch, setJournalSearch] = useState('');
  const corpusName = REVUE_CORPORA[corpus]?.label || corpus;

  const selectedDisciplines = useMemo(() => selection.disciplines || [], [selection.disciplines]);
  const revues = useMemo(() => selection.revues || [], [selection.revues]);

  const { allDisciplines, codeToName } = useMemo(() => {
    if (!revueMap) return { allDisciplines: [], codeToName: {} };
    const mapping = {};
    Object.values(revueMap).forEach(d => {
      Object.entries(d).forEach(([code, name]) => { mapping[code] = name; });
    });
    return {
      allDisciplines: Object.keys(revueMap).sort((a, b) => a.localeCompare(b, 'fr')),
      codeToName: mapping,
    };
  }, [revueMap]);

  const codesOfDisciplines = useCallback((disciplines) => {
    const codes = new Set();
    disciplines.forEach(disc => {
      Object.keys(revueMap?.[disc] || {}).forEach(c => codes.add(c));
    });
    return codes;
  }, [revueMap]);

  // Start from "everything selected", so the picker shows what the query actually
  // covers. Keyed by corpus, so each corpus seeds once and keeps its own selection.
  useEffect(() => {
    if (!revueMap || selection.disciplines) return;
    onSelectionChange(corpus, {
      disciplines: Object.keys(revueMap),
      revues: [...new Set(Object.values(revueMap).flatMap(d => Object.keys(d)))],
    });
  }, [revueMap, selection.disciplines, corpus, onSelectionChange]);

  const availableJournals = useMemo(() => {
    if (!revueMap) return [];
    return Array.from(codesOfDisciplines(selectedDisciplines))
      .map(code => ({ code, name: codeToName[code] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [selectedDisciplines, revueMap, codeToName, codesOfDisciplines]);

  const filteredDisciplines = useMemo(
    () => allDisciplines.filter(d => d.toLowerCase().includes(disciplineSearch.toLowerCase())),
    [allDisciplines, disciplineSearch]);

  const filteredJournals = useMemo(
    () => availableJournals.filter(j => j.name.toLowerCase().includes(journalSearch.toLowerCase())),
    [availableJournals, journalSearch]);

  // Disciplines are a first filter on revues: choosing them selects every journal they
  // contain and excludes all others. (Intersecting with the current selection instead
  // left the list empty whenever nothing was selected yet, and an empty list used to be
  // sent as "no filter", i.e. the whole corpus.)
  const setDisciplines = (disciplines) =>
    onSelectionChange(corpus, { disciplines, revues: [...codesOfDisciplines(disciplines)] });

  const label = (base) => (showCorpusName ? `${t(base)} — ${corpusName}` : t(base));

  if (!revueMap) return null;

  return (
    <>
      <FormControl fullWidth style={{ marginBottom: '1rem' }}>
        <InputLabel id={`disciplines-label-${corpus}`}>{label('Disciplines')}</InputLabel>
        <Select
          labelId={`disciplines-label-${corpus}`}
          multiple
          value={selectedDisciplines}
          onChange={(e) => setDisciplines(e.target.value)}
          input={<OutlinedInput label={label('Disciplines')} />}
          renderValue={(selected) => selected.length === allDisciplines.length ? t('All Disciplines') : `${selected.length} ${t('selected')}`}
          // Default "selectedMenu" scrolls the first selected item into view, which lands
          // mid-list and hides the All/None buttons; "menu" always opens at the top.
          MenuProps={{ variant: 'menu', autoFocus: false, PaperProps: { sx: { maxHeight: 420 } } }}
        >
          <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
            <Button fullWidth size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); setDisciplines(allDisciplines); }}>{t('All')}</Button>
            <Button fullWidth size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); setDisciplines([]); }}>{t('None')}</Button>
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
        <InputLabel id={`journals-label-${corpus}`}>{label('Journals')}</InputLabel>
        <Select
          labelId={`journals-label-${corpus}`}
          multiple
          value={revues}
          onChange={(e) => onSelectionChange(corpus, { revues: e.target.value })}
          input={<OutlinedInput label={label('Journals')} />}
          renderValue={(selected) => selected.length === availableJournals.length ? t('All Journals') : `${selected.length} ${t('selected')}`}
          MenuProps={{ variant: 'menu', autoFocus: false, PaperProps: { sx: { maxHeight: 420 } } }}
        >
          <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
            <Button fullWidth size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); onSelectionChange(corpus, { revues: availableJournals.map(j => j.code) }); }}>{t('All')}</Button>
            <Button fullWidth size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); onSelectionChange(corpus, { revues: [] }); }}>{t('None')}</Button>
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
              <Checkbox checked={revues.indexOf(j.code) > -1} />
              <ListItemText primary={j.name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
};

const FormComponent = ({ formData, onFormChange, onPlot, revuesData, onRevueSelectionChange }) => {
  const { t } = useTranslation();
  const { word, corpus, resolution, rubriques, byRubrique, searchMode, word2, distance, n_joker, length, stopwords } = formData;
  const [corpora, setCorpora] = useState([]);

  // One discipline+revue picker per revue corpus: a single one for Persée or Cairn,
  // two pairs for the combined corpus.
  const revueParts = revueCorpusParts(corpus);

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
            availableModes: columns[9] ? columns[9].split('|').map(m => m.trim()).filter(m => m) : [],
            category: (columns[10] || '').trim() || MISC_CATEGORY
          };
        }).filter(c => c.value);
        setCorpora([...corporaData, { value: 'google', label: t('Ngram Viewer'), resolution: 'Annuelle', category: MISC_CATEGORY }]);
      });
  }, [t]);

  // Categories keep the corpus list browsable: there are over sixty corpora, so the
  // first dropdown narrows the second one instead of just labelling a long list.
  const categories = useMemo(() => {
    const present = new Set(corpora.map(c => c.category));
    return CORPUS_CATEGORIES.filter(c => present.has(c));
  }, [corpora]);

  // The category is derived from the corpus, not stored: a query restored from a URL
  // or a duplicated tab then lands in the right category on its own.
  const currentCategory = useMemo(
    () => corpora.find(c => c.value === corpus)?.category || categories[0] || MISC_CATEGORY,
    [corpora, corpus, categories]);

  const handleSelectionChange = useCallback(
    (partCorpus, partial) => onRevueSelectionChange(formData.id, partCorpus, partial),
    [onRevueSelectionChange, formData.id]);

  const handleChange = (e) => {
    onFormChange({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRubriqueChange = (event) => {
    onFormChange({ ...formData, rubriques: event.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onPlot();
  };

  const selectedCorpus = corpora.find(c => c.value === corpus);
  const maxResolution = selectedCorpus ? selectedCorpus.resolution : 'Journalière';
  const availableModes = selectedCorpus?.availableModes || [];

  const supportsMonthly = maxResolution === 'Mensuelle' || maxResolution === 'Journalière';
  const supportsDaily = maxResolution === 'Journalière';
  // Weekly is aggregated from daily data and is only offered where it helps: the TV
  // transcripts cover a few months, so days are noisy and months give three points.
  const supportsWeekly = isTvCorpus(corpus);

  // Auto-adjust resolution when corpus changes and current resolution is not supported
  useEffect(() => {
    if (!selectedCorpus) return;

    // If current resolution is not supported, fall back to a valid one
    if (resolution === 'semaine' && !supportsWeekly) {
      onFormChange({ id: formData.id, resolution: supportsDaily ? 'jour' : supportsMonthly ? 'mois' : 'annee' });
    } else if (resolution === 'jour' && !supportsDaily) {
      onFormChange({ id: formData.id, resolution: supportsMonthly ? 'mois' : 'annee' });
    } else if (resolution === 'mois' && !supportsMonthly) {
      onFormChange({ id: formData.id, resolution: 'annee' });
    }
  }, [corpus, selectedCorpus, resolution, supportsWeekly, supportsDaily, supportsMonthly, formData.id, onFormChange]);

  // Arriving on a TV corpus selects weekly, but only on the switch, so the choice can
  // still be changed afterwards without being forced back.
  const prevCorpusRef = useRef(null);
  useEffect(() => {
    if (!selectedCorpus) return;
    if (prevCorpusRef.current !== null && prevCorpusRef.current !== corpus && isTvCorpus(corpus)) {
      onFormChange({ id: formData.id, resolution: 'semaine' });
    }
    prevCorpusRef.current = corpus;
  }, [corpus, selectedCorpus, formData.id, onFormChange]);

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
        <CorpusMenu
          corpora={corpora}
          categories={categories}
          corpus={corpus}
          currentCategory={currentCategory}
          onSelect={(value) => onFormChange({ ...formData, corpus: value })}
        />
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

      {(searchMode === 'cooccurrence' || searchMode === 'cooccurrence_article') && (
        <div className="form-group" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <TextField
            label={t('Second Word')}
            name="word2"
            value={word2 || ''}
            onChange={handleChange}
            fullWidth
          />
          {searchMode === 'cooccurrence' && (
            <TextField
              label={t('Distance')}
              name="distance"
              type="number"
              value={distance ?? ''}
              onChange={handleChange}
              sx={{ width: '150px' }}
            />
          )}
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

      {revueParts.map(part => (
        <RevuePicker
          key={part}
          corpus={part}
          revueMap={revuesData?.[part]}
          selection={getSelection(formData, part)}
          onSelectionChange={handleSelectionChange}
          showCorpusName={revueParts.length > 1}
        />
      ))}

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
          {supportsWeekly &&
            <label className="checkbox-label">
              <input type="radio" name="resolution" value="semaine" checked={resolution === 'semaine'} onChange={handleChange} />
              {t('Semaine')}
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

export const AdvancedOptionsComponent = ({ advancedOptions, onAdvancedOptionsChange, startDate }) => {
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
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.corpusBundle || false}
              onChange={onAdvancedOptionsChange}
              name="corpusBundle"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Corpus bundle')}
              <Tooltip title={t('Corpus bundle help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={advancedOptions.base100 || false}
              onChange={onAdvancedOptionsChange}
              name="base100"
            />
          }
          label={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {t('Base 100')}
              <Tooltip title={t('Base 100 help')} arrow placement="right">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 1, color: 'action.secondary', fontSize: '16px' }} />
              </Tooltip>
            </div>
          }
        />
        {advancedOptions.base100 && (
          <Box sx={{ ml: 4, mt: 1, mb: 1 }}>
            <TextField
              label={t('Base year')}
              name="base100Year"
              type="number"
              value={advancedOptions.base100Year ?? startDate}
              onChange={onAdvancedOptionsChange}
              size="small"
              sx={{ width: '120px' }}
            />
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default FormComponent;
