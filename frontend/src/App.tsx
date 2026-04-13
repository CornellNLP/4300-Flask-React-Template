import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { Restaurant, SvdConcept, SearchResponse } from './types'

const PRICE_OPTIONS = ['', '$', '$$', '$$$', '$$$$']

const DIETARY_OPTIONS = [
  { value: 'vegan',       label: 'Vegan' },
  { value: 'vegetarian',  label: 'Vegetarian' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
  { value: 'halal',       label: 'Halal' },
  { value: 'kosher',      label: 'Kosher' },
  { value: 'paleo',       label: 'Paleo' },
  { value: 'keto',        label: 'Keto' },
  { value: 'pescatarian',        label: 'Pescatarian' },
]

function PriceBadge({ range }: { range: string }) {
  if (!range) return null
  return <span className="price-badge">{range}</span>
}

function StarScore({ score, isTopRated }: { score: number; isTopRated: boolean }) {
  if (score > 0) return <span className="score-badge">★ {score.toFixed(1)}</span>
  if (isTopRated || score === 0) return <span className="top-rated-badge">Top Rated</span>
  return null
}

function ConceptPanel({ concepts }: { concepts: SvdConcept[] }) {
  if (!concepts.length) return null
  return (
    <div className="concept-panel">
      <p className="concept-panel-label">Semantic concepts activated by your query</p>
      {concepts.map((c) => (
        <div key={c.concept_id} className="concept-item">
          <span className="concept-activation">
            {c.activation > 0 ? '+' : ''}{c.activation.toFixed(3)}
          </span>
          <span className="concept-terms">
            {c.top_terms.map((t) => t.term).join(' · ')}
          </span>
        </div>
      ))}
    </div>
  )
}

function RestaurantCard({ r }: { r: Restaurant }) {
  return (
    <div className="restaurant-card">
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="restaurant-name">{r.name}</h3>
          <div className="card-badges">
            <PriceBadge range={r.price_range} />
            <StarScore score={r.score} isTopRated={r.is_top_rated} />
          </div>
        </div>
        <p className="restaurant-category">{r.category}</p>
        {r.address && <p className="restaurant-address">{r.address}</p>}
      </div>

      {r.matched_items.length > 0 && (
        <div className="menu-items">
          <p className="menu-label">Matched items</p>
          {r.matched_items.map((item, j) => (
            <div key={j} className="menu-item">
              <div className="menu-item-header">
                <span className="menu-item-name">{item.name}</span>
                {item.price && <span className="menu-item-price">{item.price}</span>}
              </div>
              {item.description && (
                <p className="menu-item-desc">{item.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {r.matched_items.length === 0 && r.popular_dish && (
        <div className="menu-items popular-dish-section">
          <p className="menu-label popular-dish-label">Popular dish</p>
          <div className="menu-item">
            <div className="menu-item-header">
              <span className="menu-item-name">{r.popular_dish.name}</span>
              {r.popular_dish.price && (
                <span className="menu-item-price">{r.popular_dish.price}</span>
              )}
            </div>
            {r.popular_dish.description && (
              <p className="menu-item-desc">{r.popular_dish.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function App(): JSX.Element {
  const [query, setQuery] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<string[]>([])
  const [searchMode, setSearchMode] = useState<'tfidf' | 'svd' | 'embeddings'>('tfidf')

  const [cities, setCities] = useState<string[]>([])
  const [results, setResults] = useState<Restaurant[]>([])
  const [svdConcepts, setSvdConcepts] = useState<SvdConcept[]>([])
  const [svdError, setSvdError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load city list once on mount
  useEffect(() => {
    fetch('/api/cities')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCities(data) })
      .catch(() => {})
  }, [])

  const doSearch = async (q: string, price: string, mode: 'tfidf' | 'svd' | 'embeddings', city: string, dietary: string[]) => {
    if (!q.trim()) {
      setResults([]); setSvdConcepts([])
      setSearched(false); setError(null); setSvdError(null)
      return
    }
    setLoading(true); setSearched(true); setError(null); setSvdError(null)
    try {
      const params = new URLSearchParams({ q, ...(price ? { price } : {}) })
      if (city) params.set('city', city)
      if (dietary.length) params.set('dietary', dietary.join(','))
      if (mode === 'svd') params.set('svd', '1')
      if (mode === 'embeddings') params.set('embeddings', '1')
      const res = await fetch(`/api/search?${params}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data: SearchResponse = await res.json()
      if (data.meta?.error) {
        setSvdError(data.meta.error); setResults([]); setSvdConcepts([])
      } else {
        setResults(data.results ?? [])
        setSvdConcepts(data.meta?.concepts ?? [])
      }
    } catch {
      setResults([]); setSvdConcepts([])
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doSearch(query, priceFilter, searchMode, cityFilter, dietaryFilter)
  }

  const handlePriceChange = (p: string) => {
    setPriceFilter(p)
    doSearch(query, p, searchMode, cityFilter, dietaryFilter)
  }

  const handleCityChange = (city: string) => {
    setCityFilter(city)
    if (searched && query.trim()) doSearch(query, priceFilter, searchMode, city, dietaryFilter)
  }

  const handleDietaryToggle = (value: string) => {
    const next = dietaryFilter.includes(value)
      ? dietaryFilter.filter((d) => d !== value)
      : [...dietaryFilter, value]
    setDietaryFilter(next)
    if (searched && query.trim()) doSearch(query, priceFilter, searchMode, cityFilter, next)
  }

  const MODE_CYCLE: Array<'tfidf' | 'svd' | 'embeddings'> = ['tfidf', 'svd', 'embeddings']
  const MODE_LABELS: Record<string, string> = { tfidf: 'TF-IDF', svd: 'SVD', embeddings: 'Embeddings' }

  const handleModeToggle = () => {
    const next = MODE_CYCLE[(MODE_CYCLE.indexOf(searchMode) + 1) % MODE_CYCLE.length]
    setSearchMode(next)
    if (searched && query.trim()) doSearch(query, priceFilter, next, cityFilter, dietaryFilter)
  }

  return (
    <div className="full-body-container">
      <div className="top-text">
        <div className="brand">
          <span className="brand-fork">🍴</span>
          <h1 className="brand-name">Forkcast</h1>
        </div>
        <p className="brand-tagline">Describe what you want to eat — we'll find the spot.</p>

        {/* Search bar */}
        <div className="input-box" onClick={() => document.getElementById('search-input')?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder='e.g. "spicy vegetarian noodles" or "cheap late-night burgers"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="search-btn" onClick={() => doSearch(query, priceFilter, searchMode, cityFilter, dietaryFilter)}>
            Search
          </button>
        </div>

        {/* Filters row */}
        <div className="controls-row">
          <div className="price-filters">
            {PRICE_OPTIONS.map((p) => (
              <button
                key={p || 'all'}
                className={`price-filter-btn ${priceFilter === p ? 'active' : ''}`}
                onClick={() => handlePriceChange(p)}
              >
                {p || 'Any price'}
              </button>
            ))}
          </div>

          <select
            className="city-select"
            value={cityFilter}
            onChange={(e) => handleCityChange(e.target.value)}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            className={`svd-toggle-btn ${searchMode !== 'tfidf' ? 'active' : ''}`}
            onClick={handleModeToggle}
            title="Cycle between TF-IDF, SVD, and Embeddings search"
          >
            <span className="svd-toggle-indicator" />
            {MODE_LABELS[searchMode]}
          </button>
        </div>
        {/* Dietary filters */}
        <div className="dietary-filters">
          {DIETARY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`dietary-btn ${dietaryFilter.includes(value) ? 'active' : ''}`}
              onClick={() => handleDietaryToggle(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div id="answer-box">
        {loading && (
          <div className="loading-row">
            <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
          </div>
        )}
        {!loading && error && <p className="no-results">{error}</p>}
        {!loading && svdError && <p className="no-results svd-error">{svdError}</p>}
        {!loading && !error && !svdError && searched && results.length === 0 && (
          <p className="no-results">No restaurants matched your query. Try different keywords or a different city.</p>
        )}
        {!loading && !error && !svdError && (
          <>
            {searchMode === 'svd' && <ConceptPanel concepts={svdConcepts} />}
            {results.map((r, i) => <RestaurantCard key={i} r={r} />)}
          </>
        )}
      </div>
    </div>
  )
}

export default App
