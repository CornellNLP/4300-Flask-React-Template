import { useState } from 'react'
import { Destination, SearchResponse } from './types'

interface Props {
  onBack: () => void
}

function SearchPage({ onBack }: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [results, setResults] = useState<Destination[]>([])
  const [nearestCity, setNearestCity] = useState('')
  const [baselineTemp, setBaselineTemp] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)

  const getLocation = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5))
        setLon(pos.coords.longitude.toFixed(5))
        setLocating(false)
      },
      () => {
        setError('Could not auto-detect location. Please enter coordinates manually.')
        setLocating(false)
      }
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setResults([])
    setNearestCity('')
    setBaselineTemp(null)

    const params = new URLSearchParams({ q: query, top_n: '10' })
    if (lat) params.set('lat', lat)
    if (lon) params.set('lon', lon)

    try {
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: SearchResponse = await res.json()
      setResults(data.results)
      if (data.user_nearest_city) setNearestCity(data.user_nearest_city)
      if (data.user_baseline_temp_c != null) setBaselineTemp(data.user_baseline_temp_c)
    } catch {
      setError('Could not reach the backend. Make sure Flask is running on port 5001.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="search-page">
      <button className="back-btn" onClick={onBack}>← back</button>

      <h1 className="search-logo">GOAT<span>aways</span></h1>

      <form className="search-form" onSubmit={handleSearch}>
        <textarea
          className="query-input"
          placeholder="Where do you want to go? e.g. I want to party in a warm beach location for spring break"
          value={query}
          onChange={e => setQuery(e.target.value)}
          rows={3}
        />

        <div className="coords-row">
          <input
            className="coord-input"
            type="number"
            step="any"
            placeholder="Latitude"
            value={lat}
            onChange={e => setLat(e.target.value)}
          />
          <input
            className="coord-input"
            type="number"
            step="any"
            placeholder="Longitude"
            value={lon}
            onChange={e => setLon(e.target.value)}
          />
          <button
            type="button"
            className="locate-btn"
            onClick={getLocation}
            disabled={locating}
          >
            {locating ? '...' : '📍 Use My Location'}
          </button>
        </div>

        <button type="submit" className="search-btn" disabled={loading}>
          {loading ? 'Searching...' : 'Find Destinations ✈️'}
        </button>
      </form>

      {nearestCity && (
        <p className="baseline-note">
          📍 Your nearest city: <strong>{nearestCity}</strong>
          {baselineTemp !== null && <> · baseline <strong>{baselineTemp}°C</strong></>}
        </p>
      )}

      {error && <p className="error-msg">{error}</p>}

      {results.length > 0 && (
        <div className="results-grid">
          {results.map((dest, i) => (
            <div key={i} className="result-card">
              <div className="card-rank">#{i + 1}</div>
              <div className="card-body">
                <h2 className="card-city">{dest.city}</h2>
                <p className="card-location">{dest.region}, {dest.country}</p>
                <p className="card-desc">{dest.short_description}</p>
                <div className="card-meta">
                  <span className="tag budget-tag">{dest.budget}</span>
                  <span className="tag score-tag">
                    {(dest.text_similarity * 100).toFixed(0)}% text match
                  </span>
                </div>
                <div className="score-bars">
                    {dest.scores &&
                        Object.entries(dest.scores).map(([key, val]) => (
                        <div key={key} className="score-bar-row">
                            <span className="score-label">
                            {key.replace('_score', '').replace('_', ' ')}
                            </span>
                            <div className="score-bar-bg">
                            <div
                                className="score-bar-fill"
                                style={{ width: `${Number(val || 0) * 100}%` }}
                            />
                            </div>
                        </div>
                        ))}
                    </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchPage
