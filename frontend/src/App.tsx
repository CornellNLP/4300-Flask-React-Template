import { FormEvent, useState } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { SongRecommendation } from './types'

function App(): JSX.Element {
  const [emotionInput, setEmotionInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [songs, setSongs] = useState<SongRecommendation[]>([])
  const [error, setError] = useState<string>('')

  const fetchRecommendations = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const query = emotionInput.trim()
    if (!query) {
      setSongs([])
      setError('Please describe how you are feeling.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/recommendations?query=${encodeURIComponent(query)}&top_k=10`)
      if (!response.ok) {
        setError(`Request failed (${response.status})`)
        setSongs([])
        return
      }
      const data: SongRecommendation[] = await response.json()
      setSongs(data)
      if (data.length === 0) {
        setError('No TF-IDF matches found. Try adding more emotional keywords.')
      }
    } catch {
      setError('Unable to load recommendations right now.')
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="full-body-container">
      <header className="hero">
        <h1>Lyra: Emotion-to-Song Prototype</h1>
        <p>
          Iteration 1 uses lyrics-only TF-IDF text matching on your emotion input.
        </p>
      </header>

      <form className="input-box" onSubmit={fetchRecommendations}>
        <img src={SearchIcon} alt="search icon" />
        <input
          placeholder='Try: "I feel sad and need calm comfort songs"'
          value={emotionInput}
          onChange={(e) => setEmotionInput(e.target.value)}
          disabled={loading}
          aria-label="Emotion input"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Matching...' : 'Get Recommendations'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div id="answer-box">
        {songs.map((song) => (
          <div key={song.id} className="song-item">
            <h3 className="song-title">{song.title}</h3>
            <p className="song-meta">
              {song.artist} · {song.album}
            </p>
            <a className="song-link" href={song.spotify_url} target="_blank" rel="noreferrer">
              Open in Spotify
            </a>
            <p className="song-score">TF-IDF similarity: {song.tfidf_score.toFixed(5)}</p>
            <p className="song-features">
              Danceability {song.danceability} · Energy {song.energy} · Valence {song.valence} · Tempo {song.tempo} BPM
            </p>
            <p className="song-lyrics">{song.lyrics_preview}</p>
            <details className="lyrics-details">
              <summary>Show full lyrics</summary>
              <p className="song-lyrics full">{song.lyrics_full}</p>
            </details>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
