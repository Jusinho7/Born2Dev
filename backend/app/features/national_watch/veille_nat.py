import feedparser

url = "URL_DU_FLUX_RSS"

feed = feedparser.parse(url)

for entry in feed.entries:
    print("Titre :", entry.get("title"))
    print("Lien :", entry.get("link"))
    print("Date :", entry.get("published"))
    print("Résumé :", entry.get("summary"))
