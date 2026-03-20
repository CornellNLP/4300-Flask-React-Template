import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import imgFood from "../assets/tomato.png";
import Chat from "../Chat";
import { Recipe, Playlist } from "../types";
import "./InputPage.css";

const DIETARY_FILTERS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
];

const COURSE_FILTERS = ["appetizer", "entrée", "dessert", "beverage"];

export function InputPage() {
  const navigate = useNavigate();
  const [themeWords, setThemeWords] = useState("");
  const [keyword1, setKeyword1] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [length, setLength] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [dietary, setDietary] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [useLlm, setUseLlm] = useState<boolean | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setUseLlm(data.use_llm))
      .catch(() => setUseLlm(false));
  }, []);

  const query = [themeWords, keyword1, keyword2, ingredients].filter(Boolean).join(" ");

  const toggleFilter = (
    value: string,
    current: string[],
    set: (v: string[]) => void,
  ) => {
    set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  };

  const handleSearch = async (value: string): Promise<void> => {
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

  const handleGetHosting = async () => {
    const q = query || "food";
    setLoading(true);
    try {
      const [recipesRes, playlistRes] = await Promise.all([
        fetch(`/api/recipes?name=${encodeURIComponent(q)}`),
        fetch(`/api/playlists?name=${encodeURIComponent(q)}`),
      ]);
      const fetchedRecipes: Recipe[] = await recipesRes.json();
      const fetchedPlaylists: Playlist[] = await playlistRes.json();
      navigate("/loading", {
        state: {
          recipes: fetchedRecipes,
          playlist: fetchedPlaylists[0] ?? null,
        },
      });
    } catch (err) {
      console.error("Failed to fetch party data:", err);
      navigate("/loading", { state: { recipes: [], playlist: null } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="input-page">
      <h1 className="input-heading">BRING THE PARTY</h1>

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
        />{" "}
        dinner party. i want the party to follow a{" "}
        <input
          type="text"
          value={keyword1}
          onChange={(e) => setKeyword1(e.target.value)}
          placeholder="keyword"
          className="prompt-input prompt-input--md"
          aria-label="first keyword"
        />{" "}
        theme and use{" "}
        <input
          type="text"
          value={keyword2}
          onChange={(e) => setKeyword2(e.target.value)}
          placeholder="keyword"
          className="prompt-input prompt-input--md"
          aria-label="second keyword"
        />{" "}
        decor. i want my menu to take{" "}
        <input
          type="text"
          value={length}
          onChange={(e) => setLength(e.target.value)}
          placeholder="length"
          className="prompt-input prompt-input--sm"
          aria-label="cook time"
        />{" "}
        amount of time to cook. i want to use{" "}
        <input
          type="text"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="ingredients"
          className="prompt-input prompt-input--md"
          aria-label="ingredients"
        />{" "}
        in my recipe.
        <span className="prompt-quote">"</span>
      </p>

      {/* ── Filters ── */}
      <div className="filter-section">
        <div
          className="filter-group"
          role="group"
          aria-label="dietary restrictions"
        >
          {DIETARY_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-chip${dietary.includes(f) ? " active" : ""}`}
              onClick={() => toggleFilter(f, dietary, setDietary)}
              aria-pressed={dietary.includes(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="filter-group" role="group" aria-label="course type">
          {COURSE_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-chip${courses.includes(f) ? " active" : ""}`}
              onClick={() => toggleFilter(f, courses, setCourses)}
              aria-pressed={courses.includes(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bottom-row">
        <button onClick={handleGetHosting} className="get-hosting-btn" disabled={loading}>
          {loading ? "loading..." : "get hosting →"}
        </button>
        <div className="food-decor" aria-hidden="true">
          <img src={imgFood} alt="" />
        </div>
      </div>

      {recipes.length > 0 && (
        <div className="recipe-results">
          {recipes.map((recipe, index) => (
            <div key={index} className="recipe-card">
              <p className="recipe-card__name">{recipe.name}</p>
              <p className="recipe-card__desc">{recipe.description}</p>
              <p className="recipe-card__meta">
                Minutes: {String(recipe.minutes)}
              </p>
            </div>
          ))}
        </div>
      )}

      {useLlm && (
        <div className="chat-dock">
          <Chat onSearchTerm={handleSearch} />
        </div>
      )}
    </div>
  );
}
