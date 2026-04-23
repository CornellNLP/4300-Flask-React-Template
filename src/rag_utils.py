from infosci_spark_client import LLMClient
import os
import json
from flask import request, jsonify, Response, stream_with_context

# --- Podcast Markdown Context (Singleton) ---
_podcast_markdown_threads = None
DEBUG_RAG = True

def _clip_words(text, max_words=50):
    """Helper to clip a long description field to a max number of words, adding ellipsis if clipped."""
    words = str(text or "").split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]) + " ..."

def build_markdown_threads(podcasts_df):
    """
    Build and cache the list of markdown strings, one per podcast.
    """
    global _podcast_markdown_threads
    markdown_threads = []
    for _, row in podcasts_df.iterrows():
        md = f"""## Podcast: {row.get('name', '')}
                **Categories:** {row.get('categories', '')}  
                **Author:** {row.get('author', '')}  
                **Description:**  
                {row.get('description', '')}
            """
        markdown_threads.append(md)
    _podcast_markdown_threads = markdown_threads
    if DEBUG_RAG:
        print('[DEBUG] Built markdown threads for podcasts, count:', len(markdown_threads))
    return markdown_threads

def get_podcast_markdown_threads(max_context=100):
    """
    Return the cached podcast markdown threads (for RAG context).
    """
    if _podcast_markdown_threads is None:
        raise RuntimeError("Podcast markdown threads not built. Call build_markdown_threads(df) at startup.")
    return _podcast_markdown_threads[:max_context]

# def format_rag_context(hits, markdown_threads, max_chars_total=120_000):
#     """
#     Build one LLM context string from search hits using full thread Markdown.
#     Args:
#         hits: List of dicts with 'doc_id', 'rank', 'title', 'score'.
#         markdown_threads: List of markdown strings, indexed by doc_id.
#         max_chars_total: Max characters for the combined string, or None for no cap.
#     Returns:
#         Prompt text for the LLM.
#     """
#     parts = []
#     for h in hits:
#         i = h["doc_id"]
#         md = markdown_threads[i] if 0 <= i < len(markdown_threads) else ""
#         parts.append(
#             f"### [{h['rank']}] {h['title']}\n"
#             f"score: {h['score']:.4f}\n\n---\n\n{md}\n"
#         )
#     text = "\n\n".join(parts)
#     if max_chars_total is not None and len(text) > max_chars_total:
#         return text[:max_chars_total] + "\n\n[truncated]"
#     return text

# def search_podcasts_and_episodes(query, markdown_threads, json_search_fn, top_k=5):
#     """
#     Wrapper around json_search to return hits in the format expected by RAG helpers.
#     Args:
#         query: User query string
#         markdown_threads: List of markdown strings (podcasts first, then episodes)
#         json_search_fn: Function to call for podcast search (should return list of podcast dicts)
#         top_k: Number of results to return
#     Returns:
#         List of dicts with doc_id, rank, title, score
#     """
#     # Call the user's existing search function
#     results = json_search_fn(query)
#     hits = []
#     # Podcasts are first in markdown_threads, so doc_id = podcast index
#     for rank, podcast in enumerate(results[:top_k], 1):
#         # Find doc_id by matching title and description in markdown_threads
#         # (Assumes build_markdown_threads order is consistent)
#         doc_id = None
#         for i, md in enumerate(markdown_threads):
#             if podcast['title'] in md and podcast['description'] in md:
#                 doc_id = i
#                 break
#         if doc_id is None:
#             doc_id = 0  # fallback to first
#         hits.append({
#             'doc_id': doc_id,
#             'rank': rank,
#             'title': podcast['title'],
#             'score': podcast['score'],
#         })
#     return hits

# def retrieve_for_rag(query, markdown_threads, json_search_fn, top_k=5, max_chars_total=120_000):
#     """
#     Run search, print a banner and hit list, then format context for the LLM.
#     Returns: (hits, context)
#     """
#     print("\n" + "=" * 72)
#     print(f" search_podcasts_and_episodes({query!r}, top_k={top_k})")
#     print("=" * 72 + "\n")
#     hits = search_podcasts_and_episodes(query, markdown_threads, json_search_fn, top_k=top_k)
#     for h in hits:
#         print(f" [{h['rank']}] {h['score']:.4f} {h['title'][:72]}")
#     print()
#     return hits, format_rag_context(hits, markdown_threads, max_chars_total)

