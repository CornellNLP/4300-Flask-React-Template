import { useMemo, useState } from 'react'
import { Podcast } from './types'
import './ResultComponent.css'

interface ResultComponentProps {
  podcasts: Podcast[]
}

function ResultComponent({ podcasts }: ResultComponentProps): JSX.Element {
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null)

  // sometimes we get the html description, so this is to eliminate the html tags and receive only the textual content
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

  const getGenres = (podcast: Podcast): string[] => {
    const categories = podcast.categories as unknown

    if (Array.isArray(categories)) {
      return categories.map(category => String(category).trim()).filter(Boolean)
    }

    if (typeof categories === 'string') {
      return categories
        .split('|')
        .map(category => category.trim())
        .filter(Boolean)
    }

    return []
  }

  // TODO: in future use LLM to generate personalized summaries for this?
  const buildWhyYouLoveIt = (podcast: Podcast): string => {
    const genres = getGenres(podcast)
    const topGenres = genres.slice(0, 3).join(', ')
    const scoreText = podcast.score !== undefined ? ` with a similarity score of ${podcast.score.toFixed(3)}` : ''

    if (topGenres) {
      return `This show aligns with your interest in ${topGenres}${scoreText}.`
    }

    return `This recommendation matches your query intent${scoreText}.`
  }

  const selectedGenres = useMemo(
    () => (selectedPodcast ? getGenres(selectedPodcast) : []),
    [selectedPodcast],
  )

  const selectedDescription = useMemo(() => {
    if (!selectedPodcast?.description) {
      return 'No description available.'
    }

    const normalized = htmlToText(selectedPodcast.description)
    return normalized || 'No description available.'
  }, [selectedPodcast])

  const closeModal = (): void => {
    setSelectedPodcast(null)
  }

  const formatAvgEpisodeTime = (minutes?: number): string => {
    if (minutes === undefined || minutes === null || Number.isNaN(minutes)) {
      return 'N/A'
    }

    return `${minutes.toFixed(1)} min`
  }

  return (
    <>
      <div className="results-container">
        {podcasts.map((podcast, index) => {
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
                  <span className="podcast-score">{podcast.score.toFixed(3)}</span>
                )}
              </div>

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

      {selectedPodcast && (
        <div className="podcast-modal-overlay" onClick={closeModal}>
          <div className="podcast-modal" onClick={event => event.stopPropagation()}>
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

            <p className="modal-description">{selectedDescription}</p>

            <div className="modal-why">
              <h3>Podcast Details</h3>
              <p>Episode count: {selectedPodcast.episode_count ?? 'N/A'}</p>
              <p>Average episode time: {formatAvgEpisodeTime(selectedPodcast.avg_episode_time) ?? 'N/A'}</p>
            </div>

            <div className="modal-why">
              <h3>Why you'd {'<3'} it</h3>
              <p>{buildWhyYouLoveIt(selectedPodcast)}</p>
            </div>

            <div className="modal-actions">
              <a
                href={selectedPodcast.website_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`listen-now-btn ${selectedPodcast.website_url ? '' : 'disabled'}`}
                onClick={event => {
                  if (!selectedPodcast.website_url) {
                    event.preventDefault()
                  }
                }}
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

export default ResultComponent
