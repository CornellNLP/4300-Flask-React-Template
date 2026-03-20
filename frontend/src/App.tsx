import { FormEvent, useEffect, useState } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { PlayerStats } from './types'
import Chat from './Chat'

interface SearchResponse {
  results: PlayerStats[]
}

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [hasSearched, setHasSearched] = useState<boolean>(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const runSearch = async (term: string): Promise<void> => {
    const trimmed = term.trim()
    if (trimmed === '') {
      setPlayers([])
      setHasSearched(false)
      return
    }

    const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
    const data: SearchResponse = await response.json()
    setPlayers(data.results ?? [])
    setHasSearched(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void runSearch(searchTerm)
  }

  const handleChatSearch = (term: string): void => {
    setSearchTerm(term)
    void runSearch(term)
  }

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
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
        <form
          className="input-box"
          onSubmit={handleSubmit}
          onClick={() => document.getElementById('search-input')?.focus()}
        >
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder="Search for a soccer player or query like 'best striker from Spain'"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setHasSearched(false)
            }}
          />
        </form>
      </div>

      <div id="answer-box">
        {players.length === 0 && hasSearched && (
          <p className="no-results">No results found.</p>
        )}
        {players.map((player, index) => (
          <div key={index} className="episode-item">
            <div className="player-header">
              <div className="player-image-frame">
                <img
                  className="player-image"
                  src={player.image || 'https://resources.premierleague.com/premierleague25/photos/players/110x140/placeholder.png'}
                  alt={player.name}
                  width={110}
                  height={140}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://resources.premierleague.com/premierleague25/photos/players/110x140/placeholder.png'
                  }}
                />
              </div>
              <h3 className="episode-title">
                {player.name} <span className="league-tag">({player.league})</span>
              </h3>
            </div>
            <p className="episode-desc">
              {player.position || 'Unknown position'} - {player.nationality || 'Unknown nationality'}
            </p>
            <p className="episode-rating">
              Goals: {player.goals ?? 'N/A'} | Assists: {player.assists ?? 'N/A'}
            </p>
            <p className="episode-rating">
              Appearances: {player.appearances ?? 'N/A'}
            </p>
          </div>
        ))}
      </div>

      {useLlm && <Chat onSearchTerm={handleChatSearch} />}
    </div>
  )
}

export default App
