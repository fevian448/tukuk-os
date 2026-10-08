SLUG: inline-video-player-embeds
TITLE: Inline Video Player Embeds: Keeping Visitors on Your Site
EXCERPT: Clicking a video should open a modal on your own domain, not a new tab on someone else's — here is the small amount of JavaScript that makes that work.
TAGS: javascript, video, ux, embeds

## The Redirect Nobody Asked For

Video results are usually plain links. Click → new tab → YouTube's interface, recommendations, and a URL that has nothing to do with where the user started. For a search engine, that is a broken loop: you did the work of finding the video, then handed the session away.

An **inline player** fixes the loop. The user clicks a result card; a modal opens *on your domain*; the video plays in an iframe; `Esc` closes it and the results are exactly where they left them. The outbound link stays available for people who genuinely want the platform UI.

## Supported Platforms, One Detector

Different platforms expose different embed forms, so normalise everything through one function:

```js
function embedSrc(href) {
  const u = new URL(href);
  const h = u.hostname.replace(/^www\./, '');
  if (h === 'youtu.be')            return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  if (h.endsWith('youtube.com')) {
    const id = u.searchParams.get('v');
    if (u.pathname.startsWith('/shorts/')) return `https://www.youtube-nocookie.com/embed/${u.pathname.split('/')[2]}`;
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (h === 'vimeo.com')           return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
  if (h === 'dailymotion.com')     return `https://www.dailymotion.com/embed/video/${u.pathname.split('/').pop()}`;
  return null; // unsupported → let the link open normally
}
```

Two deliberate choices in there:

- **`youtube-nocookie.com`** for embeds — it loads no cookies until the user plays, which keeps the page honest under our cookie-free privacy policy.
- **Return `null` for unknown platforms** instead of guessing. An unsupported link opening externally is correct behaviour, not a failure.

## Event Delegation, Not Listeners Per Card

Video lists grow — pagination, "load more", re-renders. Binding a click handler to every card means unbinding them on every re-render. One delegated listener survives all of it:

```js
document.addEventListener('click', (e) => {
  const a = e.target.closest('a.video-card');
  if (!a) return;
  const src = embedSrc(a.href);
  if (!src) return;
  e.preventDefault();
  openModal(src, a.querySelector('h3')?.textContent || 'Video');
});
```

`e.target.closest` walks *up* from whatever was clicked — thumbnail, title, badge — so the whole card is the target without extra wiring. `preventDefault` must happen on the same tick as the decision; that is what cancels navigation.

## The Modal Checklist

- **Backdrop click and `Esc`** both close — the two gestures users already know.
- **Clear the iframe on close** (`src = ''`), or the video keeps playing audibly behind the results.
- **Focus management**: move focus to the modal on open, return it to the card on close.
- **Mobile**: full-width, bottom-sheet style; iOS Safari plays inline with `playsinline` on the embed URL.
- **`rel=0` and no-cookie domain** for YouTube — recommendations stay context-appropriate and tracking-light.

## Testing Without Guesswork

Unit-test `embedSrc` against a URL matrix (watch, share, shorts, youtu.be, vimeo, garbage) — it is pure logic and cheap to lock down. For the interaction itself, verify the *server side* is not fighting you: if the page you are testing was served from a stale cache, you are debugging yesterday's JavaScript. Check the served bytes (`curl | grep embedSrc`) before believing a browser screenshot.

Twenty lines of JavaScript, one modal, and the visit stays yours.
