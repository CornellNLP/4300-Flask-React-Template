import { useMemo } from 'react';
import type { Exercise } from './types';
import { MUSCLE_OPTIONS } from './types';

type Props = {
  queryMuscles: string[];
  exercises: Exercise[];
};

const WIDTH = 760;
const HEIGHT = 760;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const OUTER = 240;
const RINGS = [0.2, 0.4, 0.6, 0.8, 1.0];

// Axis angles: distribute muscles evenly around the circle, starting at the
// top (-π/2) and going clockwise — same convention as the reference figure.
function angleFor(index: number, total: number): number {
  return (index / total) * Math.PI * 2 - Math.PI / 2;
}

function project(angle: number, value: number): { x: number; y: number } {
  const r = OUTER * Math.max(0, Math.min(1, value));
  return {
    x: CENTER_X + Math.cos(angle) * r,
    y: CENTER_Y + Math.sin(angle) * r,
  };
}

function computeScores(
  muscles: string[],
  queryMuscles: string[],
  exercises: Exercise[],
): { intent: number[]; coverage: number[] } {
  const querySet = new Set(queryMuscles.map((m) => m.toLowerCase()));
  const intent = muscles.map((m) => (querySet.has(m.toLowerCase()) ? 1 : 0));

  const raw = muscles.map((m) => {
    const target = m.toLowerCase();
    let s = 0;
    for (const ex of exercises) {
      if ((ex.primaryMuscles || []).some((p) => p.toLowerCase() === target)) {
        s += 1;
      }
      if ((ex.secondaryMuscles || []).some((p) => p.toLowerCase() === target)) {
        s += 0.5;
      }
    }
    return s;
  });
  const max = Math.max(...raw, 0);
  const coverage = raw.map((v) => (max > 0 ? v / max : 0));

  return { intent, coverage };
}

function polygonPoints(
  scores: number[],
  angles: number[],
): string {
  return scores
    .map((v, i) => {
      const { x, y } = project(angles[i], v);
      return `${x},${y}`;
    })
    .join(' ');
}

export default function MuscleRadar({ queryMuscles, exercises }: Props) {
  const { angles, intent, coverage, hasIntent } = useMemo(() => {
    const a = MUSCLE_OPTIONS.map((_, i) => angleFor(i, MUSCLE_OPTIONS.length));
    const { intent, coverage } = computeScores(
      MUSCLE_OPTIONS,
      queryMuscles,
      exercises,
    );
    return {
      angles: a,
      intent,
      coverage,
      hasIntent: intent.some((v) => v > 0),
    };
  }, [queryMuscles, exercises]);

  if (exercises.length === 0) {
    return (
      <div className="muscleradar muscleradar--empty">
        <p>Run a search to see the muscle relevance graph.</p>
      </div>
    );
  }

  return (
    <div className="muscleradar">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="muscleradar__svg"
        role="img"
        aria-label="Muscle relevance radar chart"
      >
        {/* concentric grid rings */}
        <g className="muscleradar__rings">
          {RINGS.map((r) => (
            <circle
              key={r}
              cx={CENTER_X}
              cy={CENTER_Y}
              r={OUTER * r}
              className="muscleradar__ring"
            />
          ))}
          {RINGS.map((r) => (
            <text
              key={`tick-${r}`}
              x={CENTER_X + 4}
              y={CENTER_Y - OUTER * r}
              className="muscleradar__tick"
            >
              {r.toFixed(1)}
            </text>
          ))}
        </g>

        {/* axis spokes */}
        <g className="muscleradar__axes">
          {MUSCLE_OPTIONS.map((m, i) => {
            const { x, y } = project(angles[i], 1);
            return (
              <line
                key={`axis-${m}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={x}
                y2={y}
                className="muscleradar__axis"
              />
            );
          })}
        </g>

        {/* coverage polygon (drawn first so intent overlays it) */}
        <polygon
          className="muscleradar__poly muscleradar__poly--coverage"
          points={polygonPoints(coverage, angles)}
        />
        {coverage.map((v, i) => {
          const { x, y } = project(angles[i], v);
          return (
            <circle
              key={`cov-${i}`}
              cx={x}
              cy={y}
              r={3}
              className="muscleradar__dot muscleradar__dot--coverage"
            />
          );
        })}

        {/* intent polygon */}
        {hasIntent && (
          <>
            <polygon
              className="muscleradar__poly muscleradar__poly--intent"
              points={polygonPoints(intent, angles)}
            />
            {intent.map((v, i) => {
              if (v === 0) return null;
              const { x, y } = project(angles[i], v);
              return (
                <circle
                  key={`int-${i}`}
                  cx={x}
                  cy={y}
                  r={4}
                  className="muscleradar__dot muscleradar__dot--intent"
                />
              );
            })}
          </>
        )}

        {/* axis labels */}
        <g className="muscleradar__labels">
          {MUSCLE_OPTIONS.map((m, i) => {
            const a = angles[i];
            const lx = CENTER_X + Math.cos(a) * (OUTER + 22);
            const ly = CENTER_Y + Math.sin(a) * (OUTER + 22);
            const cosA = Math.cos(a);
            const anchor =
              cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle';
            const isQuery = queryMuscles.some(
              (q) => q.toLowerCase() === m.toLowerCase(),
            );
            return (
              <text
                key={`label-${m}`}
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={
                  'muscleradar__label' +
                  (isQuery ? ' is-query-relevant' : '')
                }
              >
                {m}
              </text>
            );
          })}
        </g>
      </svg>

      <div className="muscleradar__legend">
        {hasIntent && (
          <span className="muscleradar__legend-item">
            <span className="muscleradar__legend-dot muscleradar__legend-dot--intent" />
            query targeting
          </span>
        )}
        <span className="muscleradar__legend-item">
          <span className="muscleradar__legend-dot muscleradar__legend-dot--coverage" />
          coverage in top results
        </span>
      </div>
    </div>
  );
}
