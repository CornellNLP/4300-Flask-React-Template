import { useState, useEffect } from 'react'
import './App.css'
import TraitPanel from './components/TraitPanel'
import TitleImg from './pictures/title.png'
import PawImg from './pictures/paw.png'
import MatchImg from './pictures/match_title.png'

type DimensionMatch = {
  dimension: number
  sign: string
  contribution: number
  terms: string[]
}

type DogMatch = {
  breed: string
  score: number
  structured_score?: number | null
  text_score?: number | null
  matching_traits?: string[]
  matching_words?: string[]
  positive_dimensions?: DimensionMatch[]
  negative_dimensions?: DimensionMatch[]
  description: string
  temperament: string
  group: string
  grooming: string
  energy: string
  shedding: string
  trainability: string
  demeanor: string
  picture_name?: string | null

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

type MatchResponse = {
  baseline_matches: DogMatch[]
  svd_matches: DogMatch[]
}

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [traitInput, setTraitInput] = useState<Record<string, Array<number | string>>>({})
  const [writeIn, setWriteIn] = useState<string>('')
  const [submittedQuery, setSubmittedQuery] = useState<Record<string, Array<number | string>>>({})
  const [submittedWriteIn, setSubmittedWriteIn] = useState<string>('')
  const [baselineMatches, setBaselineMatches] = useState<DogMatch[]>([])
  const [svdMatches, setSvdMatches] = useState<DogMatch[]>([])
  const [activeMethod, setActiveMethod] = useState<'svd' | 'baseline'>('svd')
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
    setBaselineMatches([])
    setSvdMatches([])
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

      const data: MatchResponse = await response.json()

      setBaselineMatches(Array.isArray(data.baseline_matches) ? data.baseline_matches : [])
      setSvdMatches(Array.isArray(data.svd_matches) ? data.svd_matches : [])
    } catch (err) {
      console.error(err)
      setError('Something went wrong while finding matches.')
      setBaselineMatches([])
      setSvdMatches([])
    } finally {
      setIsLoading(false)
    }
  }

  const selectedTraitEntries = Object.entries(submittedQuery).filter(
    ([_, values]) => values.length > 0
  )

  const selectedRanges = (input: Record<string, Array<number | string>>) => {
    const ranges: Record<string, Array<string>> = {}

    if (input['Height']?.length) ranges['Height'] = input['Height'].map(String)
    if (input['Weight']?.length) ranges['Weight'] = input['Weight'].map(String)
    if (input['Life Expectancy']?.length) ranges['Life Expectancy'] = input['Life Expectancy'].map(String)

    return ranges
  }

  const rangePrefs = selectedRanges(submittedQuery)

  const hasSubmittedInput =
    selectedTraitEntries.length > 0 || submittedWriteIn.trim() !== ''

  const normalize = (w: string) =>
    w.toLowerCase().replace(/[^a-z]/g, '')

  const highlightText = (text: string, words: string[]) => {
    if (!words || words.length === 0) return text

    const normalizedTargets = words
      .map(normalize)
      .filter(Boolean)

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

    return ranges[trait].some((r) => {
      const [low, high] = r.split('-').map(Number)
      if (Number.isNaN(low) || Number.isNaN(high)) return false
      return value >= low && value <= high
    })
  }

  const traitMatched = (dogValue: string, matchingTraits?: string[]) => {
    if (!dogValue || !matchingTraits || matchingTraits.length === 0) return false
    return matchingTraits.some(t => dogValue.toLowerCase().includes(t.toLowerCase()))
  }

  const renderDogCard = (dog: DogMatch, showSvdExplainability: boolean) => {
    return (
      <div className="dog-card" key={dog.breed}>
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
              <span className="match-score">Match: {Math.round(dog.score * 100)}%</span>
            </div>

            <div className="traits">
              <span className={`trait-pill ${rangeMatches('Height', dog.avg_height, rangePrefs) ? 'matched' : ''}`}>
                <strong>Height</strong> {dog.avg_height != null ? Math.round(dog.avg_height) : 'N/A'} cm
              </span>

              <span className={`trait-pill ${rangeMatches('Weight', dog.avg_weight, rangePrefs) ? 'matched' : ''}`}>
                <strong>Weight</strong> {dog.avg_weight != null ? Math.round(dog.avg_weight) : 'N/A'} kg
              </span>

              <span className={`trait-pill ${rangeMatches('Life Expectancy', dog.avg_expectancy, rangePrefs) ? 'matched' : ''}`}>
                <strong>Lifespan</strong> {dog.avg_expectancy ?? 'N/A'} yrs
              </span>

              <span className={`trait-pill ${traitMatched(dog.group, dog.matching_traits) ? 'matched' : ''}`}>
                {dog.group}
              </span>

              <span className={`trait-pill ${traitMatched(dog.grooming, dog.matching_traits) ? 'matched' : ''}`}>
                {dog.grooming}
              </span>

              <span className={`trait-pill ${traitMatched(dog.energy, dog.matching_traits) ? 'matched' : ''}`}>
                {dog.energy}
              </span>

              <span className={`trait-pill ${traitMatched(dog.shedding, dog.matching_traits) ? 'matched' : ''}`}>
                {dog.shedding}
              </span>

              <span className={`trait-pill ${traitMatched(dog.trainability, dog.matching_traits) ? 'matched' : ''}`}>
                {dog.trainability}
              </span>

              <span className={`trait-pill ${traitMatched(dog.demeanor, dog.matching_traits) ? 'matched' : ''}`}>
                {dog.demeanor}
              </span>
            </div>

            <p className="dog-temperament">
              {highlightText(dog.temperament || '', dog.matching_words || [])}
            </p>

            <p className="dog-description">
              {highlightText(dog.description || '', dog.matching_words || [])}
            </p>

            {showSvdExplainability && ((dog.positive_dimensions?.length || 0) > 0 || (dog.negative_dimensions?.length || 0) > 0) && (
              <div className="explainability-box">
                <div className="explainability-title">Why this matched in SVD</div>

                {(dog.positive_dimensions?.length || 0) > 0 && (
                  <div className="explainability-group">
                    <div className="explainability-subtitle">Positive dimensions</div>
                    <div className="dimension-chip-wrap">
                      {dog.positive_dimensions?.map((dim, i) => (
                        <span key={i} className="dimension-chip positive">
                          Dim {dim.dimension}: {dim.terms.join(', ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(dog.negative_dimensions?.length || 0) > 0 && (
                  <div className="explainability-group">
                    <div className="explainability-subtitle">Negative dimensions</div>
                    <div className="dimension-chip-wrap">
                      {dog.negative_dimensions?.map((dim, i) => (
                        <span key={i} className="dimension-chip negative">
                          Dim {dim.dimension}: {dim.terms.join(', ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentMatches = activeMethod === 'svd' ? svdMatches : baselineMatches
  const showMethodToggle = !isLoading && !error && (svdMatches.length > 0 || baselineMatches.length > 0)

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      <div className="site-header">
        <div className="dog-border" />
        <div className="top-text">
          <img src={TitleImg} className="title-image" alt="PawMatch" />
          <img src={PawImg} className="paw-image" alt="Paw Print" />
        </div>
      </div>

      <div className="method-toggle pre-submit-toggle">
        <button
          className={`method-button ${activeMethod === 'svd' ? 'active' : ''}`}
          onClick={() => setActiveMethod('svd')}
          type="button"
        >
          SVD
        </button>

        <button
          className={`method-button ${activeMethod === 'baseline' ? 'active' : ''}`}
          onClick={() => setActiveMethod('baseline')}
          type="button"
        >
          No SVD
        </button>
      </div>

      <div className="main-content">
        <TraitPanel
          traitInput={traitInput}
          setTraitInput={setTraitInput}
          toggleTraitValue={toggleTraitValue}
          writeIn={writeIn}
          setWriteIn={setWriteIn}
          handleSubmitPreferences={handleSubmitPreferences}
        />

        <div id="answer-box">
          {!hasSubmittedInput ? (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Your preferences</h3>
              <p className="query-preview-text">
                No preferences submitted yet. Select traits above and click Find Matches.
              </p>
            </div>
          ) : (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Submitted Preferences</h3>

              {submittedWriteIn.trim() !== '' && (
                <p className="query-preview-text">
                  <strong>Inputted Trait(s):</strong> {submittedWriteIn}
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

          {isLoading && (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Finding matches…</h3>
              <p className="query-preview-text">
                Running both methods and preparing your results.
              </p>
            </div>
          )}

          {error && (
            <div className="query-preview-card">
              <h3 className="query-preview-title">Something went wrong</h3>
              <p className="query-preview-text">{error}</p>
            </div>
          )}

          {!isLoading && hasSubmittedInput && baselineMatches.length === 0 && svdMatches.length === 0 && !error && (
            <div className="query-preview-card">
              <h3 className="query-preview-title">No matches found 🐾</h3>
              <p className="query-preview-text">
                Try selecting fewer traits, adjusting your notes, or using broader options.
              </p>
            </div>
          )}

          {!isLoading && currentMatches.length > 0 && (
            <div className="results-section comparison-section">
              <div className="match-text">
                <img src={MatchImg} className="match-title-image" alt="Top Dog Matches" />
                <img src={PawImg} className="match-paw-image" alt="Paw" />
              </div>

              <h3 className="comparison-title">
                {activeMethod === 'svd' ? 'Top 10 Matches (SVD)' : 'Top 10 Matches (No SVD)'}
              </h3>

              <p className="comparison-subtitle">
                {activeMethod === 'svd'
                  ? 'Showing the SVD-based ranking with positive and negative dimension explanations.'
                  : 'Showing the baseline ranking without SVD.'}
              </p>

              {currentMatches.map((dog, index) => (
                <div key={`${dog.breed}-${activeMethod}-${index}`}>
                  {renderDogCard(dog, activeMethod === 'svd')}
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