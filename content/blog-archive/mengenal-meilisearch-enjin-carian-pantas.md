SLUG: mengenal-meilisearch-enjin-carian-pantas
TITLE: Meet Meilisearch: A Fast, Open Source Search Engine
EXCERPT: Meilisearch is a lightweight open source search engine that gives websites and apps relevant results without complicated configuration.
TAGS: meilisearch, search-engine, open-source, elasticsearch

## Introduction

Web users rarely scroll to a second page of results. Usability studies show nearly two thirds of clicks land on the top three positions, and an extra 200 milliseconds of delay is enough to cost a site engagement. Internal search — whether for an online shop, technical documentation, or an article archive — needs to be fast and relevant from the very first millisecond. Meilisearch exists for exactly that: delivering big-engine search quality in a form small enough to run on a single machine.

## What Is Meilisearch?

Meilisearch is an **open source** search engine written in Rust that runs as a single HTTP process. It stores the index as files on disk and needs no cluster manager or heavyweight JVM like most enterprise search systems. Typically you install it, create one index, push documents through the **HTTP API**, and immediately get relevant results without training anything first.

The data model is simple. You send a batch of objects — say 500 product records — and Meilisearch builds **indexing** from the text fields in each object. Any field can be marked searchable, filterable, sortable, or displayed without declaring a full schema up front. That makes prototyping easy: start searching first, then refine the schema once real requirements are clear.

## Features That Set It Apart

### Typo Tolerance

Most search engines match text literally. Meilisearch enables **typo tolerance** by default, so a user typing "pencahayaan" misspelled still finds the correct term. Tolerance scales with field length: short fields allow one mistake, longer fields two or three. In practice this cuts empty-result searches without requiring a synonym list for every possible typo.

### Facet Filters

Fields such as category, brand, and price can be set as **facet filters**. When a user picks a brand, the system simultaneously computes result counts for every other facet value, so the interface can show exact numbers. For online shops this means users can refine while seeing how many options and results remain.

### Performance Design

The index is stored in a compact prefix structure, letting prefix searches run without reading the whole index. On a small machine with 4 GB of memory, median latency usually stays under 50 milliseconds even for indexes with hundreds of thousands of documents. The key trick is that work happens at write time rather than read time: documents are updated in place inside the index instead of being rebuilt in nightly batches.

## Quick Comparison with Elasticsearch

Elasticsearch remains the broader option. It offers advanced text analysis, powerful aggregations, and the Kibana and Logstash ecosystem for log operations. The cost is far higher memory and administration demand — a healthy Elasticsearch cluster usually starts with two or three nodes plus significant JVM tuning.

Meilisearch takes the opposite approach. It optimises for **the best first result** rather than deep analytics. There is no complex query DSL; instead simple query-string parameters like q, filter, sort, and facets do the work. For product, article, or documentation search that is enough. For log analytics or cluster-wide querying, Elasticsearch or OpenSearch still fits better.

## Common Mistakes

1. Dumping an entire HTML page into one text field, which blurs scoring and returns inaccurate results.
2. Not marking the price field filterable, so the application recomputes price filters on every request.
3. Sending document updates too often; over 1,000 updates per second on a small machine will degrade response time.
4. Ignoring **ranking rules**, even though ordering such as words, typo, and proximity strongly affects result quality.

## Practical Steps to Start

1. Install Meilisearch, run it on the default port, and store the admin key safely.
2. Create one index with a stable primary key that never changes.
3. Set the essential roles: searchable for title and description, filterable for category and price, sortable for date.
4. Cap document size and split very long fields into a separate index if needed.
5. Test with real user queries, not just perfectly spelled keywords.
6. Watch the basic metrics: response time, empty-search rate, and clicks in the top three positions.

With this order of steps most teams get solid search working within a few hours, then improve scoring and filters based on actual user feedback.
