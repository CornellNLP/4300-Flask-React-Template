// ExerciseCard — extracted from App.tsx.
// This component is pure presentation over an existing Exercise type.
// Keep the Exercise shape identical to what App already passes in.

import type { Exercise } from './types';

const QUALITY_COPY: Record<string, string> = {
  strong: 'STRONG MATCH',
  moderate: 'MODERATE',
  weak: 'WEAK',
};

export type PlanState = {
  loading: boolean;
  text: string;
  error: string | null;
};

export interface ExerciseCardProps {
  exercise: Exercise;
  rank: number;                                  // 1-based
  expanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelectCard: () => void;
  onGeneratePlan: (exercise: Exercise) => void;  // top card only
  planState: PlanState;                          // top card only
  useLlm: boolean;
}

function RankNumeral({ n }: { n: number }) {
  return <span className="rank-numeral">{String(n).padStart(2, '0')}</span>;
}

function MatchBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score * 100)));
  return (
    <div className="matchbar" aria-label={`Match score ${pct}%`}>
      <div className="matchbar__fill" style={{ width: `${pct}%` }} />
      <span className="matchbar__val">{pct}</span>
    </div>
  );
}

export default function ExerciseCard({
  exercise,
  rank,
  expanded,
  isSelected,
  onToggleExpand,
  onSelectCard,
  onGeneratePlan,
  planState,
  useLlm,
}: ExerciseCardProps) {
  const isTop = rank === 1;

  return (
    <article
      className={`ex-card ${isTop ? 'ex-card--top' : ''} ${expanded ? 'ex-card--open' : ''} ${isSelected ? 'ex-card--selected' : ''}`}
      onClick={onSelectCard}
    >
      <header className="ex-card__head">
        <RankNumeral n={rank} />
        <div className="ex-card__title-wrap">
          <h3 className="ex-card__title">{exercise.name}</h3>
          <div className="ex-card__meta">
            {exercise.level && (
              <span className="meta-pill">{exercise.level}</span>
            )}
            {exercise.equipment && (
              <span className="meta-pill meta-pill--mono">
                {exercise.equipment}
              </span>
            )}
            {exercise.category && (
              <span className="meta-pill">{exercise.category}</span>
            )}
            {exercise.match_quality && (
              <span className={`match-badge match-badge--${exercise.match_quality}`}>
                {QUALITY_COPY[exercise.match_quality] ?? exercise.match_quality}
              </span>
            )}
          </div>
        </div>
        <div className="ex-card__score">
          <MatchBar score={exercise.score} />
        </div>
      </header>

      <div className="ex-card__muscles">
        <div className="muscle-group">
          <span className="muscle-group__label">PRIMARY</span>
          <div className="muscle-group__chips">
            {exercise.primaryMuscles.map((m) => (
              <span key={m} className="muscle-chip muscle-chip--primary">{m}</span>
            ))}
          </div>
        </div>
        {exercise.secondaryMuscles.length > 0 && (
          <div className="muscle-group">
            <span className="muscle-group__label">SECONDARY</span>
            <div className="muscle-group__chips">
              {exercise.secondaryMuscles.map((m) => (
                <span key={m} className="muscle-chip muscle-chip--secondary">{m}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {exercise.tags && exercise.tags.length > 0 && (
        <div className="ex-card__tags">
          <span className="ex-card__tags-label">WHY IT MATCHED</span>
          {exercise.tags.map((t, i) => (
            <span key={i} className="tag">{t}</span>
          ))}
        </div>
      )}

      <div className="ex-card__actions">
        <button type="button" className="btn-ghost" onClick={onToggleExpand}>
          {expanded ? 'Hide instructions' : 'Show instructions'}
          <span className={`chev ${expanded ? 'chev--up' : ''}`}>↓</span>
        </button>
        {isTop && useLlm && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => onGeneratePlan(exercise)}
            disabled={planState.loading}
          >
            {planState.loading
              ? 'Building session…'
              : planState.text
                ? 'Regenerate session'
                : "Generate today's session"}
          </button>
        )}
      </div>

      {expanded && exercise.instructions && (
        <ol className="ex-card__steps">
          {exercise.instructions.map((step, i) => (
            <li key={i}>
              <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      )}

      {isTop && useLlm && (planState.text || planState.error) && (
        <div className="plan-panel">
          <div className="plan-panel__head">
            <span className="plan-panel__label">AI SESSION PLAN</span>
            <span className="plan-panel__status">
              {planState.loading ? 'streaming…' : 'ready'}
            </span>
          </div>
          {planState.error && (
            <p className="plan-panel__error">{planState.error}</p>
          )}
          {planState.text && (
            <pre className="plan-panel__text">{planState.text}</pre>
          )}
        </div>
      )}
    </article>
  );
}
