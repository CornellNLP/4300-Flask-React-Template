import { useEffect, useState } from "react";
import "./App.css";
import Chat from "./Chat";
import Logo from "./components/Logo";
import SearchBar from "./components/SearchBar";
import PlayerGrid from "./components/PlayerGrid";
import { PlayerCardData, PlayerStats } from "./types";

const EXAMPLE_QUERIES = [
  "best brazilian wingers",
  "top scorers in La Liga",
  "fastest defenders in the Premier League",
  "creative midfielders from Argentina",
  "young strikers under 23",
  "best free kick takers",
  "most assists in Serie A",
  "tall center backs over 6ft",
  "clinical finishers in Bundesliga",
  "box-to-box midfielders",
  "best Spanish goalkeepers",
  "prolific wingers from Africa",
];

function QueryCarousel({ onSelect }: { onSelect: (q: string) => void }): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const speed = 0.25; // px per frame

    const step = () => {
      if (!pausedRef.current) {
        posRef.current += speed;
        const halfWidth = track.scrollWidth / 2;
        if (posRef.current >= halfWidth) posRef.current -= halfWidth;
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const chips = [...EXAMPLE_QUERIES, ...EXAMPLE_QUERIES];

  return (
    <div
      className="query-carousel-wrapper"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="query-carousel-track" ref={trackRef}>
        {chips.map((q, i) => (
          <button
            key={i}
            className="query-chip"
            onClick={() => onSelect(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
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
        <QueryCarousel onSelect={(q) => {
          setSearchTerm(q);
          void runSearch(q);
        }} />
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