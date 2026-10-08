SLUG: privasi-dalam-ai-lokal-tiada-data-hantar-ke-awan
TITLE: Privacy in AI: Why Running Models Locally Matters
EXCERPT: Running AI models on your own hardware means prompts and customer data never leave the device, cutting breach risk and easing compliance.
TAGS: ai, privacy, local-llm, self-hosting

## Introduction

Cloud AI services offer convenience that is hard to beat: no installation, no maintenance, and access to the latest models within minutes. Yet every prompt sent to the cloud is data leaving your control. For organisations handling medical records, legal documents, proprietary code, or customer data covered by data protection rules, that is not merely a technical concern.

**Local AI** — running **models** directly on your own hardware — offers a compelling alternative. This post explains what genuinely changes for privacy, what maintenance really costs, and where local models reach their practical limits compared with cloud models.

## What Actually Changes

When you use a cloud service, your data passes through several parties: the model provider, the infrastructure host, and sometimes human review contractors. Terms of service may exclude training data, but diagnostic logs, metadata, and retention windows remain a risk.

With self-hosting, that scenario does not exist:

1. **No outbound transfer** — prompts and documents stay inside your internal network.
2. **No third-party logs** — you decide what is logged, how long it is kept, and who can access it.
3. **Full audit control** — every request can be tied to a specific user and purpose, which simplifies compliance.
4. **Operational resilience** — the system keeps working when the internet link drops or a vendor changes pricing overnight.

For some sectors, being able to prove that **data never leaves the premises** is a legal requirement rather than a preference.

## Deployment Options

Not every workload needs a GPU costing tens of thousands. Common choices include:

- **Ollama** — the easiest way to start; it runs models in a few commands and exposes an OpenAI-compatible API on your own machine.
- **llama.cpp** and its derivatives — optimised for CPU and Apple Silicon hardware, allowing 4-bit quantization that runs a 7B model on an ordinary laptop.
- **vLLM or TGI** — for high-throughput serving on GPUs, suitable when many users share one instance.
- **A sealed sandbox** — running **inference** inside an isolated network with no route to the internet.

Models such as **Llama** and **Qwen** in the 3B to 14B range now handle document summarisation, classification, information extraction, and draft generation at quality acceptable for internal use. For Malay-language tasks, check model tiers and relevant benchmarks, because quality still varies between them.

## Real Costs and Challenges

Privacy comes with a bill. You need to weigh:

- **Hardware** — a GPU with enough VRAM is the main expense; quantization lowers the requirement but slightly reduces precision.
- **Maintenance** — model updates, security patches, monitoring, and backups all become your team's responsibility.
- **Quality** — frontier cloud models still win at complex reasoning and multi-step tasks.
- **Scale** — compute demand jumps as user counts grow, so capacity planning must happen early.

The common mistake is buying hardware before measuring the real workload. Measure average prompt length, context size, and requests per second before committing to a purchase.

## Best Practices and Practical Steps

Practices that help teams avoid repeated mistakes:

1. Start with a small, high-value use case — search over internal documents is a good entry point.
2. Quantize models to 4-bit for testing and compare output against the full version before deciding.
3. Keep the inference network isolated with no outbound internet except for verified model downloads.
4. Document what the model can and cannot do, so users do not send sensitive data down the wrong path.
5. Keep an approved model list with hashes and sources so builds can be reproduced.
6. Audit logs regularly and delete data that is no longer needed.

### From Test to Production

1. Install Ollama on a test machine and run a mid-size model; measure response time and memory use.
2. Give one small team access and gather feedback on quality compared with your current cloud service.
3. List which data must stay local and which can remain in the cloud.
4. Build a hybrid workflow: sensitive data to the local model, general tasks to the cloud.
5. Calculate annual cost for both paths before deciding on expansion.

## Conclusion

Running models locally moves privacy control from third-party terms of service into your own hands. It is not a total replacement for cloud services, but a valuable layer for data that cannot leave the premises. The smartest approach is usually hybrid: define data boundaries clearly, run what must stay local, and judge results with metrics rather than assumptions.
