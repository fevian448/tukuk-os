SLUG: http2-dan-http3-quic-panduan-ringkas
TITLE: HTTP/2 vs HTTP/3 (QUIC): What Actually Changes for Your Site
EXCERPT: HTTP/2 adds multiplexing over TCP, while HTTP/3 moves the transport layer to QUIC to eliminate head-of-line blocking and speed up connections.
TAGS: http3, quic, networking, performance

## Introduction

The HTTP protocol defines how servers and browsers exchange data. Most modern sites run on HTTP/2, but HTTP/3 is spreading because it fixes structural weaknesses that are hard to patch at the application layer. Understanding the difference between the two helps you make sensible configuration decisions instead of simply following a trend.

This post covers what each version brings, why **head-of-line blocking** still exists even with HTTP/2, how **QUIC** changes the **handshake**, and the practical steps to enable HTTP/3 on your own site.

## From HTTP/1.1 to HTTP/2

HTTP/1.1 requires one connection to carry one request at a time, or several parallel connections that waste resources. HTTP/2 fixes this with three main ideas:

- **Multiplexing** — multiple streams share one TCP connection concurrently, so images, scripts, and CSS no longer queue up waiting for a turn.
- **Header compression (HPACK)** — headers repeated on every request are compressed, shrinking the size of repetitive traffic.
- **Server push** — servers can send resources before they are requested, though browser support has been scaled back in practice.

The result is a site that feels faster, especially on high-latency connections, because the number of round trips drops sharply.

### The Hidden Limit: Head-of-Line Blocking

HTTP/2 looks like it solves everything, but one problem lingers below the surface. HTTP/2 multiplexing runs on top of **TCP**, and TCP guarantees in-order delivery. If one packet segment is lost mid-path, the TCP layer holds back everything after it until that segment is retransmitted — including streams that were actually ready to send.

Put differently, losing a single packet stalls every stream in that connection. This is **TCP head-of-line blocking**, and HTTP/2 cannot remove it because it is a property of the transport protocol, not the application protocol.

## HTTP/3 and QUIC

HTTP/3 moves the transport layer from TCP to **QUIC**, which is built directly on UDP. QUIC combines transport and flow control into a single protocol, and each stream handles packet loss independently. A lost packet in an image stream no longer slows down a script stream.

Other notable changes:

1. **Faster handshake** — QUIC merges the TLS 1.3 cryptographic exchange with connection setup, usually needing a single round trip instead of two or three with TCP. On distant networks that saves tens to hundreds of milliseconds.
2. **Connection migration** — when a user switches from Wi-Fi to mobile data, the QUIC connection survives because its identity is not bound to the IP and port pair.
3. **Application-aware loss control** — retransmission and flow control can be tuned for specific traffic types without waiting for kernel updates.
4. **Header encryption** — metadata such as stream numbers is encrypted, reducing exposure to passive observers.

The cost is slightly higher CPU demand and trickier debugging when QUIC is not supported, which is why HTTP/3 almost always runs as an upgrade rather than a hard replacement.

## What It Means for Your Site

HTTP/3 matters most in these situations:

- Users are far from origin servers, where every round trip is expensive.
- Mobile networks that change frequently and drop packets often.
- Sites loading many small, interdependent resources.

For sites mostly served from a nearby CDN, the gain may only be a few percent. That does not make HTTP/3 useless — just do not expect miracles without measuring first.

Things worth checking:

- Confirm the connection to origin also uses HTTP/2 or newer, since the browser-to-origin hop affects total load time.
- Check server logs for the share of traffic actually using HTTP/3.
- If you use a CDN, most already enable HTTP/3; all that remains is verifying it.

## Enable and Test Steps

1. Install a valid TLS certificate and verify your HTTPS configuration first; HTTP/3 will not work without it.
2. Enable the **Alt-Svc** header so browsers learn about HTTP/3 support on the next connection without disturbing the current one.
3. Test with tools like browser devtools, curl --http3, and the protocol panel in your browser's network tab.
4. Monitor HTTP/3 adoption, connection time, and error rate after enabling it.
5. Compare metrics across two weeks before and after, isolating the impact by region.

If HTTP/3 adoption stays below 20 percent, the likely cause is client networks or an Alt-Svc configuration that is not reaching browsers.

## Conclusion

HTTP/2 solves simultaneous delivery at the connection level, but it remains bound by **TCP**. HTTP/3 with **QUIC** lifts that solution into a better-suited layer, removing head-of-line blocking, accelerating the handshake, and making connections more resilient to network changes. Enable it as an upgrade, measure the real effect on your metrics, and let the data decide whether more network optimization is worth the effort.
