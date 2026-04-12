import { useMemo, useState } from 'react'
import SearchIcon from './assets/mag.png'
import './QueryComponent.css'

export interface SearchRequest {
  query: string
  explicit?: boolean
  genres?: string[]
  excludedGenres?: string[]
  publisher?: string
  releaseYear?: string
  lengthMetric?: 'duration_ms' | 'total_episodes'
  minLength?: number
  maxLength?: number
}

interface QueryComponentProps {
  onSearch: (request: SearchRequest) => Promise<void> | void
  initialQuery?: string
  initialRequest?: SearchRequest
  onDraftChange?: (request: SearchRequest) => void
  showSubmit?: boolean
  radioNamePrefix?: string
}

function QueryComponent({
  onSearch,
  initialQuery = '',
  initialRequest,
  onDraftChange,
  showSubmit = true,
  radioNamePrefix = 'solo',
}: QueryComponentProps): JSX.Element {
  const defaultMinLength = 0
  const defaultMaxLength = 500

  const [query, setQuery] = useState<string>(initialRequest?.query ?? initialQuery)
  const [isExplicit, setIsExplicit] = useState<boolean>(initialRequest?.explicit ?? false)
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialRequest?.genres ?? [])
  const [lengthMetric, setLengthMetric] = useState<'duration_ms' | 'total_episodes'>(initialRequest?.lengthMetric ?? 'total_episodes')
  const [minLength, setMinLength] = useState<number>(initialRequest?.minLength ?? defaultMinLength)
  const [maxLength, setMaxLength] = useState<number>(initialRequest?.maxLength ?? defaultMaxLength)
  const [publisher, setPublisher] = useState<string>(initialRequest?.publisher ?? '')
  const [releaseYear, setReleaseYear] = useState<string>(initialRequest?.releaseYear ?? '')

  // TODO: can change this with more experimentation
  const genreOptions = useMemo(  
    () => [
      'Comedy',
      'News',
      'Technology',
      'Education',
      'Business',
      'Health',
      'Sports',
      'History',
      'Science',
      'True Crime',
      'Music',
      'Society',
    ],
    [],
  )

  const emitDraftChange = (nextRequest: Partial<SearchRequest>): void => {
    if (!onDraftChange) return

    onDraftChange({
      query,
      explicit: isExplicit,
      genres: selectedGenres,
      publisher,
      releaseYear,
      lengthMetric,
      minLength,
      maxLength,
      ...nextRequest,
    })
  }

  const handleGenreToggle = (genre: string): void => {
    setSelectedGenres(prev => {
      const nextGenres = prev.includes(genre) ? prev.filter(item => item !== genre) : [...prev, genre]
      emitDraftChange({ genres: nextGenres })
      return nextGenres
    })
  }

  const handleGenreRemove = (genre: string): void => {
    setSelectedGenres(prev => {
      const nextGenres = prev.filter(item => item !== genre)
      emitDraftChange({ genres: nextGenres })
      return nextGenres
    })
  }

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    await onSearch({
      query,
      explicit: isExplicit,
      genres: selectedGenres,
      publisher,
      releaseYear,
      lengthMetric,
      minLength,
      maxLength,
    })
  }

  const formFields = (
    <>
      <div className="solo-query-row">
        <label className="solo-label required">Query</label>
        <div className="input-box query-input-box">
          <img src={SearchIcon} alt="search" />
          <input
            className="solo-input"
            value={query}
            placeholder="Health Podcasts"
            onChange={event => {
              const nextQuery = event.target.value
              setQuery(nextQuery)
              emitDraftChange({ query: nextQuery })
            }}
            required
          />
        </div>
      </div>
      <div className="solo-fields-grid">
        <div className="solo-explicit">
          <label className="solo-label required">Explicit?</label>
          <div className="solo-explicit-options">
            <label><input type="radio" name={`${radioNamePrefix}-explicit`} value="no" checked={!isExplicit} onChange={() => {
              setIsExplicit(false)
              emitDraftChange({ explicit: false })
            }} /> No</label>
            <label><input type="radio" name={`${radioNamePrefix}-explicit`} value="yes" checked={isExplicit} onChange={() => {
              setIsExplicit(true)
              emitDraftChange({ explicit: true })
            }} /> Yes</label>
          </div>
        </div>
        <div className="solo-genres">
          <label className="solo-label">Genres</label>
          <div className="genre-selected-chips" aria-live="polite">
            {selectedGenres.map(genre => (
              <span key={genre} className="genre-chip">
                <span>{genre}</span>
                <button
                  type="button"
                  className="genre-chip-remove"
                  onClick={() => handleGenreRemove(genre)}
                  aria-label={`Remove ${genre}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="genre-checklist" role="group" aria-label="Genres">
            {genreOptions.map(genre => (
              <label key={genre} className="genre-check-item">
                <input
                  type="checkbox"
                  checked={selectedGenres.includes(genre)}
                  onChange={() => handleGenreToggle(genre)}
                />
                <span>{genre}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="solo-length">
          <label className="solo-label">Length Metric</label>
          <select className="solo-select" value={lengthMetric} onChange={event => {
            const nextLengthMetric = event.target.value as 'duration_ms' | 'total_episodes'
            setLengthMetric(nextLengthMetric)
            emitDraftChange({ lengthMetric: nextLengthMetric })
          }}>
            <option value="duration_ms">Episode Duration (minutes)</option>
            <option value="total_episodes">Total Episodes</option>
          </select>
          <label className="solo-label">Minimum Value</label>
          <input
            className="solo-input"
            type="number"
            min={defaultMinLength}
            max={defaultMaxLength}
            value={minLength}
            onChange={event => {
              const nextMin = Math.max(defaultMinLength, Number(event.target.value) || defaultMinLength)
              const nextValue = Math.min(nextMin, maxLength)
              setMinLength(nextValue)
              emitDraftChange({ minLength: nextValue })
            }}
          />
          <label className="solo-label">Maximum Value</label>
          <input
            className="solo-input"
            type="number"
            min={defaultMinLength}
            max={defaultMaxLength}
            value={maxLength}
            onChange={event => {
              const nextMax = Math.min(defaultMaxLength, Number(event.target.value) || defaultMaxLength)
              const nextValue = Math.max(nextMax, minLength)
              setMaxLength(nextValue)
              emitDraftChange({ maxLength: nextValue })
            }}
          />
        </div>
        <div className="solo-year">
          <label className="solo-label">Year</label>
          <input className="solo-input" type="number" min={1900} max={2100} placeholder="2024" value={releaseYear} onChange={event => {
            const nextReleaseYear = event.target.value
            setReleaseYear(nextReleaseYear)
            emitDraftChange({ releaseYear: nextReleaseYear })
          }} />
        </div>
        <div className="solo-publisher">
          <label className="solo-label">Publisher</label>
          <input className="solo-input" type="text" placeholder="NPR" value={publisher} onChange={event => {
            const nextPublisher = event.target.value
            setPublisher(nextPublisher)
            emitDraftChange({ publisher: nextPublisher })
          }} />
        </div>
      </div>
      {showSubmit && (
        <div className="solo-search-row">
          <button type="submit" className="solo-search-btn">SEARCH</button>
        </div>
      )}
    </>
  )

  if (!showSubmit) {
    return <div className="solo-form-card">{formFields}</div>
  }

  return (
    <form onSubmit={handleSubmit} className="solo-form-card">
      {formFields}
    </form>
  )
}

export default QueryComponent
