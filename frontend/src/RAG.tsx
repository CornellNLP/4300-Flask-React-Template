import { useState } from "react";

type SVDExplanation = { dimension: number; strength: number; mood_words: string[] };

type IRResult = {
  title: string;
  artist: string;
  similarity: number;
  cosine_score: number;
  svd_score: number;
  chords: string[];
  difficulty: number;
  svd_explanation: SVDExplanation[];
};

type RAGResponse = {
  original_query: string;
  ir_query: string;
  ir_results: IRResult[];
  llm_answer: string;
};

type RAGProps = {
  instrument: string;
  difficulty: string;
  numResults: number;
};

export default function RAG({ instrument, difficulty, numResults }: RAGProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RAGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, instrument, difficulty, top_n: numResults }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rag-container">
      <h2>🎵 Ask AI for a Recommendation</h2>
      <p className="rag-subtitle">
        Using: <strong>{instrument}</strong> · <strong>{difficulty}</strong> difficulty · top <strong>{numResults}</strong>
      </p>

      <div className="rag-input-row">
        <input
          className="rag-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. 'something sad and slow for a rainy day'"
        />
        <button className="button" onClick={handleSearch} disabled={loading}>
          {loading ? "Thinking..." : "Ask AI"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div className="rag-results">
          <div className="rag-ir-query">
            <strong>Rewritten IR query:</strong> <em>"{result.ir_query}"</em>
          </div>

          <div className="rag-columns">
            {/* LEFT: raw IR results */}
            <div className="rag-ir-panel">
              <h3>📋 IR Results </h3>
              {result.ir_results.map((song, i) => (
                <div key={i} className="song-item">
                  <h3 className="song-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{i + 1}. {song.title}</span>
                    <span>Similarity: {song.similarity}%</span>
                  </h3>
                  <h4 className="song-artist">by {song.artist}</h4>
                  <p className="song-chords">Chords: {song.chords}</p>
                  <p className="song-difficulty">Difficulty: {song.difficulty}/10</p>
                  <p className="song-scores" style={{ display: 'flex', gap: '1rem', fontSize: '0.85em', color: '#888' }}>
                    <span>Cosine: {song.cosine_score}%</span>
                    <span>SVD: {song.svd_score}%</span>
                  </p>
                  {song.svd_explanation?.length > 0 && (
                    <div className="svd-explanation" style={{ marginTop: '0.5rem', fontSize: '0.82em', color: '#333', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                      <strong>SVD Mood Analysis</strong>
                      {song.svd_explanation.map((dim, j) => (
                        <div key={j} style={{ marginTop: '0.25rem' }}>
                          <span style={{ color: dim.strength >= 0 ? '#2d7a2d' : '#a83232' }}>
                            <strong>Dimension {dim.dimension}</strong> (strength: {dim.strength})
                          </span><br />
                          <span style={{ color: '#ccc' }}>Mood words: {dim.mood_words.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* RIGHT: LLM answer grounded in those results */}
            <div className="rag-llm-panel">
              <h3>🤖 AI Recommendation</h3>
              <div className="rag-answer">{result.llm_answer}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}