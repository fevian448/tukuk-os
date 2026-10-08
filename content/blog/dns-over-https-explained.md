SLUG: dns-over-https-explained
TITLE: DNS over HTTPS (DoH): When Your Resolver Starts Lying
EXCERPT: DNS over HTTPS encrypts domain lookups inside a normal HTTPS connection, which makes DNS poisoning and filtering far harder for anyone sitting between you and the truth.
TAGS: dns, doh, privacy, censorship

## The Weak Link in Every Connection

Before a browser can fetch anything, it asks a **DNS resolver**: *what address is `example.com`?* For decades that question travelled in clear text, in a protocol (UDP/53) that anyone on the path — a Wi-Fi operator, an ISP, a state filter — could observe, answer first, or simply refuse.

When the answer is forged, everything downstream still "works": the browser connects happily — to the wrong server, or to a reset. This is **DNS poisoning**, and it is also the simplest form of censorship: you do not need to block an IP if you can make the name disappear.

## What DoH Changes

**DNS over HTTPS** (RFC 8484) sends the same lookup as a POST inside an ordinary HTTPS session to a resolver that speaks DoH — typically `1.1.1.1`, `dns.google`, or your own.

The difference is structural:

- **Encryption** — an observer sees an HTTPS connection to a resolver domain, not the individual names you query.
- **Authentication** — TLS proves you are talking to the resolver you intended, not to an injector on the path.
- **Integrity** — forged responses fail certificate validation and are discarded.

For the censor, this raises the cost: instead of silently rewriting answers, they must now block the encrypted connection itself — which means blocking a major resolver's domain, with all the collateral damage that implies.

## Enabling It in a Browser

- **Firefox:** Settings → Privacy & Security → *DNS over HTTPS* → enable, then pick Cloudflare (1.1.1.1) or Google (dns.google).
- **Chrome/Edge:** Settings → Privacy and security → Security → *Use secure DNS*, choose a provider or enter a custom DoH URL.
- **Android 9+:** Settings → Network → Private DNS → hostname `one.one.one.one` or `dns.google` (this is DoT, the TLS-on-853 sibling of DoH — same threat model, different port).
- **iOS:** the 1.1.1.1 app, or per-app VPN profiles.

Once enabled, every lookup for every site in that browser rides the encrypted channel.

## Honest Limitations

DoH is a strong fix for *resolver integrity*, not a universal bypass:

- **IP-level blocking still works.** If a government filters `104.16.0.0/12` outright, your encrypted resolver answers correctly and the connection to the destination dies anyway.
- **SNI/ECH territory.** The TLS handshake can still reveal the destination hostname to a network observer — a different layer, addressed by different tools (ECH, or a VPN, or Tor).
- **Your DoH provider sees everything.** Trading your ISP for Cloudflare or Google is a privacy trade, not an anonymity guarantee.
- **Whole-resolver blocking is possible** — adversaries can block `cloudflare-dns.com` by name. Alternate resolvers and DoT endpoints exist for exactly this reason.

## When It Saves You

DoH shines in the common, low-drama case: a hotel Wi-Fi hijacking answers, a mobile carrier returning carrier-portal IPs, or a regional filter editing DNS records on the fly. Encrypted resolution removes that whole class of interference in a five-minute settings change.

Pair it with the rest of the toolbox — an `Onion-Location` mirror for blocked domains, a backup domain for blocked edges — and DNS stops being the weakest link in the chain.
