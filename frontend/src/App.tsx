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

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    setSearchTerm(value)
    if (value.trim() === '') { setSongs([]); return }
    const response = await fetch(`/api/episodes?title=${encodeURIComponent(value)}`)
    const data: Song[] = await response.json()
    setSongs(data)
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
        <div className="input-box" onClick={() => document.getElementById('search-input')?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder="Search for a song you want to learn"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Search results (always shown) */}
      <div id="answer-box">
        {songs.map((song, index) => (
          <div key={index} className="song-item">
            <h3 className="song-title">{song.title}</h3>
            <h4 className="song-artist">by {song.artist}</h4>
            <p className="song-artist">Chords: {song.chords}</p>
            <p className="song-guitar">Guitar difficulty: {song.guitar_difficulty}</p>
            <p className="song-piano">Piano difficulty: {song.piano_difficulty}</p>
          </div>
        ))}
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && <Chat onSearchTerm={handleSearch} />}
    </div>
  )
}

export default App
