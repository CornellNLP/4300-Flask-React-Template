import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { Exercise } from './types'
import Chat from './Chat'
import bgImage from './assets/gym_background.png'

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  // const [episodes, setEpisodes] = useState<Episode[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  useEffect(() => {
    document.body.style.backgroundImage = `url(${bgImage})`
    document.body.style.backgroundSize = 'cover'
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundRepeat = 'no-repeat'
    document.body.style.backgroundAttachment = 'fixed'
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    if (value.trim() === '') { setExercises([]); return }
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: value }),
    })
    const data = await res.json()
    setExercises(data.results)
  }

  if (useLlm === null) return <></>

  return (
    <div
  className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}
>
      {/* Search bar (always shown) */}
      <div className="top-text">
        <h1 className="site-title">Athletic Training Finder</h1>
        <div className="site-description-box">
          <p className="site-description">Athletic Training Finder is a system that enables users to find the most optimal and efficient drills and/or exercises for their desired athletic, health, or fitness goals. Users can input a query describing their goals in their training and what they would like to improve, and this program will return a ranked list of relevant workout plans, drills, and routines relevant to their goals. In addition to this ranked list, users will also receive instructions for each exercise, as well as its relevance to the overall workout plan.</p>
        </div>
        <div className="input-box" onClick={() => document.getElementById('search-input')?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id="search-input"
            placeholder='Search for a Workout (e.g. "Hypertrophy training for chest", "Increasing vertical jump for basketball", etc.'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchTerm) }}
          />
        </div>
        <button className="search-btn" onClick={() => handleSearch(searchTerm)}>Search</button>
      </div>

      {/* Show Results for Kardashians, Not Needed Anymore */}
      {/* <div id="answer-box">
        {episodes.map((episode, index) => (
          <div key={index} className="episode-item">
            <h3 className="episode-title">Name: {episode.title}</h3>
            <p className="episode-desc">Description: {episode.descr}</p>
            <p className="episode-rating">IMDB Rating: {episode.imdb_rating}</p>
          </div>
        ))}
      </div> */}

      {/* IN PROGRESS BY DYLAN: Made something decently usable for now, just need to add similarity measures and such */}
      <div id="workout-answers">
        {exercises.map((exercise, index) => (
          <div key={index} className="episode-item">
            <h3 className="exercise-title">{index + 1}. {exercise.name}</h3>
            <p className="exercise-field"><strong>Score:</strong> {exercise.score.toFixed(4)}</p>
            <p className="exercise-field"><strong>Primary Muscles:</strong> {exercise.primaryMuscles.join(', ')}</p>
            {exercise.secondaryMuscles.length > 0 && <p className="exercise-field"><strong>Secondary Muscles:</strong> {exercise.secondaryMuscles.join(', ')}</p>}
            {exercise.category && <p className="exercise-field"><strong>Category:</strong> {exercise.category}</p>}
            {exercise.level && <p className="exercise-field"><strong>Level:</strong> {exercise.level}</p>}
            {exercise.equipment && <p className="exercise-field"><strong>Equipment:</strong> {exercise.equipment}</p>}
            {exercise.instructions.length > 0 && (
              <details className="exercise-instructions">
                <summary><strong>Instructions</strong></summary>
                <ol>
                  {exercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </details>
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
