SLUG: why-no-website-is-100-percent-unblockable
TITLE: Why No Website Can Be 100% Unblockable (And What to Do About It)
EXCERPT: Any government can filter a domain, an IP, or a TLS fingerprint — the realistic goal is not invulnerability but redundancy: several independent doors to the same content.
TAGS: censorship, resilience, tor, access

## The Honest Starting Point

Every few months someone claims their project is "impossible to block." It is not, and understanding why is the first step to building something genuinely resilient.

A network operator controls the pipe. They can drop packets to an IP range, refuse DNS answers, reset TLS handshakes after reading the Server Name Indication, throttle a fingerprint, or lean on the certificate authority and hosting provider until the site has nowhere to live. **Any single channel can be closed by anyone with enough authority over the network path.**

## The Blocking Toolkit (From the Other Side)

Worth knowing what you are up against:

| Layer | Technique | Your defence |
|---|---|---|
| DNS | Poisoning, NXDOMAIN injection | DNS over HTTPS / DoT |
| IP | Range filtering, RST injection | Alternate hosts, CDNs, anycast |
| SNI/TLS | Handshake inspection, blocking by hostname | ECH, domain fronting (rare), onion services |
| Domain | Court order to registrar, DNS removal | Mirror domains, `.onion` (no registrar) |
| Protocol | Blocking Tor, VPNs, obfs protocols | Pluggable bridges, Snowflake, WebTunnel |
| Application | App-store removal, provider pressure | Web versions, self-hosted copies |

Notice the pattern: **every defence is countered by a deeper control, and vice versa.** This is not a war with a winner; it is a cost calculation.

## The Realistic Goal: Redundancy

What you *can* build is a site where closing one door does not close the site:

1. **Anycast main domain** — a CDN presence in hundreds of cities; blocking one region's edge does nothing elsewhere.
2. **A Tor onion service** — no registrable domain, no exposed origin IP; reachable wherever Tor is.
3. **A mirror on a separate domain** — a different registrable name, ideally on a different provider.
4. **Encrypted DNS guidance** — so users can still resolve you when classic DNS lies.
5. **Published instructions** — a page telling users exactly how to use each door, discoverable *before* the block.

Each door is imperfect. Together they force the censor to take increasingly visible, increasingly expensive action — blocking Tor bridges wholesale, ordering every CDN, chasing every mirror — and each of those actions has political and economic costs that a silent DNS edit does not.

## Content Changes the Calculus Too

Blocks are easier to justify — and to enforce quietly — when the material is genuinely unlawful. **Original writing, public-source data, and a real contact channel** remove the easy pretext. It does not make you unblockable; it makes blocking you an openly political act rather than a routine takedown, and those are harder to sustain.

## What to Tell Your Users

Be honest in public: *if one path fails, try the next.* A site that promises invulnerability and then disappears teaches people to give up. A site that publishes three doors and instructions keeps working for the users who bother to try door number two.

Redundancy is not a marketing claim. It is a checklist — and it is something you can actually finish.
