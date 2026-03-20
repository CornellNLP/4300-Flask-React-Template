import { useNavigate, useLocation } from "react-router";
import imgCandles from "../assets/table3.png";
import imgBread from "../assets/bread.png";
import imgCheese from "../assets/cheese.png";
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
    navigate("/");
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
                    <p className="recipe-entry__title">
                      <a href={recipe.link} target="_blank" rel="noopener noreferrer" className="underline">
                        {recipe.name}
                      </a>
                    </p>
                    <span className="recipe-entry__dots" aria-hidden="true" />
                  </div>
                  <p className="recipe-entry__body">{recipe.description}</p>
                  <p className="recipe-entry__meta">{recipe.minutes} min</p>
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

      {/* decor and music section */}
      <section className="section-bottom">
        <div className="left-col">
          <div className="decor-col">
            <h2 className="section-heading">DECOR</h2>
          </div>
          <div className="food-images">
            <button onClick={handleRoundTwo} className="round-two-btn">
              ← round two
            </button>
            <img alt="" className="bread-img" src={imgBread} />
            <img alt="" className="cheese-img" src={imgCheese} />
          </div>
        </div>

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
      </section>
    </div>
  );
}
