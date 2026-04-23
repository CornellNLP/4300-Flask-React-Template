import { FormEvent, useState, useEffect,useRef } from 'react'
import './App.css'
import { SongRecommendation } from './types'
import { FaSpotify } from 'react-icons/fa'
import clickFile from './assets/click.mp3'
import errorFile from './assets/eror.mp3'
import selectFile from './assets/select.mp3'
import middleFile from './assets/error_005.ogg'
import boomFile from './assets/vine-boom.mp3'
import transportFile from './assets/click.wav'
import confirmFile from './assets/confirmation_002.ogg'
// import listFile from './assets/list.ogg'
import heartFile from './assets/heart.ogg'
import { BsSkipBackwardFill, BsSkipStartFill, BsSkipEndFill, BsSkipForwardFill, BsFillPlayFill, BsFillPauseFill, BsSuitHeartFill, BsVolumeUpFill, BsVolumeMuteFill, BsVolumeDownFill } from 'react-icons/bs'
import { CursorTrail } from './CursorTrail'

// types
type TabType = 'home' | 'setup' | 'search'
type SearchMode = 'tfidf' | 'svd' | 'rag'

interface Tab {
  id: string
  label: string
  type: TabType
  mode: SearchMode | null
  query: string
  songs: SongRecommendation[]
  descriptions: string[]
  error: string
  loading: boolean
}

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
          style={{width: `${pct}%`,background: color,opacity: 0.4 + 0.6 * (value / max)}}
        />
      </div>

      <span className="feat-val">
        <span className="feat-number">{display ?? value.toFixed(2)}</span>

        {getLabel(label, value) && (
          <span className="feat-text">
            {" "}({getLabel(label, value)})
          </span>
        )}
      </span>
    </div>
  )
}

// ──Winamp Player ──────

