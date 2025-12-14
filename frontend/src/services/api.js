import axios from 'axios';

const API_URL = '/movieGraph';

const COLORS = {
  MOVIE: '#e50914',      
  PERSON: '#4a90e2',     
  GENRE: '#ffd700',      
  DIRECTOR_EDGE: '#e50914', 
  ACTOR_EDGE: '#4a90e2',
  GENRE_EDGE: '#ffd700',
  DEFAULT: '#888'
};

export const api = {
  getSuggestions: async (query) => {
    if (!query || query.length < 2) return [];
    try {
      const res = await axios.get(`${API_URL}/search/suggestions`, { params: { q: query } });
      return res.data;
    } catch (e) { return []; }
  },

  getShortestPathGraph: async (source, target) => {
    try {
      const res = await axios.get(`${API_URL}/path/graph`, { 
        params: { source, target } 
      });
      return res.data;
    } catch (e) {
      console.error(e);
      return { nodes: [], links: [], steps: 0, message: "Błąd podczas pobierania ścieżki" };
    }
  },

  getCustomRecommendations: async (titles) => {
    try {
        const res = await axios.post(`${API_URL}/recommend/custom`, { movie_titles: titles });
        return res.data;
    } catch (e) {
        console.error(e);
        return { nodes: [], links: [] };
    }
  },

  searchEntity: async (query) => {
    const res = await axios.get(`${API_URL}/search`, { params: { q: query } });
    return res.data; 
  },

  getMovieCast: async (title) => (await axios.get(`${API_URL}/movies/${title}/cast`)).data,
  getMovieDirectors: async (title) => (await axios.get(`${API_URL}/movies/${title}/director`)).data,
  getMovieGenres: async (title) => (await axios.get(`${API_URL}/movies/${title}/genres`)).data,
  
  getPersonCredits: async (name) => (await axios.get(`${API_URL}/people/${name}/movies`)).data,

  getRecommendations: async (title) => { 
    try { return (await axios.get(`${API_URL}/recommendations/jaccard/${title}`)).data } 
    catch(e){ return [] } 
  },

  getShortestPath: async (source, target) => {
    const res = await axios.get(`${API_URL}/actor-connection`, {
      params: { source, target }
    });
    return res.data;
  },
  
  fetchGraphData: async (query) => {
    let searchResult;
    try {
        searchResult = await api.searchEntity(query);
    } catch (e) {
        throw new Error("Nie znaleziono obiektu");
    }

    const { type, data: mainEntity } = searchResult;
    let nodes = [];
    let links = [];

    if (type === 'movie') {
      const [cast, directors, genres] = await Promise.all([
        api.getMovieCast(mainEntity.title),
        api.getMovieDirectors(mainEntity.title),
        api.getMovieGenres(mainEntity.title)
      ]);

      nodes.push({ id: mainEntity.title, group: 'movie', ...mainEntity });

      cast.forEach(c => {
        nodes.push({ id: c.name, group: 'person', ...c });
        links.push({ 
            source: c.name, 
            target: mainEntity.title, 
            label: c.role,        
            color: COLORS.ACTOR_EDGE 
        });
      });

      directors.forEach(d => {
        nodes.push({ id: d.name, group: 'person', ...d });
        links.push({ 
            source: d.name, 
            target: mainEntity.title, 
            label: 'Reżyser',    
            color: COLORS.DIRECTOR_EDGE 
        });
      });

      genres.forEach(g => {
        nodes.push({ id: g.name, group: 'genre' });
        links.push({ 
            source: mainEntity.title, 
            target: g.name, 
            color: COLORS.GENRE_EDGE 
        });
      });

    } else if (type === 'person') {
      const credits = await api.getPersonCredits(mainEntity.name);

      nodes.push({ id: mainEntity.name, group: 'person', ...mainEntity });

      credits.forEach(m => {
        nodes.push({ id: m.title, group: 'movie', ...m });
        
        const isDirector = m.job === 'Director';
        
        links.push({ 
            source: mainEntity.name, 
            target: m.title,
            label: isDirector ? 'Reżyser' : (m.role || 'Aktor'),
            color: isDirector ? COLORS.DIRECTOR_EDGE : COLORS.ACTOR_EDGE
        });
      });
    }

    const uniqueNodes = Array.from(new Map(nodes.map(node => [node.id, node])).values());

    return { nodes: uniqueNodes, links };
  }
};