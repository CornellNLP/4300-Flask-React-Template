import { useState, useEffect } from 'react';
import type { Exercise, FormCue, Program } from './types';
import {
  EQUIPMENT_OPTIONS,
  DIFFICULTY_OPTIONS,
  MUSCLE_OPTIONS,
} from './types';
import ExerciseCard, { type PlanState } from './ExerciseCard';
import ProgramCard from './ProgramCard';
import MuscleGraph from './MuscleGraph';
import MuscleRadar from './MuscleRadar';
import MuscleMap from './MuscleMap';
import './App.css';

type Tab = 'exercises' | 'programs';
type Method = 'tfidf' | 'svd';
type ResultsView = 'ir' | 'rag';

type RagState<T> = {
  results: T[];
  refinedQuery: string;
  loading: boolean;
  error: string | null;
};

const emptyExerciseRag: RagState<Exercise> = {
  results: [],
  refinedQuery: '',
  loading: false,
  error: null,
};
const emptyProgramRag: RagState<Program> = {
  results: [],
  refinedQuery: '',
  loading: false,
  error: null,
};

export default function App() {
  const [useLlm, setUseLlm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>('exercises');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [queryMuscles, setQueryMuscles] = useState<string[]>([]);
  const [exerciseMethod, setExerciseMethod] = useState<Method>('tfidf');
  const [exerciseView, setExerciseView] = useState<ResultsView>('ir');
  const [exerciseRag, setExerciseRag] = useState<RagState<Exercise>>(emptyExerciseRag);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [showInjuries, setShowInjuries] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({ 0: true });
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number>(0);
  const [planState, setPlanState] = useState<PlanState>({ loading: false, text: '', error: null });
  const [vizModal, setVizModal] = useState<'map' | 'network' | 'radar' | null>(null);

  const [programSearchTerm, setProgramSearchTerm] = useState<string>('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programMethod, setProgramMethod] = useState<Method>('tfidf');
  const [programsLoading, setProgramsLoading] = useState<boolean>(false);
  const [programView, setProgramView] = useState<ResultsView>('ir');
  const [programRag, setProgramRag] = useState<RagState<Program>>(emptyProgramRag);
  const [openCueKey, setOpenCueKey] = useState<string | null>(null);
  const [topCues, setTopCues] = useState<Record<string, FormCue>>({});

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => setUseLlm(!!cfg.use_llm))
      .catch(() => setUseLlm(false));
  }, []);

  type SearchOverrides = {
    equipment?: string[];
    difficulty?: string;
    injuries?: string[];
    method?: Method;
  };

  const runSearch = async (query: string, overrides: SearchOverrides = {}) => {
    if (!query.trim()) {
      setExercises([]);
      setQueryMuscles([]);
      setPlanState({ loading: false, text: '', error: null });
      return;
    }
    const eq = overrides.equipment ?? selectedEquipment;
    const diff = overrides.difficulty ?? difficulty;
    const inj = overrides.injuries ?? injuries;
    const method = overrides.method ?? exerciseMethod;
    const body: Record<string, unknown> = { query, method };
    if (eq.length > 0) body.equipment = eq;
    if (diff) body.difficulty = diff;
    if (inj.length > 0) body.injuries = inj;
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setExercises(data.results ?? []);
      setQueryMuscles(Array.isArray(data.query_muscles) ? data.query_muscles : []);
      setPlanState({ loading: false, text: '', error: null });
      setExpandedCards({ 0: true });
      setSelectedExerciseIndex(0);
    } catch (err) {
      console.error('search failed', err);
      setExercises([]);
      setQueryMuscles([]);
    }
  };

  const runProgramSearch = async (query: string, methodOverride?: Method) => {
    if (!query.trim()) {
      setPrograms([]);
      setTopCues({});
      setOpenCueKey(null);
      return;
    }
    const method = methodOverride ?? programMethod;
    setProgramsLoading(true);
    try {
      const res = await fetch('/api/search_programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, method }),
      });
      const data = await res.json();
      const results: Program[] = data.results ?? [];
      setPrograms(results);
      setTopCues({});
      setOpenCueKey(null);

      const top = results[0];
      if (useLlm && top && top.schedule && top.schedule.length > 0) {
        const seen = new Set<string>();
        const names: string[] = [];
        for (const entry of top.schedule) {
          const nm = entry.exercise_name?.trim();
          if (!nm) continue;
          const key = nm.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(nm);
        }
        if (names.length > 0) {
          fetch('/api/enrich_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exercises: names }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((payload) => {
              if (!payload || typeof payload !== 'object') return;
              const cuesRaw = (payload as { cues?: Record<string, FormCue> }).cues;
              if (!cuesRaw) return;
              const normalized: Record<string, FormCue> = {};
              for (const [k, v] of Object.entries(cuesRaw)) {
                if (v && typeof v === 'object' && Array.isArray((v as FormCue).form_cues)) {
                  normalized[k.toLowerCase()] = v as FormCue;
                }
              }
              setTopCues(normalized);
            })
            .catch(() => { /* fail silently */ });
        }
      }
    } catch (err) {
      console.error('program search failed', err);
      setPrograms([]);
    } finally {
      setProgramsLoading(false);
    }
  };

  const runRagSearch = async (query: string, overrides: SearchOverrides = {}) => {
    if (!query.trim()) {
      setExerciseRag(emptyExerciseRag);
      return;
    }
    const eq = overrides.equipment ?? selectedEquipment;
    const diff = overrides.difficulty ?? difficulty;
    const inj = overrides.injuries ?? injuries;
    const method = overrides.method ?? exerciseMethod;
    const body: Record<string, unknown> = { query, method };
    if (eq.length > 0) body.equipment = eq;
    if (diff) body.difficulty = diff;
    if (inj.length > 0) body.injuries = inj;
    setExerciseRag((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/rag_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setExerciseRag({
          results: [], refinedQuery: '', loading: false,
          error: res.status === 503 ? 'LLM not configured' : `Request failed (${res.status})`,
        });
        return;
      }
      const data = await res.json();
      setExerciseRag({
        results: data.results ?? [],
        refinedQuery: data.refined_query ?? '',
        loading: false,
        error: null,
      });
      setSelectedExerciseIndex(0);
    } catch (err) {
      console.error('rag search failed', err);
      setExerciseRag({
        results: [], refinedQuery: '', loading: false,
        error: err instanceof Error ? err.message : 'RAG search failed',
      });
    }
  };

  const runRagProgramSearch = async (query: string, methodOverride?: Method) => {
    if (!query.trim()) {
      setProgramRag(emptyProgramRag);
      return;
    }
    const method = methodOverride ?? programMethod;
    setProgramRag((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch('/api/rag_search_programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, method }),
      });
      if (!res.ok) {
        setProgramRag({
          results: [], refinedQuery: '', loading: false,
          error: res.status === 503 ? 'LLM not configured' : `Request failed (${res.status})`,
        });
        return;
      }
      const data = await res.json();
      setProgramRag({
        results: data.results ?? [],
        refinedQuery: data.refined_query ?? '',
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('rag program search failed', err);
      setProgramRag({
        results: [], refinedQuery: '', loading: false,
        error: err instanceof Error ? err.message : 'RAG search failed',
      });
    }
  };

  const handleGeneratePlan = async (exercise: Exercise) => {
    setPlanState({ loading: true, text: '', error: null });
    try {
      const res = await fetch('/api/enrich_exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: exercise.name,
          primaryMuscles: exercise.primaryMuscles,
          secondaryMuscles: exercise.secondaryMuscles,
          equipment: exercise.equipment,
          instructions: exercise.instructions,
        }),
      });
      if (!res.ok || !res.body) {
        setPlanState({ loading: false, text: '', error: 'Could not generate plan.' });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              setPlanState({ loading: false, text: acc, error: payload.error });
              return;
            }
            if (typeof payload.content === 'string') {
              acc += payload.content;
              setPlanState({ loading: true, text: acc, error: null });
            }
          } catch { /* ignore malformed line */ }
        }
      }
      setPlanState({ loading: false, text: acc, error: null });
    } catch (err) {
      setPlanState({
        loading: false,
        text: '',
        error: err instanceof Error ? err.message : 'Plan generation failed',
      });
    }
  };

  const triggerExerciseSearch = (query: string, overrides: SearchOverrides = {}) => {
    runSearch(query, overrides);
    if (useLlm && exerciseView === 'rag' && query.trim()) {
      runRagSearch(query, overrides);
    }
  };

  const triggerProgramSearch = (query: string, methodOverride?: Method) => {
    runProgramSearch(query, methodOverride);
    if (useLlm && programView === 'rag' && query.trim()) {
      runRagProgramSearch(query, methodOverride);
    }
  };

  const toggleEquipment = (v: string) => {
    const next = selectedEquipment.includes(v)
      ? selectedEquipment.filter((x) => x !== v)
      : [...selectedEquipment, v];
    setSelectedEquipment(next);
    if (searchTerm.trim()) triggerExerciseSearch(searchTerm, { equipment: next });
  };

  const changeDifficulty = (v: string) => {
    setDifficulty(v);
    if (searchTerm.trim()) triggerExerciseSearch(searchTerm, { difficulty: v });
  };

  const toggleInjury = (v: string) => {
    const next = injuries.includes(v)
      ? injuries.filter((x) => x !== v)
      : [...injuries, v];
    setInjuries(next);
    if (searchTerm.trim()) triggerExerciseSearch(searchTerm, { injuries: next });
  };

  const changeMethod = (m: Method) => {
    if (activeTab === 'exercises') {
      setExerciseMethod(m);
      if (searchTerm.trim()) triggerExerciseSearch(searchTerm, { method: m });
    } else {
      setProgramMethod(m);
      if (programSearchTerm.trim()) triggerProgramSearch(programSearchTerm, m);
    }
  };

  const changeView = (v: ResultsView) => {
    if (activeTab === 'exercises') {
      setExerciseView(v);
      setSelectedExerciseIndex(0);
      if (v === 'rag' && useLlm && searchTerm.trim() &&
          exerciseRag.results.length === 0 && !exerciseRag.loading) {
        runRagSearch(searchTerm);
      }
    } else {
      setProgramView(v);
      if (v === 'rag' && useLlm && programSearchTerm.trim() &&
          programRag.results.length === 0 && !programRag.loading) {
        runRagProgramSearch(programSearchTerm);
      }
    }
  };

  const toggleCard = (idx: number) => {
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const currentMethod = activeTab === 'exercises' ? exerciseMethod : programMethod;

  const displayedExercises = exerciseView === 'rag' ? exerciseRag.results : exercises;
  const selectedExercise = displayedExercises[selectedExerciseIndex] ?? null;

  return (
    <div className="app">
      {/* ─── LEFT RAIL ──────────────────────────────────────────────── */}
      <aside className="rail">
        <div className="rail__brand">
          <div className="brand-name">
            ATHLETIC<br />TRAINING<br /><span>FINDER</span>
          </div>
          <div className="brand-sub">CORNELL · CS 4300</div>
        </div>

        <div className="rail__tabs">
          <button
            type="button"
            className={`railtab ${activeTab === 'exercises' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            <span className="railtab__idx">01</span>
            <span className="railtab__name">EXERCISES</span>
          </button>
          <button
            type="button"
            className={`railtab ${activeTab === 'programs' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('programs')}
          >
            <span className="railtab__idx">02</span>
            <span className="railtab__name">PROGRAMS</span>
          </button>
        </div>

        <div className="rail__section">
          <div className="rail__section-label">RETRIEVAL MODE</div>
          <div className="method-toggle">
            <button
              type="button"
              className={`method ${currentMethod === 'tfidf' ? 'is-active' : ''}`}
              onClick={() => changeMethod('tfidf')}
            >
              <span className="method__name">KEYWORD</span>
              <span className="method__tech">tf-idf</span>
            </button>
            <button
              type="button"
              className={`method ${currentMethod === 'svd' ? 'is-active' : ''}`}
              onClick={() => changeMethod('svd')}
            >
              <span className="method__name">SEMANTIC</span>
              <span className="method__tech">svd</span>
            </button>
          </div>
        </div>

        <div className="rail__section">
          <div className="rail__section-label">QUERY</div>
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 16 16" className="search-box__icon" aria-hidden>
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M11 11 L15 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={activeTab === 'exercises' ? searchTerm : programSearchTerm}
              placeholder={
                activeTab === 'exercises'
                  ? 'e.g. build chest for basketball'
                  : 'e.g. 8 week hypertrophy'
              }
              onChange={(e) => {
                if (activeTab === 'exercises') setSearchTerm(e.target.value);
                else setProgramSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (activeTab === 'exercises') triggerExerciseSearch(searchTerm);
                  else triggerProgramSearch(programSearchTerm);
                }
              }}
            />
          </div>
          <button
            type="button"
            className="run-btn"
            onClick={() =>
              activeTab === 'exercises'
                ? triggerExerciseSearch(searchTerm)
                : triggerProgramSearch(programSearchTerm)
            }
          >
            <span>RUN SEARCH</span>
            <span className="run-btn__arrow">→</span>
          </button>
        </div>

        {activeTab === 'exercises' && (
          <>
            <div className="rail__section">
              <div className="rail__section-label">EQUIPMENT</div>
              <div className="chip-grid">
                {EQUIPMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`chip ${selectedEquipment.includes(opt) ? 'is-active' : ''}`}
                    onClick={() => toggleEquipment(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rail__section">
              <div className="rail__section-label">DIFFICULTY</div>
              <div className="diff-toggle">
                <button
                  type="button"
                  className={`diff ${difficulty === '' ? 'is-active' : ''}`}
                  onClick={() => changeDifficulty('')}
                >
                  ANY
                </button>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`diff ${difficulty === opt ? 'is-active' : ''}`}
                    onClick={() => changeDifficulty(opt)}
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="rail__section">
              <button
                type="button"
                className="injury-toggle"
                onClick={() => setShowInjuries((s) => !s)}
              >
                <span className="injury-toggle__warn">⚠</span>
                <span className="injury-toggle__label">INJURED MUSCLES TO AVOID</span>
                {injuries.length > 0 && (
                  <span className="injury-toggle__count">{injuries.length}</span>
                )}
                <span className={`chev ${showInjuries ? 'chev--up' : ''}`}>↓</span>
              </button>
              {showInjuries && (
                <>
                  <p className="injury-note">
                    Exercises that primarily target these muscles will be filtered
                    out of your results.
                  </p>
                  <div className="chip-grid">
                    {MUSCLE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`chip chip--injury ${injuries.includes(opt) ? 'is-active' : ''}`}
                        onClick={() => toggleInjury(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="rail__foot">
          <span>v1.0</span>
          <span>CS 4300</span>
        </div>
      </aside>

      {/* ─── MAIN ───────────────────────────────────────────────────── */}
      <main className="main">
        {activeTab === 'exercises' ? (
          <div className="workspace workspace--exercises">
            <section className="results">
              <header className="results__head">
                <div>
                  <div className="results__label">RESULTS</div>
                  <h2 className="results__title">
                    <span className="results__count">
                      {exerciseView === 'rag' ? exerciseRag.results.length : exercises.length}
                    </span>
                    <span>exercises ranked by</span>
                    <span className="results__method">
                      {exerciseMethod === 'tfidf' ? 'KEYWORD RETRIEVAL' : 'SEMANTIC RETRIEVAL'}
                    </span>
                  </h2>
                </div>
                <div className="results__query">
                  <span className="results__query-label">QUERY</span>
                  <span className="results__query-text">"{searchTerm}"</span>
                </div>
              </header>

              {useLlm && (
                <div className="viewtabs">
                  <button
                    type="button"
                    className={`viewtab ${exerciseView === 'ir' ? 'is-active' : ''}`}
                    onClick={() => changeView('ir')}
                  >
                    IR
                  </button>
                  <button
                    type="button"
                    className={`viewtab ${exerciseView === 'rag' ? 'is-active' : ''}`}
                    onClick={() => changeView('rag')}
                  >
                    IR + RAG
                  </button>
                </div>
              )}

              {exerciseView === 'rag' && useLlm && (exerciseRag.refinedQuery || exerciseRag.loading || exerciseRag.error) && (
                <div className="refined-query">
                  <div className="refined-query__row">
                    <span className="refined-query__label">ORIGINAL</span>
                    <span className="refined-query__text">{searchTerm || '—'}</span>
                  </div>
                  <div className="refined-query__row">
                    <span className="refined-query__label">REFINED</span>
                    <span className="refined-query__text refined-query__text--accent">
                      {exerciseRag.loading
                        ? 'refining query…'
                        : exerciseRag.error
                          ? `(error: ${exerciseRag.error})`
                          : exerciseRag.refinedQuery || '—'}
                    </span>
                  </div>
                </div>
              )}

              {exerciseView === 'ir' ? (
                <div className="results__list">
                  {exercises.map((ex, i) => (
                    <ExerciseCard
                      key={`${ex.name}-${i}`}
                      exercise={ex}
                      rank={i + 1}
                      expanded={!!expandedCards[i]}
                      isSelected={selectedExerciseIndex === i}
                      onToggleExpand={() => toggleCard(i)}
                      onSelectCard={() => setSelectedExerciseIndex(i)}
                      onGeneratePlan={handleGeneratePlan}
                      planState={planState}
                      useLlm={useLlm}
                    />
                  ))}
                  {exercises.length === 0 && (
                    <div className="empty">
                      <div className="empty__icon">◎</div>
                      <p>No results. Try broadening your filters or query.</p>
                    </div>
                  )}
                </div>
              ) : exerciseRag.loading ? (
                <div className="loading">
                  <div className="loading__spinner" />
                  <p>Refining query &amp; reranking with LLM…</p>
                </div>
              ) : (
                <div className="results__list">
                  {exerciseRag.results.map((ex, i) => (
                    <ExerciseCard
                      key={`rag-${ex.name}-${i}`}
                      exercise={ex}
                      rank={i + 1}
                      expanded={!!expandedCards[i]}
                      isSelected={selectedExerciseIndex === i}
                      onToggleExpand={() => toggleCard(i)}
                      onSelectCard={() => setSelectedExerciseIndex(i)}
                      onGeneratePlan={handleGeneratePlan}
                      planState={planState}
                      useLlm={useLlm}
                    />
                  ))}
                  {exerciseRag.results.length === 0 && !exerciseRag.error && (
                    <div className="empty">
                      <div className="empty__icon">◎</div>
                      <p>Run a search to see IR + RAG results.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="vizcol">
              <aside className="bodypanel bodypanel--clickable" onClick={() => setVizModal('map')}>
                <div className="bodypanel__head">
                  <div>
                    <div className="bodypanel__label">MUSCLE MAP</div>
                    <div className="bodypanel__sub">
                      {selectedExercise ? selectedExercise.name : 'Select an exercise'}
                    </div>
                  </div>
                  <span className="expand-hint">expand ↗</span>
                </div>
                <MuscleMap
                  primaryMuscles={selectedExercise?.primaryMuscles ?? []}
                  secondaryMuscles={selectedExercise?.secondaryMuscles ?? []}
                />
              </aside>

              <section className="netpanel netpanel--clickable" onClick={() => setVizModal('network')}>
                <header className="netpanel__head">
                  <div>
                    <div className="netpanel__label">MUSCLE NETWORK</div>
                    <h2 className="netpanel__title">
                      <span>exercise &amp; muscle map</span>
                      {queryMuscles.length > 0 && (
                        <span className="netpanel__count">
                          · {queryMuscles.length} query muscle
                          {queryMuscles.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </h2>
                  </div>
                  <span className="expand-hint">expand ↗</span>
                </header>
                <MuscleGraph
                  queryMuscles={queryMuscles}
                  exercises={
                    exerciseView === 'rag' && exerciseRag.results.length > 0
                      ? exerciseRag.results
                      : exercises
                  }
                />
              </section>

              <section className="netpanel netpanel--clickable" onClick={() => setVizModal('radar')}>
                <header className="netpanel__head">
                  <div>
                    <div className="netpanel__label">MUSCLE GRAPH</div>
                    <h2 className="netpanel__title">
                      <span>relevance per muscle</span>
                    </h2>
                  </div>
                  <span className="expand-hint">expand ↗</span>
                </header>
                <MuscleRadar
                  queryMuscles={queryMuscles}
                  exercises={
                    exerciseView === 'rag' && exerciseRag.results.length > 0
                      ? exerciseRag.results
                      : exercises
                  }
                />
              </section>
            </div>
          </div>
        ) : (
          <div className="workspace workspace--programs">
            <section className="results results--full">
              <header className="results__head">
                <div>
                  <div className="results__label">PROGRAMS</div>
                  <h2 className="results__title">
                    <span className="results__count">
                      {programView === 'rag' ? programRag.results.length : programs.length}
                    </span>
                    <span>programs ranked by</span>
                    <span className="results__method">
                      {programMethod === 'tfidf' ? 'KEYWORD RETRIEVAL' : 'SEMANTIC RETRIEVAL'}
                    </span>
                  </h2>
                </div>
                <div className="results__query">
                  <span className="results__query-label">QUERY</span>
                  <span className="results__query-text">"{programSearchTerm}"</span>
                </div>
              </header>

              {useLlm && (
                <div className="viewtabs">
                  <button
                    type="button"
                    className={`viewtab ${programView === 'ir' ? 'is-active' : ''}`}
                    onClick={() => changeView('ir')}
                  >
                    IR
                  </button>
                  <button
                    type="button"
                    className={`viewtab ${programView === 'rag' ? 'is-active' : ''}`}
                    onClick={() => changeView('rag')}
                  >
                    IR + RAG
                  </button>
                </div>
              )}

              {programView === 'rag' && useLlm && (programRag.refinedQuery || programRag.loading || programRag.error) && (
                <div className="refined-query">
                  <div className="refined-query__row">
                    <span className="refined-query__label">ORIGINAL</span>
                    <span className="refined-query__text">{programSearchTerm || '—'}</span>
                  </div>
                  <div className="refined-query__row">
                    <span className="refined-query__label">REFINED</span>
                    <span className="refined-query__text refined-query__text--accent">
                      {programRag.loading
                        ? 'refining query…'
                        : programRag.error
                          ? `(error: ${programRag.error})`
                          : programRag.refinedQuery || '—'}
                    </span>
                  </div>
                </div>
              )}

              {programView === 'ir' && programsLoading ? (
                <div className="loading">
                  <div className="loading__spinner" />
                  <p>
                    Searching programs index…
                    <br />
                    <small>first run may take ~25s</small>
                  </p>
                </div>
              ) : programView === 'rag' && programRag.loading ? (
                <div className="loading">
                  <div className="loading__spinner" />
                  <p>Refining query &amp; reranking with LLM…</p>
                </div>
              ) : programView === 'ir' ? (
                <div className="results__list">
                  {programs.map((pg, i) => (
                    <ProgramCard
                      key={`${pg.title}-${i}`}
                      program={pg}
                      rank={i + 1}
                      isTop={i === 0}
                      useLlm={useLlm}
                      openCueKey={openCueKey}
                      setOpenCueKey={setOpenCueKey}
                      cues={topCues}
                    />
                  ))}
                  {programs.length === 0 && (
                    <div className="empty">
                      <div className="empty__icon">◎</div>
                      <p>No results. Try a different query.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="results__list">
                  {programRag.results.map((pg, i) => (
                    <ProgramCard
                      key={`rag-${pg.title}-${i}`}
                      program={pg}
                      rank={i + 1}
                      isTop={i === 0}
                      useLlm={useLlm}
                      openCueKey={openCueKey}
                      setOpenCueKey={setOpenCueKey}
                      cues={topCues}
                    />
                  ))}
                  {programRag.results.length === 0 && !programRag.error && (
                    <div className="empty">
                      <div className="empty__icon">◎</div>
                      <p>Run a search to see IR + RAG results.</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {vizModal && (
        <div className="viz-modal-overlay" onClick={() => setVizModal(null)}>
          <div className={`viz-modal viz-modal--${vizModal}`} onClick={(e) => e.stopPropagation()}>
            <div className="viz-modal__head">
              <span className="viz-modal__label">
                {vizModal === 'map' ? 'MUSCLE MAP' : vizModal === 'network' ? 'MUSCLE NETWORK' : 'MUSCLE GRAPH'}
              </span>
              <button className="viz-modal__close" onClick={() => setVizModal(null)}>✕</button>
            </div>
            <div className="viz-modal__body">
              {vizModal === 'map' && (
                <MuscleMap
                  primaryMuscles={selectedExercise?.primaryMuscles ?? []}
                  secondaryMuscles={selectedExercise?.secondaryMuscles ?? []}
                />
              )}
              {vizModal === 'network' && (
                <MuscleGraph
                  queryMuscles={queryMuscles}
                  exercises={exerciseView === 'rag' && exerciseRag.results.length > 0 ? exerciseRag.results : exercises}
                />
              )}
              {vizModal === 'radar' && (
                <MuscleRadar
                  queryMuscles={queryMuscles}
                  exercises={exerciseView === 'rag' && exerciseRag.results.length > 0 ? exerciseRag.results : exercises}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
