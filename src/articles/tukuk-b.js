module.exports = [
  {
    oldSlug: 'automasi-backup-watchdog-tukuk-os',
    title: 'Tukuk-OS Automation: Backups, Watchdogs and Self-Monitoring',
    slug: 'automation-backups-and-watchdogs',
    tags: ['Tukuk-OS', 'Automation', 'Backups', 'Reliability'],
    excerpt: 'How Tukuk-OS stays alive without me staring at a screen: scheduled backups to R2, a watchdog that restarts services, and logs that tell what happened.',
    content: `Self-hosted servers have one truth: they will fail at the most uncomfortable moment. In the early nights Tukuk-OS ran, I woke up checking my phone every few hours. After a few weeks of that I realised the solution was not more human supervision — it was automation.

### Scheduled Backups to Cloudflare R2

The most important part of my automation is the backup script. Every few hours the script exports the post database and search index to a \`gzip\` file, then uploads it to Cloudflare R2 (cheap object storage).

Three rules I set for backups:

1. **It must be fully automatic.** A backup that requires human memory is not a backup; it is a good intention.
2. **It must be tested.** I once ran a full restore in a testing environment before trusting the procedure.
3. **It must be cheap.** R2 offers very cheap object storage with no egress fees, so the monthly cost stays at a few cents.

Backup failures are never silent: the script writes results to a log, and consecutive failures show up in my daily check.

### The Watchdog: A Service That Restarts Itself

Linux systemd has a great feature: \`Restart=on-failure\`. If the Tukuk-OS process exits with an error, systemd waits a few seconds and starts it again. My watchdog configuration adds a second layer: a health check that sends \`GET /health\` every two minutes.

If two consecutive checks fail, the service is stopped and forcibly restarted. After repeated failures it is marked as failed so I know something needs attention — not just a process that crashed once and recovered on its own.

I deliberately chose a "restart first, investigate later" approach because most of my failures are temporary: a momentary memory spike, a network timeout, or an error that only occurs during startup. Automatic recovery solves 90 percent of problems before I even notice.

### Logs: The System's Memory

Every request, error, and notable decision is written to a log. When something happens at three in the morning the log tells me what occurred without guesswork. I use a simple approach: line-based text logs, filterable with \`grep\`, and kept on a rotation (old files are trimmed automatically so the disk never fills).

Three things I look for in the daily log: 500 errors, requests that took too long, and attempts blocked by rate limiting. Patterns in those three usually reveal problems long before users notice them.

### Testing Recovery: The Practice Most People Skip

The most commonly skipped part of any backup system is testing it. Most people happily produce backup files, nod, and feel safe — without ever trying to restore one. I was that person until I realised I did not actually know whether the file I produced could be read back.

Since then I have made restore testing a monthly routine. The process is simple: take the latest backup copy, load it into a temporary store, run the application against it, and verify the most important data exists and is consistent. The whole process takes about fifteen minutes.

That test has saved me twice. The first time it revealed that my script had been writing an almost-empty file for days because of an unnoticed path change. The second time it revealed that the restore procedure required a command I had already forgotten — and I wrote it into a procedure file before I could forget it again.

The rule I hold now: **an untested backup is just hope stored in gzip format**. Fifteen minutes a month is a reasonable price for genuine peace of mind.

### Notifications Without Noise

I once tried real-time notifications for every event and went deaf within two days. Now I only want to know when: the service has been down for more than a few minutes, backups have failed three times in a row, or disk usage has crossed a threshold. Those three events alone — all of them mean something that genuinely requires action.

### What Automation Cannot Replace

Automation restores services and maintains copies, but it cannot judge whether content is good, whether design is clear, or whether a feature should exist. That is human work, and it is why the Tukuk-OS system is designed to minimise routine maintenance — so my time can go into building and writing.

My advice: start with one automatic backup and one health check. Those two things alone will change the server-hosting experience from something nerve-wracking to something dependable.`
  },
  {
    oldSlug: 'borang-hubungi-cloudflare-email-tukuk-os',
    title: 'The Tukuk-OS Contact Form: From Click to Your Inbox',
    slug: 'contact-form-and-cloudflare-email',
    tags: ['Tukuk-OS', 'Email', 'Cloudflare', 'Backend'],
    excerpt: 'Building a contact form that actually sends email: from API keys, validation, and rate limits to Cloudflare Email Routing and how to avoid spam.',
    content: `A contact form looks easy: a text box, a submit button, done. In reality email is the most fragile part of any small website. The Tukuk-OS contact form took longer to refine than any other feature I built, and here is what I learned along the way.

### Why Email Is Hard for Small Sites

The problem starts with reputation. Major email providers (Gmail, Outlook) are deeply suspicious of new senders. If you send email directly from your own server it will likely land in spam — or be rejected outright — even if your intentions are completely genuine.

My first solution was a third-party email delivery service, but that added a new dependency and free-tier limits. Then I found a better fit for my project: **Cloudflare Email Routing**.

### How Cloudflare Email Routing Works

Because the tukuk.org domain is already managed by Cloudflare, I can set up email rules: \`hello@tukuk.org\` forwards to my personal inbox. No email server to host, no fees, and delivery goes through Cloudflare infrastructure that large providers already trust.

When the form is submitted the Tukuk-OS server builds an email message and sends it through the configured delivery method. The recipient sees a message from the domain itself, which dramatically improves delivery success rates.

### Security of the Form

An open form is a target for automated spam, so I added four layers:

1. **A secret API key** — only legitimate forms can submit.
2. **Rate limiting** — one IP can only send a few messages per minute.
3. **Basic validation** — required fields are trimmed and length-checked.
4. **Logging** — every attempt is recorded so I can see abuse patterns.

There is no annoying \`captcha\` for real users. Instead I rely on a combination of rate limits and a hidden key, which solves the bot problem without adding friction for humans.

### What Gets Sent

The email contains the name, the sender's address, and the message body, all sanitised first to prevent header injection (fake message headers that could poison logs or mislead recipients). I also set the correct \`Reply-To\` so I can reply directly to the sender with one click.

On the server side delivery failures are not swallowed: they are logged and returned to the form as an honest error message, so the sender knows the message did not get through and can try again.

### My First Mistake: Email Vanished Without a Trace

In the first month the contact form existed, someone told me they had sent an inquiry but never received a reply. I checked the logs and found no record of the request at all — meaning the form failed long before the email was sent, and the user was told nothing.

The cause was simple: a server-side error that only occurred when a particular field was filled in a particular way. The error was caught, but the response sent back to the form still reported success. I had assumed "silent failure" was better than frightening the user — that experience taught me it was one of the worst assumptions I ever made.

Since then every failure state gets the correct status code and a message written specifically for users. If email delivery fails the form tells you clearly and keeps your typed text so you do not have to retype. Success rates jumped after that change — not because fewer errors happened, but because errors are now detected and reported.

### Writing Messages That Get Replies

One lesson beyond the technical: what you write in the form affects whether you get an answer. My first messages were short and vague — "hi, I have a question" — and the reply rate was low.

Now I follow a simple template: introduce yourself in one sentence, state the question specifically (including links or references if any), and close with a reasonable expectation for reply time. Such messages respect the recipient's time and make it easier for them to reply usefully.

I also learned not to send repeated follow-ups. One clear message, then wait a few days before following up. That patience produces better reply rates than repeated pressure — and it keeps relationships with the people I contact in good shape.

### Key Lessons

Four takeaways from this work:

- Do not host email yourself if you do not have to; use infrastructure that is already trusted.
- Every open form needs at least rate limiting.
- Outbound email alone is not enough — you need logs to know what actually happened.
- An honest error message beats confusing silence every time.

The Tukuk-OS contact form now runs reliably, and I would much rather spend my time building new features than keep guessing why an email did not arrive.`
  },
  {
    oldSlug: 'privasi-tanpa-cookie-tukuk-os',
    title: 'Privacy in Tukuk-OS: Why There Are No Tracking Cookies',
    slug: 'privacy-without-tracking-cookies',
    tags: ['Tukuk-OS', 'Privacy', 'Cookies', 'Ethics'],
    excerpt: 'Why Tukuk-OS was designed without user tracking: what is not collected, what is stored, and how we keep search quality without profiling anyone.',
    content: `When you use most search engines you are the product. Your search history builds a profile that is later sold to advertisers. Tukuk-OS was built on the opposite belief: you are a user, not a product — and its privacy design reflects that decision from the very first line of code.

### What Tukuk-OS Does Not Collect

To be explicit:

- **No tracking cookies.** No analytics cookies, no cross-session user identifiers, no third-party trackers measuring you.
- **No user profiles.** No accounts, no search history tied to you.
- **No data sales.** No data sold to anyone because no personal data is collected to sell.
- **No targeted remarketing.** The ads you see are not based on you — they are based on the page you are reading.

You can verify this yourself: \`robots.txt\`, the page source, and \`privacy.html\` all explain the same thing openly.

### What Is Stored (And Why)

Absolute purity is impractical for running a web service. Tukuk-OS does store:

- **Standard server logs** — IP address, path, time, and response code. These are needed for security (detecting abuse), maintenance (diagnosing errors), and enforcing rate limits. Logs are rotated regularly so no long history is kept.
- **Search result caches** — stored per query, not per person, and without session identifiers.
- **Theme preferences** — stored in your browser (localStorage), never sent to the server.

The key difference: nothing stored can be used to build a profile about who you are, because no identifier links your session to any other session.

### How Search Quality Works Without User Data

This is the question I receive most. The answer: search quality depends on **content and the index**, not on your habits. Tukuk-OS's relevance score is computed from page structure — titles, headings, phrase matches — not from who you are.

There is no personalised "filter bubble" where you only see what you already believe. Everyone sees the same results for the same query, and that should be the default behaviour of any search engine.

### Performance Impact (Actually Positive)

A common assumption is that privacy hurts performance — that without tracking you lose optimisation ability. My experience shows the opposite.

With fewer third-party scripts, Tukuk-OS pages load faster and jank less while being read. No analytics script runs while content is being displayed, no tracker waits on the network during the first paint. When you remove all of that the page becomes light in a way users feel immediately.

On the server side, because no session identifiers need to be built and maintained for each user, every request is stateless — no session to store, no session to refresh. This makes the server design simpler and easier to scale.

The same applies to caching: because results do not vary by user, the same search result can be shared by everyone. One popular query is served once from cache and shown to a hundred searchers — savings that would be impossible if every user saw their own version.

### Advertising Without Tracking

Tukuk-OS displays ads through a standard advertising network to cover operating costs. The important part: ad impressions are not targeted at you based on your history, because that history does not exist on our side. If you see an ad it is because of the page you are reading, not because of you.

If you do not want to see ads at all, your ad blocker works here like anywhere else — we do not block it and we do not ask you to turn it off.

### Privacy Is Not an Add-On

The biggest lesson from this work is that privacy cannot be bolted on at the end of a project. If you build a system that collects user identifiers from day one, "removing" them later means rebuilding half the system — and the already-collected history still exists somewhere.

Instead, if you start with the assumption that no personal data needs to be stored, every design decision afterwards becomes easy: no session manager, no identifier encryption, no data deletion process (because there is nothing to delete), and no awkward answers when someone asks "what do you keep about me?".

The answer is short, honest, and easy to understand — and that posture itself becomes a product advantage. People are increasingly aware of who tracks them, and the ability to answer honestly is something bigger services find increasingly hard to match.`
  },
  {
    oldSlug: 'kos-menyenggara-tukuk-os',
    title: 'The Real Cost of Running Tukuk-OS: What Is Free and What Is Not',
    slug: 'the-real-cost-of-running-tukuk-os',
    tags: ['Tukuk-OS', 'Costs', 'Hosting', 'Free Software'],
    excerpt: 'An honest breakdown of Tukuk-OS operating costs: domain, cloud storage, open source, and hours — and why a free stack does not mean zero cost.',
    content: `Many people are surprised to hear that a search engine can run at almost zero cost. The answer is: yes, but "almost zero" is not "zero", and there are hidden costs that are more expensive than money — time. This article breaks down what I pay, what I get for free, and where the real cost actually lives.

### Actual Cash Expenses

**Annual domain** — this is my biggest expense. \`tukuk.org\` renews yearly at a few tens of dollars. It is also the only thing I feel is genuinely mandatory, because without a domain there is no identity.

**Cloudflare (free)** — DNS, HTTPS certificates, Email Routing, and Tunnel all sit on the free plan. For current traffic that plan is more than enough.

**Cloudflare R2 for backups** — very cheap object storage. Backup \`gzip\` files are small and written only a few times a day, so the monthly bill stays at a few cents.

**Server (already owned)** — Tukuk-OS runs on hardware I already have. Electricity and wear exist, but they are shared with my other computer use, so the marginal cost is barely noticeable.

Total monthly cash: almost invisible in the budget. Annually: almost entirely the domain.

### What Comes Free

The software stack is almost entirely free and open source: Ubuntu, Node.js, Express, Meilisearch (community plan), systemd, and various small tools. NASA data is opened by the US government to anyone. The tools I use for hosting docs and generating the OG image are all open source.

What matters: free here means an **open licence**, not low quality. Meilisearch solves search problems far better than I could build in the same time, and I got it without a licence fee.

### The Real Cost: Hours

This is where the real bill lives. Daily maintenance — checking logs, writing articles, adding features, testing after changes — takes far more time than any cash payment.

I estimate weekly maintenance at a few hours. If I counted that time at market rates it would easily be the largest expense of the project. But because I do the work because I want to, it is not a "cost" in the usual sense — it is an investment in the skills I gain.

### Revenue Versus Cost: When Does It Make Sense?

The next question is always: does this project make enough money to cover itself? Honest answer: almost, but not quite, and that is not my main goal.

Combined, ads and other income sources cover most of the annual cash cost — in the sense that the domain and storage keep getting paid. What is not covered is the hours, but as I said, those hours are a skills investment, not an expense I expect to profit from.

I deliberately set a modest monetisation target. If I set a target of "must fully pay for itself within a year" I would be tempted to add more ads, more redirects, and more tactics that damage the reader experience. With a modest target, design decisions stay free: I add features because they are useful, not because they raise clicks.

This approach also gives me the option to say no. No sponsorships that do not fit the product's values, no misleading ads, and no privacy compromises forced by revenue needs. For a personal project the freedom to say no is probably worth more than any income anyone could offer.

### What I Would Pay If It Grows

If traffic grows tenfold I would need to consider: a more powerful server (or a VPS), a wider CDN plan, and possibly a hosted search service if the index outgrows memory. I would also consider R2 for image caching and real-time notification services.

My principle: pay only when the real need arrives. Paying too early for scale you have not reached is waste; paying too late makes the site slow. The switch should happen when users — not plans — demand it.

### Lessons for Your Project

If you want to build something yourself, start with this cost model: buy a domain, use open source software, host on hardware you already have, and let your costs rise with your success. That way you will not quit before starting because of a server bill, and you will not pay for something that does not need it yet.`
  }
];
