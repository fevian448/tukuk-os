SLUG: membangun-backup-system-dengan-cloudflare
TITLE: Building an Automated Backup System with Cloudflare
EXCERPT: A guide to automated backups using Cloudflare R2, Workers and Cron Triggers without surprise egress bills eating your budget.
TAGS: cloudflare, backup, r2, serverless

## Introduction

A backup that has never been tested for recovery is not a backup; it is a copy that gives false confidence. The main challenge for small builders is cost: cloud storage services happily charge high egress fees, so many people postpone backup projects for months. This article shows how to build an automated backup system from Cloudflare components — specifically **R2**, **Workers**, and **Cron Triggers** — that stays cheap and scales with your data size.

## Why Cloudflare R2 for Storage

R2 is an object service similar in concept to the buckets of Amazon S3, but with two big advantages. First, it offers **zero egress**, meaning you are not charged when you download data out. That changes the maths: you can store 100 GB without worrying about a bill spike when you genuinely need to restore files. Second, R2 supports an S3-compatible API, so most existing tools work without modification.

For backup needs, R2 also gives server-side encryption, object lifecycle rules to drop old versions automatically, and bucket listings you can reference during an audit.

## System Design

A practical structure for most small projects:

1. **Data sources**. Databases, configuration files, and user upload folders.
2. **Collection process**. A script or Worker that structures data into a daily archive.
3. **Storage**. An R2 bucket with folders by date, for example backup/2026-10-07/db.gz.
4. **Scheduler**. Cron Triggers run the collection process on a fixed schedule.
5. **Notification**. A message to your alert channel if the job fails or archive size drops suspiciously.

With this separation, switching storage providers does not force you to rewrite the collection logic.

### Using Workers as the Collector

**Cloudflare Workers** are serverless functions running on the edge network. They suit work that runs continuously for a few minutes, such as pulling data from a database, compressing it, then uploading to R2.

A typical flow for each important table:

1. Read only recent data based on a last-updated field, so backups stay small.
2. Pack it into an archive and tag it with a unique identifier containing the date and schema version.
3. Upload to R2 with a consistent key, then write an entry into a single JSON listing.
4. Emit a short log line to the Workers console so results are easy to review from the dashboard.

For databases, do not simply export everything every day. Use an **incremental** approach: a full backup once a week, then daily deltas for changes afterwards. Most teams find daily archives shrink by as much as 80 percent compared with full exports.

## Best Practices Often Overlooked

- **Store keys properly.** Use Workers secrets and avoid keeping access keys in the repository.
- **Keep buckets layered.** Separate the backup bucket from production so one failure cannot damage both.
- **Set lifecycle rules.** Keep 7 days of daily archives, 4 weeks of weekly, and 3 months of monthly, then let the system delete the rest.
- **Test recovery regularly.** Schedule one session a month to restore a small archive into a clean environment and confirm it opens.
- **Monitor size and duration.** Archives that suddenly shrink or jobs that run longer than usual usually mean a blocked source.
- **Keep one copy off the same network.** Zero egress makes R2 attractive, but the 3-2-1 rule still applies: at least one copy on a different provider.

## Common Mistakes

Many beginners run the backup alongside the main application, so the heavy job hurts real users at peak hours. Instead, schedule it during a quiet window. Another mistake is storing files without metadata, which makes it hard to know which version matches a particular database schema. Finally, ignoring failure alerts; a silent system is not a healthy one.

## Practical Steps to Start

1. Create an R2 bucket and set lifecycle rules matching your retention pattern.
2. Write one collector script with incremental mode, and test it manually first.
3. Move the script into Workers and add Cron Triggers for a daily schedule.
4. Connect your preferred notification channel, such as a webhook.
5. Run a full restore as a test, then note how long it took.
6. Only then add other data types like generated files and system settings.

With this arrangement the cost stays low, the process runs by itself, and most importantly — you have already proven the backup can actually be restored.
