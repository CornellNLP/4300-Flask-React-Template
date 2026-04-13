import struct
import re
import json
import os
import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from nltk.stem import PorterStemmer
from collections import defaultdict
import logging

stemmer = PorterStemmer()
stemmed_stopwords = list({stemmer.stem(w) for w in ENGLISH_STOP_WORDS}) \
                     + ['anywh', 'becau', 'el', 'elsewh', 'everywh', 'ind', 'otherwi', 'plea', 'somewh']

dimension_themes = {
    0:  "Film & Television",
    1:  "Football & Team Sports",
    2:  "Music",
    3:  "Music",
    4:  "Film & Television",
    5:  "Football & Team Sports",
    6:  "Football & Team Sports",
    7:  "Combat Sports & Racing",
    8:  "Baseball & Ice Hockey",
    9:  "Football & Team Sports",
    10: "Music",
    11: "Film & Television",
    12: "Football & Team Sports",
    13: "Baseball & Ice Hockey",
    14: "Baseball & Ice Hockey",
    15: "Indian Cinema & South Asian",
    16: "Film & Television",
    17: "Football & Team Sports",
    18: "Animation, Gaming & Comics",
    19: "Combat Sports & Racing",
    20: "Combat Sports & Racing",
    21: "Literature & Theatre",
    22: "Literature & Theatre",
    23: "Olympics & Athletics",
    24: "Music",
    25: "Combat Sports & Racing",
    26: "Animation, Gaming & Comics",
    27: "Combat Sports & Racing",
    28: "Politics & Government",
    29: "Nationality",
    30: "Combat Sports & Racing",
    31: "Film & Television",
    32: "Broadcasting & Journalism",
    33: "Combat Sports & Racing",
    34: "Combat Sports & Racing",
    35: "Broadcasting & Journalism",
    36: "Animation, Gaming & Comics",
    37: "Nationality",
    38: "Literature & Theatre",
    39: "Film & Television",
    40: "Nationality",
    41: "Nationality",
    42: "Animation, Gaming & Comics",
    43: "Nationality",
    44: "Film & Television",
    45: "Indian Cinema & South Asian",
    46: "Nationality",
    47: "Film & Television",
    48: "Literature & Theatre",
    49: "Nationality",
    50: "Nationality",
    51: "Music",
    52: "Nationality",
    53: "Nationality",
    54: "Nationality",
    55: "Broadcasting & Journalism",
    56: "Indian Cinema & South Asian",
    57: "Nationality",
    58: "Film & Television",
    59: "Literature & Theatre",
    60: "Broadcasting & Journalism",
    61: "Literature & Theatre",
    62: "Nationality",
    63: "Broadcasting & Journalism",
    64: "Politics & Government",
    65: "Nationality",
    66: "Broadcasting & Journalism",
    67: "Animation, Gaming & Comics",
    68: "Broadcasting & Journalism",
    69: "Broadcasting & Journalism",
    70: "Indian Cinema & South Asian",
    71: "Politics & Government",
    72: "Literature & Theatre",
    73: "Politics & Government",
    74: "Nationality",
    75: "Nationality",
    76: "Literature & Theatre",
    77: "Olympics & Athletics",
    78: "Literature & Theatre",
    79: "Olympics & Athletics",
    80: "Animation, Gaming & Comics",
    81: "Olympics & Athletics",
    82: "Animation, Gaming & Comics",
    83: "Olympics & Athletics",
    84: "Literature & Theatre",
    85: "Nationality",
    86: "Olympics & Athletics",
    87: "Olympics & Athletics",
    88: "Nationality",
    89: "Nationality",
    90: "Nationality",
    91: "Nationality",
    92: "Nationality",
    93: "Olympics & Athletics",
    94: "Nationality",
    95: "Nationality",
    96: "Olympics & Athletics",
    97: "Nationality",
    98: "Politics & Government",
    99: "Nationality",
}

DOC_MAP = {}
REVERSE_DOC_MAP = {}
WORD_MAP = {}
WORD_ID_TO_TERM = {}
DOC_EMBEDDINGS = np.zeros(1)
TERM_EMBEDDINGS = np.zeros(1)
SINGULAR_VALUES = np.zeros(1)
DOC_IDS_SVD = {}

logger = logging.getLogger(__name__)
gunicorn_logger = logging.getLogger('gunicorn.info')
logger.handlers = gunicorn_logger.handlers
logger.setLevel(gunicorn_logger.level)

def decode_postings(blob):
    ptr = 0
    count = struct.unpack_from("I", blob, ptr)[0]
    ptr += 4

    doc = 0
    postings = []

    for _ in range(count):
        delta, score = struct.unpack_from("I H", blob, ptr)
        ptr += 6

        doc += delta
        postings.append((doc, score))

    return postings

def stem_tokenizer(text):
    words = re.findall(r"\w+", text.lower())
    return [stemmer.stem(w) for w in words]

current_directory = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_directory)
DATA_DIR = os.path.join(project_root, 'data')

