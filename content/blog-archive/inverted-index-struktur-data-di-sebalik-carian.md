SLUG: inverted-index-struktur-data-di-sebalik-carian
TITLE: Inverted Index: The Data Structure Behind Every Search Result
EXCERPT: See how an inverted index stores a document list for every term so queries can be answered in milliseconds instead of minutes.
TAGS: inverted index, search engine, data structures, indexing

## Introduction

Imagine you need to find the word "bicycle" across one million documents. The obvious approach — reading each document one by one — would take hours. Search engines avoid this by reversing the order: instead of storing documents with their words, they store every **term** with the list of documents containing it. This structure is the **inverted index**.

The inverted index is the heartbeat of any search system, whether it is a web search engine, search inside your own application, or a company document archive.

## Two Main Components

An inverted index consists of two tightly connected parts.

1. **The dictionary** — a list of every unique token ever seen, usually stored alphabetically in a structure such as a trie or B-tree. This part answers whether a term exists at all.

2. **The posting list** — for each token, a list of records noting which documents contain it, at which positions, and how often it repeats.

For example, the token "bicycle" might point to the list `doc-7, doc-42, doc-108`. When a user types that phrase, the engine only fetches one short list instead of digging through the whole collection.

## What Each Posting Stores

Information in a posting list is richer than plain document numbers. A typical record covers **term frequency** (how often the word appears), position in the text, source field (title or body), and document length for normalization purposes.

Storing positions lets the engine support exact phrase searches and operators like "this word near that word". Without position data, such queries would have to be recomputed by reading full documents, which is far more expensive.

To control index size, text goes through some processing: convert to lowercase, drop punctuation, filter **stop words** that appear too often, and apply a stemmer so "running" and "run" can share an entry.

## Answering Queries Quickly

When a query contains several terms, the engine fetches the posting list for each token and then merges them. For an AND query it intersects the lists so only documents present in every list remain — an extremely fast operation because lists are sorted by document ID.

The next step is **scoring**. Scores like TF-IDF or BM25 measure how rare a term is across the collection and how often it appears in a specific document. Terms found in only a few documents send a strong signal about search intent, so they receive higher weight.

Frequency alone is not enough, though. Engines add other signals — domain authority, freshness, server speed, and inbound link density — to arrange the final ranking.

## Scale Challenges and Optimization

Inverted indexes grow quickly. Common techniques include:

- **Compression** such as Varint or PForDelta to shrink posting lists without decoding the entire list.
- **Sharding** — splitting the index by alphabet or segment so queries only touch relevant shards.
- **Tiered indexes** — keeping a small index in memory with a full copy on disk.
- **Skip pointers** — jumping straight to likely matching regions of a list and avoiding a full scan.

Developers building internal search often debate full-text search versus indexing only selected fields. For small collections a linear scan is enough. Past tens of thousands of records, though, without an inverted index the response time becomes noticeable to users.

## Conclusion and Practical Steps

The inverted index turns a "search through millions of documents" problem into a "read a few short lists" problem. A solid grasp of the dictionary, posting lists, and scoring does more than explain how search engines work — it lets you build fast, accurate internal search for your own product.

1. Start with a clear index schema: decide which fields are searchable and whether positions are needed.
2. Normalize text consistently at index time and query time — both must use the same code.
3. Never strip every stop word blindly; phrases can lose their meaning once key words are gone.
4. Profile real query times before adding a complex cache layer.
5. Rebuild the index offline and swap atomically so search never breaks.
6. Log queries that return nothing; they usually reveal gaps in your index.
