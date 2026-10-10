/*
 * PATCHWORK client runtime: the loader the demo site includes.
 * It asks the Patchwork server which patches are live and applies them to the page.
 * Because it is just a script tag, every visitor sees the patches, no extension needed.
 *
 *   - Dashboard deploys / edits / rolls back  ->  /deployments/live changes
 *   - This script polls it every few seconds and reloads the page when it changes
 *   - ?preview_patch=<id> shows a draft on top of the live patches (isolated preview)
 */
(function () {
  var script = document.currentScript;
  var API = (window.PATCHWORK_API || (script && script.getAttribute('data-api')) || 'http://localhost:4000').replace(/\/$/, '');
  var POLL_MS = Number(window.PATCHWORK_POLL || (script && script.getAttribute('data-poll')) || 2000);
  var previewId = new URLSearchParams(window.location.search).get('preview_patch');

  // ---------- applying a change ----------
  function camelToKebab(s) {
    return s.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
  }

  function parseDeclarations(value) {
    var out = [];
    try {
      var obj = JSON.parse(value);
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(function (k) { out.push([camelToKebab(k), String(obj[k])]); });
        return out;
      }
    } catch (e) { /* not JSON, treat as CSS text */ }
    String(value).split(';').forEach(function (part) {
      var i = part.indexOf(':');
      if (i > 0) out.push([part.slice(0, i).trim(), part.slice(i + 1).trim()]);
    });
    return out;
  }

  function applyChange(el, change) {
    var type = change.type, value = change.value;
    if (type === 'text') {
      el.textContent = value;
    } else if (type === 'style') {
      parseDeclarations(value).forEach(function (d) {
        var important = /!important\s*$/.test(d[1]);
        el.style.setProperty(d[0], d[1].replace(/!important\s*$/, '').trim(), important ? 'important' : '');
      });
    } else if (type === 'visibility') {
      var hide = /^(hidden|hide|none|invisible)$/i.test(String(value).trim());
      el.style.display = hide ? 'none' : '';
    } else if (type === 'script') {
      try { new Function('target', value)(el); }
      catch (err) { console.warn('[Patchwork] script patch failed:', err); }
    }
  }

  // ---------- finding the element (selector, xpath, then fuzzy "healing") ----------
  var GENERIC = { btn: 1, button: 1, primary: 1, secondary: 1, link: 1, the: 1, a: 1, to: 1, and: 1 };
  var SYNONYMS = [
    ['checkout', 'order', 'pay', 'purchase', 'buy'],
    ['cart', 'basket', 'bag'],
    ['login', 'signin', 'sign-in'],
    ['signup', 'register', 'join'],
  ];

  function tokens(str) {
    var set = {};
    String(str || '').toLowerCase().split(/[^a-z0-9]+/).forEach(function (t) {
      if (!t || GENERIC[t]) return;
      SYNONYMS.forEach(function (group) { if (group.indexOf(t) !== -1) t = group[0]; });
      set[t] = 1;
    });
    return set;
  }

  function elementTokens(el) {
    return tokens([el.id, el.getAttribute('class'), el.textContent].join(' '));
  }

  function anchorTokens(a) {
    var attrs = a.attributes || {};
    return tokens([attrs.id, attrs['class'], attrs.name, a.textContent, a.cssSelector].join(' '));
  }

  function jaccard(a, b) {
    var inter = 0, union = Object.assign({}, a, b);
    Object.keys(a).forEach(function (k) { if (b[k]) inter++; });
    var u = Object.keys(union).length;
    return u === 0 ? 0 : inter / u;
  }

  function byXPath(xpath) {
    try {
      return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) { return null; }
  }

  function findTarget(patch) {
    var a = patch.anchors || {};
    var el = null;
    try { el = a.cssSelector ? document.querySelector(a.cssSelector) : null; } catch (e) { /* bad selector */ }
    if (el) return { el: el, how: 'selector' };
    if (a.xpath && (el = byXPath(a.xpath))) return { el: el, how: 'xpath' };

    // Healing: the selector no longer matches (site was updated), so look for the
    // element that is most similar in id / class / text, with a small synonym table.
    var want = anchorTokens(a), best = null, bestScore = 0;
    document.querySelectorAll('body *').forEach(function (cand) {
      if (cand.closest('#patchwork-preview-banner') || /^(SCRIPT|STYLE|HTML|BODY)$/.test(cand.tagName)) return;
      if (cand.children.length > 3) return; // skip big containers
      var score = jaccard(want, elementTokens(cand));
      if (score > bestScore) { best = cand; bestScore = score; }
    });
    return bestScore >= 0.25 ? { el: best, how: 'healed', score: bestScore } : null;
  }

  function applyPatches(patches) {
    patches.forEach(function (patch) {
      var found = findTarget(patch);
      if (!found) {
        console.warn('[Patchwork] could not find target for patch', patch.id, patch.anchors && patch.anchors.cssSelector);
        return;
      }
      applyChange(found.el, patch.change);
      console.log('[Patchwork] applied', patch.id.slice(0, 8), 'via', found.how, found.score ? '(' + found.score.toFixed(2) + ')' : '');
    });
  }

  // ---------- preview banner (built with DOM APIs, never innerHTML) ----------
  function showBanner(patch) {
    var bar = document.createElement('div');
    bar.id = 'patchwork-preview-banner';
    bar.setAttribute('style',
      'position:fixed;bottom:0;left:0;width:100%;background:#d97706;color:#fff;padding:10px 16px;' +
      'font:600 14px system-ui,sans-serif;z-index:999999;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box');
    var label = document.createElement('span');
    label.textContent = 'PATCHWORK PREVIEW (draft ' + patch.id.slice(0, 8) + '): ' + patch.change.type + ' = ' + patch.change.value;
    var exit = document.createElement('a');
    exit.href = window.location.pathname;
    exit.textContent = 'Exit preview';
    exit.setAttribute('style', 'color:#fff;background:rgba(0,0,0,.25);padding:4px 10px;border-radius:4px;text-decoration:none;font-size:12px');
    bar.appendChild(label);
    bar.appendChild(exit);
    document.body.appendChild(bar);
  }

  // ---------- talking to the server ----------
  function getJson(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' -> ' + r.status);
      return r.json();
    });
  }

  var appliedSignature = null;

  function pollLive() {
    return getJson('/deployments/live').then(function (live) {
      if (appliedSignature === null) {
        appliedSignature = live.signature;
        applyPatches(live.patches || []);
      } else if (live.signature !== appliedSignature) {
        // Something changed in the dashboard (deploy, edit, rollback). Reloading is
        // the only reliable way to undo patches that are no longer live.
        window.location.reload();
      }
    }).catch(function () { /* server unreachable: keep what we have, try again */ });
  }

  function init() {
    if (previewId) {
      Promise.all([getJson('/deployments/live'), getJson('/patches/' + encodeURIComponent(previewId))])
        .then(function (r) {
          applyPatches((r[0].patches || []).filter(function (p) { return p.id !== r[1].id; }));
          applyPatches([r[1]]);
          showBanner(r[1]);
        })
        .catch(function (e) { console.warn('[Patchwork] preview failed:', e); });
      return;
    }
    pollLive();
    setInterval(pollLive, POLL_MS);
  }

  window.Patchwork = { applyChange: applyChange, findTarget: findTarget, applyPatches: applyPatches, pollLive: pollLive };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
