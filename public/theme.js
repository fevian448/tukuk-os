/* Tukuk-OS theme controller — load early in <head>, no defer. */
(function () {
  var KEY_THEME = 'tk-theme';
  var KEY_ACCENT = 'tk-accent';
  var ORDER = ['system', 'light', 'dark'];
  var DEFAULT_ACCENT = 'blue';

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function preference() {
    var value = read(KEY_THEME);
    return ORDER.indexOf(value) >= 0 ? value : 'system';
  }
  function systemIsLight() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  function isDark() {
    var pref = preference();
    return pref === 'dark' || (pref === 'system' && !systemIsLight());
  }

  function apply() {
    var dark = isDark();
    var pref = preference();
    var accent = read(KEY_ACCENT) || DEFAULT_ACCENT;
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-theme-pref', pref);
    root.setAttribute('data-accent', accent);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f1115' : '#f7f8fa');

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.textContent = pref === 'system' ? '◐' : (dark ? '☾' : '☀');
      toggle.setAttribute('aria-label', 'Colour theme: ' + pref);
      toggle.setAttribute('title', 'Theme: ' + pref + ' (click to change)');
    }

    var dots = document.querySelectorAll('[data-accent-set]');
    for (var i = 0; i < dots.length; i += 1) {
      dots[i].setAttribute(
        'aria-pressed',
        dots[i].getAttribute('data-accent-set') === accent ? 'true' : 'false'
      );
    }
  }

  function cycleTheme() {
    var next = ORDER[(ORDER.indexOf(preference()) + 1) % ORDER.length];
    write(KEY_THEME, next);
    apply();
  }

  function bind() {
    var toggle = document.getElementById('theme-toggle');
    if (toggle && !toggle.dataset.tkBound) {
      toggle.dataset.tkBound = '1';
      toggle.addEventListener('click', cycleTheme);
    }
    var dots = document.querySelectorAll('[data-accent-set]');
    for (var i = 0; i < dots.length; i += 1) {
      if (dots[i].dataset.tkBound) continue;
      dots[i].dataset.tkBound = '1';
      (function (dot) {
        dot.addEventListener('click', function () {
          write(KEY_ACCENT, dot.getAttribute('data-accent-set'));
          apply();
        });
      })(dots[i]);
    }
  }

  apply();

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function () { if (preference() === 'system') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  document.addEventListener('DOMContentLoaded', bind);

  window.tkTheme = { apply: apply, cycle: cycleTheme, bind: bind };
})();

/* Logger ralat JS — hantar ke /api/js-error (audit punca ScriptError Clarity). */
(function () {
  if (!window.fetch || !navigator.sendBeacon) return;
  var sent = 0;
  var MAX = 8;
  function report(kind, message, source, line, col) {
    if (!message || sent >= MAX) return;
    sent += 1;
    try {
      navigator.sendBeacon('/api/js-error', new Blob([JSON.stringify({
        kind: kind,
        message: String(message).slice(0, 400),
        source: String(source || '').slice(0, 300),
        line: line | 0,
        col: col | 0,
        page: location.pathname + location.search
      })], { type: 'application/json' }));
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {
      report('resource', (e.target.tagName || 'RESOURCE') + ' gagal dimuat: ' + (e.target.src || e.target.href), '', 0, 0);
      return;
    }
    report('error', e.message, e.filename, e.lineno, e.colno);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    report('promise', (r && (r.message || r.name)) || String(r) || 'unhandled rejection', '', 0, 0);
  });
})();
