import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import imgFood from "../assets/tomato.png";
import { Recipe, Playlist, PlaylistRecommendations } from "../types";
import "./InputPage.css";

const DIETARY_FILTERS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
];

const COURSE_FILTERS = ["appetizer", "entrée", "dessert", "beverage"];

const PLACEHOLDERS = ["summery italian wedding", "red and white", "rustic", "two hours", "pasta and tomatoes"];

interface InputState {
  dinnerPartyKeyword: string;
  themeKeyWord: string;
  decorKeyword: string;
  length: string;
  ingredients: string;
  freeform: string;
  mode: "madlibs" | "freeform";
  dietary: string[];
  courses: string[];
}

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
  const location = useLocation();
  const savedState = (location.state ?? {}) as Partial<InputState>;

  const [dinnerPartyKeyword, setDinnerPartyKeyword] = useState<string>(
    () => savedState.dinnerPartyKeyword ?? "",
  );
  const [themeKeyWord, setThemeKeyWord] = useState<string>(
    () => savedState.themeKeyWord ?? "",
  );
  const [decorKeyword, setDecorKeyword] = useState<string>(
    () => savedState.decorKeyword ?? "",
  );
  const [length, setLength] = useState<string>(() => savedState.length ?? "");
  const [ingredients, setIngredients] = useState<string>(
    () => savedState.ingredients ?? "",
  );

  const [freeform, setFreeform] = useState<string>(
    () => savedState.freeform ?? "",
  );

  const [mode, setMode] = useState<"madlibs" | "freeform">(
    () => savedState.mode ?? "madlibs",
  );

  const [dietary, setDietary] = useState<string[]>(
    () => savedState.dietary ?? [],
  );
  const [courses, setCourses] = useState<string[]>(
    () => savedState.courses ?? [],
  );
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);

  // Build the search query regardless of mode
  const query =
    mode === "freeform"
      ? freeform.trim()
      : [
        dinnerPartyKeyword || PLACEHOLDERS[0],
        themeKeyWord || PLACEHOLDERS[1],
        decorKeyword || PLACEHOLDERS[2],
        ingredients || PLACEHOLDERS[4],
      ].filter(Boolean).join(" ");

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

  const buildRecipeUrl = (name: string, useSvd = true) => {
    const params = new URLSearchParams({
      name,
    });

    if (dietary.length > 0) {
      params.set("dietary", dietary.join(","));
    }

    if (courses.length > 0) {
      params.set("courses", courses.join(","));
    }

    const endpoint = useSvd ? "/api/recipes/svd" : "/api/recipes";

    return `${endpoint}?${params.toString()}`;
  };

  const handleGetHosting = async () => {
    const q = query || "food";
    setLoading(true);
    const inputState: InputState = {
      dinnerPartyKeyword,
      themeKeyWord,
      decorKeyword,
      length,
      ingredients,
      freeform,
      mode,
      dietary,
      courses,
    };

    try {
      const [recipesRes, playlistRes] = await Promise.all([
        fetch(buildRecipeUrl(q)),
        fetch(`/api/playlists?name=${encodeURIComponent(q)}`),
      ]);
      const fetchedRecipes: Recipe[] = await recipesRes.json();
      const playlistData = await playlistRes.json();
      
      // Handle array and object (LLM) responses
      let playlist: Playlist | PlaylistRecommendations | null = null;
      if (Array.isArray(playlistData)) {
        playlist = playlistData[0] ?? null;
      } else if (playlistData && typeof playlistData === "object") {
        playlist = playlistData;
      }
      
      navigate("/loading", {
        state: {
          ...inputState,
          recipes: fetchedRecipes,
          playlist,
        },
      });
    } catch (err) {
      console.error("Failed to fetch party data:", err);
      navigate("/loading", { state: { ...inputState, recipes: [], playlist: null } });
    } finally {
      setLoading(false);
    }
  };

  const clearSavedInput = () => {
    setDietary([]);
    setCourses([]);

    if (mode === "freeform") {
      setFreeform("");
      return;
    }

    setDinnerPartyKeyword("");
    setThemeKeyWord("");
    setDecorKeyword("");
    setLength("");
    setIngredients("");
  };

  return (
    <div className="input-page">
      <div className="heading-row">
        <h1 className="input-heading">BRING THE PARTY</h1>
        {/* Mode toggle */}
        <div className="mode-toggle-container">
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
          <button
            onClick={clearSavedInput}
            className="clear-input-btn"
            type="button"
          >
            reset filters and {mode === "madlibs" ? "guided" : "freeform"} input
          </button>
        </div>
      </div>

      {mode === "madlibs" ? (
        <p className="prompt-wrap">
          <span className="prompt-quote">&ldquo;</span>
          i&apos;m looking to host a{" "}
          <AutoInput
            value={dinnerPartyKeyword}
            onChange={setDinnerPartyKeyword}
            placeholder={PLACEHOLDERS[0]}
            aria-label="dinner party keyword(s)"
          />{" "}
          dinner party. i want the party to follow a{" "}
          <AutoInput
            value={themeKeyWord}
            onChange={setThemeKeyWord}
            placeholder={PLACEHOLDERS[1]}
            aria-label="theme keyword"
          />{" "}
          theme and use{" "}
          <AutoInput
            value={decorKeyword}
            onChange={setDecorKeyword}
            placeholder={PLACEHOLDERS[2]}
            aria-label="decor keyword"
          />{" "}
          decor. i want my menu to take{" "}
          <AutoInput
            value={length}
            onChange={setLength}
            placeholder={PLACEHOLDERS[3]}
            aria-label="cook time"
          />{" "}
          to cook. i want to use{" "}
          <AutoInput
            value={ingredients}
            onChange={setIngredients}
            placeholder={PLACEHOLDERS[4]}
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
        <div className="bottom-row__actions">
          <button
            onClick={handleGetHosting}
            className="get-hosting-btn"
            disabled={loading}
          >
            {loading ? "loading..." : "get hosting →"}
          </button>
        </div>
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
    </div>
  );
}
