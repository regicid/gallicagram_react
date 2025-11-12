import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormComponent, { AdvancedOptionsComponent } from './FormComponent';
import PlotComponent from './PlotComponent';
import TabsComponent from './TabsComponent';
import Papa from 'papaparse';
import ContextDisplay from './ContextDisplay';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { FormControl, InputLabel, Select, MenuItem, Slider, Tooltip, TextField, Box } from '@mui/material';
import SumsComponent from './SumsComponent';
import WordCloudComponent from './WordCloudComponent';

const theme = createTheme({
  typography: {
    fontFamily: [
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
  advancedOptions: {
    rescale: false,
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

const GALLICA_PROXY_API_URL = 'https://gallica-proxy-production.up.railway.app';

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

    if (resolution === 'annee') {
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
        if (resolution === 'annee') {
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
          dataMap.set(dateKey, { n: row.n, total: row.total });
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
    } else {
      const firstCorpus = queries[0]?.corpus;
      const allSameCorpus = queries.every(q => q.corpus === firstCorpus);
      const activeQuery = queries.find(q => q.id === activeQueryId);
      const advancedOptions = activeQuery?.advancedOptions || {};

      let traces = apiResponses.flatMap(res => processData(res, allSameCorpus, plotType, advancedOptions));

      // Handle ratio calculation for lineplot mode
      if (plotType === 'line' && advancedOptions.ratio && traces.length >= 2) {
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
          name: `${trace1.name}/${trace2.name}`,
          connectgaps: false,
        };
        traces = [ratioTrace];
      }

      setRawPlotData(traces);
    }
  }, [apiResponses, plotType, queries, activeQueryId, processData, t]);

  useEffect(() => {
    if (plotType !== 'line' && plotType !== 'area') {
      setPlotData(rawPlotData);
      return;
    }
    const smoothedTraces = rawPlotData.map(trace => {
      const smoothedY = movingAverage(trace.y, smoothing);
      return { ...trace, y: smoothedY };
    });
    setPlotData(smoothedTraces);
  }, [smoothing, rawPlotData, plotType]);

  const fetchOccurrences = useCallback(async (date, searchParams, query, shouldAppend = false) => {
    setIsContextLoading(true);
    setError(null);
    if (!query || !query.word) {
      setIsContextLoading(false);
      return;
    }

    const params = new URLSearchParams({
      terms: query.word,
      year: date.getFullYear(),
      limit: searchParams.limit,
      cursor: searchParams.cursor,
      source: query.corpus === 'livres' ? 'book' : (query.corpus === 'presse' ? 'periodical' : 'all'),
      sort: 'relevance'
    });

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
  }, []);

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
    setStartDate(newValue[0]);
    setEndDate(newValue[1]);
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

  const handlePointClick = (data) => {
    if (data.points.length > 0) {
      const point = data.points[0];
      const curveNumber = point.curveNumber;
      const query = apiResponses[curveNumber].query;
      setSelectedQuery(query);
      const date = new Date(point.x);
      setSelectedDate(date);
      const newSearchParams = { limit: 10, cursor: 0 };
      setContextSearchParams(newSearchParams);
      fetchOccurrences(date, newSearchParams, query, false);
    }
  };

  const handleContextPageChange = (pageIndex) => {
      const newSearchParams = { ...contextSearchParams, cursor: pageIndex * contextSearchParams.limit };
      setContextSearchParams(newSearchParams);
      fetchOccurrences(selectedDate, newSearchParams, selectedQuery, true);
  }

  const fetchSingleWordGallicagram = (word, corpus, startDate, endDate, resolution) => {
    const url = `https://shiny.ens-paris-saclay.fr/guni/query?mot=${word.trim().replace(/-/g, ' ')}&corpus=${corpus}&from=${startDate}&to=${endDate}&resolution=${resolution}`;
    console.log("Querying Gallicagram URL:", url);
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok for \"${word}\"`);
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
                console.error(`CSV Parsing errors for \"${word}\":`, results.errors);
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
          throw new Error(`Network response was not ok for \"${word}\"`);
        }
        return response.json();
      })
      .then(data => {
        if (!data || data.length === 0) {
          console.warn(`No data returned for \"${word}\"`);
          return { ngram: word, timeseries: [] };
        }
        return data[0];
      });
  };

  const fetchDataForQuery = (query, globalStartDate, globalEndDate) => {
    return new Promise((resolve, reject) => {
      const { word, corpus, resolution } = query;
      if (!word) {
        resolve({ data: [], query: { ...query, startDate: globalStartDate, endDate: globalEndDate } });
        return;
      }

      const words = word.split('+').map(w => w.trim());

      let fetchPromises;
      if (corpus === 'google') {
        fetchPromises = words.map(w => fetchSingleWordNgramViewer(w, globalStartDate, globalEndDate));
      } else {
        fetchPromises = words.map(w => fetchSingleWordGallicagram(w, corpus, globalStartDate, globalEndDate, resolution));
      }

      Promise.all(fetchPromises)
        .then(results => {
          const queryWithDates = { ...query, startDate: globalStartDate, endDate: globalEndDate };
          if (corpus === 'google') {
            if (results.length === 1) {
              resolve({ data: results, query: queryWithDates });
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
            resolve({ data: combinedData, query: queryWithDates });
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
            resolve({ data: dataValues, query: queryWithDates, total });
          }
        })
        .catch(error => reject(error));
    });
  };

  const handlePlot = () => {
    setError(null);
    setApiResponses([]);
    setOccurrences([]);
    setTotalOccurrences(0);
    setTotalPlotOccurrences(0);
    setSelectedDate(null);
    setIsLoading(true);
    setFetchContextAfterPlot(true);

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

    const promises = expandedQueries.map(q => fetchDataForQuery(q, startDate, endDate));

    Promise.all(promises)
      .then(responses => {
        setApiResponses(responses);
        const total = responses.reduce((acc, res) => acc + (res.total || 0), 0);
        setTotalPlotOccurrences(total);
      })
      .catch(err => {
        console.error("An error occurred during plotting:", err);
        setError(err ? err.message : "An unknown error occurred");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleDownloadCSV = () => {
    if (plotData.length === 0) {
      alert("No data to download.");
      return;
    }

    const headers = ['date', ...plotData.map(trace => trace.name)];
    const rows = plotData[0].x.map((date, i) => {
      const row = { date: date.toISOString().split('T')[0] };
      plotData.forEach(trace => {
        row[trace.name] = trace.y[i];
      });
      return row;
    });

    const csv = Papa.unparse({
      fields: headers,
      data: rows
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
    <div className="App">
      <header className="App-header">
        <img src="/logo.png" className="App-logo" alt="logo" />
        <div className="header-links">
          <a href="https://x.com/gallicagram" target="_blank" rel="noopener noreferrer">{t('X')}</a>
          <a href="https://osf.io/preprints/socarxiv/84bf3_v1" target="_blank" rel="noopener noreferrer">{t('Paper')}</a>
          <a href="https://regicid.github.io/api" target="_blank" rel="noopener noreferrer">{t('API')}</a>
          <button style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'}} onClick={() => changeLanguage('en')}>🇬🇧</button>
          <button style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'}} onClick={() => changeLanguage('fr')}>🇫🇷</button>
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
              />
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
              <AdvancedOptionsComponent
                advancedOptions={activeQuery.advancedOptions}
                onAdvancedOptionsChange={handleAdvancedOptionsChange}
              />
            </>
          )}
          <Button variant="contained" color="success" onClick={handlePlot} disabled={isLoading}>
            {isLoading ? t('Loading...') : t('Plot')}
          </Button>
          {totalPlotOccurrences > 0 && (
            <Typography variant="body1" style={{ marginTop: '1rem' }}>
              {t('Total Occurrences:')} {totalPlotOccurrences.toLocaleString()}
            </Typography>
          )}
        </div>
        <div className="plot-container">
          {error && <div className="error">{error}</div>}
          <div className="plot-area">
            {plotType === 'sums' ? (
              <SumsComponent data={sumsData} />
            ) : plotType === 'wordcloud' ? (
              <WordCloudComponent data={sumsData} />
            ) : (
              <PlotComponent data={plotData} onPointClick={handlePointClick} advancedOptions={activeQuery.advancedOptions} plotType={plotType} />
            )}
            <div className="plot-controls">
              <h3>{t('Plot controls')}</h3>
              <div className="form-group">
                <FormControl sx={{ minWidth: 240 }}>
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
              <div className="form-group">
                <Typography id="smoothing-slider" gutterBottom>
                  {t('Smoothing (Moving Average):')}
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
                  sx={{ width: 200, ml: 2 }}
                />
              </div>
              <Button variant="contained" color="success" disabled={isLoading || plotData.length === 0}>
                {t('Download Plot')}
              </Button>
              <Button variant="contained" color="success" onClick={handleDownloadCSV} disabled={isLoading || plotData.length === 0}>
                {t('Download CSV')}
              </Button>
            </div>
          </div>
          {(selectedDate || occurrences.length > 0) && 
            <ContextDisplay 
                records={occurrences} 
                totalRecords={totalOccurrences}
                onPageChange={handleContextPageChange}
                searchParams={contextSearchParams}
                isLoading={isContextLoading}
            />
          }
        </div>
      </div>
    </div>
    </ThemeProvider>
  );
}

export default App;