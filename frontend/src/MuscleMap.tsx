import Model from 'react-body-highlighter';
import type { IExerciseData, Muscle } from 'react-body-highlighter';

export interface MuscleMapProps {
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

// Maps app muscle names → library Muscle strings
const APP_TO_LIB: Record<string, Muscle[]> = {
  'abdominals':  ['abs'],
  'abductors':   ['abductors'],
  'adductors':   ['adductor'],
  'biceps':      ['biceps'],
  'calves':      ['calves'],
  'chest':       ['chest'],
  'forearms':    ['forearm'],
  'glutes':      ['gluteal'],
  'hamstrings':  ['hamstring'],
  'lats':        ['upper-back'],        // closest available in the library
  'lower back':  ['lower-back'],
  'middle back': ['upper-back'],
  'neck':        ['neck'],
  'quadriceps':  ['quadriceps'],
  'shoulders':   ['front-deltoids', 'back-deltoids'],
  'traps':       ['trapezius'],
  'triceps':     ['triceps'],
};

function toLibMuscles(muscles: string[]): Muscle[] {
  const out = new Set<Muscle>();
  for (const m of muscles) {
    const mapped = APP_TO_LIB[m.toLowerCase()];
    if (mapped) mapped.forEach(id => out.add(id));
  }
  return [...out];
}

function buildData(primaryMuscles: string[], secondaryMuscles: string[]): IExerciseData[] {
  const primary   = toLibMuscles(primaryMuscles);
  const secondary = toLibMuscles(secondaryMuscles).filter(m => !primary.includes(m));

  const data: IExerciseData[] = [];
  if (primary.length > 0)   data.push({ name: 'primary',   muscles: primary,   frequency: 2 });
  if (secondary.length > 0) data.push({ name: 'secondary', muscles: secondary, frequency: 1 });
  return data;
}

// index 0 = frequency 1 = secondary, index 1 = frequency 2 = primary
const HIGHLIGHT_COLORS = ['rgba(255,108,40,0.45)', '#ff6c28'];
const BODY_COLOR = '#262a33'; // --muscle-idle

const SVG_STYLE: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  maxHeight: 360,
};

const FIGURE_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
};

export default function MuscleMap({ primaryMuscles, secondaryMuscles }: MuscleMapProps) {
  const data = buildData(primaryMuscles, secondaryMuscles);

  return (
    <div className="muscle-map">
      <div className="muscle-map__grid">
        <div className="figure">
          <span className="figure__label">FRONT</span>
          <Model
            data={data}
            type="anterior"
            bodyColor={BODY_COLOR}
            highlightedColors={HIGHLIGHT_COLORS}
            style={FIGURE_STYLE}
            svgStyle={SVG_STYLE}
          />
        </div>
        <div className="figure">
          <span className="figure__label">BACK</span>
          <Model
            data={data}
            type="posterior"
            bodyColor={BODY_COLOR}
            highlightedColors={HIGHLIGHT_COLORS}
            style={FIGURE_STYLE}
            svgStyle={SVG_STYLE}
          />
        </div>
      </div>

      <div className="legend" style={{ padding: '8px 12px 10px', gap: 16, display: 'flex', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ff6c28', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)' }}>PRIMARY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,108,40,0.45)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)' }}>SECONDARY</span>
        </div>
      </div>
    </div>
  );
}
