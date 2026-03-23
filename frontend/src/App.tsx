import { useEffect, useState } from "react";
import "./App.css";
import Chat from "./Chat";
import Logo from "./components/Logo";
import SearchBar from "./components/SearchBar";
import PlayerGrid from "./components/PlayerGrid";
import { PlayerCardData, PlayerStats } from "./types";
// for stef to run deployed backend locally
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
interface SearchResponse {
  results: PlayerStats[];
}
type SearchStatus = "idle" | "loading" | "populated" | "empty" | "error";
function toCardData(results: PlayerStats[]): PlayerCardData[] {
  return results.map((player, index) => ({
    key: `${player.name}-${player.team ?? "unknown"}-${player.league ?? "unknown"}`,
    rank: index + 1,
    name: player.name,
    team: player.team,
    position: player.position,
    nationality: player.nationality,
    goals: player.goals, // will be populated later
    appearances: player.appearances, // will be populated later
    image: player.image,
  }));
}
function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [players, setPlayers] = useState<PlayerCardData[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  useEffect(() => {
    const loadConfig = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_BASE}/api/config`);
        if (!response.ok) return;
        const data: { use_llm?: boolean } = await response.json();
        setUseLlm(Boolean(data.use_llm));
      } catch {
        // if config fails, keep useLlm = false and continue rendering UI
      }
    };
    void loadConfig();
  }, []);
  const runSearch = async (term: string): Promise<void> => {
    const trimmed = term.trim();
    if (trimmed === "") {
      setPlayers([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        setPlayers([]);
        setStatus("error");
        return;
      }
      const data: SearchResponse = await response.json();
      const nextPlayers = toCardData(Array.isArray(data.results) ? data.results : []);
      setPlayers(nextPlayers);
      setStatus(nextPlayers.length > 0 ? "populated" : "empty");
    } catch {
      setPlayers([]);
      setStatus("error");
    }
  };
  const handleChatSearch = (term: string): void => {
    setSearchTerm(term);
    void runSearch(term);
  };
  return (
    <div className={`full-body-container ${useLlm ? "llm-mode" : ""}`}>
      <div className="top-text">
        <Logo />
        <SearchBar
          value={searchTerm}
          onChange={(nextValue) => {
            setSearchTerm(nextValue);
            if (status !== "idle") setStatus("idle");
          }}
          onSubmit={() => void runSearch(searchTerm)}
          placeholder="look up the best Brazilian wingers..."
        />
      </div>
      {status === "loading" && <p className="search-feedback">Searching...</p>}
      {status === "empty" && <p className="search-feedback">No results found.</p>}
      {status === "error" && (
        <p className="search-feedback">Could not load results. Please try again.</p>
      )}
      <PlayerGrid players={players} />
      {useLlm && <Chat onSearchTerm={handleChatSearch} />}
    </div>
  );
}
export default App;