def stream_output(generator):
  """Stream and format reasoning and content chunks from an LLM generator.

  This prints an initial banner, streams any "reasoning" chunks under a
  "### Thinking" heading, and then transitions to streaming "content" chunks
  under an "### Answer" heading once the final answer begins.

  Args:
    generator: An iterable yielding dictionaries that may contain
      "reasoning" and/or "content" string values.
  """
  print("--- LLM (streaming) ---\n### Thinking\n")
  seen_answer = False
  for ch in generator:
    if ch.get("reasoning"):
        print(ch["reasoning"], end="", flush=True)
    if ch.get("content"):
      if not seen_answer:
        print("\n\n### Answer\n", end="", flush=True)
        seen_answer = True
      print(ch["content"], end="", flush=True)
  print()

def enrich_query_with_llm_details(user_query, max_context=10, context_items=None, generic_only=False):
    """
        Rewrite/enrich a user query for retrieval. Parameters:
        - `user_query`: original query string from the user
        - `max_context`: max number of context items to include (if context_items is provided)
        - `context_items`: optional list of dicts with 'title', 'description', 'categories', 'author', 'score' to use as structured context for the rewrite. If not provided, will use get_podcast_markdown_threads() instead.
        - `generic_only`: if True, do not include any context in the prompt, and do a generic rewrite. Used for i) debugging or ii) If the returned results are not good so the context would not be useful
        Returns a dict with:
            - modified_query: short rewritten query string
            - explanation: one-sentence rationale
            - raw_content: raw model content
            - used_context: whether structured context was used
    """
    api_key = os.getenv("SPARK_API_KEY") or os.getenv("API_KEY")
    if not api_key:
        if DEBUG_RAG:
            print("[DEBUG] SPARK_API_KEY missing!")
        raise RuntimeError("SPARK_API_KEY not set — add it to your .env file")

    if DEBUG_RAG:
        print(f"[DEBUG] user_query: {repr(user_query)} (type: {type(user_query)})")
    client = LLMClient(api_key=api_key)

    used_context = False
    context_str = ""
    if not generic_only:
        if context_items:
            structured = []
            for idx, item in enumerate(context_items[:max_context], start=1):
                structured.append(
                    f"[{idx}] Title: {item.get('title', '')}\n"
                    f"Score: {float(item.get('score', 0.0)):.4f}\n"
                    f"Categories: {item.get('categories', '')}\n"
                    f"Author: {item.get('author', '')}\n"
                    f"Description: {_clip_words(item.get('description', ''), max_words=50)}"
                )
            context_str = "\n---\n".join(structured)
            used_context = len(structured) > 0
        else: # We collect raw description data from some podcasts
            context = get_podcast_markdown_threads(max_context)
            if isinstance(context, list):
                context_str = '\n---\n'.join(_clip_words(item, max_words=50) for item in context)
                used_context = len(context) > 0
            else:
                context_str = _clip_words(context, max_words=50)
                used_context = bool(context_str)

    max_prompt_chars = 5000
    if len(context_str) > max_prompt_chars:
        context_str = context_str[:max_prompt_chars] + "\n...[truncated total context]"

    prompt_query_modification = [
        {
            "role": "system",
            "content": (
                "You are an expert podcast search assistant. "
                "Rewrite the user's question to maximize retrieval of relevant podcasts. "
                "Output exactly two lines and nothing else:\n"
                "QUERY: <short rewritten query, max 12 words>\n"
                "EXPLANATION: <three sentences, max 50 words>."
            ),
        },
        {
            "role": "user",
            "content": (
                f"User question:\n{user_query}\n\n"
                + (f"Top podcast candidates:\n{context_str}" if used_context else "No reliable candidates found; do a generic rewrite.")
            ),
        },
    ]

    if DEBUG_RAG:
        print(f"[DEBUG] prompt_query_modification (first 500 chars): {str(prompt_query_modification)[:500]}")

    try:
        # Use a single non-streaming request here. This call is only rewriting the query,
        # so streaming the prompt and then issuing a second request just adds failure points.
        response = client.chat(prompt_query_modification, stream=False, show_thinking=False)
        if DEBUG_RAG:
            print(f"[DEBUG] LLM response: {repr(response)}")
        if not response or "content" not in response or not isinstance(response["content"], str):
            raise ValueError("LLM response missing or invalid: " + str(response))
        raw_content = response["content"].strip()

        query_line = ""
        explanation_line = ""
        for line in raw_content.splitlines():
            stripped = line.strip()
            if stripped.upper().startswith("QUERY:") and not query_line:
                query_line = stripped.split(":", 1)[1].strip()
            elif stripped.upper().startswith("EXPLANATION:") and not explanation_line:
                explanation_line = stripped.split(":", 1)[1].strip()

        modified_query = query_line or (raw_content.splitlines()[0].strip() if raw_content else "podcast")
        explanation = explanation_line or "Rewrote query to improve retrieval over available podcast topics."

        if DEBUG_RAG:
            print(f"[DEBUG] modified_query: {repr(modified_query)}")

        return {
            "modified_query": modified_query,
            "explanation": explanation,
            "raw_content": raw_content,
            "used_context": used_context,
        }
    except Exception as e:
        # Log error and return a fallback string
        print(f"[ERROR] enrich_query_with_llm: {type(e).__name__}: {e}")
        return {
            "modified_query": "podcast",
            "explanation": "Used fallback query because LLM rewrite failed.",
            "raw_content": "",
            "used_context": used_context,
        }


