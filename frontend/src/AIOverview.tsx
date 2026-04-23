import { AiOverview } from './types'

type AIOverviewProps = {
  overview: AiOverview
}

function AIOverview({ overview }: AIOverviewProps): JSX.Element {
  const hasCollaborativeQueries = Boolean((overview as AiOverview & { user_query_a?: string; user_query_b?: string }).user_query_a || (overview as AiOverview & { user_query_a?: string; user_query_b?: string }).user_query_b)
  const collabOverview = overview as AiOverview & { user_query_a?: string; user_query_b?: string }

  return (
    <section className="ai-overview-panel" aria-label="AI query rewrite overview">
      <h3>AI Overview</h3>
      <div className="ai-overview-grid">
        {hasCollaborativeQueries ? (
          <>
            <div className="ai-overview-item">
              <span className="ai-overview-label">User A Query</span>
              <span className="ai-overview-value">{collabOverview.user_query_a || 'N/A'}</span>
            </div>
            <div className="ai-overview-item">
              <span className="ai-overview-label">User B Query</span>
              <span className="ai-overview-value">{collabOverview.user_query_b || 'N/A'}</span>
            </div>
          </>
        ) : (
          <div className="ai-overview-item">
            <span className="ai-overview-label">Original Query</span>
            <span className="ai-overview-value">{overview.user_query || 'N/A'}</span>
          </div>
        )}
        <div className="ai-overview-item">
          <span className="ai-overview-label">Rewritten Query</span>
          <span className="ai-overview-value">{overview.modified_query || 'N/A'}</span>
        </div>
        <div className="ai-overview-item">
          <span className="ai-overview-label">Explanation</span>
          <span className="ai-overview-value">{overview.explanation || 'N/A'}</span>
        </div>
      </div>
    </section>
  )
}

export default AIOverview
