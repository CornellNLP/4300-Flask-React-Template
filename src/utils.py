import struct
import re
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from nltk.stem import PorterStemmer

stemmer = PorterStemmer()
stemmed_stopwords = list({stemmer.stem(w) for w in ENGLISH_STOP_WORDS}) \
                     + ['anywh', 'becau', 'el', 'elsewh', 'everywh', 'ind', 'otherwi', 'plea', 'somewh']

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