def load_data():
    global DOC_MAP, REVERSE_DOC_MAP, WORD_MAP, WORD_ID_TO_TERM, DOC_EMBEDDINGS, TERM_EMBEDDINGS, DOC_IDS_SVD, SINGULAR_VALUES
    doc_path = os.path.join(DATA_DIR, "doc_map2.json")
    word_path = os.path.join(DATA_DIR, "word_map2.json")
    doc_embeddings_path_1 = os.path.join(DATA_DIR, "svd_scipy", "doc_embeddings1.npy")
    doc_embeddings_path_2 = os.path.join(DATA_DIR, "svd_scipy", "doc_embeddings2.npy")
    term_embeddings_path = os.path.join(DATA_DIR, "svd_scipy", "term_embeddings.npy")
    doc_ids_path = os.path.join(DATA_DIR, "svd_scipy", "doc_ids.txt")
    singular_values_path = os.path.join(DATA_DIR, "svd_scipy", "singular_values.npy")

    try:
        with open(doc_path, "r") as f:
            DOC_MAP = json.load(f)
            # REVERSE_DOC_MAP = {idx: title for idx, title in enumerate(DOC_MAP.keys())}
            # REVERSE_DOC_MAP = [(v, k) for k, v in DOC_MAP.items()]
            REVERSE_DOC_MAP = {wiki_id: title for title, wiki_id in DOC_MAP.items()}

    except FileNotFoundError as e:
        print(e)
        print("Error: boi pls put doc_map.json in <root>/data")

    try:
        with open(word_path, "r") as f:
            WORD_MAP = json.load(f)
            WORD_ID_TO_TERM = {v: k for k, v in WORD_MAP.items()}
    except FileNotFoundError as e:
        print(e)
        print("Error: pls have the world_map.json in the data folder!")

    arr1 = np.load(doc_embeddings_path_1, allow_pickle=True)
    arr2 = np.load(doc_embeddings_path_2, allow_pickle=True)
    DOC_EMBEDDINGS = np.concatenate([arr1, arr2], axis=0)
    TERM_EMBEDDINGS = np.load(term_embeddings_path)
    SINGULAR_VALUES = np.load(singular_values_path)


    with open(doc_ids_path) as f:
        for line in f:
            i, name = line.strip().split("\t", 1)
            DOC_IDS_SVD[int(i)] = name

def get_svd_graph_data(terms_per_theme=8):
    """
    Returns SNAP-format graph data (nodes + edges) grouped by dimension_themes.
    Each unique theme becomes a cluster; terms are aggregated across all dims
    sharing that theme. Edges connect terms within the same theme cluster.
    """
    theme_to_dims = defaultdict(list)
    for dim, theme in dimension_themes.items():
        if dim < TERM_EMBEDDINGS.shape[1]:
            theme_to_dims[theme].append(dim)

    unique_themes = sorted(theme_to_dims.keys())
    theme_to_idx = {t: i for i, t in enumerate(unique_themes)}

    nodes = {}   # term -> node dict
    edges = []

    for theme, dims in theme_to_dims.items():
        cluster_idx = theme_to_idx[theme]
        term_scores = defaultdict(float)

        for dim in dims:
            col = TERM_EMBEDDINGS[:, dim]
            top_idx = np.argsort(col)[::-1][: terms_per_theme * 3]
            for i in top_idx:
                term = WORD_ID_TO_TERM.get(int(i))
                if term:
                    term_scores[term] += float(col[i])

        top_terms = sorted(term_scores.items(), key=lambda x: x[1], reverse=True)[:terms_per_theme]

        cluster_ids = []
        for term, score in top_terms:
            if term not in nodes:
                nodes[term] = {
                    "id": term,
                    "label": term,
                    "cluster": cluster_idx,
                    "theme": theme,
                    "weight": round(score, 4),
                }
            cluster_ids.append(term)

        # Edges: fully connect terms within the same theme cluster
        for a in range(len(cluster_ids)):
            for b in range(a + 1, len(cluster_ids)):
                edges.append({"source": cluster_ids[a], "target": cluster_ids[b]})

    return {"nodes": list(nodes.values()), "edges": edges, "themes": unique_themes}

