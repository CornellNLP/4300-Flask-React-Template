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

DOC_MAP = {}
REVERSE_DOC_MAP = {}
WORD_MAP = {}
DOC_EMBEDDINGS = np.zeros(1)
TERM_EMBEDDINGS = np.zeros(1)
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
    global DOC_MAP, REVERSE_DOC_MAP, WORD_MAP, DOC_EMBEDDINGS, TERM_EMBEDDINGS, DOC_IDS_SVD
    doc_path = os.path.join(DATA_DIR, "doc_map2.json")
    word_path = os.path.join(DATA_DIR, "word_map2.json")
    doc_embeddings_path_1 = os.path.join(DATA_DIR, "svd_scipy", "doc_embeddings1.npy")
    doc_embeddings_path_2 = os.path.join(DATA_DIR, "svd_scipy", "doc_embeddings2.npy")
    term_embeddings_path = os.path.join(DATA_DIR, "svd_scipy", "term_embeddings.npy")
    doc_ids_path = os.path.join(DATA_DIR, "svd_scipy", "doc_ids.txt")

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
    except FileNotFoundError as e:
        print(e)
        print("Error: pls have the world_map.json in the data folder!")

    arr1 = np.load(doc_embeddings_path_1, allow_pickle=True)
    arr2 = np.load(doc_embeddings_path_2, allow_pickle=True)
    DOC_EMBEDDINGS = np.concatenate([arr1, arr2], axis=0)
    TERM_EMBEDDINGS = np.load(term_embeddings_path)

    with open(doc_ids_path) as f:
        for line in f:
            i, name = line.strip().split("\t", 1)
            DOC_IDS_SVD[int(i)] = name

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
    # print(candidates)
    # print(len(candidates))
    pathway = []
    
    for _ in range(path_length*2):
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

    i = -1
    while len(branch_nodes) < path_length:
        i += 1
        if pathway[i] not in REVERSE_DOC_MAP:
            continue
        title = REVERSE_DOC_MAP.get(pathway[i], f"Unknown ID {doc_id}")
        if title.startswith("Unknown ID"):
            continue
        branch_nodes.append({
            "id": doc_id,
            "title": title,
            "score": round(doc_scores[doc_id], 4), 
            "branch": 0,                           
            "description": description            
        })
        print(doc_id)

        
    return [branch_nodes]


def generate_rabbit_hole_svd(start_article, path_length=5, num_branches=3):
    global TERM_EMBEDDINGS, DOC_EMBEDDINGS, DOC_IDS_SVD

    tokens = stem_tokenizer(start_article)
    unique_tokens = list(set(tokens))

    num_terms = TERM_EMBEDDINGS.shape[0]
    vec = np.zeros(num_terms, dtype=np.float32)

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

    for i in range(0, path_length*(num_branches-1), path_length):
        nodes = top_idx[i:i+path_length]
        temp = []
        for node in nodes:
            temp.append(
                {
                    "id": int(node),
                    "title": DOC_IDS_SVD[node],
                    "score": round(float(scores[node]), 4),
                    "branch": int(i/path_length)+1,
                    "description": description
                }
            )
        branch_nodes.append(temp)

    return branch_nodes