def enrich_query_with_llm(user_query, max_context=10):
    """Compatibility wrapper that returns only the modified query string."""
    details = enrich_query_with_llm_details(user_query=user_query, max_context=max_context)
    return details.get("modified_query", "podcast")


def enrich_collab_query_with_llm_details(user_a_query, user_b_query, max_context=5, context_items=None, generic_only=False):
    """
    Rewrite two collaborative queries into one shared search query.
    Returns the same details shape as enrich_query_with_llm_details.
    """
    api_key = os.getenv("SPARK_API_KEY") or os.getenv("API_KEY")
    if not api_key:
        if DEBUG_RAG:
            print("[DEBUG] SPARK_API_KEY missing!")
        raise RuntimeError("SPARK_API_KEY not set — add it to your .env file")

    client = LLMClient(api_key=api_key)

    used_context = False
    context_str = ""
    if not generic_only:
        if context_items:
            structured = []
            for idx, item in enumerate(context_items[:max_context], start=1):
                structured.append(
                    f"[{idx}] Title: {item.get('title', '')}\n"
                    f"Score: {float(item.get('score', 0.0)):.4f}\n"
                    f"Categories: {item.get('categories', '')}\n"
                    f"Author: {item.get('author', '')}\n"
                    f"Description: {_clip_words(item.get('description', ''), max_words=50)}"
                )
            context_str = "\n---\n".join(structured)
            used_context = len(structured) > 0
        else:
            context = get_podcast_markdown_threads(max_context)
            if isinstance(context, list):
                context_str = "\n---\n".join(_clip_words(item, max_words=50) for item in context)
                used_context = len(context) > 0
            else:
                context_str = _clip_words(context, max_words=50)
                used_context = bool(context_str)

    max_prompt_chars = 5000
    if len(context_str) > max_prompt_chars:
        context_str = context_str[:max_prompt_chars] + "\n...[truncated total context]"

    prompt_query_modification = [
        {
            "role": "system",
            "content": (
                "You are an expert podcast recommendation assistant for two people. "
                "Combine both users' interests into one podcast search query. Penalize results that end up favoring only one user's interests. "
                "Output exactly two lines and nothing else:\n"
                "QUERY: <short combined query, max 12 words>\n"
                "EXPLANATION: <three sentences, max 50 words>."
            ),
        },
        {
            "role": "user",
            "content": (
                f"User A question:\n{user_a_query}\n\n"
                f"User B question:\n{user_b_query}\n\n"
                + (f"Top podcast candidates:\n{context_str}" if used_context else "No reliable candidates found; do a generic combined rewrite.")
            ),
        },
    ]

    try:
        response = client.chat(prompt_query_modification, stream=False, show_thinking=False)
        if not response or "content" not in response or not isinstance(response["content"], str):
            raise ValueError("LLM response missing or invalid: " + str(response))

        raw_content = response["content"].strip()
        query_line = ""
        explanation_line = ""
        for line in raw_content.splitlines():
            stripped = line.strip()
            if stripped.upper().startswith("QUERY:") and not query_line:
                query_line = stripped.split(":", 1)[1].strip()
            elif stripped.upper().startswith("EXPLANATION:") and not explanation_line:
                explanation_line = stripped.split(":", 1)[1].strip()

        modified_query = query_line or (raw_content.splitlines()[0].strip() if raw_content else "podcast")
        explanation = explanation_line or "Rewrote the combined query to improve retrieval for both listeners."

        return {
            "modified_query": modified_query,
            "explanation": explanation,
            "raw_content": raw_content,
            "used_context": used_context,
        }
    except Exception as e:
        if DEBUG_RAG:
            print(f"[ERROR] enrich_collab_query_with_llm_details: {type(e).__name__}: {e}")
        return {
            "modified_query": f"{user_a_query} {user_b_query}".strip() or "podcast",
            "explanation": "Used fallback combined query because LLM rewrite failed.",
            "raw_content": "",
            "used_context": used_context,
        }


