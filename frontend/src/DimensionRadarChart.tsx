import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { DimensionActivation } from './types'
import './DimensionRadarChart.css'

interface SingleRadarChartProps {
  dimensions: DimensionActivation[]
  title: string
  color: string
}

function SingleRadarChart({ dimensions, title, color }: SingleRadarChartProps): JSX.Element {
  if (!dimensions || dimensions.length === 0) {
    return <div className="no-dimensions-single">No podcast categories detected</div>
  }

  // Find the max value for normalization
  const maxValue = Math.max(...dimensions.map(d => Math.abs(d.value)))
  
  // Prepare data for radar chart using absolute values
  const chartData = dimensions.map(d => ({
    dimension: String(d.dimension),
    value: maxValue > 0 ? Math.abs(d.value) / maxValue : 0,
    rawValue: d.value,
    fullLabel: d.label,
  }))

  return (
    <div className="single-radar-container">
      <h5 className="radar-subtitle">{title}</h5>
      <div className="radar-canvas-wrap">
        <ResponsiveContainer width="100%" height={420}>
          <RadarChart data={chartData} margin={{ top: 24, right: 24, bottom: 24, left: 24 }}>
            <PolarGrid stroke="#afd7c4" />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 13 }} stroke="#afd7c4" />
            <PolarRadiusAxis angle={90} domain={[0, 1]} tick={false} />
            <Radar
              name={title}
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.45}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="dimension-legend-single">
        {chartData.map((d, idx) => (
          <div key={idx} className="dimension-item-single">
            <span className="dimension-label-single" title={d.fullLabel}>
              {`${d.fullLabel}`}
            </span>
            <span className={`dimension-value-single`} style={{ color }}>
              {(d.rawValue * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface DimensionRadarChartProps {
  dimensions: {
    semantic: DimensionActivation[]
  }
}

function DimensionRadarChart({ dimensions }: DimensionRadarChartProps): JSX.Element {
  if (!dimensions) {
    return <div className="no-dimensions">Podcast category data unavailable</div>
  }

  const hasSemantic = dimensions.semantic && dimensions.semantic.length > 0

  return (
    <div className="dimension-radar-container">
      <h4 className="radar-title">Podcast Categories</h4>
      <div className="radar-charts-grid">
        {hasSemantic && (
          <SingleRadarChart 
            dimensions={dimensions.semantic} 
            title="Category Match Scores" 
            color="#4e8c3b"
          />
        )}
      </div>
    </div>
  )
}

export default DimensionRadarChart

