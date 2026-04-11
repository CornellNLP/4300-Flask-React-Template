import { useNavigate, useLocation } from "react-router";
import imgCandles from "../assets/table3.png";
import imgBread from "../assets/bread.png";
import imgCheese from "../assets/cheese.png";
import linkIcon from "../assets/link.svg";
import { Recipe, Playlist } from "../types";
import "./OutputPage.css";

interface OutputState {
  recipes: Recipe[];
  playlist: Playlist | null;
}

export function OutputPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as Partial<OutputState>;

  const recipes: Recipe[] = state.recipes ?? [];
  const playlist: Playlist | null = state.playlist ?? null;

  const songList: string[] = playlist
    ? playlist.songs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)
    : [];

  const artistList: string[] = playlist
    ? playlist.artist
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)
    : [];

  const handleRoundTwo = () => {
    navigate("/", { state });
  };

  return (
    <div className="output-page">
      {/* Menu section */}
      <section className="section-menu">
        <h1 className="section-heading">MENU</h1>

        <div className="menu-body">
          <div className="recipes">
            {recipes.length === 0 ? (
              <p className="body-text">No recipes found.</p>
            ) : (
              recipes.map((recipe) => (
                <div key={recipe.name} className="recipe-entry">
                  <div className="recipe-entry__header">
                    <div className="recipe-link">
                      <a href={recipe.link} target="_blank" rel="noopener noreferrer">
                        <p className="recipe-entry__title">{recipe.name}</p>
                        <img alt="" className="link-icon" src={linkIcon} />
                      </a>
                    </div>
                    <span className="recipe-entry__dots" aria-hidden="true" />
                  </div>
                  <p className="recipe-entry__body">{recipe.description}</p>
                  <p className="recipe-entry__min">{recipe.minutes} min</p>
                  <p className="recipe-entry__meta">Ingredients: {recipe.ingredients.replace(/['\[\]]/g, '')}</p>
                </div>
              ))
            )}
          </div>

          <aside className="candles-aside" aria-hidden="true">
            <img
              alt="decorative candles illustration"
              className="candles-img"
              src={imgCandles}
            />
          </aside>
        </div>
      </section>

      <div className="tunes-col">
        <h2 className="section-heading">TUNES</h2>
        <div className="playlist">
          {playlist ? (
            <>
              <p className="playlist-title">{playlist.name}</p>
              {songList.length === 0 ? (
                <p className="body-text">No songs found.</p>
              ) : (
                songList.map((song, i) => (
                  <p key={i} className="playlist-row">
                    <span className="song-name">{song}</span>
                    <span className="recipe-entry__dots" aria-hidden="true" />
                    <span className="artist-name">{artistList[i] || ""}</span>
                  </p>
                ))
              )}
            </>
          ) : (
            <p className="body-text">No playlist found.</p>
          )}
        </div>
      </div>
      <div className="food-images">
        <button onClick={handleRoundTwo} className="round-two-btn">
          ← keep this party going
        </button>
        <img alt="" className="bread-img" src={imgBread} />
        <img alt="" className="cheese-img" src={imgCheese} />
      </div>
    </div>
  );
}
