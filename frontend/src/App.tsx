import { useState, useEffect } from "react";
import "./App.css";
import SearchIcon from "./assets/mag.png";
import { Playlist, Recipe } from "./types";
import Chat from "./Chat";

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setUseLlm(data.use_llm));
  }, []);

  const handleSearchRecipe = async (value: string): Promise<void> => {
    setSearchTerm(value);
    if (value.trim() === "") {
      setRecipes([]);
      return;
    }
    const response = await fetch(
      `/api/recipes?name=${encodeURIComponent(value)}`,
    );
    const data: Recipe[] = await response.json();
    setRecipes(data);
  };

  const handleSearchPlaylist = async (value: string): Promise<void> => {
    if (value.trim() === "") {
      setPlaylists([]);
      return;
    }
    const response = await fetch(
      `/api/playlists?name=${encodeURIComponent(value)}`,
    );
    const data: Playlist[] = await response.json();
    setPlaylists(data);
  };

  if (useLlm === null) return <></>;

  return (
    <div className={`full-body-container ${useLlm ? "llm-mode" : ""}`}>
      {/* Search bar (always shown) */}
      <div
        className="input-box"
        onClick={() => document.getElementById("search-input")?.focus()}
      >
        <img src={SearchIcon} alt="search" />
        <input
          id="search-input"
          placeholder="Search for a party theme"
          value={searchTerm}
          onChange={(e) => {
            const v = e.target.value;
            Promise.all([handleSearchRecipe(v), handleSearchPlaylist(v)]);
          }}
        />
      </div>
      <div className="top-text">
        <div className="google-colors">
          <h1 id="google-4">R</h1>
          <h1 id="google-3">E</h1>
          <h1 id="google-0-1">C</h1>
          <h1 id="google-0-2">I</h1>
          <h1 id="google-4">P</h1>
          <h1 id="google-3">E</h1>
        </div>
      </div>

      {/* Search results (always shown) */}
      <div id="answer-box">
        {recipes.map((recipe, index) => (
          <div key={index} className="recipe-item">
            <h3 className="recipe-name">{recipe.name}</h3>
            <p className="recipe-desc">{recipe.description}</p>
            <p className="recipe-time">Minutes: {String(recipe.minutes)}</p>
          </div>
        ))}
      </div>

      {/* Search bar (always shown) */}
      <div className="top-text">
        <div className="google-colors">
          <h1 id="google-4">M</h1>
          <h1 id="google-3">U</h1>
          <h1 id="google-0-1">S</h1>
          <h1 id="google-0-2">I</h1>
          <h1 id="google-4">C</h1>
        </div>
      </div>

      {/* Search results (always shown) */}
      <div id="answer-box">
        {playlists.map((playlist, index) => (
          <div key={index} className="recipe-item">
            <h3 className="playlist-name">{playlist.name}</h3>
              {/* Map over the sliced array to render the elements */}
              {(playlist.songs as unknown as string).split(",").slice(0, 15).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
          </div>
        ))}
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && <Chat onSearchTerm={handleSearchRecipe} />}
      {useLlm && <Chat onSearchTerm={handleSearchPlaylist} />}
    </div>
  );
}

export default App;
