import { FormEvent, useState } from 'react'
import './App.css'
import { SongRecommendation } from './types'
import { FaSpotify } from 'react-icons/fa'

function FeatureBar({ label, value, max, color, display }: {
  label: string; value: number; max: number; color: string; display?: string
}) {
  const pct = Math.round((value / max) * 100)

  function getLabel(label: string, v: number) {
    if (label === "Energy") {
      if (v < 0.3) return "Low"
      if (v < 0.7) return "Medium"
      return "High"
    }
  
    if (label === "Valence") {
      if (v < 0.3) return "Sad"
      if (v < 0.7) return "Neutral"
      return "Happy"
    }
  
    if (label === "Danceability") {
      if (v < 0.3) return "Still"
      if (v < 0.7) return "Groovy"
      return "Dancey"
    }
  
    return ""
  }
  return (
    <div className="feat">
      <span className="feat-label">{label}</span>
      <div className="feat-bar-bg">
        <div className="feat-bar-fill"
          style={{
            width: `${pct}%`,
            background: color,
            opacity: 0.4 + 0.6 * (value / max)
          }}
        />
      </div>

      <span className="feat-val">
        <span className="feat-number">
          {display ?? value.toFixed(2)}
        </span>

        {getLabel(label, value) && (
          <span className="feat-text">
            {" "}({getLabel(label, value)})
          </span>
        )}
      </span>
    </div>
  )
}

function LoadingDots() {
  return (
    <span className="loading-dots">
      <span className="dot" /><span className="dot" /><span className="dot" />
    </span>
  )
}

function App(): JSX.Element {
  const [emotionInput, setEmotionInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [songs, setSongs] = useState<SongRecommendation[]>([])
  const [error, setError] = useState<string>('')
  const [openLyrics, setOpenLyrics] = useState<Set<string>>(new Set())
  //testing purposes for tf idf (prototype 1) vs svd performance (prototype 2)
  const [mode, setMode] = useState<'svd' | 'tfidf'>('svd')
  // 

  function toggleLyrics(id: string) { 
    setOpenLyrics(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
      const response = await fetch(`/api/recommendations?query=${encodeURIComponent(query)}&top_k=10&mode=${mode}`)
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
        <p className="eyebrow">Emotion · Song · Matching</p>  {/* ← add this line */}
        <h1>Lyra</h1>
        <p>Describe how you're feeling and get songs that match your emotional state, both lyrically and sonically. </p>
      </header>

      <div className="search-bar">
<div className="input-with-prefix">
  <span className="input-prefix">I feel...</span>
  <input
    placeholder="numb, like I'm watching life through glass"
    value={emotionInput}
    onChange={(e) => setEmotionInput(e.target.value)}
    onKeyDown={(e) => e.key === 'Enter' && fetchRecommendations(e)}
    disabled={loading}
    aria-label="Emotion input"
  />
</div>
        <button onClick={fetchRecommendations} disabled={loading}>
          {loading ? < LoadingDots /> : 'Get Recommendations'}
        </button>
      </div>

{/* testing svd and tfidf differences buttons above results, only for testing */}
      <div className="mode-toggle">
        <button
          onClick={() => setMode('tfidf')}
          className={mode === 'tfidf' ? 'mode-btn active' : 'mode-btn'}
        >
          TF-IDF
        </button>
        <button
          onClick={() => setMode('svd')}
          className={mode === 'svd' ? 'mode-btn active' : 'mode-btn'}
        >
          SVD
        </button>
      </div>


{/* // */}


      {error && <div className="error-banner">{error}</div>}

      <div id="answer-box">
        {songs.map((song) => (

        <div key={song.id} className="song-card">
          <div className="card-top">
            <div className="card-title-block">
              <div className="song-title">{song.title}</div>
              <div className="song-meta">{song.artist} · {song.album}</div>
            </div>
            <div className="card-actions">
              <span className="score-badge">{song.tfidf_score.toFixed(3)} match</span>
              <a className="spotify-btn" href={song.spotify_url} target="_blank" rel="noreferrer">
                <span className="spotify-icon">
                  <FaSpotify />
                </span>
                Spotify
              </a>
              
            </div>
          </div>
          <div className="features-row">
          <FeatureBar label="Danceability" value={Math.pow(song.danceability, 0.8)} max={1} color="#7F77DD" />
          <FeatureBar label="Energy"       value={Math.pow(song.energy, 0.7)}       max={1} color="#1D9E75" />
          <FeatureBar label="Valence"      value={Math.pow(song.valence, 0.9)}      max={1} color="#EF9F27" />
          <FeatureBar
            label="Tempo"
            value={song.tempo}
            max={200}
            color="#D85A30"
            display={`${Math.round(song.tempo)} BPM`}
          />

          </div>
          <p className="lyrics-preview">{song.lyrics_preview}</p>
          <button className="lyrics-toggle" onClick={() => toggleLyrics(song.id)}>
            {openLyrics.has(song.id) ? 'Hide lyrics ↑' : 'Show full lyrics ↓'}
          </button>
          {openLyrics.has(song.id) && (
            <p className="lyrics-full">{song.lyrics_full}</p>
          )}
        </div>
          
        ))}
      </div>
    </div>
  )
}

export default App
