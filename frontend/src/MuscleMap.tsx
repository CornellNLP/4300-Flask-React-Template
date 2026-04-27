import { useState } from 'react';

export interface MuscleMapProps {
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

// Maps exercise muscle name → SVG shape IDs (bilateral muscles get left/right IDs)
const MUSCLE_MAP: Record<string, string[]> = {
  'neck':        ['f-neck', 'b-neck'],
  'shoulders':   ['f-shld-l', 'f-shld-r', 'b-shld-l', 'b-shld-r'],
  'chest':       ['f-chest'],
  'traps':       ['b-traps'],
  'lats':        ['b-lats-l', 'b-lats-r'],
  'middle back': ['b-mid-back'],
  'lower back':  ['b-low-back'],
  'abdominals':  ['f-abs'],
  'biceps':      ['f-bicep-l', 'f-bicep-r'],
  'triceps':     ['b-tricep-l', 'b-tricep-r'],
  'forearms':    ['f-farm-l', 'f-farm-r', 'b-farm-l', 'b-farm-r'],
  'quadriceps':  ['f-quad-l', 'f-quad-r'],
  'hamstrings':  ['b-ham-l', 'b-ham-r'],
  'glutes':      ['b-glut-l', 'b-glut-r'],
  'calves':      ['b-calf-l', 'b-calf-r'],
  'adductors':   ['f-add-l', 'f-add-r'],
  'abductors':   ['f-abd-l', 'f-abd-r', 'b-abd-l', 'b-abd-r'],
};

const ID_LABEL: Record<string, string> = {
  'f-neck': 'Neck',       'b-neck': 'Neck',
  'f-shld-l': 'Shoulders', 'f-shld-r': 'Shoulders',
  'b-shld-l': 'Shoulders', 'b-shld-r': 'Shoulders',
  'f-chest': 'Chest',
  'f-abs': 'Abdominals',
  'f-bicep-l': 'Biceps',   'f-bicep-r': 'Biceps',
  'f-farm-l': 'Forearms',  'f-farm-r': 'Forearms',
  'b-farm-l': 'Forearms',  'b-farm-r': 'Forearms',
  'f-quad-l': 'Quadriceps','f-quad-r': 'Quadriceps',
  'f-add-l': 'Adductors',  'f-add-r': 'Adductors',
  'f-abd-l': 'Abductors',  'f-abd-r': 'Abductors',
  'b-traps': 'Traps',
  'b-lats-l': 'Lats',      'b-lats-r': 'Lats',
  'b-mid-back': 'Middle Back',
  'b-low-back': 'Lower Back',
  'b-tricep-l': 'Triceps', 'b-tricep-r': 'Triceps',
  'b-glut-l': 'Glutes',    'b-glut-r': 'Glutes',
  'b-ham-l': 'Hamstrings', 'b-ham-r': 'Hamstrings',
  'b-calf-l': 'Calves',    'b-calf-r': 'Calves',
  'b-abd-l': 'Abductors',  'b-abd-r': 'Abductors',
};

const IDLE   = 'var(--muscle-idle)';
const BASE   = '#1c2028';
const STROKE = 'var(--border-soft, #2a2f3a)';

function buildSets(primary: string[], secondary: string[]) {
  const p = new Set<string>();
  const s = new Set<string>();
  for (const m of primary)   (MUSCLE_MAP[m.toLowerCase()] ?? []).forEach(id => p.add(id));
  for (const m of secondary) (MUSCLE_MAP[m.toLowerCase()] ?? []).forEach(id => { if (!p.has(id)) s.add(id); });
  return { p, s };
}

function getFill(id: string, p: Set<string>, s: Set<string>) {
  if (p.has(id)) return 'var(--accent)';
  if (s.has(id)) return 'var(--accent-soft)';
  return IDLE;
}

// ─── shape helpers ───────────────────────────────────────────────────────────

type MProps = {
  id: string;
  p: Set<string>;
  s: Set<string>;
  onHover: (l: string) => void;
  onLeave: () => void;
};

function R({ id, x, y, w, h, rx = 4, p, s, onHover, onLeave }: MProps & { x: number; y: number; w: number; h: number; rx?: number }) {
  return (
    <rect id={id} x={x} y={y} width={w} height={h} rx={rx}
      fill={getFill(id, p, s)} stroke={STROKE} strokeWidth={0.6}
      onMouseEnter={() => onHover(ID_LABEL[id] ?? '')}
      onMouseLeave={onLeave}
      style={{ transition: 'fill 200ms ease', cursor: 'default' }}
    />
  );
}

function E({ id, cx, cy, rx, ry, p, s, onHover, onLeave }: MProps & { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <ellipse id={id} cx={cx} cy={cy} rx={rx} ry={ry}
      fill={getFill(id, p, s)} stroke={STROKE} strokeWidth={0.6}
      onMouseEnter={() => onHover(ID_LABEL[id] ?? '')}
      onMouseLeave={onLeave}
      style={{ transition: 'fill 200ms ease', cursor: 'default' }}
    />
  );
}

// ─── front figure ─────────────────────────────────────────────────────────────

function FrontFigure({ p, s, onHover, onLeave }: { p: Set<string>; s: Set<string>; onHover: (l: string) => void; onLeave: () => void }) {
  const sp = { p, s, onHover, onLeave };
  return (
    <svg viewBox="0 0 100 248" xmlns="http://www.w3.org/2000/svg">
      {/* ── non-muscle base shapes ── */}
      <circle cx={50} cy={14} r={12} fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={23} y={96}  width={54} height={12} rx={3}  fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={25} y={157} width={17} height={44} rx={3}  fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={58} y={157} width={17} height={44} rx={3}  fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={21} y={200} width={22} height={10} rx={3}  fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={57} y={200} width={22} height={10} rx={3}  fill={BASE} stroke={STROKE} strokeWidth={0.6} />

      {/* ── muscle shapes (front) ── */}
      <R id="f-neck"    x={44} y={26} w={12} h={12} rx={3} {...sp} />
      <E id="f-shld-l"  cx={16} cy={44} rx={10} ry={9} {...sp} />
      <E id="f-shld-r"  cx={84} cy={44} rx={10} ry={9} {...sp} />
      <R id="f-chest"   x={24} y={36} w={52} h={26} rx={4} {...sp} />
      <R id="f-bicep-l" x={7}  y={36} w={12} h={30} rx={5} {...sp} />
      <R id="f-bicep-r" x={81} y={36} w={12} h={30} rx={5} {...sp} />
      <R id="f-farm-l"  x={7}  y={68} w={11} h={26} rx={5} {...sp} />
      <R id="f-farm-r"  x={82} y={68} w={11} h={26} rx={5} {...sp} />
      <R id="f-abs"     x={27} y={62} w={46} h={36} rx={3} {...sp} />
      <R id="f-abd-l"   x={14} y={96} w={12} h={34} rx={3} {...sp} />
      <R id="f-abd-r"   x={74} y={96} w={12} h={34} rx={3} {...sp} />
      <R id="f-quad-l"  x={24} y={96} w={20} h={62} rx={4} {...sp} />
      <R id="f-quad-r"  x={56} y={96} w={20} h={62} rx={4} {...sp} />
      <R id="f-add-l"   x={43} y={98} w={7}  h={50} rx={3} {...sp} />
      <R id="f-add-r"   x={50} y={98} w={7}  h={50} rx={3} {...sp} />
    </svg>
  );
}

// ─── back figure ──────────────────────────────────────────────────────────────

function BackFigure({ p, s, onHover, onLeave }: { p: Set<string>; s: Set<string>; onHover: (l: string) => void; onLeave: () => void }) {
  const sp = { p, s, onHover, onLeave };
  return (
    <svg viewBox="0 0 100 248" xmlns="http://www.w3.org/2000/svg">
      {/* ── non-muscle base shapes ── */}
      <circle cx={50} cy={14} r={12} fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={25} y={156} width={17} height={44} rx={3} fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={58} y={156} width={17} height={44} rx={3} fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={21} y={199} width={22} height={10} rx={3} fill={BASE} stroke={STROKE} strokeWidth={0.6} />
      <rect x={57} y={199} width={22} height={10} rx={3} fill={BASE} stroke={STROKE} strokeWidth={0.6} />

      {/* ── muscle shapes (back) ── */}
      <R id="b-neck"     x={44}  y={26} w={12} h={10} rx={3} {...sp} />
      <R id="b-traps"    x={24}  y={36} w={52} h={18} rx={4} {...sp} />
      <E id="b-shld-l"   cx={16} cy={44} rx={10} ry={9} {...sp} />
      <E id="b-shld-r"   cx={84} cy={44} rx={10} ry={9} {...sp} />
      <R id="b-tricep-l" x={7}   y={36} w={12} h={30} rx={5} {...sp} />
      <R id="b-tricep-r" x={81}  y={36} w={12} h={30} rx={5} {...sp} />
      <R id="b-farm-l"   x={7}   y={68} w={11} h={26} rx={5} {...sp} />
      <R id="b-farm-r"   x={82}  y={68} w={11} h={26} rx={5} {...sp} />
      <R id="b-lats-l"   x={22}  y={52} w={18} h={36} rx={4} {...sp} />
      <R id="b-lats-r"   x={60}  y={52} w={18} h={36} rx={4} {...sp} />
      <R id="b-mid-back" x={36}  y={54} w={28} h={22} rx={3} {...sp} />
      <R id="b-low-back" x={34}  y={76} w={32} h={20} rx={3} {...sp} />
      <E id="b-glut-l"   cx={36} cy={106} rx={14} ry={10} {...sp} />
      <E id="b-glut-r"   cx={64} cy={106} rx={14} ry={10} {...sp} />
      <R id="b-abd-l"    x={14}  y={96}  w={12} h={32} rx={3} {...sp} />
      <R id="b-abd-r"    x={74}  y={96}  w={12} h={32} rx={3} {...sp} />
      <R id="b-ham-l"    x={24}  y={110} w={20} h={48} rx={4} {...sp} />
      <R id="b-ham-r"    x={56}  y={110} w={20} h={48} rx={4} {...sp} />
      <R id="b-calf-l"   x={25}  y={157} w={17} h={42} rx={4} {...sp} />
      <R id="b-calf-r"   x={58}  y={157} w={17} h={42} rx={4} {...sp} />
    </svg>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function MuscleMap({ primaryMuscles, secondaryMuscles }: MuscleMapProps) {
  const [hovered, setHovered] = useState('');
  const { p, s } = buildSets(primaryMuscles, secondaryMuscles);

  const figProps = {
    p, s,
    onHover: setHovered,
    onLeave: () => setHovered(''),
  };

  return (
    <div className="muscle-map">
      <div className="muscle-map__grid">
        <div className="figure">
          <span className="figure__label">FRONT</span>
          <FrontFigure {...figProps} />
        </div>
        <div className="figure">
          <span className="figure__label">BACK</span>
          <BackFigure {...figProps} />
        </div>
      </div>

      <div className="muscle-map__readout">
        {hovered
          ? <><span className="muscle-map__readout-key">▸</span>{hovered}</>
          : <span style={{ color: 'var(--text-faint)' }}>hover to identify</span>
        }
      </div>

      <div className="legend" style={{ padding: '8px 12px 10px', gap: 16, display: 'flex', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)' }}>PRIMARY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-soft)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)' }}>SECONDARY</span>
        </div>
      </div>
    </div>
  );
}
