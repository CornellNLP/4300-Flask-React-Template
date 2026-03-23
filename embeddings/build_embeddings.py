"""
Dependencies reused from the existing codebase:
- src.player_search.normalize_text via embeddings.preprocess.
- Existing root requirements remain unchanged for now; these embedding dependencies are isolated and will need reconciliation before Flask integration.
"""
from __future__ import annotations

import logging

from embeddings.features import build_feature_matrix
from embeddings.preprocess import preprocess_player_stats
from embeddings.similarity import find_similar_players
from embeddings.store import load_embeddings, save_embeddings


logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
LOGGER = logging.getLogger(__name__)


def main() -> None:
    """Build and persist player embeddings, then run a quick similarity sanity check."""
    LOGGER.info("Preprocessing player stats")
    player_df, _, metadata = preprocess_player_stats()

    LOGGER.info("Building canonical feature matrix")
    matrix, player_index, player_metadata, scalers = build_feature_matrix(player_df, metadata)

    LOGGER.info("Saving embeddings and metadata")
    save_embeddings(matrix, player_index, player_metadata, scalers)

    LOGGER.info("Reloading embeddings for smoke test")
    loaded_matrix, loaded_index = load_embeddings()

    for player_name in ("Harry Kane", "Virgil van Dijk"):
        LOGGER.info("Top 5 similar players for %s", player_name)
        for result in find_similar_players(player_name, loaded_matrix, loaded_index, top_k=5):
            print(result)


if __name__ == "__main__":
    main()
