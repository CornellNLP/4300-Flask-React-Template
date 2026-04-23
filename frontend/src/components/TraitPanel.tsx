import RangeFilter from "./RangeFilter"
import CheckboxFilter from "./CheckboxFilter"

const heightRanges = [
  { label: "Small (0-30 cm)", value: "0-30" },
  { label: "Medium (30-55 cm)", value: "30-55" },
  { label: "Large (55-75 cm)", value: "55-75" },
  { label: "Giant (75+ cm)", value: "75-200" }
]

const weightRanges = [
  { label: "Toy (0-7 kg)", value: "0-7" },
  { label: "Small (7-15 kg)", value: "7-15" },
  { label: "Medium (15-30 kg)", value: "15-30" },
  { label: "Large (30-50 kg)", value: "30-50" },
  { label: "Giant (50+ kg)", value: "50-200" }
]

const lifeRanges = [
  { label: "Short (0-10 years)", value: "0-10" },
  { label: "Average (10-13 years)", value: "10-13" },
  { label: "Long (13-16 years)", value: "13-16" },
  { label: "Very Long (16+ years)", value: "16-25" }
]

const groups = [
  {
    label: "Foundation Stock Service",
    value: "Foundation Stock Service",
    desc: "Developing breeds recorded by the AKC but not yet fully recognized"
  },
  {
    label: "Herding Group",
    value: "Herding Group",
    desc: "Highly intelligent dogs bred to control and move livestock; often instinctively herd people"
  },
  {
    label: "Hound Group",
    value: "Hound Group",
    desc: "Dogs bred for hunting using scent or sight, known for endurance and tracking ability"
  },
  {
    label: "Miscellaneous Class",
    value: "Miscellaneous Class",
    desc: "Breeds in the process of gaining full AKC recognition"
  },
  {
    label: "Non-Sporting Group",
    value: "Non-Sporting Group",
    desc: "A diverse mix of breeds with varied sizes, appearances, and temperaments"
  },
  {
    label: "Sporting Group",
    value: "Sporting Group",
    desc: "Active, friendly hunting dogs skilled in retrieving, pointing, and field work"
  },
  {
    label: "Terrier Group",
    value: "Terrier Group",
    desc: "Bold, energetic dogs bred to hunt vermin; often feisty and strong-willed"
  },
  {
    label: "Toy Group",
    value: "Toy Group",
    desc: "Small companion dogs ideal for apartments; affectionate but often spirited"
  },
  {
    label: "Working Group",
    value: "Working Group",
    desc: "Large, intelligent dogs bred for jobs like guarding, pulling, and rescue"
  }
]

const groomingOptions = [
  "Occasional Bath/Brush",
  "Weekly Brushing",
  "2-3 Times a Week Brushing",
  "Daily Brushing",
  "Professional Only"
]

const sheddingOptions = [
  "Infrequent",
  "Occasional",
  "Seasonal",
  "Regularly",
  "Frequent"
]

const energyOptions = [
  "Couch Potato",
  "Calm",
  "Regular Exercise",
  "Energetic",
  "Needs Lots of Activity"
]

const trainabilityOptions = [
  "Easy Training",
  "Eager to Please",
  "Agreeable",
  "Independent",
  "May be Stubborn"
]

const demeanorOptions = [
  "Friendly",
  "Outgoing",
  "Alert/Responsive",
  "Reserved with Strangers",
  "Aloof/Wary"
]

function TraitPanel({ traitInput, toggleTraitValue, writeIn, setWriteIn, handleSubmitPreferences }: any) {
  const isGroupActive = (value: string) => (traitInput["Group"] || []).includes(value)

  return (
    <div className="trait-form stagger">

      {/* Free text */}
      <div>
        <div className="section-label">Describe your ideal dog in your own words</div>
        <textarea
          className="write-in-input"
          placeholder="e.g. playful, loyal, quiet, good with kids…"
          rows={3}
          value={writeIn}
          onChange={e => setWriteIn(e.target.value)}
        />
      </div>

      {/* Size & Lifespan */}
      <div>
        <div className="trait-divider">
          <div className="divider-line" />
          <span className="divider-badge">Size &amp; Lifespan</span>
          <div className="divider-line" />
        </div>
        <div className="filter-grid">
          <div className="trait-section-card">
            <div className="trait-section-label">Height</div>
            <div className="trait-options">
              <RangeFilter label="" trait="Height" options={heightRanges} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
          <div className="trait-section-card">
            <div className="trait-section-label">Weight</div>
            <div className="trait-options">
              <RangeFilter label="" trait="Weight" options={weightRanges} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
          <div className="trait-section-card">
            <div className="trait-section-label">Life Expectancy</div>
            <div className="trait-options">
              <RangeFilter label="" trait="Life Expectancy" options={lifeRanges} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
        </div>
      </div>

      {/* Personality */}
      <div>
        <div className="trait-divider">
          <div className="divider-line" />
          <span className="divider-badge">Personality</span>
          <div className="divider-line" />
        </div>
        <div className="filter-grid two-col">
          <div className="trait-section-card">
            <div className="trait-section-label">Energy Level</div>
            <div className="trait-card-desc">How much daily exercise and stimulation the dog typically needs</div>
            <div className="trait-options">
              <CheckboxFilter trait="Energy Level" options={energyOptions} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
          <div className="trait-section-card">
            <div className="trait-section-label">Demeanor</div>
            <div className="trait-card-desc">General personality style around people</div>
            <div className="trait-options">
              <CheckboxFilter trait="Demeanor" options={demeanorOptions} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
        </div>
      </div>

      {/* Care & Training */}
      <div>
        <div className="trait-divider">
          <div className="divider-line" />
          <span className="divider-badge">Care &amp; Training</span>
          <div className="divider-line" />
        </div>
        <div className="filter-grid">
          <div className="trait-section-card">
            <div className="trait-section-label">Grooming</div>
            <div className="trait-card-desc">How much coat maintenance is required</div>
            <div className="trait-options">
              <CheckboxFilter trait="Grooming Frequency" options={groomingOptions} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
          <div className="trait-section-card">
            <div className="trait-section-label">Trainability</div>
            <div className="trait-card-desc">How quickly the dog learns commands and responds to training</div>
            <div className="trait-options">
              <CheckboxFilter trait="Trainability" options={trainabilityOptions} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
          <div className="trait-section-card">
            <div className="trait-section-label">Shedding</div>
            <div className="trait-card-desc">How much loose fur the breed typically loses throughout the year</div>
            <div className="trait-options">
              <CheckboxFilter trait="Shedding" options={sheddingOptions} traitInput={traitInput} toggleTraitValue={toggleTraitValue} />
            </div>
          </div>
        </div>
      </div>

      {/* AKC Breed Group */}
      <div>
        <div className="trait-divider">
          <div className="divider-line" />
          <span className="divider-badge">AKC Breed Group</span>
          <div className="divider-line" />
        </div>
        <div className="trait-section-card">
          <div className="trait-section-label">Breed Group</div>
          <div className="trait-card-desc">The dog's historical working role as classified by the American Kennel Club</div>
          <div className="breed-pills">
            {groups.map(({ label, value, desc }) => (
              <div className="breed-pill-row" key={value}>
                <span
                  className={`trait-pill${isGroupActive(value) ? ' active' : ''}`}
                  onClick={() => toggleTraitValue("Group", value)}
                >
                  {label}
                </span>
                <span className="group-desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <button className="submit-button" onClick={handleSubmitPreferences}>
        Find My Match
      </button>

    </div>
  )
}

export default TraitPanel