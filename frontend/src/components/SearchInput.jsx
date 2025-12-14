import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Film, User } from 'lucide-react';

const SearchInput = ({ placeholder, value, onChange, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (value.length >= 2) {
        const results = await api.getSuggestions(value);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [value]);

  const handleSelect = (item) => {
    onSelect(item.label);
    setSuggestions([]);
    setIsFocused(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
  };

  return (
    <div className="search-wrapper" ref={wrapperRef} style={{ width: '100%', marginRight: 0 }}>
      <input 
        type="text" 
        placeholder={placeholder} 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', color: 'white', borderRadius: '4px' }}
      />
      
      {isFocused && suggestions.length > 0 && (
        <ul className="suggestions-list" style={{ maxHeight: '200px' }}>
            {suggestions.map((item, idx) => (
                <li key={idx} onClick={() => handleSelect(item)}>
                    <div className="suggestion-icon">
                        {item.type === 'movie' ? <Film size={14} /> : <User size={14} />}
                    </div>
                    <div className="suggestion-info">
                        <span className="suggestion-label" style={{ fontSize: '0.9rem' }}>{item.label}</span>
                    </div>
                </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default SearchInput;