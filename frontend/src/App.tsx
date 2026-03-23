import { useState, useEffect } from "react";
import "./App.css";
import SearchIcon from "./assets/mag.png";
import Chat from "./Chat";

interface ArticleNode {
  id: number;
  title: string;
  score: number;
}

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null);
  const [article, setArticle] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [pathway, setPathway] = useState<ArticleNode[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. ADD THIS: Track if the user has actually pressed the search button
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setUseLlm(data.use_llm));
  }, []);

  const handleSearch = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault();
    if (article.trim() === "" && keywords.trim() === "") return;

    setLoading(true);
    setHasSearched(false); // Reset while searching

    try {
      const response = await fetch(
        `/api/rabbithole?article=${encodeURIComponent(article)}&keywords=${encodeURIComponent(keywords)}`,
      );
      const data: ArticleNode[] = await response.json();
      for (const node of data) {
        console.log(node.id);
      }
      setPathway(data);
    } catch (error) {
      console.error("Failed to fetch rabbit hole:", error);
    } finally {
      setLoading(false);
      setHasSearched(true); // 2. ADD THIS: Mark search as completed
    }
  };

  if (useLlm === null) return <></>;

  return (
    <div className={`full-body-container ${useLlm ? "llm-mode" : ""}`}>
      {/* Header and Input area */}
      <div
        className="top-text"
        style={{
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          🕳️ Rabbit Hole
        </h1>
        <p style={{ marginBottom: "1.5rem", color: "#555" }}>
          Enter a starting topic to discover a nuanced pathway of Wikipedia
          articles.
        </p>

        <form
          onSubmit={handleSearch}
          style={{
            width: "100%",
            maxWidth: "600px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            className="input-box"
            onClick={() => document.getElementById("article-input")?.focus()}
          >
            <img src={SearchIcon} alt="search" />
            <input
              id="article-input"
              placeholder="Starting Article (e.g., Emily in Paris)"
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              required
            />
          </div>

          <div
            className="input-box"
            onClick={() => document.getElementById("keyword-input")?.focus()}
          >
            <input
              id="keyword-input"
              placeholder="Optional keywords (e.g., drama, culture)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              style={{ paddingLeft: "20px" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              background: "#4285F4",
              color: "white",
              border: "none",
              borderRadius: "24px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {loading ? "Digging..." : "Explore Pathway"}
          </button>
        </form>
      </div>

      {/* Discovery Pathway Results */}
      <div
        id="answer-box"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}
      >
        {/* 3. ADD THIS: Empty State Handler */}
        {hasSearched && pathway.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              No articles found
            </h3>
            <p>
              We couldn't dig a rabbit hole for that query. Try using different
              keywords or checking your spelling!
            </p>
          </div>
        )}

        {/* Normal Results Mapping */}
        {pathway.length > 0 &&
          pathway.map((node, index) => (
            <div
              key={node.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              <div
                className="episode-item"
                style={{
                  width: "100%",
                  maxWidth: "500px",
                  textAlign: "center",
                  border: "2px solid #e0e0e0",
                  padding: "1rem",
                  borderRadius: "8px",
                  background: "white",
                }}
              >
                <h3
                  className="episode-title"
                  style={{ margin: "0 0 0.5rem 0" }}
                >
                  {node.title}
                </h3>
                <a
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(node.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#4285F4",
                    textDecoration: "none",
                    display: "inline-block",
                    fontWeight: "bold",
                  }}
                >
                  Read on Wikipedia ↗
                </a>
              </div>

              {/* Down arrow connector between articles */}
              {index < pathway.length - 1 && (
                <div
                  style={{ fontSize: "24px", color: "#aaa", padding: "10px 0" }}
                >
                  ↓
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Chat (only when USE_LLM = True in backend config) */}
      {useLlm && (
        <Chat
          onSearchTerm={(val) => {
            setArticle(val);
            handleSearch();
          }}
        />
      )}
    </div>
  );
}

export default App;
