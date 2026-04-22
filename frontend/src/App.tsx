import { FormEvent, useState, useEffect } from 'react'
import './App.css'
import { SongRecommendation } from './types'
import { FaSpotify } from 'react-icons/fa'
import clickFile from './assets/click.wav'

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

function getTrackId(spotifyUrl: string): string | null {
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

function App(): JSX.Element {
  const [emotionInput, setEmotionInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [songs, setSongs] = useState<SongRecommendation[]>([])
  const [descriptions, setDescriptions] = useState<string[]>([])
  const [error, setError] = useState<string>('')
  const exprompts = [
    "soft sadness with warm memories",
    "late night overthinking energy",
    "like i'm missing someone but smiling anyway",
    "like i'm healing but not there yet",
    "nostalgic but calm",
    "heavy but still moving forward"
  ]
  const [promptIndex, setPromptIndex] = useState(0)
  const [typedText, setTypedText] = useState("")
  const [showHint, setShowHint] = useState(true)
  const [isActive, setIsActive] = useState(false)

  const playClick = () => {
    const audio = new Audio(clickFile);
    audio.volume = 0.25;

    audio.play().catch((err) => {
      console.log("audio failed:", err);
    });
  };

  //testing purposes for tf idf (prototype 1) vs svd performance (prototype 2)
  const [mode, setMode] = useState<'svd' | 'tfidf'>('svd')
  const [ragMode, setRagMode] = useState<boolean>(false)
  //


  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const resetIdle = () => {
      setIsActive(true)

      clearTimeout(timer)

      timer = setTimeout(() => {
        setIsActive(false)
        setShowHint(true)
        setPromptIndex((prev) => (prev + 1) % exprompts.length)
      }, 5000)
    }

    const events = ["keydown", "mousedown", "touchstart"]

    events.forEach((e) => window.addEventListener(e, resetIdle))

    resetIdle()
    setIsActive(false)

    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, resetIdle))
    }
  }, [])

  useEffect(() => {
    if (isActive || !showHint || emotionInput) return

    const current = exprompts[promptIndex]
    let i = 0

    setTypedText("")

    const interval = setInterval(() => {
      i++
      setTypedText(current.slice(0, i))

      if (i >= current.length) {
        clearInterval(interval)
      }
    }, 40)

    return () => clearInterval(interval)
  }, [promptIndex, isActive])

  const fetchByQuery = async (query: string): Promise<void> => {
    setLoading(true)
    setError('')
    setDescriptions([])
    try {
      if (ragMode) {
        const response = await fetch('/api/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        if (!response.ok) {
          setError(`Request failed (${response.status})`)
          setSongs([])
          return
        }
        const data = await response.json()
        setSongs(data.songs ?? [])
        setDescriptions(data.descriptions ?? [])
        if ((data.songs ?? []).length === 0) {
          setError('No matches found. Try different words.')
        }
      } else {
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
      }
    } catch {
      setError('Unable to load recommendations right now.')
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  const fetchRecommendations = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const query = emotionInput.trim()
    if (!query) {
      setSongs([])
      setError('Please describe how you are feeling.')
      return
    }
    await fetchByQuery(query)
  }

  return (
    <div className="full-body-container">
      <header className="hero">
        <h1>Lyra</h1>
        <p>Describe how you're feeling and get songs that match your emotional state, both lyrically and sonically. </p>
      </header>

      <div className="search-bar">
      <div className="input-with-prefix">
        <span className="input-prefix">I feel...</span>

        <div className="input-stack">
          <input
            value={emotionInput}
            onChange={(e) => {setEmotionInput(e.target.value); setShowHint(false)}}
            onKeyDown={(e) => e.key === 'Enter' && fetchRecommendations(e)}
            disabled={loading}
          />
          {showHint && !emotionInput && !isActive && (
            <div className="input-suggestion">
              {typedText}
              <span className="cursor">|</span>
            </div>
          )}
        </div>
      </div>

        <button onClick={(e) => { playClick(); fetchRecommendations(e); }} disabled={loading}>
          {loading ? 'finding...' : 'find my song'}
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
        <button
          onClick={() => setRagMode(prev => !prev)}
          className={ragMode ? 'mode-btn active' : 'mode-btn'}
        >
          RAG
        </button>
      </div>


{/* // */}

      {error && <div className="error-banner">{error}</div>}

      <div id="answer-box">
        {songs.map((song, index) => {
          const trackId = getTrackId(song.spotify_url)

          return (
            <div key={song.id} className="song-card">

              {/* left */}
              <div className="song-main">

              <div className="card-top">

                <div className="card-title-block">
                  <div className="song-title">{song.title}</div>
                  <div className="song-meta">{song.artist} · {song.album}</div>
                </div>

                <div className="card-actions">
                  <div className="score-badge">
                    {song.tfidf_score.toFixed(3)} match
                  </div>

                  <a
                    className="spotify-btn"
                    href={song.spotify_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={playClick}
                  >
                    <span className="spotify-icon">
                      <FaSpotify />
                    </span>
                    <span className="spotify-text" >Spotify</span>
                  </a>
                </div>

              </div>

                <div className="features-row">
                  <FeatureBar label="Danceability" value={song.danceability} max={1} color="#7F77DD" />
                  <FeatureBar label="Energy" value={song.energy} max={1} color="#1D9E75" />
                  <FeatureBar label="Valence" value={song.valence} max={1} color="#EF9F27" />
                  <FeatureBar label="Tempo" value={song.tempo} max={200} color="#D85A30" display={`${Math.round(song.tempo)} BPM`} />
                </div>

                {descriptions[index] && (
                  <div className="rag-description">{descriptions[index]}</div>
                )}

              </div>

{/* right side always visible */}
                <div className="song-side">


                  {trackId && (
                    <iframe
                      className="spotify-embed"
                      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
                      loading="lazy"
                    />
                  )}

                  <div className="lyrics-full">
                    {song.lyrics_full}
                  </div>

                </div>

            </div>
          )
})}
      </div>
    </div>
  )
}

export default App
