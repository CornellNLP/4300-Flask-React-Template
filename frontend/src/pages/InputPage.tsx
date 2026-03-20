import { useState, useEffect, useRef } from "react";
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

const GUIDED_PLACEHOLDERS = ["summery italian wedding", "red and white", "rustic", "two hours", "pasta and tomatoes"];

function AutoInput({
  value,
  onChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  "aria-label"?: string;
}) {
  const sizerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sizerRef.current && inputRef.current) {
      sizerRef.current.textContent = value || placeholder;
      const w = sizerRef.current.offsetWidth;
      inputRef.current.style.width = `${w + 4}px`;
    }
  }, [value, placeholder]);

  return (
    <>
      <span
        ref={sizerRef}
        className={`prompt-input-sizer ${className ?? ""}`}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`prompt-input ${className ?? ""}`}
        aria-label={ariaLabel}
      />
    </>
  );
}

export function InputPage() {
  const navigate = useNavigate();

  const [dinnerPartyKeyWord, setDinnerPartyKeyWord] = useState("");
  const [themeKeyword, setThemeKeyword] = useState("");
  const [decorKeyword, setDecorKeyword] = useState("");
  const [length, setLength] = useState("");
  const [ingredients, setIngredients] = useState("");

  const [freeform, setFreeform] = useState("");

  const [mode, setMode] = useState<"madlibs" | "freeform">("madlibs");

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

  // Build the search query regardless of mode
  const query =
    mode === "freeform"
      ? freeform.trim()
      : [dinnerPartyKeyWord || GUIDED_PLACEHOLDERS[0], themeKeyword || GUIDED_PLACEHOLDERS[1], decorKeyword || GUIDED_PLACEHOLDERS[2], ingredients || GUIDED_PLACEHOLDERS[4]].filter(Boolean).join(" ");

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
      <div className="heading-row">
        <h1 className="input-heading">BRING THE PARTY</h1>
        {/* Mode toggle */}
        <div className="mode-toggle-group" role="group" aria-label="input mode">
          <button
            className="mode-toggle"
            onClick={() => setMode("freeform")}
            aria-label={`Switch to freeform input`}
          >
            <div
              style={
                mode === "freeform"
                  ? { color: " #d43c00", textDecorationLine: "underline" }
                  : { color: " #8d6350", textDecorationLine: "none" }
              }
            >
              freeform
            </div>
          </button>
          <span className="mode-toggle-separator"> | </span>
          <button
            className="mode-toggle"
            onClick={() => setMode("madlibs")}
            aria-label="Switch to guided input"
          >
            <div
              style={
                mode === "madlibs"
                  ? { color: " #d43c00", textDecorationLine: "underline" }
                  : { color: " #8d6350", textDecorationLine: "none" }
              }
            >
              guided
            </div>
          </button>
        </div>
      </div>

      {mode === "madlibs" ? (
        <p className="prompt-wrap">
          <span className="prompt-quote">&ldquo;</span>
          i&apos;m looking to host a{" "}
          <AutoInput
            value={dinnerPartyKeyWord}
            onChange={setDinnerPartyKeyWord}
            placeholder={GUIDED_PLACEHOLDERS[0]}
            aria-label="dinner party keyword"
          />{" "}
          dinner party. i want the party to follow a{" "}
          <AutoInput
            value={themeKeyword}
            onChange={setThemeKeyword}
            placeholder={GUIDED_PLACEHOLDERS[1]}
            aria-label="theme keyword"
          />{" "}
          theme and use{" "}
          <AutoInput
            value={decorKeyword}
            onChange={setDecorKeyword}
            placeholder={GUIDED_PLACEHOLDERS[2]}
            aria-label="decor keyword"
          />{" "}
          decor. i want my menu to take{" "}
          <AutoInput
            value={length}
            onChange={setLength}
            placeholder={GUIDED_PLACEHOLDERS[3]}
            aria-label="cook time"
          />{" "}
          to cook. i want to use{" "}
          <AutoInput
            value={ingredients}
            onChange={setIngredients}
            placeholder={GUIDED_PLACEHOLDERS[4]}
            aria-label="ingredients"
          />{" "}
          in my recipe.
          <span className="prompt-quote">&rdquo;</span>
        </p>
      ) : (
        <div className="freeform-wrap">
          <span className="prompt-quote freeform-quote-open">&ldquo;</span>
          <textarea
            className="freeform-input"
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            placeholder="i'm looking to host a summery italian wedding dinner party with a red and white theme, rustic decor, two hours of cooking, and pasta and tomatoes on the menu."
            rows={4}
            aria-label="describe your dinner party"
          />
          <span className="prompt-quote freeform-quote-close">&rdquo;</span>
        </div>
      )}

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
        <button
          onClick={handleGetHosting}
          className="get-hosting-btn"
          disabled={loading}
        >
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
