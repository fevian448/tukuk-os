SLUG: git-and-github-for-solo-projects
TITLE: Git and GitHub for Solo Projects: A Workflow You Will Actually Keep
EXCERPT: Version control is not teamwork bureaucracy — it is the undo button for your whole project, and a solo developer needs it more than anyone.
TAGS: git, github, workflow, version control

## Why Solo Developers Skip Git (and Regret It)

The common failure is familiar: a folder called `project-final`, another called `project-final-2`, and no idea which one contains the fix you made on Sunday. Git exists to make that impossible, and it costs about five commands to learn properly.

Git is the **local database** of every change you ever made. GitHub is just a copy of that database on the internet. You can use the first without the second, but the pair gives you free backups and a public record of your progress.

## The Five-Command Core

```bash
git init                 # start tracking this folder (once)
git status               # what changed?
git add -p               # stage changes, hunk by hunk
git commit -m "short reason"   # save a snapshot
git push                 # copy snapshots to GitHub
```

Everything else is elaboration. `git diff` shows the actual change before you stage it; `git log --oneline` shows history as a readable list.

## A Commit Message Habit That Scales

Write the message as **the reason**, not the file: `fix index rebuild race on restart`, not `update.js`. Future-you reads these messages while debugging; "update" tells you nothing at 2 a.m.

Small commits beat big ones. A commit that changes one idea can be reverted on its own. A commit that mixes a refactor with a feature forces you to choose between correctness and speed when something breaks.

## The Safety Net for Experiments

Branches are Git's superpower even for one person:

```bash
git switch -c experiment-tor-onion
# ...make a mess...
git switch main             # project restored exactly as it was
```

Because the messy work never touched `main`, there is nothing to "undo" — you simply go back. When the experiment works, `git merge experiment-tor-onion` folds it in. Treat branches as disposable laboratories; deleting one costs nothing.

## What to Publish and What Not To

Push `src/`, content, configs — never secrets. Environment files with API keys belong in `.env`, listed in `.gitignore`, distributed through your server's environment instead. The classic rookie leak is a committed API key; the classic fix is a rotated key, because **assume anything committed has already been scraped**, even if you delete it in the next commit (history still contains it).

A reasonable `.gitignore` for a Node project:

```gitignore
node_modules/
.env
data/
meili_data/
*.log
```

## A Minimal Solo Routine

1. Start the day with `git pull` — your laptop and the server may disagree.
2. Commit whenever a working state exists — not once a day, not when "finished".
3. Push after each commit — the remote is your off-machine backup.
4. Tag releases (`git tag v1.0`) so "the version that worked last month" is one command away.

Git takes an evening to learn and repays you the first time you break something at midnight. It is the cheapest insurance in all of software.
