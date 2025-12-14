import os
import logging
from typing import List, Optional, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from neo4j import GraphDatabase, Session
from neo4j.exceptions import ServiceUnavailable, TransientError, SessionExpired
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

if not all([NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD]):
    raise ValueError("Missing Neo4j configuration in .env file")

RECOMMENDATION_LIMIT = 3

driver = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global driver
    try:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
            max_connection_lifetime=200,
            keep_alive=True,
        )
        driver.verify_connectivity()
        logger.info("Successfully connected to Neo4j.")
    except Exception as e:
        logger.error(f"Failed to connect to Neo4j on startup: {e}")

    yield

    if driver:
        driver.close()
        logger.info("Neo4j driver closed.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ServiceUnavailable)
async def service_unavailable_handler(request: Request, exc: ServiceUnavailable):
    logger.error(f"Neo4j Service Unavailable: {exc}")
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database is currently unavailable or waking up. Please try again in a few seconds."
        },
    )


@app.exception_handler(TransientError)
async def transient_error_handler(request: Request, exc: TransientError):
    logger.error(f"Neo4j Transient Error: {exc}")
    return JSONResponse(
        status_code=503, content={"detail": "Temporary database error. Please retry."}
    )


@app.exception_handler(SessionExpired)
async def session_expired_handler(request: Request, exc: SessionExpired):
    logger.error(f"Neo4j Session Expired: {exc}")
    return JSONResponse(
        status_code=503, content={"detail": "Database session expired. Please retry."}
    )


def get_db():
    if not driver:
        raise HTTPException(
            status_code=503, detail="Database driver is not initialized."
        )

    session = driver.session()
    try:
        yield session
    except Exception as e:
        logger.error(f"Session error: {e}")
        raise e
    finally:
        session.close()


class Person(BaseModel):
    name: str
    born: Optional[int] = None
    role: Optional[str] = None
    profile_path: Optional[str] = None


class MovieSummary(BaseModel):
    title: str
    year: Optional[str] = None
    rating: float
    poster: Optional[str] = None
    job: Optional[str] = None
    role: Optional[str] = None


class MovieDetails(MovieSummary):
    overview: Optional[str] = None
    tagline: Optional[str] = None


class Genre(BaseModel):
    name: str


class Suggestion(BaseModel):
    label: str
    type: str
    year: Optional[str] = None


class SearchResult(BaseModel):
    type: str
    data: Union[MovieDetails, Person]


class PathResult(BaseModel):
    nodes: List[dict]
    links: List[dict]
    steps: int
    message: str


class CustomRecRequest(BaseModel):
    movie_titles: List[str]


class GraphResponse(BaseModel):
    nodes: List[dict]
    links: List[dict]


