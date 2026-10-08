SLUG: launch-checklist-for-a-side-project
TITLE: The Launch Checklist for a Side Project You Want to Stay Up
EXCERPT: Launching is not the demo — it is the moment strangers, crawlers, and bad actors arrive at once. A checklist beats adrenaline.
TAGS: launch, checklist, operations, seo

## Why Checklists

Under launch excitement you forget the boring things that only matter under load: certificates, backups, 404s, and who gets paged at midnight. A checklist is how a small team gets reliable-operations habits without an operations team.

## Before the First Visitor

**Security basics**
- [ ] No secrets in git (`.env` untracked; keys rotated if ever committed).
- [ ] HTTPS everywhere; redirect `http` → `https` and `www` → apex (pick one canonical host).
- [ ] Rate limits on expensive routes; body-size limits on parsers.
- [ ] Admin/health routes not exposed publicly, or behind auth.

**Stability**
- [ ] `Restart=on-failure` on every service; server reboots cleanly with them enabled.
- [ ] `/health` checks real dependencies and returns `503` when degraded.
- [ ] One external uptime monitor with a **tested** alert.
- [ ] Backups exist **and have been restored once**. A backup you have not restored is a hope, not a backup.

**Performance under real conditions**
- [ ] Gzipped responses; static assets cached with sensible `max-age`.
- [ ] HTML revalidates (`no-cache`) so deploys are visible immediately; the service worker script is `no-store`.
- [ ] Tested from outside your network — different device, mobile data, not your dev Wi-Fi.

## For the Crawlers

- [ ] `sitemap.xml` returns every canonical URL; submitted to Search Console **and** IndexNow.
- [ ] Real `404` for unknown pages — no catch-all `200` soft-404s.
- [ ] One redirect per old URL, permanently (301), never loops.
- [ ] Titles and descriptions unique per page; one `h1` that says what the page is.
- [ ] `robots.txt` allows what you want indexed and points at the sitemap.

## For Humans

- [ ] 404 page links home; error states in the UI explain themselves.
- [ ] Mobile viewport correct; tap targets reachable.
- [ ] Privacy page exists and **matches reality** (list the trackers you actually run).
- [ ] Contact channel monitored — someone answers.

## The First Week Afterwards

Watch, in this order: **errors → latency → zero-result searches → top landing queries.** Each one reveals a different failure: code bugs, capacity problems, index gaps, and finally what people actually wanted from you.

Write down what broke. Every incident that surprised you becomes a checklist line — and the list that would have prevented your next outage is the most valuable document a solo developer owns.

## Ship the Checklist With the Repo

Keep it in `README` or `docs/launch.md`, updated in the same commit as the change that invalidates it. Checklists rot when they are memories; they work when they are files.
