
import json
import os
import re
import logging
from flask import request, jsonify
from infosci_spark_client import LLMClient

logger = logging.getLogger(__name__)


def llm_expand_query(client, user_message):
    """Use the LLM to shape the user's message into IR-friendly keywords."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a search query optimizer for a music lyric search engine. "
                "Given the user's input, rewrite it as a compact set of keywords that captures the mood, theme, and feeling — words likely to appear in matching song lyrics. "
                "Rules:\n"
                "- If the input is short (1-3 words), expand it into related descriptive words.\n"
                "- If the input is long, distill it down to the most important mood and theme keywords.\n"
                "- If the input references a cultural moment, feeling, or situation, translate it into the emotions and words a matching song would contain.\n"
                "- Output only keywords, space-separated, no punctuation, no explanation. Aim for 5-10 words.\n"
                "Examples:\n"
                "  'christmas' -> 'christmas winter festive merry cozy warm holiday joy'\n"
                "  'shake off haters' -> 'shake confident carefree upbeat haters brushing off empowerment'\n"
                "  'i want something that feels like a warm summer evening with friends laughing' -> 'summer warm evening friends joy laughter carefree nostalgic'"
            ),
        },
        {"role": "user", "content": user_message},
    ]
    response = client.chat(messages)
    expanded = (response.get("content") or "").strip()
    logger.info(f"LLM query expansion: {expanded}")
    print(f"[RAG] expanded query: {expanded}", flush=True)
    return expanded or user_message


def llm_describe_songs(client, user_query, songs):
    """Ask the LLM to describe each song in context of the user's request."""
    if not songs:
        return []

    song_list = "\n".join(
        f"{i+1}. \"{s['title']}\" by {s['artist']} — {s['lyrics_preview']}"
        for i, s in enumerate(songs)
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a music assistant. For each song listed, write a paragraph of 3-6 sentences "
                "explaining why it fits the user's request — cover the mood, lyrical themes, and how it connects to what the user is looking for. "
                "Output only the numbered list, nothing else. Format:\n"
                "1. <paragraph>\n2. <paragraph>\n..."
            ),
        },
        {
            "role": "user",
            "content": f"User's request: {user_query}\n\nSongs:\n{song_list}",
        },
    ]

    response = client.chat(messages)
    content = (response.get("content") or "").strip()

    descriptions = [""] * len(songs)
    for match in re.finditer(r"(\d+)\.\s*(.+?)(?=\n\d+\.|$)", content, re.DOTALL):
        idx = int(match.group(1)) - 1
        if 0 <= idx < len(songs):
            descriptions[idx] = match.group(2).strip()

    return descriptions


def register_chat_route(app, song_search):
    """Register the /api/rag endpoint. Called from routes.py."""

    @app.route("/api/rag", methods=["POST"])
    def rag():
        data = request.get_json() or {}
        user_query = (data.get("query") or "").strip()
        if not user_query:
            return jsonify({"error": "Query is required"}), 400

        api_key = os.getenv("SPARK_API_KEY")
        if not api_key:
            return jsonify({"error": "SPARK_API_KEY not set — add it to your .env file"}), 500

        client = LLMClient(api_key=api_key)

        # Step 1: LLM expands user input into IR-friendly descriptive words
        expanded_query = llm_expand_query(client, user_query)

        # Step 2: IR retrieves songs using the expanded query
        songs = song_search(expanded_query)

        # Step 3: LLM describes each song in context of the original user request
        descriptions = llm_describe_songs(client, user_query, songs)

        return jsonify({"songs": songs, "descriptions": descriptions})
