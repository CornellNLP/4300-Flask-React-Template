import { useMemo, useState } from 'react';
import type {
  Exercise,
  MuscleGraphData,
  MuscleGraphEdge,
  MuscleGraphNode,
} from './types';

type Props = {
  queryMuscles: string[];
  exercises: Exercise[];
};

const WIDTH = 940;
const HEIGHT = 660;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const MUSCLE_RADIUS = 170;
const EXERCISE_RADIUS = 260;
const MAX_EXERCISE_LABEL = 22;

function buildGraphData(
  queryMuscles: string[],
  exercises: Exercise[],
): MuscleGraphData {
  const queryMuscleSet = new Set(queryMuscles.map((m) => m.toLowerCase()));

  const muscleSet = new Set<string>();
  const exerciseMuscles = new Map<string, string[]>();

  for (const ex of exercises) {
    const muscles = [
      ...(ex.primaryMuscles || []),
      ...(ex.secondaryMuscles || []),
    ]
      .map((m) => m.toLowerCase())
      .filter(Boolean);
    if (muscles.length === 0) continue;
    exerciseMuscles.set(ex.name, muscles);
    for (const m of muscles) muscleSet.add(m);
  }

  // Fallback: when the query yielded no explicit muscles, treat the
  // primary muscles of the top 3 results as "query-relevant" so the
  // graph still highlights something meaningful.
  if (queryMuscleSet.size === 0) {
    for (const ex of exercises.slice(0, 3)) {
      for (const m of ex.primaryMuscles || []) {
        queryMuscleSet.add(m.toLowerCase());
      }
    }
  }

  const muscleNodes: MuscleGraphNode[] = Array.from(muscleSet).map((m) => ({
    id: `muscle:${m}`,
    label: m,
    type: 'muscle',
    isQueryRelevant: queryMuscleSet.has(m),
  }));

  const exerciseNodes: MuscleGraphNode[] = Array.from(
    exerciseMuscles.keys(),
  ).map((name) => ({
    id: `exercise:${name}`,
    label: name,
    type: 'exercise',
  }));

  const edges: MuscleGraphEdge[] = [];

  for (const [name, muscles] of exerciseMuscles) {
    for (const m of muscles) {
      edges.push({
        source: `exercise:${name}`,
        target: `muscle:${m}`,
        type: 'exercise-muscle',
      });
    }
  }

  // muscle-cooccurrence: connect query-relevant muscles to other muscles
  // that appear together with them in any single exercise.
  const queryMuscleIds = muscleNodes
    .filter((n) => n.isQueryRelevant)
    .map((n) => n.label);
  const seenPair = new Set<string>();
  for (const muscles of exerciseMuscles.values()) {
    for (const a of queryMuscleIds) {
      if (!muscles.includes(a)) continue;
      for (const b of muscles) {
        if (b === a) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seenPair.has(key)) continue;
        seenPair.add(key);
        edges.push({
          source: `muscle:${a}`,
          target: `muscle:${b}`,
          type: 'muscle-cooccurrence',
        });
      }
    }
  }

  return { nodes: [...muscleNodes, ...exerciseNodes], edges };
}

type LaidOutNode = MuscleGraphNode & { x: number; y: number };

function layoutNodes(data: MuscleGraphData): LaidOutNode[] {
  const queryMuscles = data.nodes.filter(
    (n) => n.type === 'muscle' && n.isQueryRelevant,
  );
  const otherMuscles = data.nodes.filter(
    (n) => n.type === 'muscle' && !n.isQueryRelevant,
  );
  const exercises = data.nodes.filter((n) => n.type === 'exercise');

  const out: LaidOutNode[] = [];

  // Inner ring: query-relevant muscles. If only one, place at center.
  if (queryMuscles.length === 1) {
    out.push({ ...queryMuscles[0], x: CENTER_X, y: CENTER_Y });
  } else {
    const r = Math.min(70, 30 + queryMuscles.length * 8);
    queryMuscles.forEach((n, i) => {
      const a = (i / queryMuscles.length) * Math.PI * 2 - Math.PI / 2;
      out.push({ ...n, x: CENTER_X + Math.cos(a) * r, y: CENTER_Y + Math.sin(a) * r });
    });
  }

  // Mid ring: secondary muscles
  otherMuscles.forEach((n, i) => {
    const a = (i / Math.max(otherMuscles.length, 1)) * Math.PI * 2;
    out.push({
      ...n,
      x: CENTER_X + Math.cos(a) * MUSCLE_RADIUS,
      y: CENTER_Y + Math.sin(a) * MUSCLE_RADIUS,
    });
  });

  // Outer ring: exercises, distributed around the muscle they primarily
  // attach to so edges don't crisscross the whole canvas.
  const muscleAngles = new Map<string, number>();
  for (const n of out) {
    if (n.type !== 'muscle') continue;
    const dx = n.x - CENTER_X;
    const dy = n.y - CENTER_Y;
    muscleAngles.set(n.label, Math.atan2(dy, dx));
  }

  const exerciseAnchor = (ex: MuscleGraphNode): number => {
    const edge = data.edges.find(
      (e) => e.source === ex.id && e.type === 'exercise-muscle',
    );
    if (!edge) return Math.random() * Math.PI * 2;
    const muscleLabel = edge.target.replace(/^muscle:/, '');
    return muscleAngles.get(muscleLabel) ?? Math.random() * Math.PI * 2;
  };

  const sorted = [...exercises].sort(
    (a, b) => exerciseAnchor(a) - exerciseAnchor(b),
  );
  sorted.forEach((n, i) => {
    const a = (i / Math.max(sorted.length, 1)) * Math.PI * 2;
    out.push({
      ...n,
      x: CENTER_X + Math.cos(a) * EXERCISE_RADIUS,
      y: CENTER_Y + Math.sin(a) * EXERCISE_RADIUS,
    });
  });

  return out;
}

