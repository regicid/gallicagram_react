import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import FormComponent from './FormComponent';
import PlotComponent from './PlotComponent';
import TabsComponent from './TabsComponent';
import Papa from 'papaparse';
import ContextDisplay from './ContextDisplay';

let nextId = 2;
const initialQuery = {
  word: 'liberté',
  startDate: 1789,
  endDate: 1950,
  corpus: 'presse',
  resolution: 'annee',
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

function App() {
  const [queries, setQueries] = useState([{ id: 1, ...initialQuery }]);
  const [activeQueryId, setActiveQueryId] = useState(1);
  const [apiResponses, setApiResponses] = useState([]);
  const [rawPlotData, setRawPlotData] = useState([]);
  const [plotData, setPlotData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [smoothing, setSmoothing] = useState(0);
  const [plotType, setPlotType] = useState('line');
  const [occurrences, setOccurrences] = useState([]);
  const [totalOccurrences, setTotalOccurrences] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [contextSearchParams, setContextSearchParams] = useState({ limit: 10, cursor: 0 });
  const [isContextLoading, setIsContextLoading] = useState(false);

  const GALLICA_PROXY_API_URL = 'https://gallica-proxy-production.up.railway.app';

  useEffect(() => {
    // Initial data load from local CSV
    setIsLoading(true);
    fetch('/liberte_data.csv')
      .then(response => {
        if (!response.ok) {
          throw new Error("Could not load initial data file.");
        }
        return response.text();
      })
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length) {
              setError("Error parsing initial data file.");
              console.error("Error parsing initial CSV:", results.errors);
            } else {
              const initialApiResponse = { data: results.data, query: { id: 1, ...initialQuery } };
              setApiResponses([initialApiResponse]);
            }
          }
        });
      })
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
        type: plotType === 'line' ? 'scatter' : 'bar',
        mode: plotType === 'line'
          ? (years.length > 20 ? 'lines' : 'lines+markers')
          : undefined,
        line: plotType === 'line' ? { shape: 'spline' } : undefined,
        name: allSameCorpus
          ? (ngramData.ngram || `Query ${query.id}`)
          : `${ngramData.ngram || `Query ${query.id}`} (${query.corpus})`,
        connectgaps: false,
      };
    });

    return traces;
  }, []);

  const processData = useCallback((apiResponse, allSameCorpus, plotType) => {
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
        dataMap.set(new Date(year, 0).getTime(), null);
      }
    } else if (resolution === 'mois') {
      let currentDate = new Date(start, 0);
      const finalDate = new Date(end, 11);
      while (currentDate <= finalDate) {
        dataMap.set(new Date(currentDate).getTime(), null);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else if (resolution === 'jour') {
      let currentDate = new Date(start, 0, 1);
      const finalDate = new Date(end, 11, 31);
      while (currentDate <= finalDate) {
        dataMap.set(new Date(currentDate).getTime(), null);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    data.forEach(row => {
      const year = row.date || row.annee || row.year || row.année;
      if (year && row.n !== undefined && row.total !== undefined) {
        let dateKey;
        if (resolution === 'annee') {
          dateKey = new Date(year, 0).getTime();
        } else if (resolution === 'mois') {
          const month = row.mois ? row.mois - 1 : 0;
          dateKey = new Date(year, month).getTime();
        } else { // jour
          const month = row.mois ? row.mois - 1 : 0;
          const day = row.jour || 1;
          dateKey = new Date(year, month, day).getTime();
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
      if (plotType === 'line') {
        return (d.data.n !== undefined && d.data.total) ? d.data.n / d.data.total : null;
      } else { // bar
        return d.data.n !== undefined ? d.data.n : null;
      }
    });
    
    return {
      x: processedData.map(d => d.x),
      y: yValues,
      type: plotType === 'line' ? 'scatter' : 'bar',
      mode: plotType === 'line'
        ? (processedData.length > 20 ? 'lines' : 'lines+markers')
        : undefined,
      line: plotType === 'line' ? { shape: 'spline' } : undefined,
      name: allSameCorpus
        ? (query.word || `Query ${query.id}`)
        : `${query.word || `Query ${query.id}`} (${query.corpus})`,
      connectgaps: false,
    };
  }, [processNgramData]);

  useEffect(() => {
    if (apiResponses.length === 0) return;

    const firstCorpus = queries[0]?.corpus;
    const allSameCorpus = queries.every(q => q.corpus === firstCorpus);
    const traces = apiResponses.flatMap(res => processData(res, allSameCorpus, plotType));
    setRawPlotData(traces);
  }, [apiResponses, plotType, queries, processData]);

  useEffect(() => {
    if (plotType !== 'line') {
      setPlotData(rawPlotData);
      return;
    }
    const smoothedTraces = rawPlotData.map(trace => {
      const smoothedY = movingAverage(trace.y, smoothing);
      return { ...trace, y: smoothedY };
    });
    setPlotData(smoothedTraces);
  }, [smoothing, rawPlotData, plotType]);

  const handleFormChange = (updatedQuery) => {
    const newQueries = queries.map(q => q.id === updatedQuery.id ? updatedQuery : q);
    setQueries(newQueries);
  };

  const addQuery = () => {
    const activeQuery = queries.find(q => q.id === activeQueryId);
    const newQuery = {
      id: nextId++,
      word: '', // Reset the word
      startDate: activeQuery.startDate,
      endDate: activeQuery.endDate,
      corpus: activeQuery.corpus,
      resolution: activeQuery.resolution,
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

  const fetchOccurrences = async (date, searchParams) => {
    setIsContextLoading(true);
    setError(null);
    const activeQuery = queries.find(q => q.id === activeQueryId);
    if (!activeQuery || !activeQuery.word) {
      setIsContextLoading(false);
      return;
    }
    
    const params = new URLSearchParams({
      terms: activeQuery.word,
      year: date.getFullYear(),
      limit: searchParams.limit,
      cursor: searchParams.cursor,
      source: activeQuery.corpus === 'livres' ? 'book' : (activeQuery.corpus === 'presse' ? 'periodical' : 'all'),
      sort: 'relevance'
    });

    try {
      const response = await fetch(`${GALLICA_PROXY_API_URL}/api/occurrences_no_context?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch occurrences');
      }
      const data = await response.json();
      setOccurrences(data.records);
      setTotalOccurrences(data.total_records);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsContextLoading(false);
    }
  };

  const handlePointClick = (data) => {
    if (data.points.length > 0) {
      const point = data.points[0];
      const date = new Date(point.x);
      setSelectedDate(date);
      const newSearchParams = { limit: 10, cursor: 0 };
      setContextSearchParams(newSearchParams);
      fetchOccurrences(date, newSearchParams);
    }
  };

  const handleContextPageChange = (pageIndex) => {
      const newSearchParams = { ...contextSearchParams, cursor: pageIndex * contextSearchParams.limit };
      setContextSearchParams(newSearchParams);
      fetchOccurrences(selectedDate, newSearchParams);
  }

  const fetchDataForQuery = (query) => {
    if (query.corpus === 'google') {
      return fetchDataForNgramViewer(query);
    }
    return new Promise((resolve, reject) => {
      const { word, corpus, startDate, endDate, resolution } = query;
      if (!word) {
        resolve({ data: [], query });
        return;
      }
  
      const words = word.split('+');
  
      const fetchPromises = words.map(w => {
        const url = `/guni/query?mot=${w.trim()}&corpus=${corpus}&from=${startDate}&to=${endDate}&resolution=${resolution}`;
        console.log("Querying URL:", url);
        return fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Network response was not ok for "${w}"`);
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || (!contentType.includes("text/csv") && !contentType.includes("text/plain"))) {
              return response.text().then(text => {
                if (text.includes(',') && text.includes('\n')) {
                  console.warn(`Received CSV-like data but with wrong Content-Type: ${contentType}. Processing it anyway.`);
                  return text;
                }
                console.warn(`Expected CSV but received ${contentType || 'unknown'}.`, { query: { ...query, word: w }, response: text });
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
                    console.error(`CSV Parsing errors for "${w}":`, results.errors);
                  }
                  papaResolve(results.data);
                }
              });
            });
          });
      });
  
      Promise.all(fetchPromises)
        .then(results => {
          const combinedData = {};
          results.forEach(data => {
            data.forEach(row => {
              const dateKey = row.date || row.annee || row.year || row.année;
              if (dateKey) {
                if (!combinedData[dateKey]) {
                  combinedData[dateKey] = { ...row, n: 0, total: 0 };
                }
                combinedData[dateKey].n += row.n || 0;
                if (combinedData[dateKey].total === 0) {
                  combinedData[dateKey].total = row.total || 0;
                }
              }
            });
          });
          resolve({ data: Object.values(combinedData), query });
        })
        .catch(error => reject(error));
    });
  };

  const fetchDataForNgramViewer = (query) => {
    return new Promise((resolve, reject) => {
      const { word, startDate, endDate } = query;
      if (!word) {
        resolve({ data: [], query });
        return;
      }
      const url = `/ngrams/json?content=${word}&year_start=${startDate}&year_end=${endDate}&corpus=fr&smoothing=0`;
      console.log("Querying URL:", url);
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Network response was not ok for "${word}"`);
          }
          return response.json();
        })
        .then(data => {
          resolve({ data: data, query });
        })
        .catch(error => reject(error));
    });
  };

  const handlePlot = () => {
    setError(null);
    setApiResponses([]);
    setOccurrences([]);
    setTotalOccurrences(0);
    setSelectedDate(null);
    setIsLoading(true);

    const promises = queries.map(q => fetchDataForQuery(q));

    Promise.all(promises)
      .then(responses => {
        setApiResponses(responses);
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

  const activeQuery = queries.find(q => q.id === activeQueryId);

  return (
    <div className="App">
      <header className="App-header">
        <img src="/logo.png" className="App-logo" alt="logo" />
        <div className="header-links">
          <a href="https://x.com/gallicagram" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://osf.io/preprints/socarxiv/84bf3_v1" target="_blank" rel="noopener noreferrer">Paper</a>
          <a href="https://regicid.github.io/api" target="_blank" rel="noopener noreferrer">API</a>
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
            <FormComponent
              formData={activeQuery}
              onFormChange={handleFormChange}
              onPlot={handlePlot}
            />
          )}
          <button onClick={handlePlot} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Plot'}
          </button>
          <button onClick={handleDownloadCSV} disabled={isLoading || plotData.length === 0}>
            Download CSV
          </button>
          <div className="form-group">
            <label>Visualization:</label>
            <select value={plotType} onChange={(e) => setPlotType(e.target.value)}>
              <option value="line">Line Plot (Frequency)</option>
              <option value="bar">Bar Plot (Raw Count)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Smoothing (Moving Average): {smoothing}</label>
            <input
              type="range"
              min="0"
              max="11"
              value={smoothing}
              onChange={(e) => setSmoothing(parseInt(e.target.value, 10))}
              disabled={plotType !== 'line'}
            />
          </div>
        </div>
        <div className="plot-container">
          {error && <div className="error">{error}</div>}
          <PlotComponent data={plotData} onPointClick={handlePointClick} />
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
  );
}

export default App;