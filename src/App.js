import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormComponent, { AdvancedOptionsComponent } from './FormComponent';
import PlotComponent, { defaultPalette, colorblindPalette, zscore } from './PlotComponent';
import TabsComponent from './TabsComponent';
import Papa from 'papaparse';
import ContextDisplay from './ContextDisplay';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { FormControl, InputLabel, Select, MenuItem, Slider, TextField, Box, Alert, Tooltip, IconButton, Switch, Snackbar } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SumsComponent from './SumsComponent';
import WordCloudComponent from './WordCloudComponent';
import { FingerprintSpinner } from 'react-epic-spinners';

const theme = createTheme({
  typography: {
    fontFamily: [
      'EB Garamond',
      'Georgia',
      'serif',
    ].join(','),
  },
});

let nextId = 2;
const initialQuery = {
  word: 'liberté',
  corpus: 'presse',
  resolution: 'annee',
  searchMode: 'ngram',
  word2: '',
  distance: 10,
  n_joker: 10,
  length: 2, // Will be updated based on word length
  stopwords: 500,
  advancedOptions: {
    rescale: false,
    showConfidenceInterval: true,
    showTotalBarplot: false,
    extendYScale: false,
  }
};

function movingAverage(data, windowSize) {
  if (windowSize === 0) {
    return data;
  }
  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      if (data[j] !== null) {
        sum += data[j];
        count++;
      }
    }
    if (count > 0) {
      smoothed.push(sum / count);
    } else {
      smoothed.push(null);
    }
  }
  return smoothed;
}

function loessSmoothing(data, span) {
  // span should be between 0 and 1, representing the fraction of data points to use
  // We'll convert the slider value (0-10) to a span value (0.05-1.0)
  // When span is 0, return the original data without smoothing
  if (span === 0) {
    return data;
  }

  const alpha = 0.05 + (span / 10) * 0.95;

  const smoothed = [];
  const n = data.length;
  const bandwidth = Math.max(2, Math.floor(alpha * n));

  // Tricube weight function
  const tricube = (x) => {
    const absX = Math.abs(x);
    if (absX >= 1) return 0;
    const tmp = 1 - absX * absX * absX;
    return tmp * tmp * tmp;
  };

  for (let i = 0; i < n; i++) {
    // Find the k nearest neighbors
    const distances = [];
    for (let j = 0; j < n; j++) {
      if (data[j] !== null) {
        distances.push({ index: j, distance: Math.abs(i - j) });
      }
    }

    if (distances.length === 0) {
      smoothed.push(null);
      continue;
    }

    distances.sort((a, b) => a.distance - b.distance);
    const neighbors = distances.slice(0, Math.min(bandwidth, distances.length));

    if (neighbors.length === 0) {
      smoothed.push(data[i]);
      continue;
    }

    const maxDist = neighbors[neighbors.length - 1].distance;

    if (maxDist === 0) {
      smoothed.push(data[i]);
      continue;
    }

    // Weighted linear regression
    let sumW = 0;
    let sumWX = 0;
    let sumWY = 0;
    let sumWXX = 0;
    let sumWXY = 0;

    for (const neighbor of neighbors) {
      const j = neighbor.index;
      const w = tricube(neighbor.distance / maxDist);
      sumW += w;
      sumWX += w * j;
      sumWY += w * data[j];
      sumWXX += w * j * j;
      sumWXY += w * j * data[j];
    }

    // Solve for slope and intercept
    const denominator = sumW * sumWXX - sumWX * sumWX;
    if (Math.abs(denominator) < 1e-10) {
      // Fallback to weighted average if regression fails
      smoothed.push(sumWY / sumW);
    } else {
      const slope = (sumW * sumWXY - sumWX * sumWY) / denominator;
      const intercept = (sumWY - slope * sumWX) / sumW;
      smoothed.push(intercept + slope * i);
    }
  }

  return smoothed;
}

function movingSum(data, windowSize) {
  if (windowSize === 0) {
    return data;
  }
  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      if (data[j] !== null && data[j] !== undefined) {
        sum += data[j];
        count++;
      }
    }
    if (count > 0) {
      smoothed.push(sum);
    } else {
      smoothed.push(null);
    }
  }
  return smoothed;
}

const GALLICA_PROXY_API_URL = 'https://shiny.ens-paris-saclay.fr/guni';