export default function MuscleGraph({ queryMuscles, exercises }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { graph, laidOut, byId } = useMemo(() => {
    const g = buildGraphData(queryMuscles, exercises);
    const l = layoutNodes(g);
    const map = new Map<string, LaidOutNode>();
    for (const n of l) map.set(n.id, n);
    return { graph: g, laidOut: l, byId: map };
  }, [queryMuscles, exercises]);

  if (exercises.length === 0) {
    return (
      <div className="musclegraph musclegraph--empty">
        <p>Run a search to see the muscle / exercise map.</p>
      </div>
    );
  }

  const isFaded = (id: string): boolean => {
    if (!hovered) return false;
    if (id === hovered) return false;
    const adjacent = graph.edges.some(
      (e) =>
        (e.source === hovered && e.target === id) ||
        (e.target === hovered && e.source === id),
    );
    return !adjacent;
  };

  return (
    <div className="musclegraph">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="musclegraph__svg"
        role="img"
        aria-label="Muscle and exercise relationship graph"
      >
        {/* edges */}
        <g className="musclegraph__edges">
          {graph.edges.map((e, i) => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            if (!a || !b) return null;
            const faded = isFaded(e.source) || isFaded(e.target);
            const cls =
              `musclegraph__edge musclegraph__edge--${e.type}` +
              (faded ? ' is-faded' : '');
            return (
              <line
                key={`${e.source}-${e.target}-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={cls}
              />
            );
          })}
        </g>

        {/* nodes */}
        <g className="musclegraph__nodes">
          {laidOut.map((n) => {
            const isMuscle = n.type === 'muscle';
            const r = isMuscle ? (n.isQueryRelevant ? 14 : 9) : 5;
            const cls =
              `musclegraph__node musclegraph__node--${n.type}` +
              (n.isQueryRelevant ? ' is-query-relevant' : '') +
              (isFaded(n.id) ? ' is-faded' : '');

            // Exercise labels always shown, anchored outward radially so
            // they don't crash into the node or the edges. Muscle labels
            // are placed below the node (or above for query muscles).
            let labelX = 0;
            let labelY = isMuscle ? r + 12 : 0;
            let anchor: 'start' | 'middle' | 'end' = 'middle';
            let labelText = n.label;

            if (!isMuscle) {
              const dx = n.x - CENTER_X;
              const dy = n.y - CENTER_Y;
              const norm = Math.hypot(dx, dy) || 1;
              const ox = (dx / norm) * (r + 6);
              const oy = (dy / norm) * (r + 6);
              labelX = ox;
              labelY = oy;
              anchor = dx > 8 ? 'start' : dx < -8 ? 'end' : 'middle';
              if (labelText.length > MAX_EXERCISE_LABEL) {
                labelText = labelText.slice(0, MAX_EXERCISE_LABEL - 1) + '…';
              }
            }

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                className={cls}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {isMuscle ? (
                  <circle r={r} />
                ) : (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={1.5} />
                )}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={anchor}
                  dominantBaseline={isMuscle ? 'hanging' : 'middle'}
                  className="musclegraph__label"
                >
                  {labelText}
                </text>
                {!isMuscle && hovered === n.id && labelText !== n.label && (
                  <title>{n.label}</title>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="musclegraph__legend">
        <span className="musclegraph__legend-item">
          <span className="musclegraph__legend-dot musclegraph__legend-dot--query" />
          query muscle
        </span>
        <span className="musclegraph__legend-item">
          <span className="musclegraph__legend-dot musclegraph__legend-dot--muscle" />
          related muscle
        </span>
        <span className="musclegraph__legend-item">
          <span className="musclegraph__legend-dot musclegraph__legend-dot--exercise" />
          exercise
        </span>
      </div>
    </div>
  );
}
