import { useEffect, useMemo, useState } from 'react'
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
  title: string
  idPrefix: string
  onSearch: (request: SearchRequest) => Promise<void> | void
  initialQuery?: string
}

function QueryComponent({ title, idPrefix, onSearch, initialQuery = '' }: QueryComponentProps): JSX.Element {
  const defaultMinLength = 0
  const defaultMaxLength = 500

  const [query, setQuery] = useState<string>(initialQuery)
  const [isExplicit, setIsExplicit] = useState<boolean>(false)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [lengthMetric, setLengthMetric] = useState<'duration_ms' | 'total_episodes'>('total_episodes')
  const [minLength, setMinLength] = useState<number>(defaultMinLength)
  const [maxLength, setMaxLength] = useState<number>(defaultMaxLength)
  const [publisher, setPublisher] = useState<string>('')
  const [releaseYear, setReleaseYear] = useState<string>('')

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

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const handleGenreChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const values = Array.from(event.target.selectedOptions, option => option.value)
    setSelectedGenres(values)
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

  return (
    <section className="query-component">
      <h2 className="query-title">{title}</h2>

      <form onSubmit={handleSubmit}>
        <label htmlFor={`${idPrefix}-query`} className="query-label required">User Query Search Bar</label>
        <div className="input-box query-input-box" onClick={() => document.getElementById(`${idPrefix}-query`)?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id={`${idPrefix}-query`}
            placeholder="Healthy lifestyle podcasts..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            required
          />
          <button type="submit" className="query-submit">Search</button>
        </div>

        <div className="form-grid">
          <div className="field-block">
            <p className="query-label">Allow profanity or NSFW?</p>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${!isExplicit ? 'active' : ''}`}
                onClick={() => setIsExplicit(false)}
              >
                No
              </button>
              <button
                type="button"
                className={`toggle-btn ${isExplicit ? 'active' : ''}`}
                onClick={() => setIsExplicit(true)}
              >
                Yes
              </button>
              <span className="required"></span>
            </div>
          </div>

          <div className="field-block">
            <label htmlFor={`${idPrefix}-genres`} className="query-label">Genres (multi-select using Ctrl/CMD)</label>
            <select
              id={`${idPrefix}-genres`}
              multiple
              value={selectedGenres}
              onChange={handleGenreChange}
              className="query-select"
            >
              {genreOptions.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          <div className="field-block">
            <label htmlFor={`${idPrefix}-length-metric`} className="query-label">Podcast Length Metric</label>
            <select
              id={`${idPrefix}-length-metric`}
              value={lengthMetric}
              onChange={event => setLengthMetric(event.target.value as 'duration_ms' | 'total_episodes')}
              className="query-select"
            >
              <option value="total_episodes">Number of Episodes</option>
              <option value="duration_ms">Episode Duration</option>
            </select>
            <label htmlFor={`${idPrefix}-min-length`} className="query-label subtle-label">Minimum Value</label>
            <input
              id={`${idPrefix}-min-length`}
              type="number"
              min={defaultMinLength}
              max={defaultMaxLength}
              value={minLength}
              onChange={event => {
                const nextMin = Math.max(defaultMinLength, Number(event.target.value) || defaultMinLength)
                setMinLength(Math.min(nextMin, maxLength))
              }}
              className="query-text-input"
            />
            <label htmlFor={`${idPrefix}-max-length`} className="query-label subtle-label">Maximum Value</label>
            <input
              id={`${idPrefix}-max-length`}
              type="number"
              min={defaultMinLength}
              max={defaultMaxLength}
              value={maxLength}
              onChange={event => {
                const nextMax = Math.min(defaultMaxLength, Number(event.target.value) || defaultMaxLength)
                setMaxLength(Math.max(nextMax, minLength))
              }}
              className="query-text-input"
            />
          </div>

          <div className="field-block">
            <label htmlFor={`${idPrefix}-publisher`} className="query-label">Podcast Publisher</label>
            <input
              id={`${idPrefix}-publisher`}
              type="text"
              placeholder="Publisher name"
              value={publisher}
              onChange={event => setPublisher(event.target.value)}
              className="query-text-input"
            />
          </div>

          <div className="field-block">
            <label htmlFor={`${idPrefix}-year`} className="query-label">Year of Release</label>
            <input
              id={`${idPrefix}-year`}
              type="number"
              min={1900}
              max={2100}
              placeholder="e.g. 2024"
              value={releaseYear}
              onChange={event => setReleaseYear(event.target.value)}
              className="query-text-input"
            />
          </div>
        </div>
      </form>
    </section>
  )
}

export default QueryComponent
