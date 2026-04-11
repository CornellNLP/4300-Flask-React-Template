import QueryComponent, { SearchRequest } from './QueryComponent';
import './IndividualMode.css';

interface IndividualModeProps {
  onSearch: (request: SearchRequest) => Promise<void> | void;
}

function IndividualMode({ onSearch }: IndividualModeProps) {
  return (
    <div className="individual-bg">
      <header className="individual-header">
        <h1 className="individual-title">Peas <em>in a Podcast</em> <span className="individual-logo">(Logo)</span></h1>
        <div className="individual-subtitle">Today, I’m listening...</div>
        <div className="individual-toggle-row">
          <button className="individual-toggle left active">by myself</button>
          <button className="individual-toggle right">with my bestie</button>
        </div>
      </header>
      <div className="individual-main-form-box">
        <div className="individual-form-side">
          <span className="individual-form-label">Query</span>
          <QueryComponent title="" idPrefix="individual" onSearch={onSearch} />
        </div>
        <div className="individual-instructions-side">
          <span className="individual-form-label">Instructions</span>
          <div className="individual-instructions-box"></div>
        </div>
      </div>
    </div>
  );
}

export default IndividualMode;
