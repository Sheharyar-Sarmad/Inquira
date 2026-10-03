import wikipedia

wikipedia.set_user_agent("Inquira/1.0 (developersheharyar2010@gmail.com)")
wikipedia.set_rate_limiting(True)

for title in wikipedia.search("Retrieval augmented generation", results=5):
    print(title, "->", wikipedia.summary(title, sentences=2, auto_suggest=False)[:80])