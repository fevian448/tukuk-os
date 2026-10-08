SLUG: extractive-vs-abstractive-ai-answers
TITLE: Extractive vs Abstractive AI Answers: Why We Chose the Sentence That Exists
EXCERPT: An extractive engine quotes the best passages it actually found; an abstractive LLM writes new prose. For a search engine that must never invent facts, the first option wins by default.
TAGS: ai, rag, search, llms

## Two Ways to Answer a Question

Ask a search engine "what is head-of-line blocking?" and it can respond in two fundamentally different ways:

- **Extractive**: locate the passages in its index that contain the answer, score them, and present the best one — a sentence a human already wrote and published.
- **Abstractive**: pass the passages to a large language model and let it *compose* a new sentence that summarises them.

The second sounds more impressive. It is also where hallucinations live: a model fluent enough to sound confident is also capable of confidently merging two sources into a claim neither one makes.

## The Failure Modes, Side by Side

| | Extractive | Abstractive |
|---|---|---|
| Invents facts | Only via bad source material | Yes — by construction |
| Fails visibly when index is empty | Yes ("no answer found") | No — it answers anyway |
| Latency | Milliseconds | Seconds (or an API round trip) |
| Cost | CPU only | GPU or per-token API fees |
| Voice | Quotation, sometimes choppy | Smooth, human-sounding |
| Attribution | Trivial (here is the URL) | Requires extra plumbing |

The third row is the quiet killer for small deployments: when retrieval finds nothing, an extractive system **says so**, while an LLM happily produces an authoritative-sounding paragraph about a topic it has zero sources for. That is the worst possible answer for a search engine.

## Our Architecture

Tukuk-OS runs extractive answers as the default:

1. **Retrieve** candidate passages (BM25-style scoring via Meilisearch, plus a small local knowledge store for fixed facts).
2. **Score** by query overlap, source quality, and freshness.
3. **Extract** the highest-scoring sentence or two, keeping the source URL attached.
4. **Return** with `"model": "extractive (no LLM)"` in the response metadata — the user can see exactly how the answer was made.

Responses are then **language-matched to the interface** (we translate the surface strings to English rather than letting browser auto-translation mangle them — a lesson that came from watching a Malay browser mangle English answers in real time).

The whole path answers in **tens of milliseconds cold**, needs no API key, no quota, no network dependency — which matters more than eloquence for a site that promises to stay online.

## When the LLM Earns Its Keep

Abstractive generation is genuinely better for: multi-document synthesis ("compare these three papers"), conversational follow-ups, rewriting technical content for a different audience, and tasks where *style* is the point. Systems that can afford an LLM should offer both: extractive as the fast, safe default; generative as an opt-in mode, clearly labelled, with citations either way.

What does not work is the middle ground — a smooth answer with no visible sourcing, where the user cannot tell whether they are reading BBC reporting or a model's interpolation of it.

## The Principle

**A search engine's job is to find what exists.** When we answer, we should be able to point at the exact document the words came from. Extractive answers make that guarantee structural; abstractive answers make it a promise. On the open web, structure beats promises.
