SLUG: testing-your-nodejs-app-without-ceremony
TITLE: Testing Your Node.js App Without Ceremony
EXCERPT: You do not need a testing framework religion to know whether your code works — start with a script, a few assertions, and one command you run before every deploy.
TAGS: nodejs, testing, javascript, quality

## The Real Goal

The point of tests is not coverage percentages. It is answering one question with confidence: **did my last change break anything that used to work?** Anything that answers that question honestly is a valid test system.

For a small Node project, the built-in `node:test` module and `node:assert` are enough — no dependencies, no configuration files, no transpilation.

## Tests as Plain Scripts

```js
// test/url.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { embedSrc } from '../src/embed.js';

test('youtube watch links become nocookie embeds', () => {
  const out = embedSrc('https://www.youtube.com/watch?v=abc123');
  assert.strictEqual(out, 'https://www.youtube-nocookie.com/embed/abc123');
});

test('unknown platforms return null instead of guessing', () => {
  assert.strictEqual(embedSrc('https://example.com/video/1'), null);
});
```

Run it with:

```bash
node --test test/
```

That is the entire infrastructure. CI can run the same command.

## What to Test First (Highest Value per Line)

1. **Pure functions** — URL parsing, formatting, scoring, decision logic. No I/O, instant feedback, they catch the most bugs per line written.
2. **Boundary values** — empty strings, zero results, huge inputs, missing fields. Most production bugs live at the edges.
3. **One happy-path integration test** — boot the app, hit `/health`, assert `200`. This catches "the server does not even start" before your users do.

Skip, for now: pixel-perfect DOM tests, mocking every external call, and testing third-party libraries. Those are expensive and rarely where small projects die.

## Test the Thing You Just Fixed

Every bug earns a regression test:

```js
test('getDocuments wrapper: reads res.results, not the object', () => {
  const wrapped = { results: [{ id: 1 }], offset: 0, limit: 1000, total: 1 };
  assert.strictEqual(normaliseDocs(wrapped).length, 1);
});
```

We wrote exactly this after a merge script silently copied **zero documents** because the client returns `{ results: [...] }`, not an array. The bug cost an evening; the test costs four lines and can never cost us that evening again.

## The One-Command Habit

Add a single script your hands know:

```json
"scripts": {
  "test": "node --test test/",
  "predeploy": "npm test && node --check src/server.js"
}
```

`node --check` deserves special mention: it catches syntax errors across an entire file in milliseconds — the single cheapest test in the Node ecosystem, and enough to stop shipping a typo that crashes the server on restart.

## When to Graduate

You have outgrown plain tests when: assertions get repetitive (add tiny helpers), fixtures sprawl (introduce a fixtures folder), or you need HTTP lifecycle control (then consider a framework — but only then). Most solo projects never need to graduate at all.

Tests are not a tax you pay for being serious. They are the difference between changing your code with confidence and changing it with fear.
