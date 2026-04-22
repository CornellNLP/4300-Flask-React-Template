import os
from flask import request, jsonify
from infosci_spark_client import LLMClient

def register_rag_route(app, json_search):
    @app.route("/api/rag", methods=["POST"])
    def rag_query():
        try:
            data = request.get_json()
            user_query = data.get("query", "").strip()
            instrument = data.get("instrument", "guitar")
            difficulty = data.get("difficulty", "all")
            top_n = data.get("top_n", 5)

            if not user_query:
                return jsonify({"error": "Empty query"}), 400

            api_key = os.getenv("SPARK_API_KEY")
            if not api_key:
                return jsonify({"error": "SPARK_API_KEY not set"}), 500

            client = LLMClient(api_key=api_key)

            # ── STEP 1: Rewrite query for IR ──
            rewrite_messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a query rewriting assistant for a music lyric search engine. "
                        "Given a user's natural language request, extract the key emotional themes, "
                        "moods, or lyric keywords that best describe what they want to play. "
                        "Return ONLY the rewritten search query — no explanation, no punctuation."
                    )
                },
                {"role": "user", "content": user_query}
            ]
            rewrite_resp = client.chat(rewrite_messages)
            ir_query = (rewrite_resp.get("content") or user_query).strip()

            # ── STEP 2: Run IR system ──
            ir_response = json_search(ir_query, top_n, instrument, difficulty)
            ir_results = ir_response.get("results", [])

            # ── STEP 3: Build context ──
            context_blocks = []
            for i, song in enumerate(ir_results[:3], 1):
                chords = ", ".join(song.get("chords") or [])
                mood_words = []
                for dim in song.get("svd_explanation", []):
                    mood_words.extend(dim.get("mood_words", []))
                context_blocks.append(
                    f"[Song {i}] \"{song['title']}\" by {song['artist']}\n"
                    f"  Difficulty: {song['difficulty']}/10 | Chords: {chords}\n"
                    f"  Themes: {', '.join(mood_words[:5])}"
                )
            context_str = "\n\n".join(context_blocks)

            # ── STEP 4: Generate answer ──
            answer_messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a friendly music teacher and recommendation assistant. "
                        "Answer the user's request using ONLY the songs provided. "
                        "Mention specific song titles and why each fits their request. "
                        "Reference difficulty and chords when helpful. Be warm and encouraging."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"User request: {user_query}\n\n"
                        f"Retrieved songs:\n{context_str}\n\n"
                        "Based only on these songs, give a helpful personalized recommendation."
                    )
                }
            ]
            answer_resp = client.chat(answer_messages)
            llm_answer = (answer_resp.get("content") or "No answer generated.").strip()

            return jsonify({
                "original_query": user_query,
                "ir_query": ir_query,
                "ir_results": ir_results,
                "llm_answer": llm_answer,
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500