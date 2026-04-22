export interface AitaPost {
  id: number;
  submission_id: string;
  title: string;
  selftext: string;
  score: number;
  similarity: number;
  verdict?: string;
}

export interface LlmSearchResponse {
  rewritten_query: string;
  ir_results: AitaPost[];
  llm_answer: string;
  verdict_filter: string | null;
}
