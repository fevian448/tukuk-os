SLUG: panduan-nginx-reverse-proxy-dengan-cloudflare
TITLE: Nginx as a Reverse Proxy Behind Cloudflare: A Practical Guide
EXCERPT: Learn how to set up Nginx as a reverse proxy behind Cloudflare, covering base config, proxy headers, SSL, and real client IP verification.
TAGS: nginx, cloudflare, reverse proxy, devops

## Introduction

When a site is served through Cloudflare, traffic no longer arrives directly at your server. It passes through the Cloudflare network first, then reconnects to your application server through a **reverse proxy**. Nginx most often plays that role because it is stable, lightweight, and easy to configure.

Yet this two-layer arrangement creates its own challenges: the visitor's real IP is hidden, HTTPS stacks sit on top of each other, and headers must be translated correctly. A small mistake here causes pages not to load, certificates not to be trusted, or logs showing every request coming from a Cloudflare address.

## Setting Up Nginx as a Reverse Proxy

The basic Nginx configuration block for this scenario usually lives in a virtual host file. The **proxy_pass** directive forwards every request to your application, for example to port 3000 on localhost or to a Docker service name.

It is essential to set all **proxy headers** completely. The Host header must carry the original domain name so the application knows which domain was requested. Headers such as X-Real-IP and X-Forwarded-For carry the visitor address, while **X-Forwarded-Proto** tells the application whether the original connection used HTTPS. Without them your app may generate HTTP links in an environment that should be HTTPS.

Inside a location / block you normally set longer read timeouts, enable the HTTP to HTTPS redirect, and allow only the required methods. Avoid mixing several sites in one location block without host filtering, because that invites request misrouting.

## SSL Encryption and Traffic Origin

There are two approaches to the Cloudflare-to-Nginx connection. The easiest is setting Full (strict) mode in Cloudflare and installing a TLS certificate on your Nginx itself. You then get two layers of encryption: visitor to Cloudflare, and Cloudflare to your server.

The second approach allows origin traffic on port 80 only and blocks everything else at the firewall. That avoids certificate complexity, but it is only safe if your network is genuinely closed off.

To recover the real client address, never blindly trust the X-Forwarded-For header. It can be forged by anyone reaching your server directly. Instead, load Cloudflare's official IP ranges, update them automatically, and use those addresses to verify traffic genuinely comes from their network.

### Cache, Gzip and Timeouts

Even though Cloudflare offers edge caching, Nginx is still useful for local caching of requests that cannot be stored at the edge. Enable **cache** for static assets with a sensible duration, and let Cloudflare handle global delivery.

Text compression such as gzip or brotli should always be on, because it reduces the bytes crossing two connection layers. Finally, align timeouts on both sides: the Cloudflare timeout should not be shorter than the Nginx timeout, otherwise connections drop mid-flight just as your application finishes responding.

## Common Mistakes

- Blocking port 80 entirely before swapping certificates, so HTTP-01 validation fails.
- Setting the wrong hostname in the Host header, making the application return 404 even though the page exists.
- Stacking multiple proxy layers without checking redirect limits, producing endless redirect loops.
- Letting Nginx logs record only Cloudflare addresses, which ruins traffic analysis and abuse blocking.
- Forgetting longer read timeouts for heavy requests while Cloudflare has already cut the connection at its own limit.

## Practical Configuration Steps

1. Install Nginx and test the local configuration before pointing the domain through Cloudflare.
2. Set proxy_pass to your application, including Host, X-Real-IP, X-Forwarded-For, and X-Forwarded-Proto.
3. Enable HTTPS on the Nginx side, then set Full (strict) in Cloudflare's SSL settings.
4. Load Cloudflare's IP ranges and reject traffic that claims the headers but arrives from outside them.
5. Test from outside: confirm the page loads, links stay HTTPS, and logs show the real visitor IP.
6. Track certificates on both layers in your calendar; a hidden expiry is usually found only when users report errors.

For repeatable installs and consistent configuration templates, some system providers such as **Tukuk-OS** ship built-in modules for traffic blocking based on automatically updated IP ranges, so you do not have to manage download scripts yourself.

## Conclusion

A reverse proxy behind Cloudflare brings major benefits in attack filtering and caching, but it demands careful configuration. Keep proxy headers complete, SSL consistent across both layers, and origin verification based on real IP ranges. Done right, Nginx stays a thin transparent layer — with all its complexity sitting exactly where it belongs.
