import { useEffect, useState } from 'react'
import './App.css'
import { AiOverview, MatchApiResponse, Podcast, PodcastsApiResponse } from './types'
import { type SearchRequest } from './QueryComponent'
import ResultComponent from './ResultComponent'
import MatchResults from './MatchResults'
import MainLogo from './assets/main_logo.png'
import CollaborativeMode from './CollaborativeMode'
import IndividualMode from './IndividualMode'
import AIOverview from './AIOverview'
import LoadingScreen from './LoadingScreen'

type ListeningMode = 'solo' | 'collab'
type AppView = 'query' | 'results'
type SearchContext =
  | { mode: 'solo'; request: SearchRequest }
  | { mode: 'collab'; user1: SearchRequest; user2: SearchRequest }

const defaultSearchRequest: SearchRequest = {
  query: '',
  explicit: false,
  genres: [],
  excludedGenres: [],
  publisher: '',
  releaseYear: '',
  lengthMetric: 'total_episodes',
  minLength: 0,
  maxLength: 500,
  useLlm: false,
}

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [listeningMode, setListeningMode] = useState<ListeningMode>('solo')
  const [view, setView] = useState<AppView>('query')
  const [podcasts, setPodcasts] = useState<Podcast[]>([])
  const [aiOverview, setAiOverview] = useState<AiOverview | null>(null)
  const [matchPct, setMatchPct] = useState<number>(0)
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  const [chatSeedTerm] = useState<string>('')
  const [soloDraft, setSoloDraft] = useState<SearchRequest>(defaultSearchRequest)
  const [collabDraftUser1, setCollabDraftUser1] = useState<SearchRequest>(defaultSearchRequest)
  const [collabDraftUser2, setCollabDraftUser2] = useState<SearchRequest>(defaultSearchRequest)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (request: SearchRequest): Promise<void> => {
    setSoloDraft(request)
    setSearchContext({ mode: 'solo', request })

  setIsLoading(true)
  try {
    const params = new URLSearchParams()
    params.set('query', request.query)
    if (request.explicit !== undefined) params.set('explicit', String(request.explicit))
    request.genres?.forEach(genre => params.append('genres', genre))
    request.excludedGenres?.forEach(genre => params.append('excludedGenres', genre))
    if (request.publisher?.trim()) params.set('publisher', request.publisher.trim())
    if (request.releaseYear?.trim()) params.set('releaseYear', request.releaseYear.trim())
    if (request.lengthMetric) params.set('lengthMetric', request.lengthMetric)
    if (request.minLength !== undefined) params.set('minLength', String(request.minLength))
    if (request.maxLength !== undefined) params.set('maxLength', String(request.maxLength))
    if (request.useLlm !== undefined) params.set('useLLM', String(request.useLlm))

    const response = await fetch(`/api/podcasts?${params.toString()}`)
    const payload: Podcast[] | PodcastsApiResponse = await response.json()

    if (Array.isArray(payload)) {
      setPodcasts(payload)
      setAiOverview(null)
    } else {
      setPodcasts(payload.results ?? [])
      setAiOverview(payload.ai_overview ?? null)
    }
    setView('results')
  } finally {
    setIsLoading(false)
  }
}

  const handleCollaborativeSearch = async (user1: SearchRequest, user2: SearchRequest, useLlmForSearch: boolean): Promise<void> => {
    setCollabDraftUser1(user1)
    setCollabDraftUser2(user2)
    setSearchContext({ mode: 'collab', user1, user2 })

    if (!user1.query?.trim() || !user2.query?.trim()) {
      setPodcasts([])
      setAiOverview(null)
      setView('query')
      return
    }

    setIsLoading(true)

    const response = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userA: user1, userB: user2, useLLM: useLlmForSearch }),
    })

    if (!response.ok) {
      throw new Error(`Collaborative search failed with status ${response.status}`)
    }

    const data: MatchApiResponse = await response.json()
    setMatchPct(data.match_pct ?? 0)
    setPodcasts(data.results ?? [])
    setAiOverview(data.ai_overview ?? null)
    setView('results')
    setIsLoading(false)
  }

  const handleBackToQuery = (): void => {
    setView('query')
  }

  // const handleChatSearch = async (value: string): Promise<void> => {
  //   setListeningMode('solo')
  //   setChatSeedTerm(value)
  //   await handleSearch({ query: value })
  // }

  const formatLengthMetric = (metric?: SearchRequest['lengthMetric']): string => {
    if (metric === 'duration_ms') return 'Episode Duration (minutes)'
    return 'Total Episodes'
  }

  const formatRequestSummary = (request: SearchRequest): Array<{ label: string; value: string }> => {
    return [
      { label: 'Query', value: request.query || 'N/A' },
      { label: 'Explicit', value: request.explicit ? 'Yes' : 'No' },
      { label: 'Genres', value: request.genres?.length ? request.genres.join(', ') : 'Any' },
      { label: 'Use AI', value: request.useLlm ? 'Yes' : 'No' },
      { label: 'Publisher', value: request.publisher?.trim() || 'Any' },
      { label: 'Year', value: request.releaseYear?.trim() || 'Any' },
      {
        label: 'Length',
        value: `${formatLengthMetric(request.lengthMetric)}: ${request.minLength ?? 0} - ${request.maxLength ?? 500}`,
      },
    ]
  }

  const renderSummaryCard = (title: string, request: SearchRequest): JSX.Element => (
    <div className="search-summary-card">
      {/* <h4>{title}</h4> */}
      <div className="search-summary-grid">
        {formatRequestSummary(request).map(item => (
          <div key={`${title}-${item.label}`} className="search-summary-item">
            <span className="search-summary-label">{item.label}</span>
            <span className="search-summary-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSearchSummary = (): JSX.Element | null => {
    if (!searchContext) return null

    if (searchContext.mode === 'solo') {
      return renderSummaryCard('Your Search', searchContext.request)
    }

    return (
      <div className="search-summary-stack">
        <div className="search-summary-collab-wrap">
          {renderSummaryCard('User 1 Preferences', searchContext.user1)}
          {renderSummaryCard('User 2 Preferences', searchContext.user2)}
        </div>
      </div>
    )
  }

  if (useLlm === null) return <></>

  return (
    <div className="page-root">
      <LoadingScreen isVisible={isLoading} />
      <div className={`centered-app-shell ${view === 'query' && listeningMode === 'solo' ? 'solo-fullscreen-shell' : ''}`}>
        <header className="main-header">
          <div className="main-logo">
            <img src={MainLogo} alt="Peas in a Podcast logo" className="main-logo-img" />
          </div>
          {view === 'query' && <div className="main-subtitle">Today, I'm listening...</div>}
        </header>

        {view === 'query' && (
          <div className={`mode-toggle-row ${listeningMode === 'solo' ? 'solo-toggle-row' : 'collab-toggle-row'}`}>
            <button
              className={`mode-toggle left${listeningMode === 'solo' ? ' active' : ''}`}
              onClick={() => setListeningMode('solo')}
              type="button"
            >
              by myself
            </button>
            <button
              className={`mode-toggle right${listeningMode === 'collab' ? ' active' : ''}`}
              onClick={() => setListeningMode('collab')}
              type="button"
            >
              with my bestie
            </button>
          </div>
        )}

        <div className="main-panel">
          {view === 'query' && (
            <>
              {listeningMode === 'solo' ? (
                <IndividualMode
                  onSearch={handleSearch}
                  initialQuery={chatSeedTerm}
                  draft={soloDraft}
                  onDraftChange={setSoloDraft}
                  llmAvailable={Boolean(useLlm)}
                />
              ) : (
                <CollaborativeMode
                  onCollaborativeSearch={handleCollaborativeSearch}
                  initialUser1={collabDraftUser1}
                  initialUser2={collabDraftUser2}
                  llmAvailable={Boolean(useLlm)}
                  onDraftChange={(user1, user2) => {
                    setCollabDraftUser1(user1)
                    setCollabDraftUser2(user2)
                  }}
                />
              )}
            </>
          )}

          {view === 'results' && (
            <div className="results-area">
              {aiOverview && <AIOverview overview={aiOverview} />}
              <div className="search-summary-panel">
                <h3>Your Search Breakdown</h3>
                {renderSearchSummary()}
              </div>
              <div className="results-toolbar">
                <button type="button" className="back-button" onClick={handleBackToQuery}>
                  Back to Search
                </button>
              </div>
              <div id="answer-box">
                {podcasts.length > 0 ? (
                  listeningMode === 'collab' ? (
                    <MatchResults
                      matchPct={matchPct}
                      results={podcasts}
                      // combinedQuery={searchContext?.mode === 'collab'
                      //   ? [searchContext.user1.query?.trim(), searchContext.user2.query?.trim()].filter(Boolean).join(' + ')
                      //   : undefined}
                    />
                  ) : (
                    <ResultComponent podcasts={podcasts} />
                  )
                ) : (
                  <p className="no-results">No podcasts found for this search.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* {useLlm && <Chat onSearchTerm={handleChatSearch} />} */}
      </div>
    </div>
  )
}

export default App
