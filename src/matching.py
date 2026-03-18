from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# Builds a TF-IDF index for recipes or playlists
def build_tfidf_index(data, data_set_category):
    
    if data_set_category == "recipe":
        corpus = [                                                                                                                                        
        f"{d.name} {d.description} {d.tags} {d.ingredients}"                                                                                          
        for d in data                                                                                                                              
        ]  
    elif data_set_category == "playlist":
        corpus = [                                                                                                                                        
        f"{d.name} {d.songs}"                                                                                     
        for d in data                                                                                                                              
        ]  
        
    vectorizer = TfidfVectorizer(
    max_features = 5000, stop_words='english', max_df=0.8, min_df=10, norm='l2')
    doc_by_vocab = vectorizer.fit_transform(corpus)
    return vectorizer, doc_by_vocab
    
# Computes cosine-similarities between recipes and query vector
def query_data (query, data, data_set_category, vectorizer, doc_by_vocab):
    query_vec = vectorizer.transform([query])
    scores = cosine_similarity(query_vec, doc_by_vocab).flatten()
    matches = []
    
    if data_set_category == "recipe":
        for i, score in enumerate(scores):
            matches.append(({
                'name': data[i].name,
                'description': data[i].description,
                'minutes': data[i].minutes,
            }, float(score)))
    elif data_set_category == "playlist":
        for i, score in enumerate(scores):
            matches.append(({
                'name': data[i].name,
                'songs': data[i].songs,
            }, float(score)))
            
    matches.sort(key=lambda x: x[1], reverse=True)
    list_desc = [x[0] for x in matches]
    return list_desc