SLUG: panduan-meilisearch-untuk-pemula
TITLE: Meilisearch Tutorial for Beginners: From Install to First Query
EXCERPT: From installing Meilisearch and building your first index to filters and the HTTP API, this is the step-by-step guide beginners need.
TAGS: meilisearch, tutorial, indexing, api

## Introduction

Most beginners postpone search work because they picture a complicated system: multi-node servers, JVM configuration, and verbose query syntax. Meilisearch lowers that barrier with one simple service and one readable HTTP API. This guide takes you from zero to working search, including filters, typo tolerance, and a short comparison with Elasticsearch so you know when to switch.

## Step 1: Install and Verify

Meilisearch can be installed through a system package, built from source, or run as a container image. For learning, the fastest route is running one service on a local machine. Once it starts, set an admin key and store it somewhere safe; every write request needs that key through the authorization header.

Check status with a single request to the health endpoint. If the response shows the running version, you are ready to continue.

### Step 2: Create an Index and Understand Indexing

An index is the structure that lets queries be answered extremely fast. The **indexing** process takes the documents you send, breaks them into tokens, and arranges them into an inverted structure so specific words map directly to the documents containing them.

Create an index with one identifier, for example products, along with a stable primary key such as id. The primary key must not change after documents are sent, because it is used to update and delete records.

When sending documents, declare the role of each field:

- **searchable**: fields that can match queries, such as title and description.
- **filterable**: fields that can be filtered, such as category and price.
- **sortable**: fields that control ordering, such as publish date.
- **displayed**: fields returned in the response.

The most common beginner mistake is marking every field as searchable. When long descriptions, addresses, and hidden text are all searched together, scores blur and unrelated results rise to the top. Start narrow, then add fields only when tests show the need.

## Step 3: Send Documents Through the HTTP API

All communication with Meilisearch happens over the **HTTP API**, so no special client is required. Three basic operations to know:

1. Add or replace documents by sending an object list to the index path with a document field.
2. Search by sending a query through the q parameter on the search path.
3. Delete one document by identifier, or delete the whole index if you want to start over.

Every write request returns a task identifier rather than a final result. Meilisearch processes work asynchronously, so check that task's status before assuming the data is searchable. Small jobs finish in milliseconds; hundreds of thousands of documents may take a little longer.

## Step 4: Add Filters, Facets and Typo Tolerance

### Filters and Facet Filters

Once basic search works, add **facet filters**. The simplest example: when a category field is marked filterable, the search response also lists each category value with its matching result count. Your interface can display those numbers directly without recalculating anything.

Filters use a simple syntax and can be combined with and, or, and not operators. For price ranges use a between expression over two values. Practical advice: build filters from questions users actually ask rather than designer assumptions.

### Typo Tolerance

**Typo tolerance** is enabled by default. In practice the system measures edit distance between query tokens and index tokens, then allows one to three mistakes depending on token length. For short words like "tv", tolerance is reduced so random results do not surface. Beginners often set this too aggressively so everything matches, and short queries then show irrelevant items. Start with the defaults, then adjust only if real data shows searches failing because the setting is too strict.

## When to Consider Elasticsearch

Elasticsearch fits better when you need advanced text analysis, powerful aggregations, or cross-cluster log merging. It is also the right choice if your team already knows the query DSL and the Kibana ecosystem. Meilisearch, by contrast, wins on low barriers, short setup time, and much smaller resource needs. For most sites, shops, and documentation it is sufficient.

## Practical Steps for Your First Week

1. Install the service and store the admin key in a secret manager.
2. Create one index with a stable primary key.
3. Push 100 sample documents and confirm they appear in search.
4. Mark fields by role, then test price and category filters.
5. Search with real typos and check whether results stay relevant.
6. Connect your application through the HTTP API and log response times.
7. Track the empty-search rate as an early warning of data quality problems.

Once these seven steps are done you have fully working search and a solid base for improving scores based on real user feedback.
