SLUG: cloudflare-anycast-global-availability
TITLE: Cloudflare Anycast and What It Means for Global Availability
EXCERPT: Anycast puts your site in hundreds of cities behind one IP — it is the cheapest layer of "many doors" you can buy, and it is not the same thing as being unblockable.
TAGS: cloudflare, networking, anycast, availability

## One Address, Every City

Cloudflare's edge runs **anycast**: the same IP address is announced from data centres around the world, and BGP routes each user to a nearby machine. A visitor in Kuala Lumpur and a visitor in London hit *different servers* that answer as *the same address*.

For a small site, this is the single largest availability upgrade available:

- **Latency** drops because the TLS handshake terminates a few milliseconds away.
- **DDoS absorption** is structural — an attack on one location does not consume the servers everywhere else.
- **Origin privacy** — visitors never see your real server IP; only the edge does.
- **Global reach** without global infrastructure — one `A` record, hundreds of points of presence.

## What Anycast Actually Protects Against

Be precise about the threat model, because marketing language blurs it:

**Handled well:**
- Origin failures (your server dies; the edge serves cache or errors cleanly while you restart).
- Volumetric DDoS against the published address.
- Regional congestion — routes shift to healthier paths automatically.
- Naive IP blocking of the origin (the origin is not published).

**Not handled:**
- A court order to the provider (your account can be suspended — hence: keep an off-platform mirror).
- Blocking *by the resolver* — if DNS returns nothing, anycast never gets a chance to answer (hence: DNS over HTTPS guidance).
- Blocking *by the destination address* — a government can filter Cloudflare's published ranges outright, degrading or killing access inside that jurisdiction (hence: an onion service on a different transport entirely).
- SNI-based filtering — the hostname is visible during handshake on plain TLS (hence: ECH where available, or Tor).

The pattern should be familiar by now: **every layer of defence covers a different row of the threat table.** Anycast is the first and cheapest row, not the last word.

## Practical Setup Notes

1. **Proxy the DNS record** (the orange cloud). A grey-clouded record publishes your origin IP and forfeits most of the benefit.
2. **Origins should firewall tightly** — allow only Cloudflare ranges (or better, use a Cloudflare Tunnel so the origin makes *outbound* connections only and never listens publicly).
3. **Cache static HTML briefly, revalidate often.** Edge caching multiplies both your speed *and* your staleness — serve HTML with `no-cache` and assets with `max-age`.
4. **Watch `cf-cache-status`** in responses: `HIT` at the edge means the origin is not in the request path at all.
5. **Keep failover honest.** If you configure a fallback Worker or origin, test it — orphaned rules from experiments have a way of becoming silent production traffic.

## The Availability Stack We Run

Combining the layers from earlier articles in this series:

1. **Anycast edge** (`tukuk.org`) — milliseconds away from most humans.
2. **Onion service** — a completely different transport, no DNS, no published IP.
3. **Mirror on a separate domain** — a second registrable name on a second platform.
4. **DoH instructions** — so users can still resolve the name when classic DNS is interfered with.

Anycast buys you the world's best default path. The rest of the stack is what keeps answering when the default path is taken away.
