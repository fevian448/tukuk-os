SLUG: git-bisect-finding-the-commit-that-broke-it
TITLE: Git Bisect: Finding the Exact Commit That Broke Your Code
EXCERPT: When a bug appeared "somewhere in the last hundred commits", binary search with git bisect finds the guilty change in ten steps instead of an afternoon of guessing.
TAGS: git, debugging, bugs, workflow

## The Problem Bisect Solves

You notice something is wrong. Nobody knows when it started. The instinct is to read recent diffs one by one — an activity that feels like debugging but is really *archaeology*, and scales linearly with your sloppiness.

`git bisect` replaces guesswork with **binary search over history**. One hundred commits become at most seven checks. One thousand becomes ten.

## The Two-Minute Version

```bash
git bisect start
git bisect bad                 # current commit is broken
git bisect good v1.2.0         # this old tag was fine
# git checks out the middle commit — you test it:
npm test                       # or click the broken feature
git bisect good                # this commit is fine
git bisect bad                 # this commit is broken
# ...repeat until:
# 9d3f2a1 is the first bad commit
git bisect reset               # back to where you started
```

Each answer halves the search space. Ten answers anywhere in your history, and you have the single commit that introduced the bug — with its author, message, and full diff staring at you.

## Automating It: Bisect Runs Your Tests

Manual clicking is fine for UI bugs. For logic bugs, let Git do the checking:

```bash
git bisect run npm test
```

`git bisect run` executes your command at every step: exit code `0` means good, anything non-zero (up to 125) means bad. If the command crashes entirely (125), Git aborts safely rather than lying to you.

Make it reliable:

- **Use a fast, deterministic check.** The whole exercise costs `log₂(n) × test-time`; a 10-minute suite turns seven steps into over an hour. Write a targeted test for *the* behaviour, not the whole suite.
- **Handle "I don't know".** If a commit cannot even build, `git bisect skip` moves past it and continues with the rest of the range.
- **Be strict about the answer.** A flaky test trains bisect to give you a random commit. Fix flakiness first or distrust the output.

## A Real Session From This Project

Symptom: a merge script reported "0 documents copied" even though the source index held 32,000. The script had "worked" weeks ago.

```bash
git bisect start
git bisect bad
git bisect good <commit-before-merge-scripts>
git bisect run node scripts/merge-index.js --dry-run
```

The culprit: a commit that upgraded the search client library. The new version returned `{ results: [...] }` from `getDocuments` instead of a bare array — invisible in review, fatal in execution. The bisect took six steps and ended the "maybe our data is wrong" phase of the investigation permanently.

## Tips That Make It Painless

- **Tag your releases** — bisect needs a known-good anchor, and `origin/main~43` is not an anchor.
- **Combine with `git log --oneline <bad> ^<good>`** right after to see everything in the guilty window.
- **For flaky-by-nature bugs**, script a loop: run the check 20× per step and only trust "bad" if it fails consistently.
- **`git bisect view`** opens an interactive log of the range if you want to read the story of how things changed.

## The Mindset Payoff

Bisect teaches a habit that outlives the command: **every commit should be a coherent, testable state.** When commits mix five concerns, bisect's answer points at a diff you cannot reason about. When commits are small and honest, bisect hands you the bug and its cause in one screen.

Bugs are inevitable. Hunting them one at a time, by hand, across a thousand files — that part is optional.
