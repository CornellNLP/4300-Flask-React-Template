// import { FormEvent, useEffect, useState } from 'react'
// import './App.css'
// import SearchIcon from './assets/mag.png'
// import { PlayerStats } from './types'
// import Chat from './Chat'

// interface SearchResponse {
//   results: PlayerStats[]
// }

// function App(): JSX.Element {
//   const [useLlm, setUseLlm] = useState<boolean | null>(null)
//   const [searchTerm, setSearchTerm] = useState<string>('')
//   const [players, setPlayers] = useState<PlayerStats[]>([])
//   const [hasSearched, setHasSearched] = useState<boolean>(false)

//   useEffect(() => {
//     fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
//   }, [])

//   const runSearch = async (term: string): Promise<void> => {
//     const trimmed = term.trim()
//     if (trimmed === '') {
//       setPlayers([])
//       setHasSearched(false)
//       return
//     }

//     const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
//     const data: SearchResponse = await response.json()
//     setPlayers(data.results ?? [])
//     setHasSearched(true)
//   }

//   const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
//     event.preventDefault()
//     void runSearch(searchTerm)
//   }

//   const handleChatSearch = (term: string): void => {
//     setSearchTerm(term)
//     void runSearch(term)
//   }

//   if (useLlm === null) return <></>

//   return (
//     <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
//       <div className="top-text">
//         <div className="google-colors">
//           <h1 id="google-4">F</h1>
//           <h1 id="google-3">O</h1>
//           <h1 id="google-0-1">O</h1>
//           <h1 id="google-0-2">T</h1>
//           <h1 id="google-4">Y</h1>
//           <h1 id="google-3">S</h1>
//           <h1 id="google-0-1">E</h1>
//           <h1 id="google-0-2">A</h1>
//           <h1 id="google-4">R</h1>
//           <h1 id="google-3">C</h1>
//           <h1 id="google-0-1">H</h1>
//           <h1 id="google-0-2">!</h1>
//         </div>
//         <form
//           className="input-box"
//           onSubmit={handleSubmit}
//           onClick={() => document.getElementById('search-input')?.focus()}
//         >
//           <img src={SearchIcon} alt="search" />
//           <input
//             id="search-input"
//             placeholder="Search for a soccer player or query like 'best striker from Spain'"
//             value={searchTerm}
//             onChange={(e) => {
//               setSearchTerm(e.target.value)
//               setHasSearched(false)
//             }}
//           />
//         </form>
//       </div>

//       <div id="answer-box">
//         {players.length === 0 && hasSearched && (
//           <p className="no-results">No results found.</p>
//         )}
//         {players.map((player, index) => (
//           <div key={index} className="episode-item">
//             <div className="player-header">
//               <div className="player-image-frame">
//                 <img
//                   className="player-image"
//                   src={player.image || 'https://resources.premierleague.com/premierleague25/photos/players/110x140/placeholder.png'}
//                   alt={player.name}
//                   width={110}
//                   height={140}
//                   onError={(e) => {
//                     (e.target as HTMLImageElement).src = 'https://resources.premierleague.com/premierleague25/photos/players/110x140/placeholder.png'
//                   }}
//                 />
//               </div>
//               <h3 className="episode-title">
//                 {player.name} <span className="league-tag">({player.league})</span>
//               </h3>
//             </div>
//             <p className="episode-desc">
//               {player.position || 'Unknown position'} - {player.nationality || 'Unknown nationality'}
//             </p>
//             <p className="episode-rating">
//               Goals: {player.goals ?? 'N/A'} | Assists: {player.assists ?? 'N/A'}
//             </p>
//             <p className="episode-rating">
//               Appearances: {player.appearances ?? 'N/A'}
//             </p>
//             {player.similarity_score !== undefined && player.similarity_score !== null && (
//               <p className="episode-rating">
//                 Similarity: {(player.similarity_score * 100).toFixed(1)}%
//               </p>
//             )}
//           </div>
//         ))}
//       </div>

//       {useLlm && <Chat onSearchTerm={handleChatSearch} />}
//     </div>
//   )
// }

// export default App

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