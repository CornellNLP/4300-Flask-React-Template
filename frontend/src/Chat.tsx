import { useState, useRef, useEffect } from 'react'
import SearchIcon from './assets/mag.png'
import { AitaPost, LlmSearchResponse } from './types'

const VERDICT_COLORS: Record<string, string> = {
  NTA: '#2e7d32',
  YTA: '#c62828',
  ESH: '#e65100',
  NAH: '#1565c0',
}

interface RagTurn {
  userMessage: string
  rewrittenQuery: string | null
  irResults: AitaPost[]
  llmAnswer: string
}

interface ChatProps {
  method: 'SVD' | 'TF-IDF'
  onIrResults?: (posts: AitaPost[], rewrittenQuery: string) => void
}

function Chat({ method, onIrResults }: ChatProps): JSX.Element {
  const [turns, setTurns] = useState<RagTurn[]>([])
  const [input, setInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, loading])

  const sendMessage = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)
    setError(null)

    try {
      const methodParam = method === 'TF-IDF' ? 'tfidf' : 'svd'
      const response = await fetch('/api/llm_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, method: methodParam }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError('Error: ' + (data.error || response.status))
        setLoading(false)
        return
      }

      const data: LlmSearchResponse = await response.json()
      const turn: RagTurn = {
        userMessage: text,
        rewrittenQuery: data.rewritten_query || null,
        irResults: data.ir_results || [],
        llmAnswer: data.llm_answer || '',
      }
      setTurns(prev => [...prev, turn])

      if (onIrResults && data.ir_results?.length && data.rewritten_query) {
        onIrResults(data.ir_results, data.rewritten_query)
      }
    } catch {
      setError('Something went wrong. Check the console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div id="messages">
        {turns.map((turn, i) => (
          <div key={i} className="rag-turn">
            {/* User message */}
            <div className="message user">
              <p>{turn.userMessage}</p>
            </div>

            {/* IR retrieval section */}
            {turn.rewrittenQuery && (
              <div className="rag-retrieval">
                <div className="rag-section-label">
                  IR Query: <em>{turn.rewrittenQuery}</em>
                </div>
                <div className="rag-ir-results">
                  {turn.irResults.slice(0, 5).map((post, j) => (
                    <div key={j} className="rag-post-card">
                      {post.verdict && (
                        <span
                          className="verdict-badge"
                          style={{ background: VERDICT_COLORS[post.verdict] ?? '#555' }}
                        >
                          {post.verdict}
                        </span>
                      )}
                      <div className="rag-post-title">{post.title}</div>
                      <div className="rag-post-snippet">
                        {(post.selftext || '').slice(0, 150)}
                        {(post.selftext || '').length > 150 ? '…' : ''}
                      </div>
                      <div className="rag-post-sim">sim: {post.similarity?.toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LLM answer */}
            {turn.llmAnswer && (
              <div className="message assistant">
                <p>{turn.llmAnswer}</p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="rag-loading">
            <div className="loading-indicator visible">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
            <span className="rag-loading-label">Retrieving & synthesizing…</span>
          </div>
        )}

        {error && (
          <div className="message assistant">
            <p style={{ color: '#f44' }}>{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-bar">
        <form className="input-row" onSubmit={sendMessage}>
          <img src={SearchIcon} alt="" />
          <input
            type="text"
            placeholder="Describe your situation for an AITA verdict…"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>Send</button>
        </form>
      </div>
    </>
  )
}

export default Chat
