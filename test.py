import requests
import json
import time
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("TMDB_API_KEY")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "movie_data")
BASE_URL = os.getenv("BASE_URL", "https://api.themoviedb.org/3")


def get_data(url, params):
    try:
        response = requests.get(url, params=params, timeout=10)

        if response.status_code == 429:
            print("Rate limit hit. Sleeping for 5 seconds...")
            time.sleep(5)
            return get_data(url, params)

        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None


def process_movie_data(movie_raw):
    credits = movie_raw.get("credits", {})
    keywords_data = movie_raw.get("keywords", {})

    cast = []
    for member in credits.get("cast", [])[:10]:
        cast.append(
            {
                "id": member.get("id"),
                "name": member.get("name"),
                "character": member.get("character"),
                "profile_path": member.get("profile_path"),
            }
        )

    directors = []
    for member in credits.get("crew", []):
        if member.get("job") == "Director":
            directors.append(
                {
                    "id": member.get("id"),
                    "name": member.get("name"),
                    "profile_path": member.get("profile_path"),
                }
            )

    keywords = []
    for kw in keywords_data.get("keywords", []):
        keywords.append({"id": kw.get("id"), "name": kw.get("name")})

    return {
        "id": movie_raw.get("id"),
        "title": movie_raw.get("title"),
        "overview": movie_raw.get("overview"),
        "release_date": movie_raw.get("release_date"),
        "vote_average": movie_raw.get("vote_average"),
        "poster_path": movie_raw.get("poster_path"),
        "backdrop_path": movie_raw.get("backdrop_path"),
        "genres": movie_raw.get("genres", []),
        "cast": cast,
        "directors": directors,
        "keywords": keywords,
    }


def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created directory: {OUTPUT_DIR}")

    total_pages = 500

    print(
        f"Starting download of 10,000 movies sorted by RATING (Pages 1-{total_pages})..."
    )

    for page in range(1, total_pages + 1):
        print(f"--- Processing Page {page}/{total_pages} ---")

        discover_params = {
            "api_key": API_KEY,
            "page": page,
            "language": "en-US",
            "sort_by": "vote_average.desc",
            "vote_count.gte": 300,
            "include_adult": "false",
        }

        discover_data = get_data(f"{BASE_URL}/discover/movie", discover_params)

        if not discover_data:
            print(f"Skipping page {page} due to error.")
            continue

        movies_on_page = []

        for item in discover_data.get("results", []):
            movie_id = item["id"]

            details_params = {
                "api_key": API_KEY,
                "append_to_response": "credits,keywords",
            }

            raw_movie = get_data(f"{BASE_URL}/movie/{movie_id}", details_params)

            if raw_movie:
                clean_movie = process_movie_data(raw_movie)
                movies_on_page.append(clean_movie)
                time.sleep(0.05)

        filename = os.path.join(OUTPUT_DIR, f"movies_page_{page}.json")
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(movies_on_page, f, ensure_ascii=False, indent=2)

        print(f"Saved {len(movies_on_page)} movies from page {page}")

    print("Download complete. You can now run the Neo4j loader.")


if __name__ == "__main__":
    main()
