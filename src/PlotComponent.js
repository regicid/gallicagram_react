import React from 'react';
import Plot from 'react-plotly.js';

const PlotComponent = ({ data }) => {
  return (
    <Plot
      data={data}
      layout={{ 
        width: 800, 
        height: 600, 
        title: 'Frequency over time',
        font: {
          family: 'Lato, sans-serif'
        },
        xaxis: {
          title: 'Date'
        },
        yaxis: {
          title: 'Frequency in the corpus'
        }
      }}
    />
  );
};

export default PlotComponent;