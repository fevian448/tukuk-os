SLUG: famous-software-bugs-that-changed-engineering
TITLE: Famous Software Bugs That Changed Engineering Forever
EXCERPT: Ariane 5 exploded, Therac-25 killed, and a decimal point cost a bank $330M — the canonical bug stories are not gossip, they are the curriculum nobody teaches formally.
TAGS: bugs, history, software engineering, testing

## Why Studying Old Bugs Works

Nobody learns wisdom from a checklist alone. The famous failures carry emotional weight precisely because the people involved were competent, rushed, and certain — which is exactly how you feel on any Tuesday. Read them once and you will recognise the shape of your next incident before it finishes unfolding.

## Ariane 5 — 501: One Conversion, One Rocket

In 1996, the Ariane 5 launcher veered off course 37 seconds after liftoff and self-destructed. Cause: a 64-bit floating-point value from the inertial reference system, converted to a 16-bit signed integer. The new rocket's acceleration produced a number the old rocket never could — **overflow** — inside a piece of code inherited verbatim from Ariane 4, where the value range made the conversion safe.

Lessons that still bite:

- **Inherited code is not validated code.** The component had passed every test that mattered on the previous vehicle.
- **Defensive conversion is cheap.** One range check, or letting the exception be handled as "ignore this guidance sample", would have saved the rocket.
- **Failure of a non-critical module can be critical** if nothing isolates it from the flight computer.

## Therac-25 — When Confidence Killed

In the mid-1980s, a radiation therapy machine delivered lethal doses to several patients. The bug was a **race condition**: a human operator could modify the treatment setup faster than the software's state machine processed it, causing the machine to deliver radiation without the beam-shaping device in place. The software checked the state *before* the operator's edit landed, then ran on stale assumptions.

The uncomfortable part: earlier incidents were dismissed as "operator error" because the code *logically* could not do what patients and technicians reported. The bug lived in a window between events, not in any single line.

Lesson: **timing bugs produce impossible reports that are actually true.** When a competent human says the machine did X and the code says X is impossible, the code is wrong about time.

## Knight Capital — 45 Minutes, $440 Million

In 2012, Knight Capital deployed new trading software. One server in the cluster never received the deployment — but the release also repurposed an old, unused code path into a live "power peg" feature. On that machine, the dormant code woke up, interpreted garbage state as trading signals, and accumulated $440M of unwanted positions in 45 minutes before anyone pulled the plug.

Lessons: **deploy consistency across a cluster is part of "the deploy"**, kill-switches must be independent of the code they kill, and feature flags are time bombs when old ones are never reclaimed.

## The Integer Failures

- **Toronto Stock Exchange, 2010** — a runaway test message multiplied orders until a symbol's price hit the exchange's **integer overflow** guard and trading halted.
- **Intel Pentium FDIV (1994)** — an incorrect lookup table entry in the floating-point divider produced division errors on specific operands. A tiny defect in a lookup table, shipped in millions of chips, costing ~$475M to recall.
- **Knight Bros. decimal disaster (2003)** — currency arbitrage software divided by 10,000 instead of 1,000 (JPY handling), executing trades on false spreads until the firm's positions exceeded its capital.

The pattern: **numeric edge cases are not theoretical** — they are where real money and real rockets die.

## CrowdStrike 2024 — Scale as a Weapon

A faulty configuration update to a kernel driver caused mass Windows blue screens worldwide. The bug itself was ordinary (a content update without adequate validation); what made it historic was **the update channel's blast radius** — one file, one push, millions of machines crashing simultaneously, many unable to even boot for recovery.

Modern lesson: **your deployment pipeline is part of your attack surface against yourself.** Staged rollouts, canaries, and the ability to stop mid-push are not bureaucracy — they are the only thing between a bad file and a global outage.

## The Checklist These Bugs Produce

1. Check numeric conversions at every boundary (and test the extremes).
2. Treat "impossible" user reports as timing bugs until proven otherwise.
3. Verify **every** machine got the deploy before declaring success.
4. Keep a kill switch that does not depend on the thing it kills.
5. Roll out gradually — your update system can break more than your code.

Bugs of this scale share a texture: competent people, missing verification at the seams, and a system that trusted its own assumptions. Your project has the same texture at a smaller radius — the only question is whether you read these stories first.
