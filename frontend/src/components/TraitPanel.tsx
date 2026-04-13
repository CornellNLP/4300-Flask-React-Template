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
    desc: "Developing breeds recorded by the American Kennel Club (AKC) but not yet fully recognized"
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
    desc: "Breeds in the process of gaining full American Kennel Club (AKC) recognition"
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

function TraitPanel({
  traitInput,
  toggleTraitValue,
  writeIn,
  setWriteIn,
  handleSubmitPreferences
}: any) {

  return (
    <div className="trait-form">

      {/* Row 1: Text input */}
      <div className="trait-section-card">
        <p className="trait-section-label">Input Traits</p>
        <textarea
          className="write-in-input"
          placeholder="ex: playful, loyal, quiet"
          value={writeIn}
          onChange={(e) => setWriteIn(e.target.value)}
          rows={2}
        />
      </div>

      {/* Row 2: Height + Weight + Life Expectancy */}
      <div className="trait-form-grid-3">
        <div className="trait-section-card">
          <p className="trait-section-label">Height</p>
          <div className="trait-options">
            <RangeFilter
              label=""
              trait="Height"
              options={heightRanges}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>

        <div className="trait-section-card">
          <p className="trait-section-label">Weight</p>
          <div className="trait-options">
            <RangeFilter
              label=""
              trait="Weight"
              options={weightRanges}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>

        <div className="trait-section-card">
          <p className="trait-section-label">Life Expectancy</p>
          <div className="trait-options">
            <RangeFilter
              label=""
              trait="Life Expectancy"
              options={lifeRanges}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>
      </div>

      {/* Row 3: Breed Group + Energy Level + Demeanor */}
      <div className="trait-form-grid-3">
        <div className="trait-section-card">

  <div className="trait-section-card">
  <p className="trait-section-label">Breed Group:{" "}
    <span className="trait-definition">
      Describes the dog's historical working role
    </span>
    </p>

  <div className="trait-options breed-group-options">

    {groups.map((g) => {
      const isSelected = traitInput["Group"]?.includes(g.value)

      return (
        <div key={g.value} className="breed-group-row">

          <span
            className={`trait-pill ${isSelected ? "matched" : ""}`}
            onClick={() => toggleTraitValue("Group", g.value)}
          >
            {g.label}
          </span>

          <span className="group-desc">
            {g.desc}
          </span>

        </div>
      )
    })}

  </div>
</div>
</div>

        <div className="trait-section-card">
          <p className="trait-section-label">Energy Level:{" "}
          <span className="trait-definition">
            Reflects how much daily exercise and stimulation the dog typically needs
          </span>
          </p>
          <div className="trait-options">
            <CheckboxFilter
              trait="Energy Level"
              options={energyOptions}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>

        <div className="trait-section-card">
          <p className="trait-section-label">Demeanor:{" "}
          <span className="trait-definition">
            Describes general personality style 
          </span>
          </p>
          <div className="trait-options">
            <CheckboxFilter
              trait="Demeanor"
              options={demeanorOptions}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>
      </div>

      {/* Row 4: Grooming + Trainability + Shedding */}
      <div className="trait-form-grid-3">
        <div className="trait-section-card">
          <p className="trait-section-label">Grooming:{" "}
          <span className="trait-definition">
            Describe how much coat maintenance (brushing, trimming, bathing) is required.
          </span>
          </p>
          <div className="trait-options">
            <CheckboxFilter
              trait="Grooming Frequency"
              options={groomingOptions}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>

        <div className="trait-section-card">
          <p className="trait-section-label">Trainability:{" "}
          <span className="trait-definition">
            Reflects how quickly the dog learns commands & responds to training
          </span>
          </p>
          <div className="trait-options">
            <CheckboxFilter
              trait="Trainability"
              options={trainabilityOptions}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>

        <div className="trait-section-card">
          <p className="trait-section-label">Shedding:{" "}
          <span className="trait-definition">
            Indicates how much loose fur the breed typically loses throughout the year
          </span>
          </p>
          <div className="trait-options">
            <CheckboxFilter
              trait="Shedding"
              options={sheddingOptions}
              traitInput={traitInput}
              toggleTraitValue={toggleTraitValue}
            />
          </div>
        </div>
      </div>

      <button className="submit-button" onClick={handleSubmitPreferences}>
        Find matches
      </button>

    </div>
  )
}

export default TraitPanel