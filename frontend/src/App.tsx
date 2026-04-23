import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import Logo from './assets/harmony_logo.png'
import { Song } from './types'
import Chat from './Chat'
import RAG from "./RAG"

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [songs, setSongs] = useState<Song[]>([])
  const [numResults, setNumResults] = useState(5)
  const [instrument, setInstrument] = useState<string>('guitar')
  const [difficulty, setDifficulty] = useState<string>('all')

  useEffect(() => {
    handleSearch(searchTerm);
  }, [instrument, difficulty]);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    if (value.trim() === '') { setSongs([]); return }
    const response = await fetch(`/api/songs?title=${encodeURIComponent(value)}&topn=${encodeURIComponent(numResults)}&instrument=${encodeURIComponent(instrument)}&difficulty=${encodeURIComponent(difficulty)}`)
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
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch(searchTerm)
          }}
        >
          <div className="input-box">
            <img src={SearchIcon} alt="search" />
            <input
              id="search-input"
              placeholder="Search for a song you want to learn"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)

              }}
            />
          </div>
          <div className="search-button">
            <button type="submit" className='button'>
              Search
            </button>
          </div>
        </form>


        {/* Search results (always shown) */}
        < div id="answer-box" >
          {
            songs.map((song, index) => (
              <div key={index} className="song-item">
                <h3 className="song-title" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{song.title}</span> <span>Similarity: {song.similarity}%</span></h3>
                <h4 className="song-artist">by {song.artist}</h4>
                <p className="song-chords">Chords: {song.chords}</p>
                <p className="song-difficulty">Difficulty: {song.difficulty}/10</p>
                <p className="song-scores" style={{ display: 'flex', gap: '1rem', fontSize: '0.85em', color: '#888' }}>
                  <span>Cosine: {song.cosine_score}%</span>
                  <span>SVD: {song.svd_score}%</span>
                </p>
                {song.svd_explanation && song.svd_explanation.length > 0 && (
                  <div className="svd-explanation" style={{ marginTop: '0.5rem', fontSize: '0.82em', color: '#333', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                    <strong>SVD Mood Analysis</strong>
                    {song.svd_explanation.map((dim, i) => (
                      <div key={i} style={{ marginTop: '0.25rem' }}>
                        <span style={{ color: dim.strength >= 0 ? '#2d7a2d' : '#a83232' }}>
                          <strong>Dimension {dim.dimension}</strong> (strength: {dim.strength})
                        </span>
                        <br />
                        <span>Mood words: {dim.mood_words.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          }
        </div >
        <div id="filter-box">
          <div className="filters">
            <div className="filter-title">
              <h1>Pick An Instrument!</h1>
            </div>
            <div className="btn-groupH">
              <button className={instrument === "guitar" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setInstrument("guitar")
              }}>
                Guitar
              </button>
              <button className={instrument === "piano" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setInstrument("piano")
              }}>
                Piano
              </button>
            </div>
            <div className="filter-title">
              <h1>Pick A Difficulty!</h1>
            </div>
            <div className="btn-groupV">
              <button className={difficulty === "all" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("all")
              }}>
                All
              </button>
              <button className={difficulty === "easy" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("easy")
              }}>
                Easy
              </button>
              <button className={difficulty === "medium" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("medium")
              }}>
                Medium
              </button>
              <button className={difficulty === "hard" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("hard")
              }}>
                Hard
              </button>
            </div>
            <div>
              <div className="filter-title">
                <h1># of Results</h1>
              </div>
              <input
                className="slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={numResults}
                onChange={(e) => setNumResults(Number(e.target.value))}
              />
              <div className="slider-labels">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && (
        <RAG
          instrument={instrument}
          difficulty={difficulty}
          numResults={numResults}
        />
      )}
    </div >
  )
}

export default App

