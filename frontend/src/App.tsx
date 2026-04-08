import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { Episode } from './types'
import Chat from './Chat'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [episodes, setEpisodes] = useState<Episode[]>([])

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    setSearchTerm(value)
    if (value.trim() === '') { setEpisodes([]); return }
    const response = await fetch(`/api/episodes?title=${encodeURIComponent(value)}`)
    const data: Episode[] = await response.json()
    setEpisodes(data)
  }

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      {/* Search bar (always shown) */}
      <div className="top-text">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            backgroundColor: '#007aff',
            color: 'white',
            padding: '14px 28px',
            borderRadius: '24px',
            borderBottomRightRadius: '6px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontSize: '36px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 122, 255, 0.25)',
            display: 'inline-block',
            letterSpacing: '-0.5px'
          }}>
            Hey Girlie...
          </div>
        </div>
        <p className="project-subtitle">
          Relatable relationship advice from real Reddit posts!
        </p>
        <div className="input-box" onClick={() => document.getElementById('search-input')?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder="Describe your relationship situation and press Enter"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSearch(searchTerm)
              }
            }}
          />
        </div>
      </div>

      {/* Search results (always shown) */}
      <div id="answer-box">
        {episodes.length > 0 && (
          <p className="result-count">Top {episodes.length} matches</p>
        )}
        {episodes.map((episode, index) => (
          <div key={index} className="episode-item">
            <h3 className="episode-title">
              {episode.rank !== undefined ? `#${episode.rank} ` : ''}
              {episode.url ? (
                <a href={episode.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {episode.title}
                </a>
              ) : (
                episode.title
              )}
            </h3>
            <p className="episode-desc">{episode.descr}</p>
            {episode.final_score_pct !== undefined && (
              <p className="episode-rating">Final Score: {episode.final_score_pct.toFixed(2)}%</p>
            )}
            <p className="episode-rating">
              Cosine Similarity Score: {(episode.cosine_similarity ?? episode.similarity_score ?? 0).toFixed(4)}
            </p>
            <p className="episode-rating">
              Upvote Score: {(episode.upvote_score ?? episode.imdb_rating).toFixed(1)}
            </p>
            <p className="episode-rating">
              Number of Comments: {episode.num_comments ?? 0}
            </p>
            
            {episode.radar_strengths && episode.radar_strengths.length > 0 && (
              <div style={{ marginTop: '20px', height: '300px', width: '100%' }}>
                <h4 style={{ textAlign: 'center', marginBottom: '10px', marginTop: '0' }}>SVD Component Strengths</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={episode.radar_strengths}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fontSize: 10 }} />
                    <Radar
                      name="Strength"
                      dataKey="value"
                      stroke="#007aff"
                      fill="#007aff"
                      fillOpacity={0.3}
                      strokeWidth={2}
                      activeDot={{ r: 4 }}
                    />
                    <Tooltip 
                      formatter={(value: any) => typeof value === 'number' ? value.toFixed(3) : value}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && <Chat onSearchTerm={handleSearch} />}
    </div>
  )
}

export default App