def summarize_podcast_with_llm(podcast, user_query=None, top_dimensions=None):
    """
    Generate a short, user-facing summary explaining why a podcast matches.
    Returns a concise sentence or a fallback string on error.
    """
    api_key = os.getenv("SPARK_API_KEY") or os.getenv("API_KEY")
    if not api_key:
        return "This recommendation matches your query intent."

    client = LLMClient(api_key=api_key)

    def format_dimension_block(dimensions):
        if not dimensions:
            return ""

        positive = dimensions.get("positive", []) if isinstance(dimensions, dict) else []
        negative = dimensions.get("negative", []) if isinstance(dimensions, dict) else []
        lines = []

        if positive:
            lines.append("Positive latent dimensions:")
            for dim in positive[:3]:
                lines.append(
                    f"- {dim.get('label', 'Dim')} (value: {float(dim.get('value', 0.0)):.3f})"
                )
        # TODO: remove when merging with main branch cuz we will remove negative latent dimensions
        if negative:
            lines.append("Negative latent dimensions:")
            for dim in negative[:3]:
                lines.append(
                    f"- {dim.get('label', 'Dim')} (value: {float(dim.get('value', 0.0)):.3f})"
                )

        return "\n".join(lines)

    dimension_block = format_dimension_block(top_dimensions)
    prompt = [
        {
            "role": "user",
            "content": (
                f"User query: {user_query or 'N/A'}\n"
                f"Podcast title: {podcast.get('title', '')}\n"
                f"Categories: {podcast.get('categories', '')}\n"
                f"Author: {podcast.get('author', '')}\n"
                f"Description: {_clip_words(podcast.get('description', ''), max_words=60)}\n"
                f"{dimension_block}\n\n"
                "Write one short sentence explaining why this podcast fits the user. "
                "Do not use bullets or markdown. Keep it friendly and specific. "
                "Mention the strongest latent signals only if they help the explanation."
            ),
        }
    ]

    try:
        response = client.chat(prompt, stream=False, show_thinking=False)
        if not response or "content" not in response or not isinstance(response["content"], str):
            return "This recommendation matches your query intent."

        summary = response["content"].strip()
        return summary or "This recommendation matches your query intent."
    except Exception as e:
        if DEBUG_RAG:
            print(f"[ERROR] summarize_podcast_with_llm: {type(e).__name__}: {e}")
        return "This recommendation matches your query intent."