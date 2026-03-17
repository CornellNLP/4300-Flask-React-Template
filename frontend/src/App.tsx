import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { PlayerStats } from './types'
import Chat from './Chat'

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('')

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  // Debounce keystrokes so we don't hit the backend on every character.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 350)
    return () => window.clearTimeout(id)
  }, [searchTerm])

  // Fetch when the debounced value changes. Abort in-flight requests on new input.
  useEffect(() => {
    const term = debouncedSearchTerm.trim()
    if (term === '') {
      setPlayers([])
      return
    }

    const controller = new AbortController()
    ;(async () => {
      const response = await fetch(`/api/player?name=${encodeURIComponent(term)}`, { signal: controller.signal })
      const data: PlayerStats[] = await response.json()
      setPlayers(data)
    })().catch((err: unknown) => {
      // Ignore aborts; rethrowing would be noisy in the console.
      if (err instanceof DOMException && err.name === 'AbortError') return
    })

    return () => controller.abort()
  }, [debouncedSearchTerm])

  const handleSearch = (value: string): void => {
    setSearchTerm(value)
  }

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      {/* Search bar (always shown) */}
      <div className="top-text">
        <div className="google-colors">
          <h1 id="google-4">F</h1>
          <h1 id="google-3">O</h1>
          <h1 id="google-0-1">O</h1>
          <h1 id="google-0-2">T</h1>
          <h1 id="google-4">Y</h1>
          <h1 id="google-3">S</h1>
          <h1 id="google-0-1">E</h1>
          <h1 id="google-0-2">A</h1>
          <h1 id="google-4">R</h1>
          <h1 id="google-3">C</h1>
          <h1 id="google-0-1">H</h1>
          <h1 id="google-0-2">!</h1>
        </div>
        <div className="input-box" onClick={() => document.getElementById('search-input')?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder="Search for a famous soccer player"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Player stats results (always shown) */}
      <div id="answer-box">
        {players.length === 0 && searchTerm.trim() !== '' && (
          <p className="no-results">No players found. Try another name.</p>
        )}
        {players.map((player, index) => (
          <div key={index} className="episode-item">
            <div className="player-header">
              <div style={{ width: 110, height: 140, overflow: 'hidden', flexShrink: 0 }}>
                <img
                  src={player.image || "https://resources.premierleague.com/premierleague25/photos/players/110x140/placeholder.png"}
                  alt={player.name}
                  style={{ width: '110px', height: '140px', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://resources.premierleague.com/premierleague25/photos/players/110x140/placeholder.png";
                  }}
                />
              </div>
              <h3 className="episode-title">
                {player.name} <span className="league-tag">({player.league})</span>
              </h3>
            </div>
            <p className="episode-desc">
              {player.position || 'Unknown position'} &mdash; {player.team || 'Unknown team'}
            </p>
            <p className="episode-rating">
              Games: {player.games ?? 'N/A'} | Minutes: {player.minutes ?? 'N/A'} | Goals: {player.goals ?? 'N/A'} | Assists: {player.assists ?? 'N/A'}
            </p>
            <p className="episode-rating">
              Shots: {player.shots ?? 'N/A'} | On target: {player.shots_on_target ?? 'N/A'} | Touches in box: {player.touches_in_box ?? 'N/A'}
            </p>
          </div>
        ))}
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && <Chat onSearchTerm={handleSearch} />}
    </div>
  )
}

export default App
