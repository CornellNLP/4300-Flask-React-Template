/**
 * RagPanel — auto-triggered post-search explanation panel.
 *
 * After each search that returns results, this component calls /api/rag with
 * the query + the exact restaurants shown to the user. The LLM streams back
 * a grounded synthesis (2–4 sentences) explaining why the results match.
 *
 * The LLM only sees what the IR system already retrieved — no hallucination.
 */
import { useState, useEffect, useRef } from 'react'
import { Restaurant } from './types'

interface RagPanelProps {
  query: string
  results: Restaurant[]
}

function RagPanel({ query, results }: RagPanelProps): JSX.Element | null {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const abortRef                      = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset when query or results change
    setExplanation('')
    setError(null)

    if (!query.trim() || results.length === 0) {
      setLoading(false)
      return
    }

    // Abort any in-flight request from a previous search
    if (abortRef.current) abortRef.current.abort()
    const controller  = new AbortController()
    abortRef.current  = controller

    setLoading(true)

    fetch('/api/rag', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, results }),
      signal:  controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || `Server error ${res.status}`)
          setLoading(false)
          return
        }

        setLoading(false)
        const reader  = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''
        let text      = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const payload = JSON.parse(line.slice(6))
              if (payload.error) { setError(payload.error); return }
              if (payload.content) {
                text += payload.content
                setExplanation(text)
              }
            } catch { /* ignore malformed SSE lines */ }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Unable to generate explanation — please try again.')
          setLoading(false)
        }
      })

    return () => { controller.abort() }
  }, [query, results])

  if (!query.trim()) return null

  return (
    <div className="rag-panel">
      {loading && (
        <div className="rag-loading">
          <span className="rag-label">Analyzing results</span>
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      )}
      {error && <p className="rag-error">{error}</p>}
      {!loading && !error && explanation && (
        <p className="rag-explanation">{explanation}</p>
      )}
    </div>
  )
}

export default RagPanel
