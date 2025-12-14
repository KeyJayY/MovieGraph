import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Info, Map, Star, X, Network, Footprints, Zap, Trash, ChevronLeft, ChevronRight, MousePointer2 } from 'lucide-react';
import SearchInput from './SearchInput';

const SidePanel = ({ selectedNode, onClose, onNodeSelect, onDrawGraph, onFindPath, onReplaceGraph }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  
  const [relatedItems, setRelatedItems] = useState([]); 
  const [loadingRelated, setLoadingRelated] = useState(false);
  
  const [sourceInput, setSourceInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState(null);

  const [genInput, setGenInput] = useState(''); 
  const [selectedMovies, setSelectedMovies] = useState([]); 
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    if (selectedNode) {
        setIsOpen(true);
        setActiveTab('details');
        fetchRelatedData();
        setSourceInput(selectedNode.title || selectedNode.name);
    }
  }, [selectedNode]);

  const fetchRelatedData = async () => {
    if (!selectedNode) return;
    setLoadingRelated(true);
    setRelatedItems([]);

    try {
      if (selectedNode.group === 'person') {
        const movies = await api.getPersonCredits(selectedNode.id);
        setRelatedItems(movies);
      } else if (['movie', 'input', 'recommendation'].includes(selectedNode.group)) {
        try {
            const cast = await api.getMovieCast(selectedNode.id);
            const directors = await api.getMovieDirectors(selectedNode.id);
            const directorsWithJob = directors.map(d => ({ ...d, job: 'Director' }));
            const castWithJob = cast.map(c => ({ ...c, job: 'Actor' }));
            setRelatedItems([...directorsWithJob, ...castWithJob]);
        } catch(e) {
            console.warn("Could not fetch details", e);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingRelated(false);
  };

  const handlePathSearch = async () => {
    if (!sourceInput || !targetInput) return;
    setPathLoading(true);
    setPathError(null);
    const result = await api.getShortestPathGraph(sourceInput, targetInput);
    setPathLoading(false);
    if (result.nodes.length > 0) onFindPath(result);
    else setPathError(result.message || "Nie znaleziono ścieżki.");
  };

  const handleAddMovie = (title) => {
      if (title && !selectedMovies.includes(title)) {
          setSelectedMovies([...selectedMovies, title]);
          setGenInput(''); 
      }
  };

  const handleRemoveMovie = (t) => setSelectedMovies(selectedMovies.filter(x => x !== t));

  const handleGenerateGraph = async () => {
    if (selectedMovies.length === 0) return;
    setGenLoading(true);
    try {
        const data = await api.getCustomRecommendations(selectedMovies);
        onReplaceGraph(data);
    } catch (e) { console.error(e); } 
    finally { setGenLoading(false); }
  };

  const getImageUrl = (path) => path ? `https://image.tmdb.org/t/p/w200${path}` : null;

  const isPerson = selectedNode?.group === 'person';
  const nodeTitle = selectedNode?.title || selectedNode?.name;
  const imagePath = selectedNode ? (selectedNode.poster_path || selectedNode.profile_path || selectedNode.poster) : null;

  return (
    <div className={`side-panel-wrapper ${isOpen ? 'open' : 'closed'}`}>
      
      <button className="panel-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
      </button>

      <div className="tabs" style={{ padding: '10px 10px 0 10px', background: '#252525' }}>
        <button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>
          <Info size={16} /> Info
        </button>
        <button className={activeTab === 'path' ? 'active' : ''} onClick={() => setActiveTab('path')}>
          <Map size={16} /> Ścieżka
        </button>
        <button className={activeTab === 'gen' ? 'active' : ''} onClick={() => setActiveTab('gen')}>
          <Zap size={16} /> Rekomendacje
        </button>
      </div>

      <div className="panel-content-scroll">
        
        {activeTab === 'details' && (
          <div className="tab-details">
            {!selectedNode ? (
                <div className="empty-state">
                    <MousePointer2 size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <h3>Nie wybrano węzła</h3>
                    <p>Kliknij węzeł na grafie, aby zobaczyć szczegóły, obsadę i twórców.</p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                        <div style={{ flex: 1 }}>
                        <span className={`badge ${isPerson ? 'badge-person' : 'badge-movie'}`} 
                                style={{ fontSize: '0.7em', padding: '2px 6px', borderRadius: '4px', background: isPerson ? '#4a90e2' : '#e50914', color: 'white', display: 'inline-block', marginBottom: '5px' }}>
                            {selectedNode.group ? (selectedNode.group === 'person' ? 'OSOBA' : 'FILM') : (isPerson ? 'OSOBA' : 'FILM')}
                        </span>
                        <h2 style={{ margin: 0, lineHeight: '1.2', fontSize: '1.4rem' }}>{nodeTitle}</h2>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', marginLeft: '10px' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <button className="draw-graph-btn" onClick={() => onDrawGraph(nodeTitle)}>
                            <Network size={16} /> Rysuj graf dla tego węzła
                        </button>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        {getImageUrl(imagePath) ? (
                            <img 
                                src={getImageUrl(imagePath)} 
                                alt="Plakat" 
                                style={{ maxHeight: '250px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} 
                            />
                        ) : (
                            <div style={{ height: '150px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: '#666' }}>Brak zdjęcia</div>
                        )}
                    </div>

                    <div style={{ background: '#222', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        {selectedNode.year && <p style={{ margin: '5px 0' }}>📅 <strong>Rok:</strong> {selectedNode.year}</p>}
                        {selectedNode.rating && <p style={{ margin: '5px 0' }}>⭐ <strong>Ocena:</strong> {selectedNode.rating}</p>}
                        {selectedNode.born && <p style={{ margin: '5px 0' }}>🎂 <strong>Urodzony:</strong> {selectedNode.born}</p>}
                        {selectedNode.overview && <p style={{ margin: '10px 0', lineHeight: '1.5', color: '#ccc', fontSize: '0.9em' }}>{selectedNode.overview}</p>}
                    </div>

                    <h3>{isPerson ? 'Filmografia' : 'Obsada i twórcy'}</h3>
                    {loadingRelated ? <p>Ładowanie...</p> : (
                        <ul className="interactive-list">
                            {relatedItems.map((item, idx) => {
                                const isDir = item.job === 'Director' || item.role === 'Director';
                                const itemImg = item.poster || item.poster_path || item.profile_path;
                                return (
                                    <li 
                                        key={idx} 
                                        onClick={() => {
                                            const newNode = {
                                                id: item.id || item.name || item.title, 
                                                group: isPerson ? 'movie' : 'person',   
                                                ...item 
                                            };
                                            onNodeSelect(newNode);
                                        }}
                                        style={{ borderLeft: isDir ? '3px solid #e50914' : '3px solid #4a90e2' }}
                                    >
                                        <img src={getImageUrl(itemImg) || 'https://via.placeholder.com/50x75?text=?'} alt="miniaturka" />
                                        <div>
                                            <strong>{item.title || item.name}</strong>
                                            <div className="sub-text">
                                                {isDir 
                                                    ? <span style={{color: '#e50914', fontWeight: 'bold', fontSize: '0.8rem'}}>REŻYSER</span> 
                                                    : (item.role ? `jako ${item.role}` : 'Aktor')
                                                }
                                            </div>
                                            {item.year && <div className="sub-text">{item.year}</div>}
                                        </div>
                                    </li>
                                );
                            })}
                            {relatedItems.length === 0 && <p style={{color: '#666', fontStyle: 'italic'}}>Brak dostępnych szczegółów.</p>}
                        </ul>
                    )}
                </>
            )}
          </div>
        )}

        {activeTab === 'path' && (
          <div className="tab-path">
            <h3>Najkrótsza ścieżka 👣</h3>
            <p style={{ color: '#aaa', fontSize: '0.9em', marginBottom: '15px' }}>
                Znajdź połączenie między dwoma obiektami (aktorzy i filmy). <br/> 
                <span style={{color: '#e50914', fontSize: '0.85em'}}>⚠️ Czyści obecny graf.</span>
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                    <label style={{ fontSize: '0.8em', color: '#888', marginBottom: '5px', display: 'block' }}>WĘZEŁ POCZĄTKOWY</label>
                    <SearchInput 
                        placeholder="Start (np. Kevin Bacon)" 
                        value={sourceInput} 
                        onChange={setSourceInput}
                        onSelect={setSourceInput}
                    />
                </div>
                <div style={{ textAlign: 'center', color: '#666' }}>⬇️</div>
                <div>
                    <label style={{ fontSize: '0.8em', color: '#888', marginBottom: '5px', display: 'block' }}>WĘZEŁ KOŃCOWY</label>
                    <SearchInput 
                        placeholder="Koniec (np. Matrix)" 
                        value={targetInput} 
                        onChange={setTargetInput}
                        onSelect={setTargetInput}
                    />
                </div>

                <button 
                    onClick={handlePathSearch} 
                    disabled={pathLoading}
                    className="draw-graph-btn"
                    style={{ background: '#4a90e2', marginTop: '10px' }}
                >
                    {pathLoading ? 'Obliczanie...' : 'Znajdź i narysuj ścieżkę'} <Footprints size={16} />
                </button>
            </div>
            {pathError && (
                <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,0,0,0.1)', border: '1px solid #500', borderRadius: '4px', color: '#ffaaaa' }}>
                    {pathError}
                </div>
            )}
          </div>
        )}

        {activeTab === 'gen' && (
             <div className="tab-recs">
                <h3>Rekomendacje filmowe</h3>
                <p style={{ color: '#aaa', fontSize: '0.9em', marginBottom: '15px' }}>
                    Zobacz dlaczego filmy są polecane (wspólni aktorzy, gatunki, słowa kluczowe).
                </p>
                
                <label style={{ fontSize: '0.8em', color: '#888', marginBottom: '5px', display: 'block' }}>DODAJ FILMY DO LISTY</label>
                
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <SearchInput 
                            placeholder="Wpisz tytuł filmu..." 
                            value={genInput} 
                            onChange={setGenInput}
                            onSelect={(val) => { setGenInput(val); handleAddMovie(val); }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {selectedMovies.map((title, idx) => (
                        <div key={idx} style={{ 
                            background: '#2a4b7c', color: '#fff', padding: '4px 8px', borderRadius: '12px', fontSize: '0.85em', 
                            display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #4a90e2'
                        }}>
                            {title}
                            <button onClick={() => handleRemoveMovie(title)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {selectedMovies.length === 0 && <span style={{ color: '#666', fontSize: '0.85em', fontStyle: 'italic' }}>Lista jest pusta. Dodaj filmy powyżej.</span>}
                </div>

                <button 
                    onClick={handleGenerateGraph}
                    disabled={genLoading || selectedMovies.length === 0}
                    className="draw-graph-btn"
                    style={{ background: '#28a745' }}
                >
                    {genLoading ? 'Analizowanie powiązań...' : 'Generuj głęboki graf'} <Zap size={16} />
                </button>
             </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel;