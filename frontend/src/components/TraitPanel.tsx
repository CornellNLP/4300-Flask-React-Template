import RangeFilter from "./RangeFilter"
import DropdownFilter from "./DropdownFilter"

const heightRanges = [
  { label: "Small (0–30 cm)", value: "0-30" },
  { label: "Medium (30–55 cm)", value: "30-55" },
  { label: "Large (55–75 cm)", value: "55-75" },
  { label: "Giant (75+ cm)", value: "75-200" }
]

const weightRanges = [
  { label: "Toy (0–7 kg)", value: "0-7" },
  { label: "Small (7–15 kg)", value: "7-15" },
  { label: "Medium (15–30 kg)", value: "15-30" },
  { label: "Large (30–50 kg)", value: "30-50" },
  { label: "Giant (50+ kg)", value: "50-200" }
]

const lifeRanges = [
  { label: "Short (0–10 years)", value: "0-10" },
  { label: "Average (10–13 years)", value: "10-13" },
  { label: "Long (13–16 years)", value: "13-16" },
  { label: "Very Long (16+ years)", value: "16-25" }
]

const groups = [
  "Foundation Stock Service",
  "Herding Group",
  "Hound Group",
  "Miscellaneous Class",
  "Non-Sporting Group",
  "Sporting Group",
  "Terrier Group",
  "Toy Group",
  "Working Group"
]

const groomingOptions = [
  "Occasional Bath/Brush",
  "Weekly Brushing",
  "2-3 Times a Week Brushing",
  "Daily Brushing",
  "Specialty/Professional"
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
  setTraitInput,
  toggleTraitValue,
  writeIn,
  setWriteIn,
  handleSubmitPreferences
}: any) {

  return (
    <div className="trait-form">

      <div className="trait-section-text">
            <p>Input Traits</p>

            <input
              className="write-in-input"
              type="text"
              placeholder="ex: playful, loyal, quiet"
              value={writeIn}
              onChange={(e) => setWriteIn(e.target.value)}
            />
          </div>

      <div className="trait-columns">
        <div className="trait-column-left">

          <div className="trait-section-range">
            <p>Height</p>
            <div className="trait-options height-options">
              <RangeFilter
                label=""
                trait="Height"
                options={heightRanges}
                traitInput={traitInput}
                toggleTraitValue={toggleTraitValue}
              />
            </div>
          </div>

          <div className="trait-section-range">
            <p>Weight</p>
            <div className="trait-options weight-options">
              <RangeFilter
                label=""
                trait="Weight"
                options={weightRanges}
                traitInput={traitInput}
                toggleTraitValue={toggleTraitValue}
              />
            </div>
          </div>

          <div className="trait-section-range">
            <p>Life Expectancy</p>
            <div className="trait-options life-options">
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

        <div className="trait-column-right">
          <DropdownFilter
            label="Group"
            trait="Group"
            options={groups}
            traitInput={traitInput}
            setTraitInput={setTraitInput}
          />

          <DropdownFilter
            label="Grooming Frequency"
            trait="Grooming Frequency"
            options={groomingOptions}
            traitInput={traitInput}
            setTraitInput={setTraitInput}
          />

          <DropdownFilter
            label="Shedding"
            trait="Shedding"
            options={sheddingOptions}
            traitInput={traitInput}
            setTraitInput={setTraitInput}
          />

        </div>
        <div className="trait-column-mid">
          <DropdownFilter
            label="Energy Level"
            trait="Energy Level"
            options={energyOptions}
            traitInput={traitInput}
            setTraitInput={setTraitInput}
          />

          <DropdownFilter
            label="Trainability"
            trait="Trainability"
            options={trainabilityOptions}
            traitInput={traitInput}
            setTraitInput={setTraitInput}
          />

          <DropdownFilter
            label="Demeanor"
            trait="Demeanor"
            options={demeanorOptions}
            traitInput={traitInput}
            setTraitInput={setTraitInput}
          />
        </div>
      </div>


      <button
        className="submit-button"
        onClick={handleSubmitPreferences}
      >
        Find Matches
      </button>

    </div>
  )
}

export default TraitPanel