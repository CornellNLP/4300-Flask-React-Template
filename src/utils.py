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
WORLD_MAP = {}

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
    global DOC_MAP, REVERSE_DOC_MAP, WORLD_MAP
    doc_path = os.path.join(DATA_DIR, "doc_map.json")
    world_path = os.path.join(DATA_DIR, "world_map.json")

    try:
        with open(doc_path, "r") as f:
            DOC_MAP = json.load(f)
            # REVERSE_DOC_MAP = {idx: title for idx, title in enumerate(DOC_MAP.keys())}
            # REVERSE_DOC_MAP = [(v, k) for k, v in DOC_MAP.items()]
            REVERSE_DOC_MAP = {wiki_id: title for title, wiki_id in DOC_MAP.items()}

    except FileNotFoundError:
        print("Error: boi pls put doc_map.json in <root>/data")

    try:
        with open(world_path, "r") as f:
            WORLD_MAP = json.load(f)
    except FileNotFoundError:
        print("Error: pls have the world_map.json in the data folder!")

def generate_rabbit_hole(start_article, additional_keywords, postings_model, path_length=5, diversity_lambda=0.5):
    """
    Returns list of articles to discover
    """

    # 1. Retrives doc using binary index
    logging.getLogger().info("Generating rabbit hole")
    query_text = f"{start_article} {additional_keywords}"
    tokens = stem_tokenizer(query_text)
    unique_tokens = list(set(tokens))

    token_to_idx = {token: i for i, token in enumerate(unique_tokens)}
    vocab_size = len(unique_tokens)

    doc_scores = defaultdict(float)
    doc_vectors = defaultdict(dict)

    for token in unique_tokens:
        term_id = WORLD_MAP.get(token)
        if term_id is not None:
            record = postings_model.query.filter_by(term_id=term_id).first()
            if record and record.postings:
                decoded = decode_postings(record.postings)

                for doc_id, score in decoded:
                    doc_scores[doc_id] += score
                    doc_vectors[doc_id][token] = score
            
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
    
    for _ in range(path_length):
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
    res = []
    for doc_id in pathway:
        title = REVERSE_DOC_MAP.get(doc_id, f"Unknown ID {doc_id}")
        res.append({
            "id": doc_id,        # already IS the wiki ID
            "title": title,
            "score": round(doc_scores[doc_id], 2)
        })
        print(doc_id)
    return res