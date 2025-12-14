import json
import os
import glob
import time
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
DATA_DIR = os.getenv("OUTPUT_DIR", "movie_data")


def load_batch(tx, batch_data):
    query = """
    UNWIND $batch AS movie
    
    MERGE (m:Movie {id: movie.id})
    SET m.title = movie.title,
        m.overview = movie.overview,
        m.released = movie.release_date,
        m.vote_average = movie.vote_average,
        m.poster_path = movie.poster_path,
        m.backdrop_path = movie.backdrop_path

    FOREACH (g IN movie.genres |
        MERGE (gen:Genre {name: g.name})
        MERGE (m)-[:HAS_GENRE]->(gen)
    )

    FOREACH (k IN movie.keywords |
        MERGE (kw:Keyword {id: k.id})
        SET kw.name = k.name
        MERGE (m)-[:HAS_KEYWORD]->(kw)
    )

    FOREACH (c IN movie.cast |
        MERGE (p:Person {id: c.id})
        SET p.name = c.name, 
            p.profile_path = c.profile_path
        MERGE (p)-[:ACTED_IN {role: coalesce(c.character, '')}]->(m)
    )

    FOREACH (d IN movie.directors |
        MERGE (dir:Person {id: d.id})
        SET dir.name = d.name, 
            dir.profile_path = d.profile_path
        MERGE (dir)-[:DIRECTED]->(m)
    )
    """
    tx.run(query, batch=batch_data)


def main():
    print(f"Connecting to Neo4j at {NEO4J_URI}...")
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        print("Connection successful!")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    files = glob.glob(os.path.join(DATA_DIR, "movies_page_*.json"))
    files.sort(key=lambda f: int("".join(filter(str.isdigit, f))))

    total_files = len(files)
    print(f"Found {total_files} JSON files to process.")

    start_time = time.time()

    with driver.session() as session:
        for i, file_path in enumerate(files, 1):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    batch = json.load(f)

                if not batch:
                    continue

                session.execute_write(load_batch, batch)

                percent = (i / total_files) * 100
                print(
                    f"[{i}/{total_files}] Imported {len(batch)} movies from {os.path.basename(file_path)} ({percent:.1f}%)"
                )

            except Exception as e:
                print(f"Error processing {file_path}: {e}")

    elapsed = time.time() - start_time
    print(f"\n--- Import Complete in {elapsed:.2f} seconds ---")
    driver.close()


if __name__ == "__main__":
    main()
