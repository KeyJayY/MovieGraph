import React from 'react';
import '../App.css';

const Legend = () => {
  return (
    <div className="graph-legend">
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', textTransform: 'uppercase', color: '#888' }}>
        Legenda
      </h4>
      
      <div className="legend-section">
        <span className="legend-label">Węzły</span>
        <div className="legend-item">
          <span className="dot" style={{ background: '#e50914' }}></span>
          <span>Film</span>
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: '#4a90e2' }}></span>
          <span>Osoba</span>
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: '#ffd700' }}></span>
          <span>Gatunek</span>
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: '#42f554' }}></span>
          <span>Rekomendacja</span>
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: '#bdc3c7' }}></span>
          <span>Słowo kluczowe</span>
        </div>
      </div>

      <div className="legend-divider"></div>

      <div className="legend-section">
        <span className="legend-label">Relacje</span>
        <div className="legend-item">
          <span className="line" style={{ background: '#4a90e2' }}></span>
          <span>Zagrał w</span>
        </div>
        <div className="legend-item">
          <span className="line" style={{ background: '#e50914' }}></span>
          <span>Wyreżyserował</span>
        </div>
      </div>

      <div className="legend-divider"></div>

      <div className="legend-section">
        <span className="legend-label">Credits</span>
        <div className="legend-item">
          <span><em>Dane o filmach pochodzą z themoviedb.org</em></span>
        </div>

      </div>
    </div>
  );
};

export default Legend;