function WinampPlayer({ songs, descriptions, onClickSound, mode, favoriteSongs, onToggleFavorite }: {
  songs: SongRecommendation[]
  descriptions: string[]
  onClickSound: () => void
  mode: SearchMode
  favoriteSongs: SongRecommendation[]
  onToggleFavorite: (song: SongRecommendation) => void
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.75)
  const [showVolume, setShowVolume] = useState(false)

  const song = songs[selectedIndex]
  // herehere
  // const trackId = song.spotify_url.match(/track\/([a-zA-Z0-9]+)/)?.[1] ?? null
  const [artUrl, setArtUrl] = useState<string | null>(null)
  // for playing audio preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const cleanArtistName = (artist: string) => artist.replace(/[\[\]']/g, '')


  useEffect(() => {
    setArtUrl(null)
    setPreviewUrl(null)
    setIsPlaying(false)
    audioRef.current?.pause()
    fetchTrackData(song.artist, song.title).then(({ art, preview }) => {
      setArtUrl(art)
      setPreviewUrl(preview)
    })
    if (audioRef.current) audioRef.current.volume = volume
  }, [song.artist, song.title])

  const goTo = (index: number) => {
    // playList()
    setSelectedIndex(index)
    setIsPlaying(false)
    audioRef.current?.pause()
  }

  const prev = () => goTo(Math.max(0, selectedIndex - 1))
  const next = () => goTo(Math.min(songs.length - 1, selectedIndex + 1))

  // play with button
  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(p => !p)
  }

  // transform file for playing button noise
  const withTransform = (f: () => void) => () => {
    playTransform()
    f()
  }

  return (
    <div className="winamp-wrap">

      {/* Left: playlist panel */}
      <div className="winamp-playlist">
        <div className="winamp-playlist-header">✦ playlist ✦</div>
        <div className="winamp-playlist-items">
          {songs.map((s, i) => (
            <button
              key={s.id}
              className={`winamp-playlist-item ${i === selectedIndex ? 'active' : ''}`}
              onClick={() => goTo(i)}
            >
              <span className="wpi-num">{i + 1}</span>
              <span className="wpi-info">
                <span className="wpi-title">
                  {favoriteSongs.find(f => f.id === s.id) && (
                    <BsSuitHeartFill size={10} style={{ color: '#ff4dab', marginRight: '4px', verticalAlign: 'middle' }} />
                  )}
                  {s.title}
                </span>
                <span className="wpi-artist">{cleanArtistName(s.artist)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="winamp-playlist-footer">
          brought to you by <span>{mode}</span>
        </div>
      </div>

      {/* Right: active card + controls */}
      <div className="winamp-main">
        <div className="winamp-card">
          {previewUrl && <audio ref={audioRef} src={previewUrl} />}
          <div className="winamp-card-header">
            <div className="winamp-card-header-inner">
              <div className="winamp-album-art-wrap">
                {artUrl && (
                  <img className="winamp-album-art" src={artUrl} alt={`${song.title} cover`} />
                )}
              </div>

              <div className="winamp-card-header-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="winamp-song-title">{song.title}</div>
                  {descriptions[selectedIndex] && (
                    <div className="rag-info-wrap">
                      <span className="rag-info-btn">?</span>
                      <div className="rag-tooltip">{descriptions[selectedIndex]}</div>
                    </div>
                  )}
                </div>
                <div className="winamp-song-meta">{cleanArtistName(song.artist)}  ✧  {song.album}</div>
              </div>

              <div className="winamp-score-row">
                <span className="score-badge">{song.tfidf_score.toFixed(3)} match</span>
                <a className="spotify-btn" href={song.spotify_url} target="_blank" rel="noreferrer" onClick={onClickSound}>
                  <FaSpotify />
                  <span className="spotify-text">Spotify</span>
                </a>
              </div>
            </div>
          </div>

        

          <div className="winamp-card-body">
            <div className="winamp-card-left">
              <div className="features-col">
                <FeatureBar label="Danceability" value={song.danceability} max={1} color="#d988b9" />
                <FeatureBar label="Energy" value={song.energy} max={1} color="#7ec8e3" />
                <FeatureBar label="Valence" value={song.valence} max={1} color="#b59fdd" />
                <FeatureBar label="Tempo" value={song.tempo} max={200} color="#f7a8c4" display={`${Math.round(song.tempo)} BPM`} />
              </div>
            </div>

            <div className="winamp-card-right">
              {song.lyrics_full && (
                <div className="lyrics-container">
                  <div className="lyrics-notes">
                    {['♪','♫','♩','♬','♪','♫','♩','♬'].map((note, i) => (
                      <span key={i} className="lyrics-note" style={{
                        left: i % 2 === 0 ? `${2 + (i % 3) * 4}%` : `${88 + (i % 3) * 3}%`,
                        animationDelay: `${i * 0.6}s`,
                        animationDuration: `${3 + (i % 3)}s`,
                        fontSize: `${11 + (i % 3) * 3}px`
                      }}>{note}</span>
                    ))}
                  </div>
                  <div className="lyrics-full">{song.lyrics_full}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transport controls */}
        <div className="winamp-controls">
          <button
            className={`wc-btn wc-heart ${favoriteSongs.find(s => s.id === song.id) ? 'active' : ''}`}
            onClick={() => { playHeart(); onToggleFavorite(song) }}
            title="favorite"
          >
            <BsSuitHeartFill size={14} />
          </button>
          <button className="wc-btn" onClick={withTransform(() => goTo(0))} title="first"><BsSkipBackwardFill size={16} /></button>
          <button className="wc-btn" onClick={withTransform(prev)} title="prev" disabled={selectedIndex === 0}><BsSkipStartFill size={16} /></button>
          <button className="wc-btn wc-play" onClick={togglePlay} title={isPlaying ? 'pause' : 'play'}>
            {isPlaying ? <BsFillPauseFill size={16} /> : <BsFillPlayFill size={16} />}
          </button>
          <button className="wc-btn" onClick={withTransform(next)} title="next" disabled={selectedIndex === songs.length - 1}><BsSkipEndFill size={16} /></button>
          <button className="wc-btn" onClick={withTransform(() => goTo(songs.length - 1))} title="last"><BsSkipForwardFill size={16} /></button>
          <div className="wc-volume-wrap">
            <button className={`wc-btn ${showVolume ? 'active' : ''}`} onClick={withTransform(() => setShowVolume(p => !p))}>
              {volume === 0 ? <BsVolumeMuteFill size={14} /> : volume < 0.5 ? <BsVolumeDownFill size={14} /> : <BsVolumeUpFill size={18} />}
            </button>
            {showVolume && (
              <div className="wc-volume-popup">
                <span className="wc-vol-label">VOL {Math.round(volume * 100)}</span>
                <div className="wc-vol-slider-wrap">
                  <input
                    type="range" min={0} max={1} step={0.01} value={volume}
                    className="wc-vol-slider"
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setVolume(v)
                      if (audioRef.current) audioRef.current.volume = v
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

//helpers
function playClick() {
  const audio = new Audio(clickFile)
  audio.volume = 0.4
  audio.play().catch(() => {})
}

function playTransform() {
  const audio = new Audio(transportFile)
  audio.volume = 0.4
  audio.play().catch(() => {})
}

function playError() {
  const audio = new Audio(errorFile)
  audio.volume = 0.35
  audio.play().catch(() => {})
}

function playSelect() {
  const audio = new Audio(selectFile)
  audio.volume = 0.6
  audio.play().catch(() => {})
}

function playMiddle() {
  const audio = new Audio(middleFile)
  audio.volume = .8
  audio.play().catch(() => {})
}
function playBoom() {
  const audio = new Audio(boomFile)
  audio.volume = .5
  audio.play().catch(() => {})
}

function playConfirm() {
  const audio = new Audio(confirmFile)
  audio.volume = .5
  audio.play().catch(() => {})
}

// function playList() {
//   const audio = new Audio(listFile)
//   audio.volume = .5
//   audio.play().catch(() => {})
// }
function playHeart() {
  const audio = new Audio(heartFile)
  audio.volume = .2
  audio.play().catch(() => {})
}


async function fetchTrackData(artist: string, title: string): Promise<{ art: string | null, preview: string | null }> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`)
    const data = await res.json()
    if (data.results.length === 0) return { art: null, preview: null }
    return {
      art: data.results[0].artworkUrl100.replace('100x100', '600x600'),
      preview: data.results[0].previewUrl ?? null
    }
  } catch {
    return { art: null, preview: null }
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App(): JSX.Element {
  const nextId = useRef(1)

  const makeHomeTab = (): Tab => ({
    id: 'home',
    label: 'home',
    type: 'home',
    mode: null,
    query: '',
    songs: [],
    descriptions: [],
    error: '',
    loading: false,
  })

  const [tabs, setTabs] = useState<Tab[]>([makeHomeTab()])
  const [activeId, setActiveId] = useState<string>('home')

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  const [favoriteSongs, setFavoriteSongs] = useState<SongRecommendation[]>([])
  const toggleFavorite = (song: SongRecommendation) => {
    setFavoriteSongs(prev =>
      prev.find(s => s.id === song.id)
        ? prev.filter(s => s.id !== song.id)
        : [...prev, song]
    )
  }

  const cleanArtistName = (artist: string) => artist.replace(/[\[\]']/g, '')

  const loadingStatus = ['tuning in...', 'scanning vibes...', 'connecting...']
  const loadingSubs = ['hang tight bestie ♪', 'almost there ★', 'ur song is out there ♫']
  const [statusIdx, setStatusIdx] = useState(0)
  const [subIdx, setSubIdx] = useState(0)

  // animate loading text  
  useEffect(() => {
  if (!activeTab.loading) return
  const a = setInterval(() => setStatusIdx(i => (i + 1) % loadingStatus.length), 8000)
  const b = setInterval(() => setSubIdx(i => (i + 1) % loadingSubs.length), 8000)
  return () => { clearInterval(a); clearInterval(b) }
}, [activeTab.loading])


  // ─── Tab management ─────────────────────────────────────────────────────────

  const addTab = () => {
    if (tabs.length >= 5) return
    const id = `tab-${nextId.current++}`
    setTabs(prev => [...prev, {
      id, label: 'new tab', type: 'setup', mode: null,
      query: '', songs: [], descriptions: [], error: '', loading: false,
    }])
    setActiveId(id)
  }

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeId === id) setActiveId(next[next.length - 1].id)
      return next
    })
  }

  const updateTab = (id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  // ─── Search ─────────────────────────────────────────────────────────────────

  const fetchByQuery = async (tabId: string, query: string, mode: SearchMode) => {
    updateTab(tabId, { loading: true, error: '', descriptions: [] })

    try {
      if (mode === 'rag') {
        const response = await fetch('/api/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 10 }),
        })
        if (!response.ok) {
          updateTab(tabId, { error: `Request failed (${response.status})`, songs: [] })
          return
        }
        const data = await response.json()
        const songs = data.songs ?? []
        updateTab(tabId, {
          songs, descriptions: data.descriptions ?? [],
          error: songs.length === 0 ? 'No matches found. Try different words.' : '',
          label: query.length > 14 ? query.slice(0, 14) + '…' : query,
        })
      } else {
        const response = await fetch(`/api/recommendations?query=${encodeURIComponent(query)}&top_k=10&mode=${mode}`)
        if (!response.ok) { updateTab(tabId, { error: `Request failed (${response.status})`, songs: [] })
          return
        }
        const data: SongRecommendation[] = await response.json()
        updateTab(tabId, {
          songs: data,
          error: data.length === 0 ? 'No matches found. Try adding more emotional keywords.' : '',
          label: query.length > 14 ? query.slice(0, 14) + '…' : query,
        })
      }
    } catch {
      updateTab(tabId, { error: 'Unable to load recommendations right now.', songs: [] })
    } finally {
      updateTab(tabId, { loading: false })
    }
  }

  const handleSearch = (e: FormEvent, tabId: string, query: string, mode: SearchMode | null) => {
    e.preventDefault()
    if (!query.trim()) {updateTab(tabId, { error: 'Please describe how you are feeling.' })
      return
    }
    if (!mode) return
    fetchByQuery(tabId, query.trim(), mode)
  }

  // ─── returning for app ──────────────────────────────────────────────────────────────────

  return (
    <div className="full-body-container">
      <CursorTrail /> 
      <div className="retro-window">

        {/* Title bar */}
        <div className="retro-titlebar">
          <span className="retro-title">lyra.exe</span>
          <div className="retro-controls">
            <button className="retro-ctrl" onClick={playBoom}>_</button>
            <button className="retro-ctrl" onClick={playMiddle}>□</button>
            <button className="retro-ctrl retro-close" onClick={playError}>✕</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="retro-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`retro-tab ${t.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(t.id)}
            >
              {t.label}
              {t.mode && t.type === 'search' && (
                <span className="tab-chip">{t.mode}</span>
              )}
              {t.id !== 'home' && (
                <span className="tab-close" onClick={e => closeTab(t.id, e)}>✕</span>
              )}
            </button>
          ))}
          {tabs.length < 5 && (
            <button className="tab-plus" onClick={addTab} title="New tab">+</button>
          )}
        </div>

        {/* Body */}
        <div className="retro-body">

          {/* ── HOME ── */}
          {activeTab.type === 'home' && (
            <div>
              <header className="hero">
                <h1>Lyra</h1>
                <p>drop your feelings here — we'll find the soundtrack.</p>
              </header>
                <div className="home-btn-wrap">
                  <button className="home-find-btn" onClick={() => {playClick();addTab()}}>find my song →</button>
                </div>

              {favoriteSongs.length > 0 && (
                <div className="favorites-wrap">
                  <div className="favorites-panel">
                    <div className="favorites-header">♥ favorites ♥</div>
                    {favoriteSongs.map(s => (
                      <div key={s.id} className="favorites-item">
                        <span className="fav-title">{s.title}</span>
                        <span className="fav-artist">{cleanArtistName(s.artist)}</span>
                        <button className="fav-remove" onClick={() => toggleFavorite(s)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SETUP (mode picker) ── */}
          {activeTab.type === 'setup' && (
            <div className="mode-picker-wrap">
              <div className="mode-picker-card">
                <p className="mode-picker-heading">choose a search mode</p>
                <div className="mode-picker-opts">
                  {(['rag', 'tfidf', 'svd'] as SearchMode[]).map(m => (
                    <button
                      key={m}
                      className={`retro-btn ${activeTab.mode === m ? 'active' : ''}`}
                      onClick={() => { playSelect(); updateTab(activeTab.id, { mode: m }) }}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="mode-picker-note">
                  RAG uses retrieval-augmented generation for richer matches.
                  TF-IDF and SVD are faster vector methods.
                </p>
                <button
                  className="mode-picker-start"
                  disabled={!activeTab.mode}
                  onClick={() => {
                    playConfirm()
                    updateTab(activeTab.id, {
                      type: 'search',
                      label: activeTab.mode!,
                    })
                  }}
                >
                  start searching →
                </button>
              </div>
            </div>
          )}

          {/* ── SEARCH ── */}
          {activeTab.type === 'search' && (
            <div className="search-view-wrap">
              <div className="search-top-bar">
                <div className="search-bar">
                  <div className="input-with-prefix">
                    <span className="input-prefix">I feel...</span>
                    <div className="input-sizer">
                      <span className="input-sizer-text">{activeTab.query}</span>
                      <input
                        value={activeTab.query}
                        onChange={e => updateTab(activeTab.id, { query: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSearch(e, activeTab.id, activeTab.query, activeTab.mode)
                        }}
                        disabled={activeTab.loading}
                      />
                    </div>
                  </div>
                  <button
                    className="retro-btn"
                    onClick={e => { playClick(); handleSearch(e, activeTab.id, activeTab.query, activeTab.mode) }}
                    disabled={activeTab.loading}
                  >
                    find my song
                  </button>
                </div>
              </div>
              {activeTab.loading && (
                <div className="loading-screen">
                  <div className="loading-status">{loadingStatus[statusIdx]}</div>
                  <div className="loading-stars">
                    <span>★</span><span>✦</span><span>★</span><span>✦</span><span>★</span>
                  </div>
                  <div className="loading-bar-wrap">
                    <div className="loading-bar-label">LOADING</div>
                    <div className="loading-bar-outer">
                      <div className="loading-bar-inner" />
                    </div>
                  </div>
                  <div className="loading-subtitle">{loadingSubs[subIdx]}</div>
                </div>
              )}
              {activeTab.error && <div className="error-banner">{activeTab.error}</div>}

              {activeTab.songs.length > 0 && (
                <WinampPlayer
                  songs={activeTab.songs}
                  descriptions={activeTab.descriptions}
                  onClickSound={playClick}
                  mode={activeTab.mode!}
                  favoriteSongs={favoriteSongs}
                  onToggleFavorite={toggleFavorite}
                />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default App
