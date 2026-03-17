import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import imgFood from "../assets/tomato.png";
import Chat from "../Chat";
import { Recipe } from "../types";
import "./InputPage.css";

export function InputPage() {
  const navigate = useNavigate();
  const [themeWords, setThemeWords] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [length, setLength] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [useLlm, setUseLlm] = useState<boolean | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setUseLlm(data.use_llm))
      .catch(() => setUseLlm(false));
  }, []);

  const handleSearch = async (value: string): Promise<void> => {
    if (value.trim() === "") {
      setRecipes([]);
      return;
    }
    const response = await fetch(`/api/recipes?name=${encodeURIComponent(value)}`);
    const data: Recipe[] = await response.json();
    setRecipes(data);
  };

  const handleGetHosting = () => {
    navigate("/loading");
  };

  return (
    <div className="input-page">
      <h1 className="input-heading">BRING THE PARTY</h1>

      {/* ── Mad-lib prompt ── */}
      <p className="prompt-wrap">
        <span className="prompt-quote">"</span>
        i'm looking to host a{" "}
        <input
          type="text"
          value={themeWords}
          onChange={(e) => setThemeWords(e.target.value)}
          placeholder="theme words"
          className="prompt-input prompt-input--lg"
          aria-label="theme words"
        />
        {" "}dinner party. i want the party to follow a{" "}
        <input
          type="text"
          value={keyword1}
          onChange={(e) => setKeyword1(e.target.value)}
          placeholder="keyword"
          className="prompt-input prompt-input--md"
          aria-label="first keyword"
        />
        {" "}theme and use{" "}
        <input
          type="text"
          value={keyword2}
          onChange={(e) => setKeyword2(e.target.value)}
          placeholder="keyword"
          className="prompt-input prompt-input--md"
          aria-label="second keyword"
        />
        {" "}decor. i want my menu to take{" "}
        <input
          type="text"
          value={length}
          onChange={(e) => setLength(e.target.value)}
          placeholder="length"
          className="prompt-input prompt-input--sm"
          aria-label="cook time"
        />
        {" "}amount of time to cook. i want to use{" "}
        <input
          type="text"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="ingredients"
          className="prompt-input prompt-input--md"
          aria-label="ingredients"
        />
        {" "}in my recipe.
        <span className="prompt-quote">"</span>
      </p>

      {/* ── Filter chips ── */}
      <div className="filter-row" role="group" aria-label="filters">
        <button className="filter-chip">FILTER ONE</button>
        <button className="filter-chip">FILTER TWO</button>
        <button className="filter-chip">FILTER THREE</button>
      </div>

      {/* ── Decorative image (positioned relative to page, hidden on mobile) ── */}
      <div className="food-decor" aria-hidden="true">
        <img src={imgFood} alt="" />
      </div>

      {/* ── CTA ── */}
      <div className="cta-row">
        <button onClick={handleGetHosting} className="get-hosting-btn">
          get hosting →
        </button>
      </div>

      {/* ── Recipe results ── */}
      {recipes.length > 0 && (
        <div className="recipe-results">
          {recipes.map((recipe, index) => (
            <div key={index} className="recipe-card">
              <p className="recipe-card__name">{recipe.name}</p>
              <p className="recipe-card__desc">{recipe.description}</p>
              <p className="recipe-card__meta">Minutes: {String(recipe.minutes)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Chat dock ── */}
      {useLlm && (
        <div className="chat-dock">
          <Chat onSearchTerm={handleSearch} />
        </div>
      )}
    </div>
  );
}