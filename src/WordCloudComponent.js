import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-selection';
import * as d3Scale from 'd3-scale';
import cloud from 'd3-cloud';
import { useTranslation } from 'react-i18next';
import 'd3-transition';

const WordCloudComponent = ({ data, darkMode }) => {
  const { t } = useTranslation();
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef(null);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 600
        });
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial size
    handleResize();

    // Use a small timeout to let layout settle if needed
    setTimeout(handleResize, 100);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const { width, height } = dimensions;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    // Color palette
    const colors = darkMode
      ? ['#61dafb', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd']
      : ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2'];

    const colorScale = d3Scale.scaleOrdinal(colors);

    // Font size scale
    const hasData = data && data.length > 0;
    const maxVal = hasData ? Math.max(...data.map(d => d.total)) : 1;
    const minVal = hasData ? Math.min(...data.map(d => d.total)) : 0;

    const fontSizeScale = d3Scale.scaleSqrt()
      .domain([minVal, maxVal])
      .range([12, 60]);

    // Construct words array for d3-cloud
    const words = data.map(d => ({
      text: d.word,
      size: fontSizeScale(d.total),
      value: d.total
    }));

    const layout = cloud()
      .size([width, height])
      .words(words)
      .padding(5)
      .rotate(0)
      .font("EB Garamond")
      .fontSize(d => d.size)
      // d3-cloud is asynchronous
      .on("end", draw);

    layout.start();

    function draw(words) {
      if (!svgRef.current) return;

      const svg = d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height);

      // Add a group centered
      const g = svg.append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

      g.selectAll("text")
        .data(words)
        .enter().append("text")
        .style("font-size", d => d.size + "px")
        .style("font-family", "EB Garamond, Georgia, serif")
        .style("fill", (d, i) => colorScale(i))
        .attr("text-anchor", "middle")
        .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")")
        .text(d => d.text)
        .style("cursor", "default")
        .append("title") // Tooltip
        .text(d => `${d.text} (${d.value})`);
    }

  }, [data, dimensions, darkMode]);

  if (!data || data.length === 0) {
    return <div>{t('No data to display')}</div>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: '600px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      <h3 style={{ fontFamily: 'EB Garamond, Georgia, serif', color: darkMode ? '#eaeaea' : 'black', marginBottom: '10px' }}>
        {t('Word Cloud')}
      </h3>
      <svg ref={svgRef} />
    </div>
  );
};

export default WordCloudComponent;