function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(response => response.json())
      .then(data => {
        console.log('IP Geolocation data:', data);
        console.log('Is country FR:', data.country_code === 'FR');
        if (data.country_code === 'FR') {
          i18n.changeLanguage('fr');
        } else {
          i18n.changeLanguage('en');
        }
      })
      .catch(error => console.error('Error fetching IP geolocation:', error));
  }, [i18n]);
  const [queries, setQueries] = useState([{ id: 1, ...initialQuery }]);
  const [activeQueryId, setActiveQueryId] = useState(1);
  const [startDate, setStartDate] = useState(1789);
  const [endDate, setEndDate] = useState(1950);
  const [apiResponses, setApiResponses] = useState([]);
  const [rawPlotData, setRawPlotData] = useState([]);
  const [plotData, setPlotData] = useState([]);
  const [sumsData, setSumsData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [smoothing, setSmoothing] = useState(0);
  const [plotType, setPlotType] = useState('line');
  const [occurrences, setOccurrences] = useState([]);
  const [totalOccurrences, setTotalOccurrences] = useState(0);
  const [totalPlotOccurrences, setTotalPlotOccurrences] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [contextSearchParams, setContextSearchParams] = useState({ limit: 10, cursor: 0 });
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [fetchContextAfterPlot, setFetchContextAfterPlot] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [corpusPeriods, setCorpusPeriods] = useState({});
  const [corpusConfigs, setCorpusConfigs] = useState({});
  const [perseeData, setPerseeData] = useState(null);
  const [dateWarnings, setDateWarnings] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [fetchId, setFetchId] = useState(0); // Track data fetches for graph updates

  useEffect(() => {
    // Load corpus periods and configs from TSV
    fetch('/corpus.tsv')
      .then(response => response.text())
      .then(data => {
        const lines = data.split('\n');
        const periods = {};
        const configs = {};
        lines.slice(1).forEach(line => {
          const columns = line.split('\t');
          if (columns[0] && columns[1] && columns[3]) {
            const periodRange = columns[1].trim();
            const periodMatch = periodRange.match(/^(\d{4})-(\d{4})$/);
            if (periodMatch) {
              periods[columns[3].trim()] = {
                start: parseInt(periodMatch[1]),
                end: parseInt(periodMatch[2]),
                name: columns[0].trim()
              };
            }
            const code = columns[3].trim();
            const filter = columns[8] ? columns[8].trim() : '';
            const maxLength = columns[4] ? parseInt(columns[4].trim(), 10) : 2;
            configs[code] = { filter, maxLength };
          }
        });
        setCorpusPeriods(periods);
        setCorpusConfigs(configs);
      })
      .catch(error => console.error('Error loading corpus periods:', error));

    // Load Persee revues
    fetch('/revues_persee.json')
      .then(res => res.json())
      .then(data => setPerseeData(data))
      .catch(err => console.error("Error loading persee revues", err));
  }, []);

  useEffect(() => {
    // Initial data load
    setIsLoading(true);

    const csvPromise = fetch('/liberte_data.csv')
      .then(response => {
        if (!response.ok) {
          throw new Error("Could not load initial data file.");
        }
        return response.text();
      })
      .then(csvText => {
        return new Promise((resolve, reject) => {
          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length) {
                console.error("Error parsing initial CSV:", results.errors);
                reject(new Error("Error parsing initial data file."));
              } else {
                const total = results.data.reduce((acc, row) => acc + (row.n || 0), 0);
                const initialApiResponse = { data: results.data, query: { id: 1, ...initialQuery, startDate: 1789, endDate: 1950 }, total };
                setApiResponses([initialApiResponse]);
                setFetchId(prev => prev + 1);
                resolve();
              }
            }
          });
        });
      });

    const occurrencesPromise = fetch('/occurrences_exemple.json')
      .then(response => {
        if (!response.ok) {
          throw new Error("Could not load example occurrences file.");
        }
        return response.json();
      })
      .then(data => {
        setOccurrences(data.records);
        setTotalOccurrences(data.total_records || data.records.length);
      });

    Promise.all([csvPromise, occurrencesPromise])
      .catch(err => {
        setError(err.message);
        console.error(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // Empty dependency array ensures this runs only once

  const processNgramData = useCallback((apiResponse, allSameCorpus, plotType) => {
    const { data, query } = apiResponse;
    const { startDate, endDate } = query;
    const start = parseInt(startDate);
    const end = parseInt(endDate);

    const years = [];
    for (let year = start; year <= end; year++) {
      years.push(new Date(year, 0));
    }

    const traces = data.map(ngramData => {
      return {
        x: years,
        y: ngramData.timeseries,
        type: plotType === 'line' || plotType === 'area' ? 'scatter' : 'bar',
        mode: plotType === 'line' || plotType === 'area'
          ? (years.length > 20 ? 'lines' : 'lines+markers')
          : undefined,
        fill: plotType === 'area' ? 'tozeroy' : undefined,
        line: plotType === 'line' || plotType === 'area' ? { shape: 'spline' } : undefined,
        name: allSameCorpus
          ? (ngramData.ngram || `${t('Query')} ${query.id}`)
          : `${ngramData.ngram || `${t('Query')} ${query.id}`} (${query.corpus})`,
        connectgaps: false,
      };
    });

    return traces;
  }, [t]);

  const processData = useCallback((apiResponse, allSameCorpus, plotType, advancedOptions) => {
    if (apiResponse.query.corpus === 'google') {
      return processNgramData(apiResponse, allSameCorpus, plotType);
    }
    const { data, query } = apiResponse;
    const { startDate, endDate, resolution } = query;
    const dataMap = new Map();
    const start = parseInt(startDate);
    const end = parseInt(endDate);

    if (resolution === 'decennie') {
      const startDecade = Math.floor(start / 10) * 10;
      const endDecade = Math.floor(end / 10) * 10;
      for (let decade = startDecade; decade <= endDecade; decade += 10) {
        dataMap.set(Date.UTC(decade, 0), null);
      }
    } else if (resolution === 'annee') {
      for (let year = start; year <= end; year++) {
        dataMap.set(Date.UTC(year, 0), null);
      }
    } else if (resolution === 'mois') {
      for (let y = start; y <= end; y++) {
        for (let m = 0; m < 12; m++) {
          dataMap.set(Date.UTC(y, m), null);
        }
      }
    } else if (resolution === 'jour') {
      let currentDate = new Date(Date.UTC(start, 0, 1));
      const finalDate = new Date(Date.UTC(end, 11, 31));
      while (currentDate <= finalDate) {
        dataMap.set(currentDate.getTime(), null);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    data.forEach(row => {
      const year = row.date || row.annee || row.year;
      if (year && row.n !== undefined && row.total !== undefined) {
        let dateKey;
        if (resolution === 'decennie') {
          const decade = Math.floor(year / 10) * 10;
          dateKey = Date.UTC(decade, 0);
        } else if (resolution === 'annee') {
          dateKey = Date.UTC(year, 0);
        } else if (resolution === 'mois') {
          const month = row.mois ? row.mois - 1 : 0;
          dateKey = Date.UTC(year, month);
        } else { // jour
          const month = row.mois ? row.mois - 1 : 0;
          const day = row.jour || 1;
          dateKey = Date.UTC(year, month, day);
        }
        if (dataMap.has(dateKey)) {
          if (resolution === 'decennie') {
            const current = dataMap.get(dateKey);
            const currentN = current ? current.n : 0;
            const currentTotal = current ? current.total : 0;
            dataMap.set(dateKey, { n: currentN + row.n, total: currentTotal + row.total });
          } else {
            dataMap.set(dateKey, { n: row.n, total: row.total });
          }
        }
      }
    });

    const processedData = Array.from(dataMap, ([date, values]) => ({ x: new Date(date), data: values }))
      .sort((a, b) => a.x - b.x);

    const yValues = processedData.map(d => {
      if (!d.data) return null;
      if (plotType === 'line' || plotType === 'area') {
        return (d.data.n !== undefined && d.data.total) ? d.data.n / d.data.total : null;
      } else { // bar
        return d.data.n !== undefined ? d.data.n : null;
      }
    });

    return {
      x: processedData.map(d => d.x),
      y: yValues,
      n: processedData.map(d => d.data ? d.data.n : null),
      total: processedData.map(d => d.data ? d.data.total : null),
      type: plotType === 'line' || plotType === 'area' ? 'scatter' : 'bar',
      mode: plotType === 'line' || plotType === 'area'
        ? (processedData.length > 20 ? 'lines' : 'lines+markers')
        : undefined,
      fill: plotType === 'area' ? 'tozeroy' : undefined,
      line: plotType === 'line' || plotType === 'area' ? { shape: 'spline' } : undefined,
      name: allSameCorpus
        ? (query.word || `${t('Query')} ${query.id}`)
        : `${query.word || `${t('Query')} ${query.id}`} (${query.corpus})`,
      connectgaps: false,
    };
  }, [processNgramData, t]);

  useEffect(() => {
    if (apiResponses.length === 0) return;

    if (plotType === 'sums' || plotType === 'wordcloud') {
      // Check if any response is from list mode (Joker/Nearby)
      const listModeResponse = apiResponses.find(res => res.query && res.query.isListMode);

      if (listModeResponse) {
        // Use the data directly
        setSumsData(listModeResponse.data);
      } else {
        const data = apiResponses.map(res => {
          let total;
          if (res.query.corpus === 'google') {
            total = 0;
          } else {
            total = res.total || 0;
          }
          return {
            word: res.query.word || `${t('Query')} ${res.query.id}`,
            total: total
          };
        });
        data.sort((a, b) => b.total - a.total);
        setSumsData(data);
      }
    } else {
      const firstCorpus = queries[0]?.corpus;
      const allSameCorpus = queries.every(q => q.corpus === firstCorpus);
      const activeQuery = queries.find(q => q.id === activeQueryId);
      const advancedOptions = activeQuery?.advancedOptions || {};

      let traces = apiResponses.flatMap(res => processData(res, allSameCorpus, plotType, advancedOptions));

      // Handle difference calculation for lineplot mode
      if (plotType === 'line' && advancedOptions.difference && traces.length >= 2) {
        const trace1 = traces[0];
        const trace2 = traces[1];
        const diffTrace = {
          x: trace1.x,
          y: trace1.y.map((v, i) => {
            if (v !== null && trace2.y[i] !== null) {
              return v - trace2.y[i];
            }
            return null;
          }),
          type: 'scatter',
          mode: trace1.mode,
          line: trace1.line,
          name: `${trace1.name} - ${trace2.name}`,
          connectgaps: false,
        };
        traces = [diffTrace];
      }
      // Handle ratio calculation for lineplot mode
      else if (plotType === 'line' && advancedOptions.ratio && traces.length >= 2) {
        const trace1 = traces[0];
        const trace2 = traces[1];
        const ratioTrace = {
          x: trace1.x,
          y: trace1.y.map((v, i) => {
            if (v !== null && trace2.y[i] !== null && trace2.y[i] !== 0) {
              return v / trace2.y[i];
            }
            return null;
          }),
          type: 'scatter',
          mode: trace1.mode,
          line: trace1.line,
          name: `${trace1.name} / ${trace2.name}`,
          connectgaps: false,
        };
        traces = [ratioTrace];
      }

      setRawPlotData(traces);
    }
  }, [apiResponses, plotType, queries, activeQueryId, processData, t]);

  // Effect to switch to 'sums' view for list modes
  useEffect(() => {
    const activeQuery = queries.find(q => q.id === activeQueryId);
    if (activeQuery && (activeQuery.searchMode === 'joker' || activeQuery.searchMode === 'nearby' || activeQuery.searchMode === 'associated_article')) {
      if (plotType !== 'sums' && plotType !== 'wordcloud') {
        setPlotType('sums');
      }
    }
  }, [queries, activeQueryId, plotType]);

  useEffect(() => {
    if (plotType !== 'line' && plotType !== 'area') {
      setPlotData(rawPlotData);
      return;
    }
    const activeQuery = queries.find(q => q.id === activeQueryId);
    const useLoess = activeQuery?.advancedOptions?.loessSmoothing || false;

    const smoothedTraces = rawPlotData.map(trace => {
      if (useLoess) {
        const smoothedY = loessSmoothing(trace.y, smoothing);
        return { ...trace, y: smoothedY };
      } else {
        if (smoothing === 0) return trace;

        if (trace.n && trace.total) {
          const smoothedN = movingSum(trace.n, smoothing);
          const smoothedTotal = movingSum(trace.total, smoothing);
          const smoothedY = smoothedN.map((n, i) => {
            const t = smoothedTotal[i];
            return (n !== null && t !== null && t !== 0) ? n / t : null;
          });
          return { ...trace, y: smoothedY, n: smoothedN, total: smoothedTotal };
        } else {
          const smoothedY = movingAverage(trace.y, smoothing);
          return { ...trace, y: smoothedY };
        }
      }
    });
    setPlotData(smoothedTraces);
  }, [smoothing, rawPlotData, plotType, queries, activeQueryId]);

  const fetchOccurrences = useCallback(async (date, searchParams, query, shouldAppend = false) => {
    setIsContextLoading(true);
    setError(null);
    if (!query || !query.word) {
      setIsContextLoading(false);
      return;
    }

    const corpusCode = query.corpus;
    const config = corpusConfigs[corpusCode];
    const isGallica = config && config.filter;

    if (!isGallica) {
      // Handle non-Gallica corpora by creating a dummy record
      const dummyRecord = {
        date: date.toISOString(),
        paper_title: `${t('Context for')} ${query.word} (${date.getFullYear()})`,
        url: '#',
        terms: [query.word],
        dummy: true,
        resolution: query.resolution
      };
      setOccurrences([dummyRecord]);
      setTotalOccurrences(1);
      setIsContextLoading(false);
      return;
    }

    const params = new URLSearchParams({
      terms: query.word.replace(/’/g, "'"),
      year: date.getFullYear(),
      limit: searchParams.limit,
      cursor: searchParams.cursor,
      sort: 'relevance'
    });

    // Add resolution specific parameters (month, day)
    const resolution = query.resolution;
    if (resolution === 'mois' || resolution === 'jour') {
      if (!isNaN(date.getTime())) {
        params.append('month', date.getMonth() + 1); // getMonth is 0-indexed
        if (resolution === 'jour') {
          params.append('day', date.getDate());
        }
      }
    }

    if (config && config.filter) {
      const filterParams = new URLSearchParams(config.filter);
      filterParams.forEach((value, key) => {
        params.append(key, value);
      });
    }

    try {
      const response = await fetch(`${GALLICA_PROXY_API_URL}/api/occurrences_no_context?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch occurrences');
      }
      const data = await response.json();
      if (shouldAppend) {
        setOccurrences(prev => [...prev, ...data.records]);
      } else {
        setOccurrences(data.records);
      }
      setTotalOccurrences(data.total_records);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsContextLoading(false);
    }
  }, [corpusConfigs, t]);

  useEffect(() => {
    if (fetchContextAfterPlot && plotData.length > 0) {
      const activeQueryIndex = queries.findIndex(q => q.id === activeQueryId);
      if (activeQueryIndex === -1) {
        setFetchContextAfterPlot(false);
        return;
      }

      const activeTrace = plotData[activeQueryIndex];
      const activeQuery = queries[activeQueryIndex];

      if (activeTrace && activeTrace.x && activeTrace.x.length > 0) {
        let lastDateWithData = null;
        for (let i = activeTrace.x.length - 1; i >= 0; i--) {
          if (activeTrace.y[i] !== null && activeTrace.y[i] !== undefined) {
            lastDateWithData = new Date(activeTrace.x[i]);
            break;
          }
        }

        if (lastDateWithData) {
          setSelectedDate(lastDateWithData);
          const newSearchParams = { limit: 10, cursor: 0 };
          setContextSearchParams(newSearchParams);
          fetchOccurrences(lastDateWithData, newSearchParams, activeQuery, false);
        }
      }
      setFetchContextAfterPlot(false);
    }
  }, [plotData, fetchContextAfterPlot, queries, activeQueryId, fetchOccurrences]);

  const handleFormChange = (updatedQuery) => {
    const newQueries = queries.map(q => q.id === updatedQuery.id ? updatedQuery : q);
    setQueries(newQueries);
  };

  const handleSliderChange = (event, newValue) => {
    // Ensure start date doesn't exceed end date
    if (newValue[0] <= newValue[1]) {
      setStartDate(newValue[0]);
      setEndDate(newValue[1]);
    }
  };

  const handleDateInputChange = (e) => {
    const { name, value } = e.target;
    const intValue = value === '' ? '' : parseInt(value, 10);
    if (name === 'startDate') {
      setStartDate(intValue);
    } else if (name === 'endDate') {
      setEndDate(intValue);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handlePlot();
    }
  };

  const validateDatesAgainstCorpus = useCallback(() => {
    const currentActiveQuery = queries.find(q => q.id === activeQueryId);
    if (!currentActiveQuery || !corpusPeriods[currentActiveQuery.corpus]) {
      setDateWarnings([]);
      return;
    }

    const period = corpusPeriods[currentActiveQuery.corpus];
    const warnings = [];

    if (startDate < period.start) {
      warnings.push({
        type: 'start',
        message: t('Start date warning', { startDate, periodStart: period.start, corpusName: period.name })
      });
    }

    if (endDate > period.end) {
      warnings.push({
        type: 'end',
        message: t('End date warning', { endDate, periodEnd: period.end, corpusName: period.name })
      });
    }

    setDateWarnings(warnings);
  }, [queries, activeQueryId, corpusPeriods, startDate, endDate, t]);

  useEffect(() => {
    validateDatesAgainstCorpus();
  }, [validateDatesAgainstCorpus]);

  // Auto-adjust dates when corpus changes and current dates fall outside the new corpus's bounds
  useEffect(() => {
    const activeQuery = queries.find(q => q.id === activeQueryId);
    if (!activeQuery || !corpusPeriods[activeQuery.corpus]) return;

    const period = corpusPeriods[activeQuery.corpus];

    // If EITHER date is out of bounds, reset BOTH to the period limits (as requested)
    if (startDate < period.start || endDate > period.end) {
      setStartDate(period.start);
      setEndDate(period.end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries, activeQueryId, corpusPeriods]);

  const [wordCountWarnings, setWordCountWarnings] = useState([]);

  const validateWordCounts = useCallback(() => {
    const currentActiveQuery = queries.find(q => q.id === activeQueryId);
    if (!currentActiveQuery || !corpusConfigs[currentActiveQuery.corpus]) {
      setWordCountWarnings([]);
      return;
    }

    const config = corpusConfigs[currentActiveQuery.corpus];
    let maxLength = config.maxLength !== undefined ? config.maxLength : 2;

    // Specific logic for Le Monde corpus
    if ((currentActiveQuery.corpus === 'lemonde' || currentActiveQuery.corpus === 'lemonde_rubriques') &&
      (currentActiveQuery.searchMode === 'associated_article' ||
        currentActiveQuery.searchMode === 'cooccurrence' ||
        currentActiveQuery.searchMode === 'cooccurrence_article')) {
      maxLength = 1;
    }

    const warnings = [];

    if (currentActiveQuery.word) {
      // Split by space, plus, or ampersand
      const wordCount = currentActiveQuery.word.trim().split(/[\s+&]+/).length;
      if (wordCount > maxLength) {
        let messageKey = 'Long query warning';
        if ((currentActiveQuery.corpus === 'lemonde' || currentActiveQuery.corpus === 'lemonde_rubriques') &&
          (currentActiveQuery.searchMode === 'associated_article' ||
            currentActiveQuery.searchMode === 'cooccurrence' ||
            currentActiveQuery.searchMode === 'cooccurrence_article')) {
          messageKey = 'Long query warning lemonde restricted';
        }

        warnings.push({
          message: t(messageKey, { count: wordCount, max: maxLength, corpusName: corpusPeriods[currentActiveQuery.corpus]?.name || currentActiveQuery.corpus })
        });
      } else if (['joker', 'nearby', 'associated_article'].includes(currentActiveQuery.searchMode)) {
        const lengthParam = parseInt(currentActiveQuery.length, 10);
        if (lengthParam > maxLength) {
          let messageKey = 'Long query warning';
          // Re-use logic for Le Monde if needed, or just standard warning
          if ((currentActiveQuery.corpus === 'lemonde' || currentActiveQuery.corpus === 'lemonde_rubriques') &&
            (currentActiveQuery.searchMode === 'associated_article' ||
              currentActiveQuery.searchMode === 'cooccurrence' ||
              currentActiveQuery.searchMode === 'cooccurrence_article')) {
            messageKey = 'Long query warning lemonde restricted';
          }
          warnings.push({
            message: t(messageKey, { count: lengthParam, max: maxLength, corpusName: corpusPeriods[currentActiveQuery.corpus]?.name || currentActiveQuery.corpus })
          });
        }
      }
    }

    setWordCountWarnings(warnings);
  }, [queries, activeQueryId, corpusConfigs, corpusPeriods, t]);

  useEffect(() => {
    validateWordCounts();
  }, [validateWordCounts]);

  const handleAdvancedOptionsChange = (event) => {
    const activeQuery = queries.find(q => q.id === activeQueryId);
    const newAdvancedOptions = {
      ...activeQuery.advancedOptions,
      [event.target.name]: event.target.checked,
    };
    const updatedQuery = { ...activeQuery, advancedOptions: newAdvancedOptions };
    handleFormChange(updatedQuery);
  };

  const addQuery = () => {
    const activeQuery = queries.find(q => q.id === activeQueryId);
    const newQuery = {
      id: nextId++,
      word: '', // Reset the word
      corpus: activeQuery.corpus,
      resolution: activeQuery.resolution,
      advancedOptions: activeQuery.advancedOptions,
    };
    setQueries([...queries, newQuery]);
    setActiveQueryId(newQuery.id);
  };

  const removeQuery = (id) => {
    if (queries.length <= 1) return;
    const newQueries = queries.filter(q => q.id !== id);
    setQueries(newQueries);
    if (activeQueryId === id) {
      setActiveQueryId(newQueries[0].id);
    }
  };

  const handlePointClick = useCallback((data) => {
    if (data.points.length > 0) {
      const point = data.points[0];
      const curveNumber = point.curveNumber;

      // When confidence intervals are shown, CI traces are prepended to the plot data.
      // Each original trace gets 2 CI traces (lower and upper bounds), so we need to
      // calculate the correct index into apiResponses.
      const activeQuery = queries.find(q => q.id === activeQueryId);
      const showCI = activeQuery?.advancedOptions?.showConfidenceInterval !== false &&
        plotType === 'line' &&
        !activeQuery?.advancedOptions?.rescale;

      let responseIndex = curveNumber;
      if (showCI && apiResponses.length > 0) {
        // CI traces come first: 2 traces per original trace (lower + upper bounds)
        const numCITraces = apiResponses.length * 2;
        if (curveNumber < numCITraces) {
          // User clicked on a CI trace, ignore or map to corresponding data trace
          responseIndex = Math.floor(curveNumber / 2);
        } else {
          // User clicked on a data trace, subtract the CI traces offset
          responseIndex = curveNumber - numCITraces;
        }
      }

      // Validate index is within bounds
      if (responseIndex < 0 || responseIndex >= apiResponses.length) {
        console.warn('Invalid curve index:', curveNumber, 'mapped to:', responseIndex);
        return;
      }

      const query = apiResponses[responseIndex].query;
      setSelectedQuery(query);
      const date = new Date(point.x);
      setSelectedDate(date);
      const newSearchParams = { limit: 10, cursor: 0 };
      setContextSearchParams(newSearchParams);
      fetchOccurrences(date, newSearchParams, query, false);
    }
  }, [queries, activeQueryId, plotType, apiResponses, fetchOccurrences]);

  const handleContextPageChange = (pageIndex) => {
    const newSearchParams = { ...contextSearchParams, cursor: pageIndex * contextSearchParams.limit };
    setContextSearchParams(newSearchParams);
    fetchOccurrences(selectedDate, newSearchParams, selectedQuery, true);
  }

  const fetchSingleWordGallicagram = (word, corpus, startDate, endDate, resolution, revues, rubriques, byRubrique) => {
    const apiResolution = resolution === 'decennie' ? 'annee' : resolution;
    let url;
    if (corpus === 'route à part (query_persee)') {
      const revueParam = revues && revues.length > 0 ? `&revue=${revues.join('+')}` : '';
      url = `https://shiny.ens-paris-saclay.fr/guni/query_persee?mot=${word.trim().replace(/-/g, ' ').replace(/’/g, "'")}&from=${startDate}&to=${endDate}&by_revue=False${revueParam}`;
    } else if (corpus === 'lemonde_rubriques') {
      const rubriqueParam = rubriques && rubriques.length > 0 ? `&rubrique=${rubriques.join('+')}` : '';
      const byRubriqueParam = byRubrique ? '&by_rubrique=True' : '';
      url = `https://shiny.ens-paris-saclay.fr/guni/query?mot=${word.trim().replace(/-/g, ' ').replace(/’/g, "'")}&corpus=${corpus}&from=${startDate}&to=${endDate}&resolution=${apiResolution}${rubriqueParam}${byRubriqueParam}`;
    } else {
      url = `https://shiny.ens-paris-saclay.fr/guni/query?mot=${word.trim().replace(/-/g, ' ').replace(/’/g, "'")}&corpus=${corpus}&from=${startDate}&to=${endDate}&resolution=${apiResolution}`;
    }
    console.log("Querying Gallicagram URL:", url);
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok for "${word}"`);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || (!contentType.includes("text/csv") && !contentType.includes("text/plain"))) {
          return response.text().then(text => {
            if (text.includes(',') && text.includes('\n')) {
              console.warn(`Received CSV-like data but with wrong Content-Type: ${contentType}. Processing it anyway.`);
              return text;
            }
            console.warn(`Expected CSV but received ${contentType || 'unknown'}.`, { query: { word, corpus }, response: text });
            return ''; // Return empty string to avoid breaking Papa.parse
          });
        }
        return response.text();
      })
      .then(csvText => {
        return new Promise((papaResolve) => {
          if (!csvText) {
            papaResolve([]);
            return;
          }
          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length) {
                console.error(`CSV Parsing errors for "${word}":`, results.errors);
              }
              papaResolve(results.data);
            }
          });
        });
      });
  };

  const fetchSingleWordNgramViewer = (word, startDate, endDate) => {
    const url = `/ngrams/json?content=${word.trim()}&year_start=${startDate}&year_end=${endDate}&corpus=fr&smoothing=0`;
    console.log("Querying Ngram URL:", url);
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok for "${word}"`);
        }
        return response.json();
      })
      .then(data => {
        if (!data || data.length === 0) {
          console.warn(`No data returned for "${word}"`);
          return { ngram: word, timeseries: [] };
        }
        return data[0];
      });
  };

  const fetchByDocument = async (query, globalStartDate, globalEndDate) => {
    const { word, corpus, resolution, searchMode, word2 } = query;
    const apiResolution = resolution === 'decennie' ? 'annee' : resolution;

    if (corpus === 'lemonde' || corpus === 'lemonde_rubriques') {
      let url;
      if (searchMode === 'cooccurrence' || searchMode === 'cooccurrence_article') {
        url = `https://shiny.ens-paris-saclay.fr/guni/cooccur?mot1=${encodeURIComponent(word.trim().replace(/-/g, ' ').replace(/’/g, "'"))}&mot2=${encodeURIComponent((word2 || '').trim().replace(/-/g, ' ').replace(/’/g, "'"))}&from=${globalStartDate}&to=${globalEndDate}&resolution=${apiResolution}`;
      } else { // 'article' or 'document' (legacy)
        url = `https://shiny.ens-paris-saclay.fr/guni/query_article?mot=${encodeURIComponent(word.trim().replace(/-/g, ' ').replace(/’/g, "'"))}&from=${globalStartDate}&to=${globalEndDate}&resolution=${apiResolution}`;
      }

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const text = await response.text();
        const parsed = await new Promise((resolveParse) => {
          Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (res) => resolveParse(res.data)
          });
        });
        return [{ data: parsed, query: { ...query, startDate: globalStartDate, endDate: globalEndDate } }];
      } catch (error) {
        console.error("Error fetching Le Monde article/cooccur mode:", error);
        return [{ data: [], query: { ...query, startDate: globalStartDate, endDate: globalEndDate } }];
      }
    }

    const code = corpusConfigs[corpus]?.filter?.match(/codes=([^&]+)/)?.[1];

    // Determine context filter part
    let contextQuery = "";
    if (corpus === 'livres') {
      contextQuery = 'dc.type all "monographie"';
    } else if (corpus === 'presse') {
      contextQuery = 'dc.type all "fascicule"';
    } else if (code) {
      contextQuery = `arkPress adj "${code}_date"`;
    } else {
      // Fallback or error if no code/source found for other corpora
      console.warn("No specific code found for 'By document' search on this corpus");
    }

    const start = parseInt(globalStartDate);
    const end = parseInt(globalEndDate);

    // Helper to fetch count
    const fetchCount = async (cqlQuery) => {
      const url = `/api/sru?operation=searchRetrieve&exactSearch=True&version=1.2&startRecord=0&maximumRecords=0&collapsing=false&query=${encodeURIComponent(cqlQuery)}`;
      try {
        const res = await fetch(url);
        const text = await res.text();
        // Parse XML to find <srw:numberOfRecords>
        const match = text.match(/<srw:numberOfRecords>(\d+)<\/srw:numberOfRecords>/);
        return match ? parseInt(match[1], 10) : 0;
      } catch (e) {
        console.error("Error fetching SRU", e);
        return 0;
      }
    };

    const fetchPeriod = async (year, monthIndex = null) => {
      let dateFilter = "";
      let startDateStr = "";
      let endDateStr = "";

      if (resolution === 'mois' && monthIndex !== null) {
        const m = monthIndex + 1;
        const nm = m === 12 ? 1 : m + 1;
        const ny = m === 12 ? year + 1 : year;
        startDateStr = `${year}-${String(m).padStart(2, '0')}-01`;
        endDateStr = `${ny}-${String(nm).padStart(2, '0')}-01`;
        dateFilter = `gallicapublication_date>="${startDateStr}" and gallicapublication_date<"${endDateStr}"`;
      } else {
        // annee or decennie (fetched as yearly slices)
        startDateStr = `${year}-01-01`;
        endDateStr = `${year + 1}-01-01`;
        dateFilter = `gallicapublication_date>="${startDateStr}" and gallicapublication_date<"${endDateStr}"`;
      }

      let queryTerm;
      if (query.searchMode === 'cooccurrence') {
        const w1 = query.word;
        const w2 = query.word2;
        const dist = query.distance || 10;
        // The instruction says: (( text all "word1" prox/unit=word/distance=n_distance "word2"))
        queryTerm = `(( text all "${w1}" prox/unit=word/distance=${dist} "${w2}"))`;
      } else {
        queryTerm = `(text adj "${word}")`;
      }
      const fullQuery = `${queryTerm} and ${dateFilter} and ${contextQuery}`;
      const totalQuery = `${dateFilter} and ${contextQuery}`;

      const [n, total] = await Promise.all([
        fetchCount(fullQuery),
        fetchCount(totalQuery)
      ]);

      return {
        year,
        mois: monthIndex !== null ? monthIndex + 1 : undefined,
        n,
        total
      };
    };

    // Prepare tasks
    const tasks = [];
    for (let year = start; year <= end; year++) {
      if (resolution === 'mois') {
        for (let m = 0; m < 12; m++) {
          tasks.push(() => fetchPeriod(year, m));
        }
      } else {
        tasks.push(() => fetchPeriod(year));
      }
    }

    // Run tasks with concurrency limit (batching)
    const chunkSize = 10;
    const allData = [];
    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(t => t()));
      allData.push(...chunkResults);
    }

    return [{ data: allData, query: { ...query, startDate: globalStartDate, endDate: globalEndDate } }];
  };

  const fetchListMode = (query, globalStartDate, globalEndDate, route) => {
    const { word, corpus, n_joker, length, stopwords } = query;
    // Handle Le Monde corpus specificities
    let actualCorpus = corpus;
    if (corpus === 'lemonde_rubriques' || corpus === 'lemonde') {
      actualCorpus = 'lemonde';
    }

    const url = `https://shiny.ens-paris-saclay.fr/guni/${route}?mot=${word.replace(/’/g, "'")}&corpus=${actualCorpus}&from=${globalStartDate}&to=${globalEndDate}&n_joker=${n_joker || 10}&length=${length || 2}&stopwords=${stopwords || 500}`;

    return fetch(url)
      .then(res => res.text())
      .then(csvText => {
        return new Promise(resolve => {
          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              // Map results to { word: row.gram, total: row.tot }
              let processedData = results.data;

              // Filter out "d'word", "l'word" etc. for nearby search
              if (route === 'associated') {
                const lowerWord = word.toLowerCase();
                processedData = processedData.filter(row => {
                  if (!row.gram) return false;
                  const gramLower = row.gram.toLowerCase();
                  // Check if it ends with 'word (e.g. "l'immigration")
                  if (gramLower.endsWith(`'${lowerWord}`)) {
                    return false;
                  }
                  return true;
                });
              }

              const data = processedData.map(row => ({
                word: row.gram,
                total: row.tot
              }));
              resolve([{ data, query: { ...query, startDate: globalStartDate, endDate: globalEndDate, isListMode: true } }]);
            }
          });
        });
      });
  };

  const fetchDataForQuery = (query, globalStartDate, globalEndDate) => {
    return new Promise((resolve, reject) => {
      const { word, corpus, resolution, revues, rubriques, byRubrique, searchMode } = query;
      if (!word) {
        resolve([{ data: [], query: { ...query, startDate: globalStartDate, endDate: globalEndDate } }]);
        return;
      }

      if (searchMode === 'document' || searchMode === 'cooccurrence' || searchMode === 'article' || searchMode === 'cooccurrence_article') {
        fetchByDocument(query, globalStartDate, globalEndDate).then(resolve).catch(reject);
        return;
      }

      if (searchMode === 'joker') {
        fetchListMode(query, globalStartDate, globalEndDate, 'joker').then(resolve).catch(reject);
        return;
      }

      if (searchMode === 'nearby') {
        fetchListMode(query, globalStartDate, globalEndDate, 'associated').then(resolve).catch(reject);
        return;
      }

      if (searchMode === 'associated_article') {
        fetchListMode(query, globalStartDate, globalEndDate, 'associated_article').then(resolve).catch(reject);
        return;
      }

      const words = word.split('+').map(w => w.trim());

      let fetchPromises;
      if (corpus === 'google') {
        fetchPromises = words.map(w => fetchSingleWordNgramViewer(w, globalStartDate, globalEndDate));
      } else {
        fetchPromises = words.map(w => fetchSingleWordGallicagram(w, corpus, globalStartDate, globalEndDate, resolution, revues, rubriques, byRubrique));
      }

      Promise.all(fetchPromises)
        .then(results => {
          const queryWithDates = { ...query, startDate: globalStartDate, endDate: globalEndDate };
          if (corpus === 'google') {
            if (results.length === 1) {
              resolve([{ data: results, query: queryWithDates }]);
              return;
            }
            const combinedNgram = results.map(r => r.ngram).join(' + ');
            let combinedTimeseries = [];
            const lengths = results.map(r => r.timeseries.length);
            const maxLength = Math.max(...lengths);
            results.forEach(r => {
              if (r.timeseries.length < maxLength) {
                const diff = maxLength - r.timeseries.length;
                r.timeseries = r.timeseries.concat(Array(diff).fill(0));
              }
            });
            for (let i = 0; i < maxLength; i++) {
              let sum = 0;
              for (let j = 0; j < results.length; j++) {
                sum += results[j].timeseries[i] || 0;
              }
              combinedTimeseries.push(sum);
            }
            const combinedData = [{
              ngram: combinedNgram,
              parent: "",
              timeseries: combinedTimeseries,
              type: "ABS"
            }];
            resolve([{ data: combinedData, query: queryWithDates }]);
          } else {
            if (corpus === 'lemonde_rubriques' && byRubrique) {
              // Flatten results from multiple words (if any) and group by rubrique
              const allRows = results.flat();
              const grouped = {};
              allRows.forEach(row => {
                const rub = row.rubrique || 'Unknown';
                if (!grouped[rub]) grouped[rub] = [];
                grouped[rub].push(row);
              });

              const rubriqueResponses = Object.entries(grouped).map(([rub, rows]) => {
                const combinedData = {};
                rows.forEach(row => {
                  const year = row.date || row.annee || row.year;
                  if (!year) return;

                  let dateKey;
                  if (resolution === 'annee') {
                    dateKey = `${year}`;
                  } else if (resolution === 'mois') {
                    dateKey = `${year}-${row.mois || 1}`;
                  } else { // jour
                    dateKey = `${year}-${row.mois || 1}-${row.jour || 1}`;
                  }

                  if (!combinedData[dateKey]) {
                    combinedData[dateKey] = { ...row, n: 0, total: 0 };
                  }
                  combinedData[dateKey].n += row.n || 0;
                  if (combinedData[dateKey].total === 0) {
                    combinedData[dateKey].total = row.total || 0;
                  }
                });
                const dataValues = Object.values(combinedData);
                const total = dataValues.reduce((acc, row) => acc + (row.n || 0), 0);
                return { data: dataValues, query: { ...queryWithDates, word: `${word} - ${rub}` }, total };
              });
              resolve(rubriqueResponses);
            } else {
              const combinedData = {};
              results.forEach(data => {
                data.forEach(row => {
                  const year = row.date || row.annee || row.year;
                  if (!year) return;

                  let dateKey;
                  if (resolution === 'annee') {
                    dateKey = `${year}`;
                  } else if (resolution === 'mois') {
                    dateKey = `${year}-${row.mois || 1}`;
                  } else { // jour
                    dateKey = `${year}-${row.mois || 1}-${row.jour || 1}`;
                  }

                  if (!combinedData[dateKey]) {
                    combinedData[dateKey] = { ...row, n: 0, total: 0 };
                  }
                  combinedData[dateKey].n += row.n || 0;
                  if (combinedData[dateKey].total === 0) {
                    combinedData[dateKey].total = row.total || 0;
                  }
                });
              });
              const dataValues = Object.values(combinedData);
              const total = dataValues.reduce((acc, row) => acc + (row.n || 0), 0);
              resolve([{ data: dataValues, query: queryWithDates, total }]);
            }
          }
        })
        .catch(error => reject(error));
    });
  };

  const handlePlot = () => {
    setError(null);
    setApiResponses([]);
    setRawPlotData([]);
    setPlotData([]);
    setOccurrences([]);
    setTotalOccurrences(0);
    setTotalPlotOccurrences(0);
    setSelectedDate(null);
    setIsLoading(true);
    setFetchContextAfterPlot(true);

    // Compute adjusted dates synchronously to handle race condition with auto-adjust useEffect
    const activeQuery = queries.find(q => q.id === activeQueryId);
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;

    if (activeQuery && corpusPeriods[activeQuery.corpus]) {
      const period = corpusPeriods[activeQuery.corpus];
      if (startDate < period.start) effectiveStartDate = period.start;
      if (endDate > period.end) effectiveEndDate = period.end;

      if (effectiveStartDate !== startDate || effectiveEndDate !== endDate) {
        // Also update the state to keep UI in sync, but only if changed
        if (effectiveStartDate !== startDate) setStartDate(effectiveStartDate);
        if (effectiveEndDate !== endDate) setEndDate(effectiveEndDate);
      }
    }

    // Expand queries with '&' separator into multiple queries
    const expandedQueries = queries.flatMap(q => {
      if (q.word && q.word.includes('&')) {
        // Split by '&' and create separate queries for each word
        return q.word.split('&').map(w => ({
          ...q,
          word: w.trim()
        }));
      }
      return [q];
    });

    const promises = expandedQueries.map(q => fetchDataForQuery(q, effectiveStartDate, effectiveEndDate));

    Promise.all(promises)
      .then(responses => {
        const flatResponses = responses.flat();
        setApiResponses(flatResponses);
        setFetchId(prev => prev + 1);
        const total = flatResponses.reduce((acc, res) => acc + (res.total || 0), 0);
        setTotalPlotOccurrences(total);

        // Auto-switch to barplot if total occurrences < 100 and currently in line mode
        if (plotType === 'line' && total < 100 && total > 0) {
          setPlotType('bar');
          setSnackbarMessage(t('Low data warning', { count: total }));
          setSnackbarOpen(true);
        }
      })
      .catch(err => {
        console.error("An error occurred during plotting:", err);
        setError(err ? err.message : "An unknown error occurred");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleDownloadPlot = () => {
    if ((plotType === 'sums' || plotType === 'wordcloud') && sumsData.length === 0) return;
    if ((plotType !== 'sums' && plotType !== 'wordcloud') && plotData.length === 0) return;

    // Ensure fonts are loaded before drawing
    document.fonts.ready.then(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const scale = 2; // Increase resolution
      const width = 1200 * scale;
      const height = 800 * scale;
      let margin = { top: 60 * scale, right: 60 * scale, bottom: 100 * scale, left: 100 * scale };
      canvas.width = width;
      canvas.height = height;

      // Background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);

      const activeQuery = queries.find(q => q.id === activeQueryId);
      const advancedOptions = activeQuery?.advancedOptions || {};
      const palette = advancedOptions?.colorblindPalette ? colorblindPalette : defaultPalette;

      // Fonts
      ctx.font = `${16 * scale}px 'EB Garamond', Georgia, serif`;
      ctx.fillStyle = 'black';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3 * scale;

      if (plotType === 'wordcloud') {
        const words = sumsData.map((d, i) => {
          const angle = sumsData.length > 1 ? (i / (sumsData.length - 1)) * 2 * Math.PI : 0;
          const maxTotal = sumsData.length > 0 && sumsData[0].total > 0 ? sumsData[0].total : 1;
          // Center is (width/2, height/2), radius scaled
          const radius = Math.min(width, height) * 0.35;
          return {
            ...d,
            x: width / 2 + Math.cos(angle) * radius * (0.1 + 0.9 * i / sumsData.length), // Spiral-ish
            y: height / 2 + Math.sin(angle) * radius * (0.1 + 0.9 * i / sumsData.length),
            size: (20 + (d.total / maxTotal) * 80) * scale
          };
        });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';

        words.forEach(w => {
          ctx.font = `${w.size}px 'EB Garamond', Georgia, serif`;
          ctx.fillText(w.word, w.x, w.y);
        });

        // Title
        ctx.font = `bold ${24 * scale}px 'EB Garamond', Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black';
        ctx.fillText(t('Word Cloud'), width / 2, 40 * scale);

      } else if (plotType === 'sums') {
        // Horizontal Bar Chart
        const maxVal = Math.max(...sumsData.map(d => d.total));

        // Calculate room needed for value labels at the end of bars
        ctx.font = `${16 * scale}px 'EB Garamond', Georgia, serif`;
        let maxValLabelWidth = 0;
        sumsData.forEach(d => {
          const labelWidth = ctx.measureText(d.total.toLocaleString()).width;
          if (labelWidth > maxValLabelWidth) maxValLabelWidth = labelWidth;
        });
        margin.right = Math.max(margin.right, maxValLabelWidth + 20 * scale);

        // Scales
        // Y axis is categories (words), evenly spaced
        const itemHeight = (height - margin.top - margin.bottom) / sumsData.length;
        const barHeight = itemHeight * 0.6;

        // X axis is value
        const xScale = (val) => margin.left + (val / maxVal) * (width - margin.left - margin.right);

        // Axes Drawing
        ctx.beginPath();
        // Y Axis line
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        // X Axis line
        ctx.moveTo(margin.left, height - margin.bottom);
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.stroke();

        // Title
        ctx.textAlign = 'center';
        ctx.font = `${20 * scale}px 'EB Garamond', Georgia, serif`;
        ctx.fillText(t('Total Occurrences per Query'), width / 2, 40 * scale);

        // X Axis Label
        ctx.font = `${24 * scale}px 'EB Garamond', Georgia, serif`;
        ctx.fillText(t('Total Occurrences'), width / 2, height - 25 * scale);
        // Bars and Labels
        sumsData.forEach((d, i) => {
          const y = margin.top + i * itemHeight + itemHeight / 2;
          const barWidth = xScale(d.total) - margin.left;

          ctx.fillStyle = palette[i % palette.length];
          ctx.fillRect(margin.left, y - barHeight / 2, barWidth, barHeight);

          // Y Label (Word)
          ctx.fillStyle = 'black';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.font = `${16 * scale}px 'EB Garamond', Georgia, serif`;
          ctx.fillText(d.word, margin.left - 10 * scale, y);

          // Value Label
          ctx.textAlign = 'left';
          ctx.fillText(d.total.toLocaleString(), margin.left + barWidth + 5 * scale, y);
        });

      } else {
        // Line, Area, Bar
        const effectiveIsRescaled = advancedOptions.rescale && plotType === 'line';

        const processTrace = (trace) => {
          let y = trace.y;
          if (effectiveIsRescaled) {
            y = zscore(y);
          } else if (plotType !== 'bar') {
            y = y.map(v => v !== null && v !== undefined ? v * 1000 : v);
          }
          return { ...trace, y };
        };

        let tracesToDraw = plotData.map(processTrace);
        let rawTracesToDraw = rawPlotData.map(processTrace);

        // Determine Ranges
        let allX = [];
        let allY = [];
        tracesToDraw.forEach(t => {
          allX.push(...t.x);
          allY.push(...t.y);
        });
        if (smoothing > 0 && (plotType === 'line' || plotType === 'area')) {
          rawTracesToDraw.forEach(t => {
            allY.push(...t.y);
          });
        }
        allY = allY.filter(y => y !== null && y !== undefined);

        const dates = allX.map(d => new Date(d).getTime());
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const dataMin = Math.min(...allY);
        const dataMax = Math.max(...allY);

        // Padding
        const range = dataMax - dataMin;
        const padding = range === 0 ? (dataMax === 0 ? 1 : Math.abs(dataMax) * 0.05) : range * 0.05;
        // Clamp min to 0 unless z-score, or if extendYScale is set
        let paddedMin;
        if (effectiveIsRescaled) {
          paddedMin = dataMin - padding;
        } else if (advancedOptions?.extendYScale) {
          paddedMin = 0;
        } else {
          paddedMin = Math.max(0, dataMin - padding);
        }

        const paddedMax = dataMax + padding;

        // Nice Ticks
        const targetTicks = 6;
        const roughStep = (paddedMax - paddedMin) / (targetTicks - 1);
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalizedStep = roughStep / magnitude;
        let tickStep;
        if (normalizedStep <= 1) tickStep = 1 * magnitude;
        else if (normalizedStep <= 2) tickStep = 2 * magnitude;
        else if (normalizedStep <= 5) tickStep = 5 * magnitude;
        else tickStep = 10 * magnitude;

        const minValue = Math.floor(paddedMin / tickStep) * tickStep;
        const maxValue = Math.ceil(paddedMax / tickStep) * tickStep;

        // Calculate max tick width to adjust margin dynamically
        ctx.font = `${16 * scale}px 'EB Garamond', Georgia, serif`;
        let maxTickWidth = 0;
        for (let val = minValue; val <= maxValue + tickStep / 10; val += tickStep) {
          const label = parseFloat(val.toPrecision(10)).toString();
          const metrics = ctx.measureText(label);
          if (metrics.width > maxTickWidth) maxTickWidth = metrics.width;
        }
        // Ensure enough room for Y title (approx 40px * scale) and ticks
        margin.left = Math.max(margin.left, maxTickWidth + 60 * scale);

        // Scales
        const xScale = (date) => {
          const t = new Date(date).getTime();
          return margin.left + (t - minDate) / (maxDate - minDate) * (width - margin.left - margin.right);
        };
        const yScale = (val) => {
          return height - margin.bottom - (val - minValue) / (maxValue - minValue) * (height - margin.top - margin.bottom);
        };

        // Axes
        ctx.beginPath();
        ctx.moveTo(margin.left, height - margin.bottom);
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.moveTo(margin.left, height - margin.bottom);
        ctx.lineTo(margin.left, margin.top);
        ctx.stroke();

        // X Ticks
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `${20 * scale}px 'EB Garamond', Georgia, serif`;
        const yearSpan = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 365.25);
        const tickInterval = yearSpan > 100 ? 20 : (yearSpan > 50 ? 10 : 5);
        const startYear = new Date(minDate).getFullYear();
        const endYear = new Date(maxDate).getFullYear();
        for (let y = Math.ceil(startYear / tickInterval) * tickInterval; y <= endYear; y += tickInterval) {
          const date = new Date(y, 0, 1);
          const x = xScale(date);
          ctx.beginPath();
          ctx.moveTo(x, height - margin.bottom);
          ctx.lineTo(x, height - margin.bottom + 5 * scale);
          ctx.stroke();
          ctx.fillText(y.toString(), x, height - margin.bottom + 10 * scale);
        }

        // Y Ticks
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let val = minValue; val <= maxValue + tickStep / 10; val += tickStep) {
          const y = yScale(val);
          if (y >= margin.top && y <= height - margin.bottom) {
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left - 5 * scale, y);
            ctx.stroke();
            const label = parseFloat(val.toPrecision(10)).toString();
            ctx.fillText(label, margin.left - 10 * scale, y);
          }
        }

        // Labels
        ctx.textAlign = 'center';
        ctx.font = `${24 * scale}px 'EB Garamond', Georgia, serif`;
        ctx.fillText(t('Date'), margin.left + (width - margin.left - margin.right) / 2, height - margin.bottom + 50 * scale);

        ctx.save();
        // Place Y title relative to margin.left to avoid overlap
        ctx.translate(margin.left - maxTickWidth - 40 * scale, margin.top + (height - margin.top - margin.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        let yTitle;
        if (effectiveIsRescaled) {
          yTitle = t('Z-score');
        } else if (plotType === 'bar') {
          yTitle = t('Frequency in the corpus');
        } else {
          yTitle = t('Frequency in the corpus (‰)');
        }
        ctx.fillText(yTitle, 0, 0);
        ctx.restore();
        // Drawing Data
        tracesToDraw.forEach((trace, i) => {
          const color = palette[i % palette.length];
          ctx.fillStyle = color;
          ctx.strokeStyle = color;

          if (plotType === 'bar') {
            const barWidth = (width - margin.left - margin.right) / trace.x.length * 0.8;
            trace.y.forEach((yVal, idx) => {
              if (yVal !== null && yVal !== undefined) {
                const x = xScale(trace.x[idx]);
                const y = yScale(yVal);
                const h = height - margin.bottom - y;
                ctx.fillRect(x - barWidth / 2, y, barWidth, h);
              }
            });
          } else if (plotType === 'area') {
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            const points = [];
            trace.y.forEach((yVal, idx) => {
              if (yVal !== null && yVal !== undefined) {
                points.push({ x: xScale(trace.x[idx]), y: yScale(yVal) });
              }
            });

            if (points.length > 0) {
              ctx.moveTo(points[0].x, height - margin.bottom);
              ctx.lineTo(points[0].x, points[0].y);

              for (let j = 0; j < points.length - 1; j++) {
                const p0 = points[j > 0 ? j - 1 : j];
                const p1 = points[j];
                const p2 = points[j + 1];
                const p3 = points[j + 2 < points.length ? j + 2 : j + 1];

                const cp1x = p1.x + (p2.x - p0.x) / 6;
                let cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                let cp2y = p2.y - (p3.y - p1.y) / 6;

                const yBottom = height - margin.bottom;
                const yTop = margin.top;
                cp1y = Math.max(yTop, Math.min(yBottom, cp1y));
                cp2y = Math.max(yTop, Math.min(yBottom, cp2y));

                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
              }

              ctx.lineTo(points[points.length - 1].x, height - margin.bottom);
              ctx.closePath();
              ctx.fill();

              ctx.globalAlpha = 1.0;
              ctx.lineWidth = 2 * scale;
              ctx.stroke();
            }

          } else {
            if (smoothing > 0) {
              const rawTrace = rawTracesToDraw[i];
              rawTrace.y.forEach((yVal, idx) => {
                if (yVal !== null && yVal !== undefined) {
                  const cx = xScale(rawTrace.x[idx]);
                  const cy = yScale(yVal);
                  ctx.beginPath();
                  ctx.arc(cx, cy, 3 * scale, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
            }

            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            const points = [];
            trace.y.forEach((yVal, idx) => {
              if (yVal !== null && yVal !== undefined) {
                points.push({ x: xScale(trace.x[idx]), y: yScale(yVal) });
              }
            });

            if (points.length > 0) {
              ctx.moveTo(points[0].x, points[0].y);
              for (let j = 0; j < points.length - 1; j++) {
                const p0 = points[j > 0 ? j - 1 : j];
                const p1 = points[j];
                const p2 = points[j + 1];
                const p3 = points[j + 2 < points.length ? j + 2 : j + 1];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                let cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                let cp2y = p2.y - (p3.y - p1.y) / 6;
                const yBottom = height - margin.bottom;
                const yTop = margin.top;
                cp1y = Math.max(yTop, Math.min(yBottom, cp1y));
                cp2y = Math.max(yTop, Math.min(yBottom, cp2y));
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
              }
            }
            ctx.stroke();
          }
        });

        // Legend
        if (tracesToDraw.length > 1) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `${16 * scale}px 'EB Garamond', Georgia, serif`;
          let legendX = margin.left;
          const legendY = height - 30 * scale;
          tracesToDraw.forEach((trace, i) => {
            const color = palette[i % palette.length];
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY - 5 * scale, 20 * scale, 10 * scale);
            ctx.fillStyle = 'black';
            ctx.fillText(trace.name, legendX + 25 * scale, legendY);
            legendX += ctx.measureText(trace.name).width + 50 * scale;
          });
        }
      }

      const link = document.createElement('a');
      link.download = 'gallicagram_plot.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const handleDownloadCSV = () => {
    if ((plotType === 'sums' || plotType === 'wordcloud') && sumsData.length > 0) {
      const csv = Papa.unparse({
        fields: ['Word', 'Count'],
        data: sumsData.map(d => ({ Word: d.word, Count: d.total }))
      });
      downloadCSV(csv);
      return;
    }

    if (rawPlotData.length === 0) {
      alert("No data to download.");
      return;
    }

    const headers = ['date'];
    rawPlotData.forEach(trace => {
      headers.push(trace.name);
      if (trace.n && trace.total) {
        headers.push(`${trace.name} (n)`);
        headers.push(`${trace.name} (total)`);
      }
    });

    const rows = rawPlotData[0].x.map((date, i) => {
      const row = { date: date.toISOString().split('T')[0] };
      rawPlotData.forEach(trace => {
        row[trace.name] = trace.y[i];
        if (trace.n && trace.total) {
          row[`${trace.name} (n)`] = trace.n[i];
          row[`${trace.name} (total)`] = trace.total[i];
        }
      });
      return row;
    });

    const csv = Papa.unparse({
      fields: headers,
      data: rows
    });

    downloadCSV(csv);
  };

  const downloadCSV = (csvContent) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'gallicagram_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const activeQuery = queries.find(q => q.id === activeQueryId);

  return (
    <ThemeProvider theme={theme}>
      <div className={`App ${darkMode ? 'dark' : ''}`}>
        <header className="App-header">
          <img src="/logo.png" className="App-logo" alt="logo" />
          <div className="header-links">
            <a href="https://x.com/gallicagram" target="_blank" rel="noopener noreferrer">{t('X')}</a>
            <a href="https://osf.io/preprints/socarxiv/84bf3_v1" target="_blank" rel="noopener noreferrer">{t('Paper')}</a>
            <a href="https://regicid.github.io/api" target="_blank" rel="noopener noreferrer">{t('API')}</a>
            <a href="https://archive.org/download/2024-01-19-de-courson/2024-01-19-De%20Courson.mp4" target="_blank" rel="noopener noreferrer">{t('Video')}</a>
            <a href="https://github.com/regicid/gallicagram_react" target="_blank" rel="noopener noreferrer">{t('Code')}</a>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }} onClick={() => changeLanguage('en')}>🇬🇧</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }} onClick={() => changeLanguage('fr')}>🇫🇷</button>
            <span style={{ marginLeft: '10px', display: 'inline-flex', alignItems: 'center' }}>
              <Typography variant="body2" style={{ marginRight: '3px' }}>🌙</Typography>
              <Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} size="small" />
            </span>
          </div>
        </header>
        <div className="App-body">
          <div className="form-container">
            <TabsComponent
              queries={queries}
              activeQueryId={activeQueryId}
              onTabClick={setActiveQueryId}
              onAddTab={addQuery}
              onRemoveTab={removeQuery}
              isOnlyQuery={queries.length === 1}
            />
            {activeQuery && (
              <>
                <FormComponent
                  formData={activeQuery}
                  onFormChange={handleFormChange}
                  onPlot={handlePlot}
                  perseeData={perseeData}
                />
                <div className="form-group">
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <TextField
                      name="startDate"
                      label={t('Start Date')}
                      type="number"
                      value={startDate}
                      onChange={handleDateInputChange}
                      onKeyDown={handleKeyDown}
                      inputProps={{ min: 1600, max: 2025 }}
                    />
                    <TextField
                      name="endDate"
                      label={t('End Date')}
                      type="number"
                      value={endDate}
                      onChange={handleDateInputChange}
                      onKeyDown={handleKeyDown}
                      inputProps={{ min: 1600, max: 2025 }}
                    />
                  </Box>
                  <Box sx={{ width: '100%' }}>
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
                <AdvancedOptionsComponent
                  advancedOptions={activeQuery.advancedOptions}
                  onAdvancedOptionsChange={handleAdvancedOptionsChange}
                />
              </>
            )}
            <Button variant="contained" color="success" onClick={handlePlot} disabled={isLoading}>
              {isLoading ? t('Loading...') : t('Plot')}
            </Button>
            {dateWarnings.length > 0 && (
              <Box sx={{ marginTop: '1rem', width: '100%' }}>
                {dateWarnings.map((warning, index) => (
                  <Alert key={index} severity="warning" sx={{ marginBottom: '0.5rem' }}>
                    {warning.message}
                  </Alert>
                ))}
              </Box>
            )}
            {wordCountWarnings.length > 0 && (
              <Box sx={{ marginTop: '1rem', width: '100%' }}>
                {wordCountWarnings.map((warning, index) => (
                  <Alert key={`word-${index}`} severity="warning" sx={{ marginBottom: '0.5rem' }}>
                    {warning.message}
                  </Alert>
                ))}
              </Box>
            )}
            {totalPlotOccurrences > 0 && (
              <Typography variant="body1" style={{ marginTop: '1rem' }}>
                {t('Total Occurrences:')} {totalPlotOccurrences.toLocaleString()}
              </Typography>
            )}
          </div>
          <div className="plot-container">
            {error && <div className="error">{error}</div>}
            <div className="plot-area">
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {isLoading && (
                  <div className="loading-overlay" style={{ flexDirection: 'column' }}>

                    <FingerprintSpinner color="#d32f2f" size={100} />
                  </div>
                )}
                {plotType === 'sums' ? (
                  <SumsComponent data={sumsData} darkMode={darkMode} />
                ) : plotType === 'wordcloud' ? (
                  <WordCloudComponent data={sumsData} darkMode={darkMode} />
                ) : (
                  <PlotComponent
                    data={plotData}
                    onPointClick={handlePointClick}
                    advancedOptions={activeQuery.advancedOptions}
                    plotType={plotType}
                    darkMode={darkMode}
                    plotRevision={`${fetchId}-${smoothing}-${plotType}-${JSON.stringify(activeQuery?.advancedOptions)}`}
                  />
                )}
              </div>
              <div className="plot-controls">
                <h3>{t('Plot controls')}</h3>
                <div className="form-group">
                  <FormControl fullWidth>
                    <InputLabel id="plot-type-select-label">{t('Visualization:')}</InputLabel>
                    <Select
                      labelId="plot-type-select-label"
                      id="plot-type-select"
                      value={plotType}
                      label={t('Visualization:')}
                      onChange={(e) => setPlotType(e.target.value)}
                      sx={{ fontFamily: 'serif' }}
                    >
                      <MenuItem value={"line"}>{t('Line Plot (Frequency)')}</MenuItem>
                      <MenuItem value={"area"}>{t('Area Chart (Frequency)')}</MenuItem>
                      <MenuItem value={"bar"}>{t('Bar Plot (Raw Count)')}</MenuItem>
                      <MenuItem value={"sums"}>{t('Sums')}</MenuItem>
                      <MenuItem value={"wordcloud"}>{t('Word Cloud')}</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ flexGrow: 1 }}>
                    <Typography id="smoothing-slider" gutterBottom>
                      {activeQuery?.advancedOptions?.loessSmoothing
                        ? t('Smoothing (Loess Span):')
                        : t('Smoothing (Moving Average):')}
                    </Typography>
                    <Slider
                      value={smoothing}
                      onChange={(e, newValue) => setSmoothing(newValue)}
                      aria-labelledby="smoothing-slider"
                      valueLabelDisplay="on"
                      step={1}
                      marks
                      min={0}
                      max={10}
                      disabled={plotType !== 'line' && plotType !== 'area'}
                      sx={{ width: '90%' }}
                    />
                  </div>
                  <Tooltip
                    title={
                      <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        <strong>{t('Smoothing Help')}</strong>
                        <br />
                        <br />
                        {activeQuery?.advancedOptions?.loessSmoothing
                          ? t('Loess Smoothing Help')
                          : t('Moving Average Help')}
                      </div>
                    }
                    arrow
                    placement="right"
                  >
                    <IconButton size="small" style={{ marginLeft: '0.5rem' }}>
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </div>
                <Button variant="contained" color="success" onClick={handleDownloadPlot} disabled={isLoading || plotData.length === 0}>
                  {t('Download Plot')}
                </Button>
                <Button variant="contained" color="success" onClick={handleDownloadCSV} disabled={isLoading || plotData.length === 0}>
                  {t('Download CSV')}
                </Button>
              </div>
            </div>
            {(selectedDate || occurrences.length > 0) &&
              <div style={{ position: 'relative' }}>
                {isContextLoading && (
                  <div className="loading-overlay">
                    <FingerprintSpinner color="#d32f2f" size={100} />
                  </div>
                )}
                <ContextDisplay
                  records={occurrences}
                  totalRecords={totalOccurrences}
                  onPageChange={handleContextPageChange}
                  searchParams={contextSearchParams}
                  isLoading={isContextLoading}
                  corpus={(selectedQuery || activeQuery)?.corpus}
                  corpusConfigs={corpusConfigs}
                  resolution={(selectedQuery || activeQuery)?.resolution}
                />
              </div>
            }
          </div>
        </div>
      </div>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </ThemeProvider>
  );
}

export default App;