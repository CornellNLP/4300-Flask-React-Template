from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import Normalizer
from sklearn.metrics.pairwise import cosine_similarity


# Builds a TF-IDF index for recipes or playlists
def build_tfidf_index(data, data_set_category):

    if data_set_category == "recipe":
        corpus = [
        f"{d.name} {d.description} {d.tags} {d.ingredients}"
        for d in data
        ]
        vectorizer = TfidfVectorizer(
            max_features=5000, stop_words='english', max_df=0.8, min_df=10, norm='l2')
        doc_by_vocab = vectorizer.fit_transform(corpus)
        return vectorizer, doc_by_vocab

    elif data_set_category == "playlist":
        name_corpus = [d.name for d in data]
        song_corpus = [d.songs for d in data]

        name_vectorizer = TfidfVectorizer(
            max_features=5000, stop_words='english', max_df=0.8, min_df=2, norm='l2')
        song_vectorizer = TfidfVectorizer(
            max_features=5000, stop_words='english', max_df=0.8, min_df=10, norm='l2')

        name_vecs = name_vectorizer.fit_transform(name_corpus)
        song_vecs = song_vectorizer.fit_transform(song_corpus)
        return (name_vectorizer, song_vectorizer), (name_vecs, song_vecs)


# Computes cosine-similarities between recipes and query vector
def query_data(query, data, data_set_category, vectorizer, doc_by_vocab, name_weight):
    matches = []
    if data_set_category == "recipe":
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, doc_by_vocab).flatten()
        for i, score in enumerate(scores):
            link_suffix = data[i].name.lower().replace(' ', '-') + '-' + str(data[i].site_id)
            reconstructed_link = "https://www.food.com/recipe/" + link_suffix
            matches.append(({
                'name': data[i].name,
                'description': data[i].description,
                'minutes': data[i].minutes,
                'link': reconstructed_link,
            }, float(score)))

    elif data_set_category == "playlist":
        name_vectorizer, song_vectorizer = vectorizer
        name_vecs, song_vecs = doc_by_vocab

        name_query = name_vectorizer.transform([query])
        song_query = song_vectorizer.transform([query])

        name_scores = cosine_similarity(name_query, name_vecs).flatten()
        song_scores = cosine_similarity(song_query, song_vecs).flatten()

        scores = name_weight * name_scores + (1 - name_weight) * song_scores

        for i, score in enumerate(scores):
            matches.append(({
                'name': data[i].name,
                'songs': data[i].songs,
                'artist': data[i].artists,
            }, float(score)))

    matches.sort(key=lambda x: x[1], reverse=True)
    list_desc = [x[0] for x in matches]
    return list_desc