@app.post("/recommend/custom", response_model=GraphResponse)
def get_custom_recommendations(
    payload: CustomRecRequest, session: Session = Depends(get_db)
):
    nodes_dict = {}
    links_list = []

    def add_node(node_obj, group_override=None):
        if not node_obj:
            return None
        n_id = node_obj.get("title") or node_obj.get("name")
        if not n_id:
            return None

        if n_id not in nodes_dict:
            labels = list(node_obj.labels)
            if group_override:
                group = group_override
            elif "Genre" in labels:
                group = "genre"
            elif "Keyword" in labels:
                group = "keyword"
            elif "Person" in labels:
                group = "person"
            elif "Movie" in labels:
                group = "movie"
            else:
                group = "unknown"

            data = dict(node_obj.items())
            data["id"] = n_id
            data["group"] = group
            nodes_dict[n_id] = data
        return n_id

    def add_link(source, target, label, rel_type):
        if not source or not target:
            return
        color = "#888"
        if rel_type == "DIRECTED":
            color = "#e50914"
        elif rel_type == "ACTED_IN":
            color = "#4a90e2"
        elif rel_type in ["HAS_GENRE", "IN_GENRE"]:
            color = "#ffd700"
        elif rel_type == "HAS_KEYWORD":
            color = "#bdc3c7"

        links_list.append(
            {
                "source": source,
                "target": target,
                "label": label if rel_type == "ACTED_IN" else rel_type,
                "color": color,
            }
        )

    init_query = """
    MATCH (m:Movie) WHERE toLower(m.title) IN [t IN $titles | toLower(t)] RETURN m
    """
    init_result = session.run(init_query, titles=payload.movie_titles)
    for record in init_result:
        add_node(record["m"], group_override="input")

    rec_query = """
        MATCH (input:Movie) WHERE toLower(input.title) IN [t IN $titles | toLower(t)]
        MATCH (input)-[r1]-(shared)-[r2]-(rec:Movie)
        WHERE NOT toLower(rec.title) IN [t IN $titles | toLower(t)]
        AND (shared:Person OR shared:Genre OR shared:Keyword)
        
        WITH rec, input, shared, r1, r2,
            CASE 
                WHEN type(r1) = 'DIRECTED' THEN 3
                WHEN type(r1) = 'ACTED_IN' THEN 2
                ELSE 1
            END as weight

        WITH rec, sum(weight) as score, collect(DISTINCT shared) as sharedNodes, collect(DISTINCT input) as inputs
        ORDER BY score DESC LIMIT $limit
        
        UNWIND inputs as input
        UNWIND sharedNodes as shared
        MATCH (input)-[r1]-(shared)-[r2]-(rec)
        RETURN input, shared, rec, type(r1) as r1_type, type(r2) as r2_type, coalesce(r1.role, 'Director') as r1_role, coalesce(r2.role, 'Director') as r2_role
        """
    result = session.run(
        rec_query, titles=payload.movie_titles, limit=RECOMMENDATION_LIMIT
    )
    for record in result:
        inp_id = add_node(record["input"], group_override="input")
        shared_id = add_node(record["shared"])
        rec_id = add_node(record["rec"], group_override="recommendation")
        if inp_id and shared_id:
            r1_role = record["r1_role"] if record["r1_type"] == "ACTED_IN" else None
            add_link(inp_id, shared_id, r1_role, record["r1_type"])
        if shared_id and rec_id:
            r2_role = record["r2_role"] if record["r2_type"] == "ACTED_IN" else None
            add_link(shared_id, rec_id, r2_role, record["r2_type"])

    valid_ids = set(nodes_dict.keys())
    unique_links = []
    seen_links = set()
    for l in links_list:
        if l["source"] in valid_ids and l["target"] in valid_ids:
            pair = tuple(sorted([l["source"], l["target"]]))
            key = (pair, l["label"])
            if key not in seen_links:
                seen_links.add(key)
                unique_links.append(l)

    return {"nodes": list(nodes_dict.values()), "links": unique_links}


@app.get("/path/graph", response_model=PathResult)
def get_shortest_path_graph(
    source: str, target: str, session: Session = Depends(get_db)
):
    query = """
    MATCH (start) WHERE (start:Person AND toLower(start.name) = toLower($source)) OR (start:Movie AND toLower(start.title) = toLower($source))
    MATCH (end) WHERE (end:Person AND toLower(end.name) = toLower($target)) OR (end:Movie AND toLower(end.title) = toLower($target))
    MATCH p = shortestPath((start)-[:ACTED_IN|DIRECTED*]-(end))
    WITH p, length(p) as steps
    UNWIND nodes(p) as n
    UNWIND relationships(p) as r
    RETURN collect(DISTINCT {
        id: coalesce(n.title, n.name), group: labels(n)[0], title: n.title, name: n.name,
        poster_path: n.poster_path, profile_path: n.profile_path, year: n.released, born: n.born, rating: n.vote_average
    }) as nodes,
    collect(DISTINCT {
        source: coalesce(startNode(r).title, startNode(r).name), target: coalesce(endNode(r).title, endNode(r).name),
        label: coalesce(r.role, 'Director'), type: type(r), color: CASE WHEN type(r) = 'DIRECTED' THEN '#e50914' ELSE '#4a90e2' END
    }) as links, steps
    """
    result = session.run(query, source=source, target=target).single()
    if not result or not result["nodes"]:
        return {"nodes": [], "links": [], "steps": 0, "message": "No path found."}
    nodes = []
    for n in result["nodes"]:
        group = n["group"].lower() if n.get("group") else "unknown"
        nodes.append({**n, "group": group, "id": n["id"]})
    return {
        "nodes": nodes,
        "links": result["links"],
        "steps": result["steps"],
        "message": f"Found path in {result['steps']} steps!",
    }


