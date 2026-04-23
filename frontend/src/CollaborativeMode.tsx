import { useEffect, useState } from 'react';
import QueryComponent, { SearchRequest } from './QueryComponent';
import './CollaborativeMode.css';

interface CollaborativeModeProps {
  onCollaborativeSearch: (user1: SearchRequest, user2: SearchRequest, useLlm: boolean) => Promise<void> | void;
  initialUser1?: SearchRequest;
  initialUser2?: SearchRequest;
  onDraftChange?: (user1: SearchRequest, user2: SearchRequest) => void;
  llmAvailable?: boolean;
}

const defaultRequest: SearchRequest = {
  query: '',
  explicit: false,
  genres: [],
  excludedGenres: [],
  publisher: '',
  releaseYear: '',
  lengthMetric: 'total_episodes',
  minLength: 0,
  maxLength: 500,
};

function CollaborativeMode({ onCollaborativeSearch, initialUser1, initialUser2, onDraftChange, llmAvailable = true }: CollaborativeModeProps) {
  const [user1, setUser1] = useState<SearchRequest>(initialUser1 ?? defaultRequest);
  const [user2, setUser2] = useState<SearchRequest>(initialUser2 ?? defaultRequest);
  const [useLlm, setUseLlm] = useState<boolean>(llmAvailable);
  const [submitting, setSubmitting] = useState(false);

  const mergeWithDefaults = (request?: SearchRequest): SearchRequest => ({
    ...defaultRequest,
    ...(request ?? {}),
    genres: request?.genres ?? [],
  });

  useEffect(() => {
    setUser1(mergeWithDefaults(initialUser1));
    setUser2(mergeWithDefaults(initialUser2));
  }, [initialUser1, initialUser2]);

  useEffect(() => {
    if (!llmAvailable) {
      setUseLlm(false);
    }
  }, [llmAvailable]);

  const handleSubmit = async () => {
    if (user1.query.trim() && user2.query.trim()) {
      setSubmitting(true);
      await onCollaborativeSearch(user1, user2, useLlm);
      setSubmitting(false);
    }
  };

  const handleUser1DraftChange = (next: SearchRequest) => {
    setUser1(next);
    onDraftChange?.(next, user2);
  };

  const handleUser2DraftChange = (next: SearchRequest) => {
    setUser2(next);
    onDraftChange?.(user1, next);
  };

  return (
    <div className="collab-main-form-box">

      <div className="collab-instructions-panel">
        <h3 className="instructions-title">Instructions</h3>
        <div className="instructions-box">
          <ul>
            <li>Add both users' preferences below.</li>
            <li>Once every user has put in their information, click <b>SEARCH TOGETHER</b>.</li>
          </ul>
        </div>
      </div>

      <div className="collab-forms-row">
        <div className="collab-user-card user-a-card">
          <QueryComponent
            onSearch={async () => {}}
            initialRequest={user1}
            onDraftChange={handleUser1DraftChange}
            showSubmit={false}
            radioNamePrefix="collab-user1"
          />
        </div>
        <div className="collab-user-card user-b-card">
          <QueryComponent
            onSearch={async () => {}}
            initialRequest={user2}
            onDraftChange={handleUser2DraftChange}
            showSubmit={false}
            radioNamePrefix="collab-user2"
          />
        </div>
      </div>

      <div className="collab-search-row-bottom">
        <label className="collab-ai-toggle">
          <span>Use AI?</span>
          <input
            type="checkbox"
            checked={useLlm}
            disabled={!llmAvailable}
            onChange={event => setUseLlm(event.target.checked)}
          />
        </label>
        <button type="button" className="collab-search-btn" onClick={handleSubmit} disabled={submitting || !user1.query.trim() || !user2.query.trim()}>
          {submitting ? 'SEARCHING...' : 'SEARCH TOGETHER'}
        </button>
      </div>
    </div>
  );
}

export default CollaborativeMode;
