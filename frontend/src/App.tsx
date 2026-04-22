import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import {
  Exercise,
  FormCue,
  MatchQuality,
  Program,
  ProgramScheduleEntry,
  SearchMethod,
  EQUIPMENT_OPTIONS,
  DIFFICULTY_OPTIONS,
  MUSCLE_OPTIONS,
} from './types'

const QUALITY_COPY: Record<MatchQuality, string> = {
  strong: 'Strong match',
  moderate: 'Moderate match',
  weak: 'Weak match',
}
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
  const [exerciseMethod, setExerciseMethod] = useState<SearchMethod>('tfidf')
  const [programMethod, setProgramMethod] = useState<SearchMethod>('tfidf')
  const [planText, setPlanText] = useState<string>('')
  const [planLoading, setPlanLoading] = useState<boolean>(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [programCues, setProgramCues] = useState<Record<string, FormCue>>({})
  const [openCueKey, setOpenCueKey] = useState<string | null>(null)

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
    overrides?: { equipment?: string[]; difficulty?: string; injuries?: string[]; method?: SearchMethod },
  ): Promise<void> => {
    if (value.trim() === '') {
      setExercises([])
      setPlanText('')
      setPlanError(null)
      setPlanLoading(false)
      return
    }
    const eq = overrides?.equipment ?? selectedEquipment
    const diff = overrides?.difficulty ?? difficulty
    const inj = overrides?.injuries ?? injuries
    const meth = overrides?.method ?? exerciseMethod
    const body: Record<string, unknown> = { query: value, method: meth }
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
    // Reset plan state on every new search — top result may have changed.
    setPlanText('')
    setPlanError(null)
    setPlanLoading(false)
  }

  const handleGeneratePlan = async (exercise: Exercise): Promise<void> => {
    setPlanError(null)
    setPlanText('')
    setPlanLoading(true)
    try {
      const res = await fetch('/api/enrich_exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: exercise.name,
          primaryMuscles: exercise.primaryMuscles,
          secondaryMuscles: exercise.secondaryMuscles,
          equipment: exercise.equipment,
          instructions: exercise.instructions,
        }),
      })
      if (!res.ok || !res.body) {
        setPlanError('Could not generate plan.')
        setPlanLoading(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let text = ''
      setPlanLoading(false)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.error) {
              setPlanError(payload.error)
              return
            }
            if (typeof payload.content === 'string') {
              text += payload.content
              setPlanText(text)
            }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch {
      setPlanError('Something went wrong generating the plan.')
      setPlanLoading(false)
    }
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

  const handleProgramSearch = async (
    value: string,
    overrides?: { method?: SearchMethod },
  ): Promise<void> => {
    if (value.trim() === '') {
      setPrograms([])
      setProgramCues({})
      setOpenCueKey(null)
      return
    }
    const meth = overrides?.method ?? programMethod
    setProgramsLoading(true)
    try {
      const res = await fetch('/api/search_programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value, method: meth }),
      })
      const data = await res.json()
      setPrograms(data.results)
      setProgramCues({})
      setOpenCueKey(null)

      const top: Program | undefined = data.results?.[0]
      if (top && top.schedule && top.schedule.length > 0) {
        const names: string[] = []
        const seen = new Set<string>()
        for (const entry of top.schedule) {
          const nm = entry.exercise_name?.trim()
          if (!nm) continue
          const key = nm.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          names.push(nm)
        }
        if (names.length > 0 && useLlm) {
          fetch('/api/enrich_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exercises: names }),
          })
            .then(r => (r.ok ? r.json() : null))
            .then(payload => {
              if (!payload || typeof payload !== 'object') return
              const cuesRaw = (payload as { cues?: Record<string, FormCue> }).cues
              if (!cuesRaw) return
              const normalized: Record<string, FormCue> = {}
              for (const [k, v] of Object.entries(cuesRaw)) {
                if (v && typeof v === 'object' && Array.isArray((v as FormCue).form_cues)) {
                  normalized[k.toLowerCase()] = v as FormCue
                }
              }
              setProgramCues(normalized)
            })
            .catch(() => { /* fail silently */ })
        }
      }
    } finally {
      setProgramsLoading(false)
    }
  }

  const changeExerciseMethod = (next: SearchMethod): void => {
    setExerciseMethod(next)
    if (searchTerm.trim() !== '') handleSearch(searchTerm, { method: next })
  }

  const changeProgramMethod = (next: SearchMethod): void => {
    setProgramMethod(next)
    if (programSearchTerm.trim() !== '') handleProgramSearch(programSearchTerm, { method: next })
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
        <div className="subtab-bar">
          <button
            type="button"
            className={`subtab-button ${exerciseMethod === 'tfidf' ? 'active' : ''}`}
            onClick={() => changeExerciseMethod('tfidf')}
          >
            TF-IDF
          </button>
          <button
            type="button"
            className={`subtab-button ${exerciseMethod === 'svd' ? 'active' : ''}`}
            onClick={() => changeExerciseMethod('svd')}
          >
            SVD
          </button>
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
        <div className="subtab-bar">
          <button
            type="button"
            className={`subtab-button ${programMethod === 'tfidf' ? 'active' : ''}`}
            onClick={() => changeProgramMethod('tfidf')}
          >
            TF-IDF
          </button>
          <button
            type="button"
            className={`subtab-button ${programMethod === 'svd' ? 'active' : ''}`}
            onClick={() => changeProgramMethod('svd')}
          >
            SVD
          </button>
        </div>
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
            <p className="exercise-field">
              <strong>Score:</strong> {exercise.score.toFixed(4)}
              {exercise.match_quality && (
                <span className={`match-badge match-badge--${exercise.match_quality}`}>
                  {QUALITY_COPY[exercise.match_quality]}
                </span>
              )}
            </p>
            {exercise.tags && exercise.tags.length > 0 && (
              <div className="match-tags">
                <span className="match-tags-label">Why this matched:</span>
                {exercise.tags.map((t, i) => <span key={i} className="match-tag">{t}</span>)}
              </div>
            )}
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
            {index === 0 && useLlm && (
              <div className="workout-plan">
                <button
                  type="button"
                  className="workout-plan-btn"
                  onClick={() => handleGeneratePlan(exercise)}
                  disabled={planLoading}
                >
                  {planLoading
                    ? 'Generating workout plan…'
                    : planText
                      ? 'Regenerate workout plan'
                      : 'Generate workout plan for today'}
                </button>
                {planError && <p className="workout-plan-error">{planError}</p>}
                {planText && (
                  <pre className="workout-plan-content" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {planText}
                  </pre>
                )}
              </div>
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
            <p className="exercise-field">
              <strong>Score:</strong> {program.score.toFixed(4)}
              {program.match_quality && (
                <span className={`match-badge match-badge--${program.match_quality}`}>
                  {QUALITY_COPY[program.match_quality]}
                </span>
              )}
            </p>
            {program.tags && program.tags.length > 0 && (
              <div className="match-tags">
                <span className="match-tags-label">Why this matched:</span>
                {program.tags.map((t, i) => <span key={i} className="match-tag">{t}</span>)}
              </div>
            )}
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
                          {dayGroup.entries.map((entry, ei) => {
                            const cueKey = entry.exercise_name.trim().toLowerCase()
                            const cue = index === 0 ? programCues[cueKey] : undefined
                            const openKey = `${wi}-${di}-${ei}`
                            const isOpen = openCueKey === openKey
                            return (
                              <li key={ei}>
                                {entry.exercise_name}{formatReps(entry)}
                                {cue && (
                                  <>
                                    {' '}
                                    <button
                                      type="button"
                                      className="form-cue-toggle"
                                      aria-label="Form cues"
                                      aria-expanded={isOpen}
                                      onClick={() => setOpenCueKey(isOpen ? null : openKey)}
                                    >
                                      ⓘ
                                    </button>
                                    {isOpen && (
                                      <div className="form-cue-panel">
                                        {cue.form_cues.length > 0 && (
                                          <ul className="form-cue-list">
                                            {cue.form_cues.map((c, ci) => <li key={ci}>{c}</li>)}
                                          </ul>
                                        )}
                                        {cue.safety && (
                                          <p className="form-cue-safety"><strong>Safety:</strong> {cue.safety}</p>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </li>
                            )
                          })}
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