@app.get("/search", response_model=SearchResult)
def search_entity(q: str, session: Session = Depends(get_db)):
    movie = session.run(
        "MATCH (m:Movie) WHERE toLower(m.title) = toLower($q) RETURN m.title AS title, m.released AS year, m.vote_average AS rating, m.poster_path AS poster, m.overview AS overview, m.tagline AS tagline LIMIT 1",
        q=q,
    ).single()
    if movie:
        return {"type": "movie", "data": movie.data()}
    person = session.run(
        "MATCH (p:Person) WHERE toLower(p.name) = toLower($q) RETURN p.name AS name, p.born AS born, p.profile_path AS profile_path LIMIT 1",
        q=q,
    ).single()
    if person:
        return {"type": "person", "data": person.data()}
    raise HTTPException(status_code=404, detail="Not found")


@app.get("/search/suggestions", response_model=List[Suggestion])
def get_search_suggestions(q: str, session: Session = Depends(get_db)):
    if len(q) < 2:
        return []
    query = "CALL { MATCH (m:Movie) WHERE toLower(m.title) CONTAINS toLower($q) RETURN m.title AS label, 'movie' AS type, toString(m.released) AS year LIMIT 5 } RETURN label, type, year UNION CALL { MATCH (p:Person) WHERE toLower(p.name) CONTAINS toLower($q) RETURN p.name AS label, 'person' AS type, 'Person' AS year LIMIT 5 } RETURN label, type, year"
    return [r.data() for r in session.run(query, q=q)]


@app.get("/movies/{title}/cast", response_model=List[Person])
def get_movie_cast(title: str, session: Session = Depends(get_db)):
    return [
        r.data()
        for r in session.run(
            "MATCH (m:Movie {title: $title})<-[r:ACTED_IN]-(p:Person) RETURN p.name AS name, r.role AS role, p.profile_path AS profile_path LIMIT 20",
            title=title,
        )
    ]


@app.get("/movies/{title}/director", response_model=List[Person])
def get_movie_director(title: str, session: Session = Depends(get_db)):
    return [
        r.data()
        for r in session.run(
            "MATCH (m:Movie {title: $title})<-[:DIRECTED]-(p:Person) RETURN p.name AS name, 'Director' AS role, p.profile_path AS profile_path",
            title=title,
        )
    ]


@app.get("/movies/{title}/genres", response_model=List[Genre])
def get_movie_genres(title: str, session: Session = Depends(get_db)):
    return [
        r.data()
        for r in session.run(
            "MATCH (m:Movie {title: $title})-[:HAS_GENRE|IN_GENRE]->(g:Genre) RETURN g.name AS name",
            title=title,
        )
    ]


@app.get("/people/{actor_name}/movies", response_model=List[MovieSummary])
def get_person_credits(actor_name: str, session: Session = Depends(get_db)):
    return [
        r.data()
        for r in session.run(
            "MATCH (p:Person {name: $actor_name})-[r:ACTED_IN|DIRECTED]->(m:Movie) RETURN m.title AS title, m.released AS year, m.vote_average AS rating, m.poster_path AS poster, type(r) AS rel_type, CASE WHEN type(r) = 'ACTED_IN' THEN r.role ELSE 'Director' END AS role, CASE WHEN type(r) = 'ACTED_IN' THEN 'Actor' ELSE 'Director' END AS job ORDER BY m.released DESC",
            actor_name=actor_name,
        )
    ]


@app.get("/movies/{title}", response_model=MovieDetails)
def get_movie_details(title: str, session: Session = Depends(get_db)):
    r = session.run(
        "MATCH (m:Movie {title: $title}) RETURN m.title AS title, m.released AS year, m.vote_average AS rating, m.poster_path AS poster, m.overview AS overview, m.tagline AS tagline",
        title=title,
    ).single()
    if not r:
        raise HTTPException(404, "Not found")
    return r.data()


@app.get("/recommendations/jaccard/{title}")
def get_recs(title: str):
    return []


@app.get("/actor-connection")
def get_path(source: str, target: str):
    return {"steps": 0, "path_text": "Todo"}


if os.path.exists("frontend/build"):
    app.mount("/static", StaticFiles(directory="frontend/build/static"), name="static")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path.startswith("api") or full_path.startswith("recommend"):
            raise HTTPException(status_code=404, detail="Not Found")
        return FileResponse("frontend/build/index.html")

else:
    print("Warning: 'frontend/build' folder not found. Frontend will not be served.")
