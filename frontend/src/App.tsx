import { useState, useEffect } from 'react'
import './App.css'
import TraitPanel from './components/TraitPanel'
import TitleImg from './pictures/title.png'
import PawImg from './pictures/paw.png'
import MatchImg from './pictures/match_title.png'

type DogMatch = {
  breed: string
  score: number
  matching_traits?: string[]
  matching_words?: string[]
  description: string
  temperament: string
  group: string
  energy: string
  shedding: string
  trainability: string
  grooming: string
  demeanor: string
  picture_name: string

  min_height: number | null
  max_height: number | null
  avg_height: number | null

  min_weight: number | null
  max_weight: number | null
  avg_weight: number | null

  min_expectancy: number | null
  max_expectancy: number | null
  avg_expectancy: number | null
}

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [traitInput, setTraitInput] = useState<Record<string, Array<number | string>>>({})
  const [writeIn, setWriteIn] = useState<string>('')
  const [submittedQuery, setSubmittedQuery] = useState<Record<string, Array<number | string>>>({})
  const [submittedWriteIn, setSubmittedWriteIn] = useState<string>('')
  const [matches, setMatches] = useState<DogMatch[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => setUseLlm(data.use_llm))
  }, [])

  const toggleTraitValue = (trait: string, value: number | string) => {
    setTraitInput((prev) => {
      const current = prev[trait] || []
      if (current.includes(value)) {
        return {
          ...prev,
          [trait]: current.filter((v) => v !== value),
        }
      }

      return {
        ...prev,
        [trait]: [...current, value],
      }
    })
  }

  const handleSubmitPreferences = async () => {
    setSubmittedQuery(traitInput)
    setSubmittedWriteIn(writeIn)
    setMatches([])
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          traitInput,
          writeIn,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch matches')
      }

      const data = await response.json()
      setMatches(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('Something went wrong while finding matches.')
      setMatches([])
    } finally {
      setIsLoading(false)
    }
  }

  const selectedTraitEntries = Object.entries(submittedQuery).filter(
    ([_, values]) => values.length > 0
  )

  const selectedRanges = (traitInput: Record<string, Array<number | string>>) => {
    const ranges: Record<string, Array<string>> = {}

    if (traitInput['Height']?.length) ranges['Height'] = traitInput['Height'].map(String)
    if (traitInput['Weight']?.length) ranges['Weight'] = traitInput['Weight'].map(String)
    if (traitInput['Life Expectancy']?.length) ranges['Life Expectancy'] = traitInput['Life Expectancy'].map(String)

    return ranges
  }
  const rangePrefs = selectedRanges(traitInput)

  const hasSubmittedInput =
    selectedTraitEntries.length > 0 || submittedWriteIn.trim() !== ''

  const normalize = (w: string) =>
    w.toLowerCase().replace(/[^a-z]/g, '')

  const highlightText = (text: string, words: string[]) => {
    if (!words || words.length === 0) return text

    const normalizedTargets = words
      .map(normalize)
      .filter(Boolean)

    // split text into words but KEEP original display
    const parts = text.split(/(\b)/)

    return parts.map((part, i) => {
      const clean = normalize(part)

      const isMatch = normalizedTargets.some(target =>
        clean === target || clean.startsWith(target)
      )

      return isMatch ? <mark key={i}>{part}</mark> : part
    })
  }

  const rangeMatches = (
  trait: 'Height' | 'Weight' | 'Life Expectancy',
  value: number | null,
  ranges: Record<string, string[]>
) => {
  if (!ranges[trait] || value == null) return false

  const v = value

  return ranges[trait].some((r) => {
    const [low, high] = r.split('-').map(Number)
    if (Number.isNaN(low) || Number.isNaN(high)) return false
    return v >= low && v <= high
  })
}

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      {/* Header */}
      <div className="site-header">
        <div className="dog-border" />
        <div className="top-text">
          <img src={TitleImg} className="title-image" alt="PawMatch" />
          <img src={PawImg} className="paw-image" alt="Paw Print" />
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">

        {/* Trait selector panel */}
        <TraitPanel
          traitInput={traitInput}
          setTraitInput={setTraitInput}
          toggleTraitValue={toggleTraitValue}
          writeIn={writeIn}
          setWriteIn={setWriteIn}
          handleSubmitPreferences={handleSubmitPreferences}
        />

        {/* Results / status area */}
        <div id="answer-box">

          {/* Submitted preferences preview */}
          {!hasSubmittedInput ? (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Your preferences</h3>
              <p className="query-preview-text">
                No preferences submitted yet — select traits above and click Find Matches.
              </p>
            </div>
          ) : (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Submitted preferences</h3>

              {submittedWriteIn.trim() !== '' && (
                <p className="query-preview-text">
                  <strong>Additional notes:</strong> {submittedWriteIn}
                </p>
              )}

              {selectedTraitEntries.map(([trait, values]) => {
                const formattedValues = values.map((v) => {
                  const val = String(v)
                  if (trait === 'Height') return `${val} cm`
                  if (trait === 'Weight') return `${val} kg`
                  if (trait === 'Life Expectancy') return `${val} years`
                  return val
                })

                return (
                  <p key={trait} className="query-preview-text">
                    <strong>{trait}:</strong> {formattedValues.join(', ')}
                  </p>
                )
              })}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Finding matches…</h3>
              <p className="query-preview-text">Ranking dogs by how well they fit your preferences.</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Something went wrong</h3>
              <p className="query-preview-text">{error}</p>
            </div>
          )}

          {/* No results */}
          {!isLoading && hasSubmittedInput && matches.length === 0 && !error && (
            <div className="query-preview-card">
              <h3 className="query-preview-title">No matches found 🐾</h3>
              <p className="query-preview-text">
                Try selecting fewer traits, adjusting your notes, or using broader options.
              </p>
            </div>
          )}

          {/* Dog results */}
          {!isLoading && matches.length > 0 && (
            <div className="results-section">
              <div className="match-text">
                <img src={MatchImg} className="match-title-image" alt="Top Dog Matches" />
                <img src={PawImg} className="match-paw-image" alt="Paw" />
              </div>

              {matches.map((dog, index) => (
                <div className="dog-card" key={`${dog.breed}-${index}`}>
                  <div className="dog-card-layout">
                    <div className="dog-image-wrap">
                      <img
                        src={dog.picture_name ? `/images/${dog.picture_name}` : PawImg}
                        alt={dog.breed}
                        className="dog-image"
                        onError={(e) => { e.currentTarget.src = PawImg }}
                      />
                    </div>

                    <div className="dog-card-content">
                      <div className="dog-card-header">
                        <h4>{dog.breed}</h4>
                        <span className="match-score">Match: {dog.score}%</span>
                      </div>

                      <div className="traits">
                        <span className={`trait-pill ${
                          rangeMatches('Height', dog.avg_height, rangePrefs) ? 'matched' : ''
                        }`}>
                          <strong>Height</strong> {dog.avg_height != null ? Math.round(dog.avg_height) : 'N/A'} cm
                        </span>

                        <span className={`trait-pill ${
                          rangeMatches('Weight', dog.avg_weight, rangePrefs) ? 'matched' : ''
                        }`}>
                          <strong>Weight</strong> {dog.avg_weight != null ? Math.round(dog.avg_weight) : 'N/A'} kg
                        </span>

                        <span className={`trait-pill ${
                          rangeMatches('Life Expectancy', dog.avg_expectancy, rangePrefs) ? 'matched' : ''
                        }`}>
                          <strong>Lifespan</strong> {dog.avg_expectancy ?? 'N/A'} yrs
                        </span>

                        <span className={`trait-pill ${
                          dog.matching_traits?.some(t =>
                            dog.group?.toLowerCase().includes(t.toLowerCase())
                          ) ? 'matched' : ''
                        }`}>
                          {dog.group}
                        </span>

                        <span className={`trait-pill ${
                          dog.matching_traits?.some(t =>
                            dog.energy?.toLowerCase().includes(t.toLowerCase())
                          ) ? 'matched' : ''
                        }`}>
                          {dog.energy}
                        </span>

                        <span className={`trait-pill ${
                          dog.matching_traits?.some(t =>
                            dog.shedding?.toLowerCase().includes(t.toLowerCase())
                          ) ? 'matched' : ''
                        }`}>
                          {dog.shedding}
                        </span>

                        <span className={`trait-pill ${
                          dog.matching_traits?.some(t =>
                            dog.trainability?.toLowerCase().includes(t.toLowerCase())
                          ) ? 'matched' : ''
                        }`}>
                          {dog.trainability}
                        </span>

                        <span className={`trait-pill ${
                          dog.matching_traits?.some(t =>
                            dog.demeanor?.toLowerCase().includes(t.toLowerCase())
                          ) ? 'matched' : ''
                        }`}>
                          {dog.demeanor}
                        </span>
                      </div>

                      <p className="dog-temperament">
                        {highlightText(dog.temperament, dog.matching_words || [])}
                      </p>
                      <p className="dog-description">
                        {highlightText(dog.description, dog.matching_words || [])}
                      </p>

                      {(dog.matching_traits?.length || dog.matching_words?.length) && (
                        <div className="match-reason">
                          <div className="match-section">Matches Your Preference(s):</div>

                          <div className="match-body">
                            {[...(dog.matching_traits || []), ...(dog.matching_words || [])]
                              .filter((v, i, arr) => arr.indexOf(v) === i)
                              .slice(0, 5)
                              .map((item, i) => (
                                <span key={i} className="match-chip">
                                  {item}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App