import { useMemo, useState } from 'react'
import { Podcast } from './types'
import DimensionRadarChart from './DimensionRadarChart'
import './MatchResults.css'

interface MatchPodcast extends Podcast {
  score_for_a?: number
  score_for_b?: number
}

interface MatchResultsProps {
  matchPct: number
  results: MatchPodcast[]
}

function MatchResults({ matchPct, results }: MatchResultsProps): JSX.Element {
  const [selectedPodcast, setSelectedPodcast] = useState<MatchPodcast | null>(null)

  const htmlToText = (value: string): string => {
    const trimmedValue = value.trim()
    if (!trimmedValue) return ''
    try {
      const parser = new DOMParser()
      const parsed = parser.parseFromString(trimmedValue, 'text/html')
      return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim()
    } catch {
      return trimmedValue.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  const getGenres = (podcast: MatchPodcast): string[] => {
    const categories = podcast.categories as unknown
    if (Array.isArray(categories)) {
      return categories.map(c => String(c).trim()).filter(Boolean)
    }
    if (typeof categories === 'string') {
      return categories.split('|').map(c => c.trim()).filter(Boolean)
    }
    return []
  }

  const buildWhyBothLoveIt = (podcast: MatchPodcast): string => {
    const genres = getGenres(podcast)
    const topGenres = genres.slice(0, 3).join(', ')
    const scoreA = podcast.score_for_a !== undefined ? (podcast.score_for_a * 100).toFixed(0) : null
    const scoreB = podcast.score_for_b !== undefined ? (podcast.score_for_b * 100).toFixed(0) : null

    let base = topGenres
      ? `This show aligns with both of your interests in ${topGenres}.`
      : `This recommendation matches both of your query intents.`

    if (scoreA && scoreB) {
      base += ` Person A: ${scoreA}% match · Person B: ${scoreB}% match.`
    }

    return base
  }

  const getWhyBothLoveIt = (podcast: MatchPodcast): string => {
    return podcast.why_you_love_it?.trim() || buildWhyBothLoveIt(podcast)
  }

  const matchLabel = useMemo(() => {
    if (matchPct >= 85) return 'You two are podcast soulmates 🎧'
    if (matchPct >= 65) return 'Great taste overlap!'
    if (matchPct >= 45) return 'Some common ground'
    return 'Opposites attract?'
  }, [matchPct])

  // Determine ring color class based on match percentage
  const ringClass = useMemo(() => {
    if (matchPct >= 85) return 'ring-high'
    if (matchPct >= 65) return 'ring-mid'
    if (matchPct >= 45) return 'ring-low'
    return 'ring-very-low'
  }, [matchPct])

  const selectedGenres = useMemo(
    () => (selectedPodcast ? getGenres(selectedPodcast) : []),
    [selectedPodcast],
  )

  const selectedDescription = useMemo(() => {
    if (!selectedPodcast?.description) return 'No description available.'
    const normalized = htmlToText(selectedPodcast.description)
    return normalized || 'No description available.'
  }, [selectedPodcast])

  const closeModal = (): void => setSelectedPodcast(null)

  const formatAvgEpisodeTime = (minutes?: number | string): string => {
    if (typeof minutes === 'string') {
      return minutes
    }

    if (minutes === undefined || minutes === null || Number.isNaN(minutes)) {
      return 'N/A'
    }

    return `${minutes.toFixed(1)} min`
  }

  return (
    <>
      {/* ── Match score hero ─────────────────────────────────────────── */}
      <div className="match-hero">
        <div className={`match-ring ${ringClass}`}>
          <svg viewBox="0 0 120 120" className="match-ring-svg" aria-hidden="true">
            <circle cx="60" cy="60" r="52" className="ring-track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="ring-fill"
              strokeDasharray={`${(matchPct / 100) * 326.7} 326.7`}
            />
          </svg>
          <div className="match-ring-inner">
            <span className="match-pct">{matchPct.toFixed(0)}<span className="match-pct-symbol">%</span></span>
          </div>
        </div>
        <p className="match-label">{matchLabel}</p>
      </div>
      <div className="results-heading-wrap">
        <h2 className="results-heading">Here are {Math.min(results.length, 5)} podcasts for you</h2>
      </div>

      {/* ── Results grid — same structure as ResultComponent ─────────── */}
      <div className="results-container">
        {results.map((podcast, index) => {
          const genres = getGenres(podcast)
          return (
            <button
              type="button"
              key={index}
              className="podcast-card"
              onClick={() => setSelectedPodcast(podcast)}
              aria-label={`Open details for ${podcast.title}`}
            >
              {podcast.image_url ? (
                <img src={podcast.image_url} alt={podcast.title} className="podcast-image" />
              ) : (
                <div className="podcast-image image-placeholder">No Image</div>
              )}

              <div className="title-score-row">
                <h2 className="podcast-title">{podcast.title}</h2>
                {podcast.score !== undefined && (
                  <span className="podcast-score">{podcast.score.toFixed(0)}%</span>
                )}
              </div>

              {/* Per-user mini scores */}
              {(podcast.score_for_a !== undefined || podcast.score_for_b !== undefined) && (
                <div className="user-scores">
                  {podcast.score_for_a !== undefined && (
                    <span className="user-score user-score-a">
                      A {(podcast.score_for_a * 100).toFixed(0)}%
                    </span>
                  )}
                  {podcast.score_for_b !== undefined && (
                    <span className="user-score user-score-b">
                      B {(podcast.score_for_b * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}

              {genres.length > 0 && (
                <div className="genre-tags compact-tags">
                  {genres.slice(0, 4).map((genre, i) => (
                    <span key={i} className="tag">{genre}</span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Modal — same structure as ResultComponent ─────────────────── */}
      {selectedPodcast && (
        <div className="podcast-modal-overlay" onClick={closeModal}>
          <div className="podcast-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Close details">
              x
            </button>

            <h2 className="modal-title">{selectedPodcast.title}</h2>

            {selectedGenres.length > 0 && (
              <div className="genre-tags modal-tags">
                {selectedGenres.map((genre, i) => (
                  <span key={i} className="tag">{genre}</span>
                ))}
              </div>
            )}

            {/* Per-user scores in modal */}
            {(selectedPodcast.score_for_a !== undefined || selectedPodcast.score_for_b !== undefined) && (
              <div className="modal-user-scores">
                {selectedPodcast.score_for_a !== undefined && (
                  <div className="modal-user-score">
                    <span className="modal-user-label">Person A</span>
                    <span className="modal-user-bar-wrap">
                      <span
                        className="modal-user-bar modal-user-bar-a"
                        style={{ width: `${(selectedPodcast.score_for_a * 100).toFixed(0)}%` }}
                      />
                    </span>
                    <span className="modal-user-val">{(selectedPodcast.score_for_a * 100).toFixed(0)}%</span>
                  </div>
                )}
                {selectedPodcast.score_for_b !== undefined && (
                  <div className="modal-user-score">
                    <span className="modal-user-label">Person B</span>
                    <span className="modal-user-bar-wrap">
                      <span
                        className="modal-user-bar modal-user-bar-b"
                        style={{ width: `${(selectedPodcast.score_for_b * 100).toFixed(0)}%` }}
                      />
                    </span>
                    <span className="modal-user-val">{(selectedPodcast.score_for_b * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            )}

            <p className="modal-description">{selectedDescription}</p>

            <div className="modal-why">
              <h3>Podcast Details</h3>
              <p>Episode count: {selectedPodcast.episode_count ?? 'N/A'}</p>
              <p>Average episode time: {formatAvgEpisodeTime(selectedPodcast.avg_episode_time)}</p>
            </div>

            <div className="modal-why">
              <h3>Why you'd {'<3'} it together</h3>
              <p>{getWhyBothLoveIt(selectedPodcast)}</p>
            </div>

            {selectedPodcast.top_dimensions &&
              (selectedPodcast.top_dimensions.positive?.length > 0 || selectedPodcast.top_dimensions.negative?.length > 0) && (
                <DimensionRadarChart dimensions={selectedPodcast.top_dimensions} />
              )}

            <div className="modal-actions">
              <a
                href={selectedPodcast.website_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`listen-now-btn ${selectedPodcast.website_url ? '' : 'disabled'}`}
                onClick={e => { if (!selectedPodcast.website_url) e.preventDefault() }}
              >
                ♪ Listen Now
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default MatchResults