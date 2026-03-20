import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import { Episode, Exercise } from './types'
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
    const [exerciseRes] = await Promise.all([
      fetch(`/api/exercises?q=${encodeURIComponent(value)}`),
    ])
    // setEpisodes(await episodeRes.json())
    setExercises(await exerciseRes.json())
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
            <h3 className="exercise-title">{exercise.title}</h3>
            {exercise.desc && <p className="exercise-desc"><strong>Description:</strong> {exercise.desc}</p>}
            {exercise.Type && <p className="exercise-field"><strong>Type:</strong> {exercise.Type}</p>}
            {exercise.BodyPart && <p className="exercise-field"><strong>Body Part:</strong> {exercise.BodyPart}</p>}
            {exercise.Equipment && <p className="exercise-field"><strong>Equipment:</strong> {exercise.Equipment}</p>}
            {exercise.Level && <p className="exercise-field"><strong>Level:</strong> {exercise.Level}</p>}
            {exercise.Rating && <p className="exercise-field"><strong>Rating:</strong> {exercise.Rating}</p>}
            {exercise.RatingDesc && <p className="exercise-field"><strong>Rating Description:</strong> {exercise.RatingDesc}</p>}
          </div>
        ))}
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && <Chat onSearchTerm={handleSearch} />}
    </div>
  )
}

export default App
