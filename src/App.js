import React, { useState, useEffect } from 'react';
import './App.css';
import FormComponent from './FormComponent';
import PlotComponent from './PlotComponent';
import TabsComponent from './TabsComponent';
import Papa from 'papaparse';

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

  useEffect(() => {
    if (apiResponses.length === 0) return;

    const firstCorpus = queries[0]?.corpus;
    const allSameCorpus = queries.every(q => q.corpus === firstCorpus);
    const traces = apiResponses.map(res => processData(res, allSameCorpus, plotType));
    setRawPlotData(traces);
  }, [apiResponses, plotType, queries]);

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

  const fetchDataForQuery = (query) => {
    return new Promise((resolve, reject) => {
      const { word, corpus, startDate, endDate, resolution } = query;
      if (!word) {
        resolve({ data: [], query });
        return;
      }
      const url = `/guni/query?mot=${word}&corpus=${corpus}&from=${startDate}&to=${endDate}&resolution=${resolution}`;

      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Network response was not ok for "${word}"`);
          }
          const contentType = response.headers.get("content-type");
          if (!contentType || (!contentType.includes("text/csv") && !contentType.includes("text/plain"))) {
            return response.text().then(text => {
              // If it looks like a CSV, process it anyway.
              if (text.includes(',') && text.includes('\n')) { 
                 console.warn(`Received CSV-like data but with wrong Content-Type: ${contentType}. Processing it anyway.`);
                 return text; // Return the text to be processed by Papa.parse
              }
              console.warn(`Expected CSV but received ${contentType || 'unknown'}.`, { query: query, response: text });
              resolve({ data: [], query }); // Resolve with empty data
              return null; // Prevent further processing
            });
          }
          return response.text();
        })
        .then(csvText => {
          if (csvText === null) return; // Stop if not CSV

          Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length) {
                console.error(`CSV Parsing errors for "${word}":`, results.errors);
                // Even with parsing errors, we resolve with what we have, but log it.
                // This is more robust than rejecting the whole promise.
                resolve({ data: results.data, query });
              } else {
                resolve({ data: results.data, query });
              }
            }
          });
        })
        .catch(error => reject(error));
    });
  };

  const processData = (apiResponse, allSameCorpus, plotType) => {
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
  };

  const handlePlot = () => {
    setError(null);
    setApiResponses([]);
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
          <PlotComponent data={plotData} />
        </div>
      </div>
    </div>
  );
}

export default App;