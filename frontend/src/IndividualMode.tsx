import QueryComponent, { SearchRequest } from './QueryComponent';
import './IndividualMode.css';

interface IndividualModeProps {
  onSearch: (request: SearchRequest) => Promise<void> | void;
  initialQuery?: string;
  draft?: SearchRequest;
  onDraftChange?: (request: SearchRequest) => void;
  llmAvailable?: boolean;
}

function IndividualMode({ onSearch, initialQuery = '', draft, onDraftChange, llmAvailable = true }: IndividualModeProps) {
  return (
    <div className="individual-mode-fullscreen">
      <div className="solo-layout">
        <div className="solo-form-card">
          <QueryComponent
            onSearch={onSearch}
            initialQuery={initialQuery}
            initialRequest={draft}
            onDraftChange={onDraftChange}
            llmAvailable={llmAvailable}
          />
        </div>
        <div className="instructions-panel">
          <h3 className="instructions-title">Instructions</h3>
          <div className="instructions-box">
            <ul>
              <li>Enter your query (example: Health Podcasts).</li>
              <li>Use the Explicit Content toggle to filter explicit content.</li>
              <li> We have multiple options to filter your results. These are <b> hard filters</b> that will narrow down your search results.</li>
              <li>Select any genres you want with the checklist!</li>
              <li>Set your preferred min and max values for the selected length metric. Use either episode count, or episode duration (in minutes).</li>
              <li>Add a release year (example: 2024) and publisher (example: NPR) as needed.</li>
              <li>Click <b>SEARCH</b> to find matching podcasts.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndividualMode;
