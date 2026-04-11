import QueryComponent, { SearchRequest } from './QueryComponent';
import './CollaborativeMode.css';

interface CollaborativeModeProps {
  onSearchUser1: (request: SearchRequest) => Promise<void> | void;
  onSearchUser2: (request: SearchRequest) => Promise<void> | void;
}

function CollaborativeMode({ onSearchUser1, onSearchUser2 }: CollaborativeModeProps) {
  return (
    <div className="collab-bg">
      <header className="collab-header">
        <h1 className="collab-title">Peas <em>in a Podcast</em> <span className="collab-logo">(Logo)</span></h1>
        <div className="collab-subtitle">Today, I’m listening...</div>
        <div className="collab-toggle-row">
          <button className="collab-toggle left">by myself</button>
          <button className="collab-toggle right active">with my bestie</button>
        </div>
      </header>
      <div className="collab-main-form-box">
        <div className="collab-form-side">
          <span className="collab-form-label">Query</span>
          <QueryComponent title="" idPrefix="collab-user-1" onSearch={onSearchUser1} />
        </div>
        <div className="collab-form-side">
          <span className="collab-form-label">Query</span>
          <QueryComponent title="" idPrefix="collab-user-2" onSearch={onSearchUser2} />
        </div>
      </div>
    </div>
  );
}

export default CollaborativeMode;
