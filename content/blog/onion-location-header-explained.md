SLUG: onion-location-header-explained
TITLE: The Onion-Location Header: How Websites Invite Tor Users Automatically
EXCERPT: Onion-Location is a single HTTP response header that tells Tor Browser your site has an onion mirror — one line of server config that bridges the clearnet and Tor worlds.
TAGS: tor, http headers, censorship, web standards

## One Header, Two Worlds

`Onion-Location` is an HTTP response header proposed by the Tor Project and supported natively by Tor Browser. When your server sends:

```
Onion-Location: http://your-service.onion/path
```

Tor Browser shows a small prompt offering to open the onion version instead. The visitor gets the same site with a stronger transport, and you wrote exactly one line of configuration.

No JavaScript. No service worker. No visible change for ordinary browsers — they simply ignore the unknown header.

## Why It Matters for Reachability

A clearnet domain can be blocked at three layers: **DNS** (the name does not resolve), **IP** (the address is filtered), and **TLS/SNI** (the handshake is recognised and reset). An onion address uses none of those. If Tor connectivity works, the site loads — the blocker has nothing obvious to filter except Tor itself.

`Onion-Location` is how you tell people that path exists *before* they need it. The header rides along on every normal visit, so users discover the onion mirror while the network still works, and remember it for the day it does not.

## Server-Side Setup

Any framework can set it. In Express:

```js
app.use((req, res, next) => {
  if (!/\.[a-z0-9]+$/i.test(req.path) || req.path.endsWith('.html')) {
    res.setHeader('Onion-Location', `http://${ONION_HOST}${req.originalUrl}`);
  }
  next();
});
```

Two details matter:

- **Match paths carefully.** Static assets do not need the header; HTML and clean URLs do. Preserving `req.originalUrl` keeps query strings and subpaths intact so the onion URL mirrors the clearnet URL exactly.
- **Set it before other middleware** that might replace headers or stream files, so the header survives to the actual response.

For Nginx:

```nginx
add_header Onion-Location "http://$onion_host$request_uri" always;
```

## What Visitors Experience

1. The user opens `https://your-site.example` in Tor Browser.
2. The response carries `Onion-Location`.
3. Tor Browser displays a bar: *You are viewing an onion site, we recommend you view this site using Tor Browser instead* — or offers to open it directly, depending on version.
4. The next loads go through the `.onion` address.

Standard browsers — Chrome, Firefox on the clearnet, Safari — never see the prompt. The feature is invisible until the moment it is useful.

## Good Practices

- **Keep content identical.** The header promises equivalence; broken onion mirrors destroy trust.
- **Serve it on HTML responses only.** Pointing users' Tor Browser at a JSON endpoint or an image is noise.
- **Test the onion route end to end** with a SOCKS curl through Tor before publishing the hostname.
- **Pair it with a mirror page** that explains DoH, bridges, and what to do when *each* door closes.

`Onion-Location` costs nothing and works forever. It is the smallest possible signal that your site plans to stay reachable.
