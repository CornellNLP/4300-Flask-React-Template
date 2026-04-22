import { useState, useEffect } from 'react';
import type { Exercise, FormCue, Program } from './types';
import {
  EQUIPMENT_OPTIONS,
  DIFFICULTY_OPTIONS,
  MUSCLE_OPTIONS,
} from './types';
import ExerciseCard, { type PlanState } from './ExerciseCard';
import ProgramCard from './ProgramCard';
import './App.css';

type Tab = 'exercises' | 'programs';
type Method = 'tfidf' | 'svd';

export default function App() {
  const [useLlm, setUseLlm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>('exercises');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseMethod, setExerciseMethod] = useState<Method>('tfidf');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>('');
  const [injuries, setInjuries] = useState<string[]>([]);
  const [showInjuries, setShowInjuries] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({ 0: true });
  const [planState, setPlanState] = useState<PlanState>({ loading: false, text: '', error: null });

  const [programSearchTerm, setProgramSearchTerm] = useState<string>('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programMethod, setProgramMethod] = useState<Method>('tfidf');
  const [programsLoading, setProgramsLoading] = useState<boolean>(false);
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
      setPlanState({ loading: false, text: '', error: null });
      setExpandedCards({ 0: true });
    } catch (err) {
      console.error('search failed', err);
      setExercises([]);
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

  const toggleEquipment = (v: string) => {
    const next = selectedEquipment.includes(v)
      ? selectedEquipment.filter((x) => x !== v)
      : [...selectedEquipment, v];
    setSelectedEquipment(next);
    if (searchTerm.trim()) runSearch(searchTerm, { equipment: next });
  };

  const changeDifficulty = (v: string) => {
    setDifficulty(v);
    if (searchTerm.trim()) runSearch(searchTerm, { difficulty: v });
  };

  const toggleInjury = (v: string) => {
    const next = injuries.includes(v)
      ? injuries.filter((x) => x !== v)
      : [...injuries, v];
    setInjuries(next);
    if (searchTerm.trim()) runSearch(searchTerm, { injuries: next });
  };

  const changeMethod = (m: Method) => {
    if (activeTab === 'exercises') {
      setExerciseMethod(m);
      if (searchTerm.trim()) runSearch(searchTerm, { method: m });
    } else {
      setProgramMethod(m);
      if (programSearchTerm.trim()) runProgramSearch(programSearchTerm, m);
    }
  };

  const toggleCard = (idx: number) => {
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const currentMethod = activeTab === 'exercises' ? exerciseMethod : programMethod;

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
                  if (activeTab === 'exercises') runSearch(searchTerm);
                  else runProgramSearch(programSearchTerm);
                }
              }}
            />
          </div>
          <button
            type="button"
            className="run-btn"
            onClick={() =>
              activeTab === 'exercises'
                ? runSearch(searchTerm)
                : runProgramSearch(programSearchTerm)
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
            <aside className="bodypanel">
              <div className="bodypanel__head">
                <div>
                  <div className="bodypanel__label">MUSCLE MAP</div>
                  <div className="bodypanel__sub">Coming soon</div>
                </div>
              </div>
            </aside>

            <section className="results">
              <header className="results__head">
                <div>
                  <div className="results__label">RESULTS</div>
                  <h2 className="results__title">
                    <span className="results__count">{exercises.length}</span>
                    <span>exercises ranked by</span>
                    <span className="results__method">
                      {exerciseMethod === 'tfidf' ? 'KEYWORD' : 'SEMANTIC'}
                    </span>
                  </h2>
                </div>
                <div className="results__query">
                  <span className="results__query-label">QUERY</span>
                  <span className="results__query-text">"{searchTerm}"</span>
                </div>
              </header>

              <div className="results__list">
                {exercises.map((ex, i) => (
                  <ExerciseCard
                    key={`${ex.name}-${i}`}
                    exercise={ex}
                    rank={i + 1}
                    expanded={!!expandedCards[i]}
                    onToggleExpand={() => toggleCard(i)}
                    onHoverMuscles={() => { /* muscle map disabled */ }}
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
            </section>
          </div>
        ) : (
          <div className="workspace workspace--programs">
            <section className="results results--full">
              <header className="results__head">
                <div>
                  <div className="results__label">PROGRAMS</div>
                  <h2 className="results__title">
                    <span className="results__count">{programs.length}</span>
                    <span>programs ranked by</span>
                    <span className="results__method">
                      {programMethod === 'tfidf' ? 'KEYWORD' : 'SEMANTIC'}
                    </span>
                  </h2>
                </div>
                <div className="results__query">
                  <span className="results__query-label">QUERY</span>
                  <span className="results__query-text">"{programSearchTerm}"</span>
                </div>
              </header>

              {programsLoading ? (
                <div className="loading">
                  <div className="loading__spinner" />
                  <p>
                    Searching programs index…
                    <br />
                    <small>first run may take ~25s</small>
                  </p>
                </div>
              ) : (
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
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
