import { useState, useEffect } from 'react'
import './App.css'
// import { Episode } from './types'
// import Chat from './Chat'
import TraitPanel from './components/TraitPanel'
import TitleImg from './pictures/title.png'
import PawImg from './pictures/paw.png'
import MatchImg from './pictures/match_title.png'

type DogMatch = {
  breed: string
  score: number
  description: string
  temperament: string
  group: string
  energy: string
  shedding: string
  trainability: string
  demeanor: string

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
  // const [searchTerm, setSearchTerm] = useState<string>('')
  // const [episodes, setEpisodes] = useState<Episode[]>([])
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

  // const handleSearch = async (value: string): Promise<void> => {
  //   setSearchTerm(value)
  //   if (value.trim() === '') {
  //     setEpisodes([])
  //     return
  //   }

  //   const response = await fetch(`/api/episodes?title=${encodeURIComponent(value)}`)
  //   const data: Episode[] = await response.json()
  //   setEpisodes(data)
  // }

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

  const hasSubmittedInput =
    selectedTraitEntries.length > 0 || submittedWriteIn.trim() !== ''

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      <div className="dog-border"></div>

      <div className="top-text">
        <img src={TitleImg} className="title-image" alt="PawMatch" />
        <img src={PawImg} className="paw-image" alt="Paw Print" />
      </div>

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
            <h3 className="query-preview-title">Current</h3>
            <p className="query-preview-text">
              No preferences submitted yet. Select traits and click Find Matches.
            </p>
          </div>
        ) : (
          <div className="query-preview-card">
            <h3 className="query-preview-title">Submitted Preferences</h3>

            {submittedWriteIn.trim() !== '' && (
              <p className="query-preview-text">
                <strong>Additional Traits:</strong> {submittedWriteIn}
              </p>
            )}

            {selectedTraitEntries.map(([trait, values]) => (
              <p key={trait} className="query-preview-text">
                <strong>{trait}:</strong> {values.join(', ')}
              </p>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="query-preview-card">
            <h3 className="query-preview-title">Finding Matches...</h3>
            <p className="query-preview-text">Please wait while we rank the dogs.</p>
          </div>
        )}

        {error && (
          <div className="query-preview-card">
            <h3 className="query-preview-title">Error</h3>
            <p className="query-preview-text">{error}</p>
          </div>
        )}

        {!isLoading && hasSubmittedInput && matches.length === 0 && !error && (
          <div className="query-preview-card">
            <h3 className="query-preview-title">No Matches Found 🐾</h3>
            <p className="query-preview-text">
              Try selecting fewer traits, changing your text input, or using more general options.
            </p>
          </div>
        )}

        {!isLoading && matches.length > 0 && (
          <div className="results-section">
            <div className="match-text">
              <img src={MatchImg} className="match-title-image" alt="Top Dog Matches" />
              <img src={PawImg} className="match-paw-image" alt="Paw Print" />
            </div>

            {matches.map((dog, index) => (
              <div className="dog-card" key={`${dog.breed}-${index}`}>
                <h4>{dog.breed}</h4>

                <p className="match-score">Match: {dog.score}</p>

                <div className="traits">
                  <span className="trait-pill">
                    <strong>Height:</strong> {dog.avg_height != null ? Math.round(dog.avg_height) : "N/A"} cm
                  </span>

                  <span className="trait-pill">
                    <strong>Weight:</strong> {dog.avg_weight != null ? Math.round(dog.avg_weight) : "N/A"} kg
                  </span>

                  <span className="trait-pill">
                    <strong>Life Expectancy:</strong> {dog.avg_expectancy ?? "N/A"} yrs
                  </span>

                  <span className="trait-pill">{dog.group}</span>
                  <span className="trait-pill">{dog.energy}</span>
                  <span className="trait-pill">{dog.shedding}</span>
                  <span className="trait-pill">{dog.trainability}</span>
                  <span className="trait-pill">{dog.demeanor}</span>
                </div>

                <p className="dog-temperament">
                  <strong>{dog.temperament}</strong>
                </p>

                <p className="dog-description">{dog.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* {useLlm && <Chat onSearchTerm={handleSearch} />} */}
    </div>
  )
}

export default App