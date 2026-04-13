import { useNavigate, useLocation } from "react-router";
import imgCandles from "../assets/table3.png";
import imgWine from "../assets/table6.png";
import imgLongTable from "../assets/table4.png";
import imgBread from "../assets/bread.png";
import imgCheese from "../assets/cheese.png";
import linkIcon from "../assets/link.svg";
import { DimInfo, SVDRecipe, Playlist } from "../types";
import "./OutputPage.css";
import { useState } from "react";

interface OutputState {
  recipes: SVDRecipe[];
  playlist: Playlist | null;
}

// Mini sparkline: renders a bar chart of the first N latent dimensions
function DimSparkline({
  docMags,
  queryMags,
  sharedDims,
}: {
  docMags: number[];
  queryMags: number[];
  sharedDims: DimInfo[];
}) {
  const N = Math.min(docMags.length, queryMags.length, 40);
  const sharedSet = new Set(sharedDims.map((d) => d.dim));

  const maxAbs = Math.max(
    ...docMags.slice(0, N).map(Math.abs),
    ...queryMags.slice(0, N).map(Math.abs),
    0.001
  );

  return (
    <div className="sparkline-wrap" aria-hidden="true">
      <div className="sparkline-row">
        {Array.from({ length: N }).map((_, i) => {
          const val = docMags[i] ?? 0;
          const height = Math.abs(val) / maxAbs;
          const isShared = sharedSet.has(i);
          return (
            <div
              key={i}
              className={`sparkline-bar ${isShared ? "shared" : ""}`}
              style={{ height: `${Math.max(height * 28, 2)}px` }}
            />
          );
        })}
      </div>
      <div className="sparkline-row query-row">
        {Array.from({ length: N }).map((_, i) => {
          const val = queryMags[i] ?? 0;
          const height = Math.abs(val) / maxAbs;
          const isShared = sharedSet.has(i);
          return (
            <div
              key={i}
              className={`sparkline-bar query-bar ${isShared ? "shared" : ""}`}
              style={{ height: `${Math.max(height * 28, 2)}px` }}
            />
          );
        })}
      </div>
      <div className="sparkline-legend">
        <span className="legend-dot doc-dot" /> this recipe
        <span className="legend-dot query-dot" /> your input
        <span className="legend-dot shared-dot" /> overlap
      </div>
    </div>
  );
}

// Expandable SVD explainability panel for one recipe
function SVDPanel({ recipe }: { recipe: SVDRecipe }) {
  const [open, setOpen] = useState(false);
  const hasSVD = recipe.similarity !== undefined && recipe.doc_magnitudes?.length > 0;

  if (!hasSVD) return null;

  const pct = Math.round(recipe.similarity * 100);

  const maxMag = Math.max(...recipe.doc_dims.map(d => Math.abs(d.magnitude)));

  return (
    <div className="svd-panel">
      <button
        className="svd-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="svd-score">
          <span className="svd-score-bar-wrap">
            <span
              className="svd-score-bar"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="svd-score-label">{pct}% match</span>
        </span>
        <span className="svd-toggle-label">why this recipe?</span>
        <span className="svd-toggle-arrow">{open ? "▲" : "▼"}</span>

      </button>

      {open && (
        <div className="svd-detail">
          {/* Highlighted query keywords */}
          {recipe.highlighted_keywords.length > 0 && (
            <div className="svd-section">
              <p className="svd-section-label">keywords matched</p>
              <div className="svd-chips">
                {recipe.highlighted_keywords.map((kw) => (
                  <span key={kw} className="svd-chip keyword-chip">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Shared latent dimensions */}
          {recipe.shared_dims.length > 0 && (
            <div className="svd-section">
              <p className="svd-section-label">Both your input and this recipe are strong in these dimensions</p>
              {recipe.shared_dims.map((dim) => (
                <div key={dim.dim} className="svd-dim-row">
                  <span className="svd-dim-label">dimension {dim.dim}</span>
                  <div className="svd-dim-bar-wrap">
                    <div
                      className="svd-dim-bar"
                      style={{ width: `${(Math.abs(dim.magnitude) / maxMag) * 100}%` }}
                    />
                  </div>
                  <div className="svd-dim-keywords">
                    {dim.keywords.map((kw) => (
                      <span key={kw} className="svd-chip">{kw}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sparkline chart */}
          <div className="svd-section">
            <p className="svd-section-label">Alignment with all {recipe.doc_magnitudes.length}  dimensions</p>
            <DimSparkline
              docMags={recipe.doc_magnitudes}
              queryMags={recipe.query_magnitudes}
              sharedDims={recipe.shared_dims}
            />
          </div>

          {/* Top recipe-side dimensions */}
          <div className="svd-section">
            <p className="svd-section-label">this recipe's strongest concepts</p>
            {recipe.doc_dims.map((dim) => (
              <div key={dim.dim} className="svd-dim-row">
                <span className="svd-dim-label">dimension {dim.dim}</span>
                <div className="svd-dim-keywords">
                  {dim.keywords.map((kw) => (
                    <span key={kw} className="svd-chip">{kw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OutputPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as Partial<OutputState>;

  const recipes: SVDRecipe[] = state.recipes ?? [];
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
                  <SVDPanel recipe={recipe} />
                </div>
              ))
            )}
          </div>

          <aside className="candles-aside" aria-hidden="true">

            <img
              alt="decorative table illustration with wine glasses"
              className="wine-img"
              src={imgWine}
            />
            <img
              alt="decorative candles illustration"
              className="candles-img"
              src={imgCandles}
            />
            <img
              alt="decorative illustration of a long table seen from above"
              className="long-table-img"
              src={imgLongTable}
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
