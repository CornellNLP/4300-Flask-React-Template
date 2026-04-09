import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import Logo from './assets/harmony_logo.png'
import { Song } from './types'
import Chat from './Chat'

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [songs, setSongs] = useState<Song[]>([])
  // const [difficulty, setDifficulty] = useState<string>('all')

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    setSearchTerm(value)
    if (value.trim() === '') { setSongs([]); return }
    const response = await fetch(`/api/episodes?title=${encodeURIComponent(value)}`)
    const data = await response.json()
    setSongs(data.results)
  }

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      {/* Search bar (always shown) */}
      <div className="top-text">
        <div className="title">
          <img src={Logo} alt="logo" />
          <h1>Harmony</h1>
        </div>
        <form
          className="input-box"
          onSubmit={(e) => {
          e.preventDefault()
          handleSearch(searchTerm)
          }}
          >
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder="Search for a song you want to learn"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="all">All</option>
            <option value="easy">Easy (1–3)</option>
            <option value="medium">Medium (4–7)</option>
            <option value="hard">Hard (8–10)</option>
          </select> */}
          <button type="submit">
            Search
          </button>
        </form>
      </div>

      {/* Search results (always shown) */}
      <div id="answer-box">
        {songs.map((song, index) => (
          <div key={index} className="song-item">
            <h3 className="song-title" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{song.title}</span> <span>Similarity: {song.similarity}%</span></h3>
            <h4 className="song-artist">by {song.artist}</h4>
            <p className="song-chords">Chords: {song.chords}</p>
            <p className="song-difficulty" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Guitar difficulty: {song.guitar_difficulty}/10</span> <span>Piano difficulty: {song.piano_difficulty}/10</span></p>
            <p className="song-scores" style={{ display: 'flex', gap: '1rem', fontSize: '0.85em', color: '#888' }}>
              <span>Cosine: {song.cosine_score}%</span>
              <span>SVD: {song.svd_score}%</span>
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