def generate_rabbit_hole(start_article, additional_keywords, postings_model, path_length=5, diversity_lambda=0.5, num_branches=3, branch_seeds=None):
    """
    Returns list of articles to discover
    """

    # 1. Retrives doc using binary index
    # gunicorn.info
    global logger
    logger.info("Generating rabbit hole")
    query_text = f"{start_article} {additional_keywords}"
    tokens = stem_tokenizer(query_text)
    unique_tokens = list(set(tokens))

    token_to_idx = {token: i for i, token in enumerate(unique_tokens)}
    vocab_size = len(unique_tokens)

    doc_scores = defaultdict(float)
    doc_vectors = defaultdict(dict)

    for token in unique_tokens:
        term_id = WORD_MAP.get(token)
        if term_id is not None:
            record = postings_model.query.filter_by(term_id=term_id).first()
            if record and record.postings:
                logger.info("Found records")
                decoded = decode_postings(record.postings)

                for doc_id, score in decoded:
                    doc_scores[doc_id] += score
                    doc_vectors[doc_id][token] = score
    logger.info("Processed tokens")
            
    if not doc_scores:
        return []
    
    # 2. Applies MRR for diversity
    # 2.1: convert dict vectors to NumPy arras
    np_vectors = {}
    for doc_id, vector_dict in doc_vectors.items():
        vec = np.zeros(vocab_size)
        for term, score in vector_dict.items():
            if term in token_to_idx:
                vec[token_to_idx[term]] = score
        np_vectors[doc_id] = vec

    # 2.2: Do MMR
    candidates = list(doc_scores.keys())
    pathway = []
    
    for _ in range(path_length * num_branches * 2):
        if not candidates:
            break
    
        best_doc = None
        best_mmr_score = -float('inf')

        for doc in candidates:
            relevance = doc_scores[doc]
            similarity_penalty = 0
            if pathway:
                penalties = []
                for selected_doc in pathway:
                    sim = np.dot(np_vectors[doc], np_vectors[selected_doc])
                    penalties.append(sim)
                similarity_penalty = max(penalties)

            mmr_score = (diversity_lambda * relevance) - ((1-diversity_lambda) * similarity_penalty)
            if mmr_score > best_mmr_score:
                best_mmr_score = mmr_score
                best_doc = doc
            
        if best_doc is not None:
            pathway.append(best_doc)
            candidates.remove(best_doc)
    
    # 3. Format output 
    # Changed to branch nodes as frontend expects many branch nodes for each rabbit hole. 
    branch_nodes = []

    description = "A unique thematic cluster."

    np.random.shuffle(pathway)

    for i in range(0, path_length*num_branches, path_length):
        nodes = pathway[i:i+path_length]
        temp = []
        for doc_id in nodes:
            if doc_id not in REVERSE_DOC_MAP:
                continue
            title = REVERSE_DOC_MAP.get(doc_id, f"Unknown ID {doc_id}")
            if title.startswith("Unknown ID"):
                continue
            temp.append({
                "id": doc_id,
                "title": title,
                "score": round(doc_scores[doc_id], 4),
                "branch": int(i/path_length) + 1,
                "description": description
            })
        if temp:
            branch_nodes.append(temp)

    return branch_nodes


def generate_branch(doc_id, doc_vec, doc_embed, term_embed, path_length=5):
    path = [doc_id]
    prev_doc = doc_vec
    j = 0
    while len(path) < path_length and j < 20:
        q_emb = prev_doc @ term_embed
        q_emb /= np.linalg.norm(q_emb) + 1e-8
        scores = doc_embed @ q_emb
        top_idx = np.argsort(scores)[-5:][::-1]
        np.random.shuffle(top_idx)

        i = 0
        if top_idx[0] in path:
            i += 1

        path.append(top_idx[i])
        prev_doc = TERM_EMBEDDINGS @ (SINGULAR_VALUES * DOC_EMBEDDINGS[top_idx[i], :])
        j += 1

    return path

def top_query_dimensions(q_emb, top_k=5):
    # sort by magnitude (important: absolute value)
    idx = np.argsort(np.abs(q_emb))[::-1][:top_k]

    return [(i, q_emb[i]) for i in idx]

def generate_rabbit_hole_svd(start_article, path_length=5, num_branches=3):
    global TERM_EMBEDDINGS, DOC_EMBEDDINGS, DOC_IDS_SVD, SINGULAR_VALUES

    tokens = stem_tokenizer(start_article)
    unique_tokens = list(set(tokens))

    num_terms = TERM_EMBEDDINGS.shape[0]
    vec = np.zeros(num_terms, dtype=np.float32)
    print(vec.shape)

    for w in unique_tokens:
        if w in WORD_MAP:
            vec[WORD_MAP[w]] += 1.0


    q_emb = vec @ TERM_EMBEDDINGS

    q_emb /= np.linalg.norm(q_emb) + 1e-8

    scores = DOC_EMBEDDINGS @ q_emb

    top_idx = np.argsort(scores)[-(path_length*num_branches):][::-1]

    np.random.shuffle(top_idx)

    branch_nodes = []

    description = "A unique thematic cluster."

    for i in range(0, path_length * num_branches, path_length):
        nodes = top_idx[i:i+path_length]
        temp = []
        for node in nodes:
            doc_vec = TERM_EMBEDDINGS @ (SINGULAR_VALUES * DOC_EMBEDDINGS[top_idx[i], :])
            dims = top_query_dimensions(doc_vec @ TERM_EMBEDDINGS)
            dim_names = []
            dim_scores = []
            for dim, score in dims:
                if dimension_themes[dim] not in dim_names:
                    dim_names.append(dimension_themes[dim])
                    dim_scores.append(float(score))
            temp.append(
                {
                    "id": int(node),
                    "title": DOC_IDS_SVD[node],
                    "score": round(float(scores[node]), 4),
                    "branch": int(i/path_length)+1,
                    "description": description,
                    "dimensions": dim_names,
                    "dimensionScores": dim_scores
                }
            )
        branch_nodes.append(temp)

    return branch_nodes





