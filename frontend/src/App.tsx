import { useState, useEffect } from 'react'
import './App.css'
import { Episode } from './types'
import Chat from './Chat'
import TitleImg from './pictures/title.png'
import PawImg from './pictures/paw.png'

const numericTraits = [
  "Affectionate With Family",
  "Good With Young Children",
  "Good With Other Dogs",
  "Shedding Level",
  "Coat Grooming Frequency",
  "Drooling Level",
  "Openness To Strangers",
  "Playfulness Level",
  "Watchdog/Protective Nature",
  "Adaptability Level",
  "Trainability Level",
  "Energy Level",
  "Barking Level",
  "Mental Stimulation Needs"
]

const coatTypes = ["Corded", "Curly", "Double", "Hairless", "Rough", "Silky", "Smooth", "Wavy", "Wiry"]
const coatLengths = ["Short", "Medium", "Long"]

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [traitInput, setTraitInput] = useState<Record<string, Array<number | string>>>({})
  const [writeIn, setWriteIn] = useState<string>('')
  const [submittedQuery, setSubmittedQuery] = useState<Record<string, Array<number | string>>>({})
  const [submittedWriteIn, setSubmittedWriteIn] = useState<string>('')

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    setSearchTerm(value)
    if (value.trim() === '') {
      setEpisodes([])
      return
    }
    const response = await fetch(`/api/episodes?title=${encodeURIComponent(value)}`)
    const data: Episode[] = await response.json()
    setEpisodes(data)
  }

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

  const handleSubmitPreferences = () => {
    setSubmittedQuery(traitInput)
    setSubmittedWriteIn(writeIn)
  }

  const selectedTraitEntries = Object.entries(submittedQuery).filter(
    ([_, values]) => values.length > 0
  )

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      <div className="dog-border"></div>

      {/* Title */}
      <div className="top-text">
        <img src={TitleImg} className="title-image" alt="PawMatch" />
        <img src={PawImg} className="paw-image" alt="Paw Print" />
      </div>

      <div className="trait-form">
        <div className="trait-section">
          <p>Additional Traits</p>
          <input
            className="write-in-input"
            type="text"
            placeholder="ex: playful, loyal, quiet"
            value={writeIn}
            onChange={(e) => setWriteIn(e.target.value)}
          />
        </div>

        {numericTraits.map((trait) => (
          <div key={trait} className="trait-section">
            <p>{trait}</p>
            <div className="trait-options">
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num}>
                  <input
                    type="checkbox"
                    checked={(traitInput[trait] || []).includes(num)}
                    onChange={() => toggleTraitValue(trait, num)}
                  />
                  {num}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="trait-section">
          <p>Coat Type</p>
          <div className="trait-options coat-type-options">
            {coatTypes.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={(traitInput["Coat Type"] || []).includes(type)}
                  onChange={() => toggleTraitValue("Coat Type", type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className="trait-section">
          <p>Coat Length</p>
          <div className="trait-options">
            {coatLengths.map((length) => (
              <label key={length}>
                <input
                  type="checkbox"
                  checked={(traitInput["Coat Length"] || []).includes(length)}
                  onChange={() => toggleTraitValue("Coat Length", length)}
                />
                {length}
              </label>
            ))}
          </div>
        </div>

        <button className="submit-button" onClick={handleSubmitPreferences}>
          Find Matches
        </button>
      </div>

      <div id="answer-box">
        {selectedTraitEntries.length === 0 && submittedWriteIn.trim() === '' ? (
          <div className="query-preview-card">
            <h3 className="query-preview-title">Current Prototype Output</h3>
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

        {episodes.map((episode, index) => (
          <div key={index} className="episode-item">
            <h3 className="episode-title">{episode.title}</h3>
            <p className="episode-desc">{episode.descr}</p>
            <p className="episode-rating">IMDB Rating: {episode.imdb_rating}</p>
          </div>
        ))}
      </div>

      {useLlm && <Chat onSearchTerm={handleSearch} />}
    </div>
  )
}

export default App