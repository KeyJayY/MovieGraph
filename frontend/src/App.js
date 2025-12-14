import React, { useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView.jsx';
import SidePanel from './components/SidePanel.jsx';
import Legend from './components/Legend.jsx';
import { api } from './services/api';
import './App.css';
import { Search, Film, User, Trash2 } from 'lucide-react';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        const results = await api.getSuggestions(searchQuery);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const addDataToGraph = (newData) => {
    setGraphData(prevData => {
        const existingNodes = new Map(prevData.nodes.map(n => [n.id, n]));
        const existingLinks = new Set(prevData.links.map(l => 
            `${l.source.id || l.source}-${l.target.id || l.target}-${l.type}`
        ));

        newData.nodes.forEach(node => {
            if (!existingNodes.has(node.id)) {
                existingNodes.set(node.id, node);
            }
        });

        const newLinks = [...prevData.links];
        newData.links.forEach(link => {
            const linkId = `${link.source}-${link.target}-${link.type}`;
            if (!existingLinks.has(linkId)) {
                newLinks.push(link);
                existingLinks.add(linkId);
            }
        });

        return {
            nodes: Array.from(existingNodes.values()),
            links: newLinks
        };
    });
  };

  const handlePathFound = (pathResult) => {
    setGraphData({
        nodes: pathResult.nodes,
        links: pathResult.links
    });
    
    if (pathResult.nodes.length > 0) {
        setSelectedNode(pathResult.nodes[0]); 
    }
  };

  const handleReplaceGraph = (newData) => {
    setGraphData({
        nodes: [...newData.nodes],
        links: [...newData.links]
    });
  };

  const handleClearGraph = () => {
    setGraphData({ nodes: [], links: [] });
    setSelectedNode(null);
    setSearchQuery('');
    setSuggestions([]);
  };

  const fetchAndAddToGraph = async (query) => {
    setSuggestions([]);
    setIsFocused(false);

    try {
      const data = await api.fetchGraphData(query);
      addDataToGraph(data);

      if (data.nodes.length > 0) {
        const centerNode = data.nodes.find(n => 
            (n.title && n.title.toLowerCase() === query.toLowerCase()) || 
            (n.name && n.name.toLowerCase() === query.toLowerCase())
        ) || data.nodes[0];
        
        setSelectedNode(centerNode); 
      }
    } catch (error) {
      console.error(error);
      alert("Nie znaleziono filmu ani osoby!");
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    await fetchAndAddToGraph(searchQuery);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.label);
    fetchAndAddToGraph(suggestion.label);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  };

  const handleDrawGraph = async (nameOrTitle) => {
    await fetchAndAddToGraph(nameOrTitle);
  };

  const handleNodeClick = (node) => {
    if (node.group) {
      setSelectedNode(node);
    }
  };

  return (
    <div className="app-container">
      <header className="top-bar" style={{ marginLeft: '40px' }}> 
        <h1>MovieGraph</h1>
        
        <div className="search-wrapper" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit} className="search-form">
            <input 
                type="text" 
                placeholder="Dodaj do grafu (np. Matrix)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)} 
                onBlur={handleBlur}              
            />
            <button type="submit"><Search size={18} /></button>
            </form>

            {isFocused && suggestions.length > 0 && (
                <ul className="suggestions-list">
                    {suggestions.map((item, idx) => (
                        <li key={idx} onClick={() => handleSuggestionClick(item)}>
                            <div className="suggestion-icon">
                                {item.type === 'movie' ? <Film size={16} /> : <User size={16} />}
                            </div>
                            <div className="suggestion-info">
                                <span className="suggestion-label">{item.label}</span>
                                <span className="suggestion-meta">{item.year}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        <button onClick={handleClearGraph} className="clear-btn">
            <Trash2 size={18} /> Wyczyść
        </button>
      </header>

      <main className="main-layout">
        <div className="graph-container">
          <GraphView 
            data={graphData} 
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleDrawGraph}
          />
          
          {graphData.nodes.length > 0 && <Legend />}
          
          {graphData.nodes.length === 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#666', pointerEvents: 'none', textAlign: 'center' }}>
                  <h3>Graf jest pusty</h3>
                  <p>Wyszukaj film lub aktora</p>
              </div>
          )}
        </div>

        <SidePanel 
          selectedNode={selectedNode} 
          onClose={() => setSelectedNode(null)} 
          onNodeSelect={(node) => setSelectedNode(node)} 
          onDrawGraph={handleDrawGraph}
          onFindPath={handlePathFound}
          onReplaceGraph={handleReplaceGraph}
        />
      </main>
    </div>
  );
}

export default App;