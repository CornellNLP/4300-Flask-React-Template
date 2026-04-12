import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import {
  Exercise,
  Program,
  ProgramScheduleEntry,
  EQUIPMENT_OPTIONS,
  DIFFICULTY_OPTIONS,
  MUSCLE_OPTIONS,
} from './types'
import Chat from './Chat'
import bgImage from './assets/gym_background.png'

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'exercises' | 'programs'>('exercises')
  const [searchTerm, setSearchTerm] = useState<string>('')
  // const [episodes, setEpisodes] = useState<Episode[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<string>('')
  const [injuries, setInjuries] = useState<string[]>([])
  const [showInjuries, setShowInjuries] = useState<boolean>(false)
  const [programSearchTerm, setProgramSearchTerm] = useState<string>('')
  const [programs, setPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState<boolean>(false)

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

  const handleSearch = async (
    value: string,
    overrides?: { equipment?: string[]; difficulty?: string; injuries?: string[] },
  ): Promise<void> => {
    if (value.trim() === '') { setExercises([]); return }
    const eq = overrides?.equipment ?? selectedEquipment
    const diff = overrides?.difficulty ?? difficulty
    const inj = overrides?.injuries ?? injuries
    const body: Record<string, unknown> = { query: value }
    if (eq.length > 0) body.equipment = eq
    if (diff) body.difficulty = diff
    if (inj.length > 0) body.injuries = inj
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setExercises(data.results)
  }

  const toggleEquipment = (value: string): void => {
    const next = selectedEquipment.includes(value)
      ? selectedEquipment.filter(v => v !== value)
      : [...selectedEquipment, value]
    setSelectedEquipment(next)
    if (searchTerm.trim() !== '') handleSearch(searchTerm, { equipment: next })
  }

  const changeDifficulty = (value: string): void => {
    setDifficulty(value)
    if (searchTerm.trim() !== '') handleSearch(searchTerm, { difficulty: value })
  }

  const toggleInjury = (value: string): void => {
    const next = injuries.includes(value)
      ? injuries.filter(v => v !== value)
      : [...injuries, value]
    setInjuries(next)
    if (searchTerm.trim() !== '') handleSearch(searchTerm, { injuries: next })
  }

  const handleProgramSearch = async (value: string): Promise<void> => {
    if (value.trim() === '') { setPrograms([]); return }
    setProgramsLoading(true)
    try {
      const res = await fetch('/api/search_programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value }),
      })
      const data = await res.json()
      setPrograms(data.results)
    } finally {
      setProgramsLoading(false)
    }
  }

  const formatReps = (entry: ProgramScheduleEntry): string => {
    if (entry.sets == null || entry.reps == null) return ''
    const sets = Number.isInteger(entry.sets) ? entry.sets : entry.sets.toFixed(1)
    const reps = Number.isInteger(entry.reps) ? entry.reps : entry.reps.toFixed(1)
    const suffix = entry.rep_type === 'seconds' ? 's' : ''
    return ` — ${sets}×${reps}${suffix}`
  }

  const groupScheduleByWeekDay = (
    schedule: ProgramScheduleEntry[],
  ): Array<{ week: number | null; days: Array<{ day: number | null; entries: ProgramScheduleEntry[] }> }> => {
    const weekMap = new Map<number | null, Map<number | null, ProgramScheduleEntry[]>>()
    for (const entry of schedule) {
      if (!weekMap.has(entry.week)) weekMap.set(entry.week, new Map())
      const dayMap = weekMap.get(entry.week)!
      if (!dayMap.has(entry.day)) dayMap.set(entry.day, [])
      dayMap.get(entry.day)!.push(entry)
    }
    const sortKey = (v: number | null): number => v ?? Number.POSITIVE_INFINITY
    return [...weekMap.entries()]
      .sort((a, b) => sortKey(a[0]) - sortKey(b[0]))
      .map(([week, dayMap]) => ({
        week,
        days: [...dayMap.entries()]
          .sort((a, b) => sortKey(a[0]) - sortKey(b[0]))
          .map(([day, entries]) => ({ day, entries })),
      }))
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
        <div className="tab-bar">
          <button
            type="button"
            className={`tab-button ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            Exercises
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'programs' ? 'active' : ''}`}
            onClick={() => setActiveTab('programs')}
          >
            Workout Programs
          </button>
        </div>

        {activeTab === 'exercises' && (
        <>
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

        <div className="filters-panel">
          <div className="filter-group">
            <label className="filter-label">Equipment</label>
            <div className="filter-chips">
              {EQUIPMENT_OPTIONS.map(opt => (
                <label key={opt} className={`filter-chip ${selectedEquipment.includes(opt) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedEquipment.includes(opt)}
                    onChange={() => toggleEquipment(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="difficulty-select">Difficulty</label>
            <select
              id="difficulty-select"
              value={difficulty}
              onChange={(e) => changeDifficulty(e.target.value)}
            >
              <option value="">Any</option>
              {DIFFICULTY_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <button
              type="button"
              className="filter-toggle"
              onClick={() => setShowInjuries(s => !s)}
            >
              {showInjuries ? '− ' : '+ '}Injured muscles to avoid
              {injuries.length > 0 && ` (${injuries.length})`}
            </button>
            {showInjuries && (
              <div className="filter-chips">
                {MUSCLE_OPTIONS.map(opt => (
                  <label key={opt} className={`filter-chip ${injuries.includes(opt) ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={injuries.includes(opt)}
                      onChange={() => toggleInjury(opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {activeTab === 'programs' && (
        <>
        <div className="input-box" onClick={() => document.getElementById('program-search-input')?.focus()}>
          <img src={SearchIcon} alt="search" />
          <input
            id="program-search-input"
            placeholder='Search for a Program (e.g. "beginner powerlifting", "8 week bodybuilding split", etc.)'
            value={programSearchTerm}
            onChange={(e) => setProgramSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleProgramSearch(programSearchTerm) }}
          />
        </div>
        <button className="search-btn" onClick={() => handleProgramSearch(programSearchTerm)}>Search</button>
        </>
        )}
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
      {activeTab === 'exercises' && (
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
      )}

      {activeTab === 'programs' && programsLoading && (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="loading-text">
          {programs.length === 0
            ? 'Loading programs index... (first search may take up to ~25 seconds)'
            : 'Searching programs...'}
        </p>
      </div>
      )}

      {activeTab === 'programs' && !programsLoading && (
      <div id="workout-answers">
        {programs.map((program, index) => (
          <div key={index} className="episode-item">
            <h3 className="exercise-title">{index + 1}. {program.title}</h3>
            <p className="exercise-field"><strong>Score:</strong> {program.score.toFixed(4)}</p>
            {program.level && <p className="exercise-field"><strong>Level:</strong> {program.level}</p>}
            {program.program_length_weeks != null && (
              <p className="exercise-field"><strong>Length:</strong> {program.program_length_weeks} weeks</p>
            )}
            {program.goal.length > 0 && (
              <p className="exercise-field"><strong>Goals:</strong> {program.goal.join(', ')}</p>
            )}
            {program.description && (
              <details className="exercise-instructions">
                <summary><strong>Description</strong></summary>
                <p>{program.description}</p>
              </details>
            )}
            {program.schedule.length > 0 && (
              <details className="exercise-instructions">
                <summary><strong>Schedule</strong></summary>
                {groupScheduleByWeekDay(program.schedule).map((weekGroup, wi) => (
                  <div key={wi} className="schedule-week">
                    <p><strong>Week {weekGroup.week ?? '?'}</strong></p>
                    {weekGroup.days.map((dayGroup, di) => (
                      <div key={di} className="schedule-day">
                        <p><em>Day {dayGroup.day ?? '?'}</em></p>
                        <ul>
                          {dayGroup.entries.map((entry, ei) => (
                            <li key={ei}>{entry.exercise_name}{formatReps(entry)}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </details>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {useLlm && <Chat onSearchTerm={handleSearch} />}
    </div>
  )
}

export default App
