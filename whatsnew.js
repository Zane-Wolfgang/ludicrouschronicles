/* ─────────────────────────────────────────────────────────────────────────
   What's New — per-visitor "new since last visit" tracking (no backend/login).

   Model (Inkbunny-style):
   - Each item has a stable id (title) and a date.
   - localStorage remembers which item ids this browser has already SEEN.
   - On load, any item whose date is newer than the FIRST-EVER visit baseline
     AND not yet in the seen-set is "new": it gets a gold dot.
   - Clicking a new item marks that id seen -> its dot clears, permanently.
   - A banner shows the count of still-unseen new items.
   - A brand-new visitor establishes a baseline (nothing flags on first visit;
     otherwise the whole catalogue would light up).

   Per-browser, per-device. Clearing site data resets it. That's expected.

   Usage on a page:
     <script src="whatsnew.js"></script>
     LCWhatsNew.init({
       scope: 'gallery',                    // unique key per page/section group
       itemSelector: '.gallery-item',       // tiles to flag
       getId:   el => el.querySelector('.gallery-overlay-title')?.textContent?.trim(),
       getDate: el => ...,                  // Date|string|null for that tile
       dotTarget: el => el,                 // where to attach the dot (defaults to el)
       onSeen:  id => {},                   // optional
       bannerMount: '#some-el-before-grid', // optional; where to insert the banner
       bannerText: n => `${n} new since your last visit`
     });
   Call LCWhatsNew.rescan(scope) after async tiles load.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  const LS = {
    seen:     scope => `lc_whatsnew_seen_${scope}`,      // JSON array of seen ids
    baseline: scope => `lc_whatsnew_baseline_${scope}`,  // ms timestamp of first visit
    count:    scope => `lc_whatsnew_count_${scope}`,      // last-known unseen-new count
  };

  function readSeen(scope) {
    try { return new Set(JSON.parse(localStorage.getItem(LS.seen(scope)) || '[]')); }
    catch (_) { return new Set(); }
  }
  function writeSeen(scope, set) {
    try { localStorage.setItem(LS.seen(scope), JSON.stringify([...set])); } catch (_) {}
  }
  function getBaseline(scope) {
    const v = localStorage.getItem(LS.baseline(scope));
    return v ? Number(v) : null;
  }
  function setBaseline(scope, ms) {
    try { localStorage.setItem(LS.baseline(scope), String(ms)); } catch (_) {}
  }

  function toTime(d) {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d) ? null : d.getTime();
    const t = new Date(d).getTime();
    return isNaN(t) ? null : t;
  }

  const registry = {}; // scope -> config

  function ensureDotStyles() {
    if (document.getElementById('lc-whatsnew-styles')) return;
    const s = document.createElement('style');
    s.id = 'lc-whatsnew-styles';
    s.textContent = `
      .lc-new-dot { position: absolute; top: 8px; right: 8px; width: 11px; height: 11px;
        border-radius: 50%; background: #c9a84c; box-shadow: 0 0 0 2px rgba(10,8,6,0.85), 0 0 8px rgba(201,168,76,0.7);
        z-index: 6; pointer-events: none; animation: lcNewPulse 2s ease-in-out infinite; }
      @keyframes lcNewPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
      .lc-new-banner { max-width: 640px; margin: 0 auto 1rem; padding: 0.65rem 1rem;
        display: flex; align-items: center; justify-content: center; gap: 0.75rem;
        border: 1px solid var(--gold-dim, #8a6e2f); background: rgba(201,168,76,0.07);
        font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
        color: var(--gold, #c9a84c); }
      .lc-new-banner .lc-new-banner-dot { width: 9px; height: 9px; border-radius: 50%; background: #c9a84c;
        box-shadow: 0 0 8px rgba(201,168,76,0.7); flex-shrink: 0; }
      .lc-new-banner button { margin-left: 0.5rem; background: none; border: 1px solid var(--border, #2a2018);
        color: var(--text-muted, #9a8c78); font-family: 'Cinzel', serif; font-size: 8px; letter-spacing: 0.15em;
        text-transform: uppercase; padding: 0.3em 0.8em; cursor: pointer; transition: color 0.2s, border-color 0.2s; }
      .lc-new-banner button:hover { color: var(--gold, #c9a84c); border-color: var(--gold-dim, #8a6e2f); }
      /* the count itself is a jump control — reads as text, behaves as a link */
      .lc-new-banner .lc-new-banner-jump { margin-left: 0; border: none; padding: 0;
        color: var(--gold, #c9a84c); font-size: 10px; letter-spacing: 0.2em; text-decoration: underline;
        text-underline-offset: 3px; text-decoration-color: rgba(201,168,76,0.4); }
      .lc-new-banner .lc-new-banner-jump:hover { color: var(--gold-bright, #e8c96a); text-decoration-color: currentColor; }
      .lc-nav-new-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: #c9a84c; box-shadow: 0 0 6px rgba(201,168,76,0.8); margin-left: 5px; vertical-align: super; }
    `;
    document.head.appendChild(s);
  }

  function scan(scope) {
    const cfg = registry[scope];
    if (!cfg) return { newCount: 0 };
    const seen = readSeen(scope);
    let baseline = getBaseline(scope);

    const items = [...document.querySelectorAll(cfg.itemSelector)];

    // First-ever visit for this scope: establish baseline = newest item date (or now),
    // so nothing flags on the very first visit.
    if (baseline == null) {
      let newest = 0;
      items.forEach(el => { const t = toTime(cfg.getDate(el)); if (t && t > newest) newest = t; });
      baseline = newest || Date.now();
      setBaseline(scope, baseline);
    }

    let newCount = 0;
    items.forEach(el => {
      const id = cfg.getId(el);
      if (!id) return;
      const t = toTime(cfg.getDate(el));
      const isNew = t != null && t > baseline && !seen.has(id);

      const host = (cfg.dotTarget ? cfg.dotTarget(el) : el) || el;
      let dot = host.querySelector(':scope > .lc-new-dot');

      if (isNew) {
        newCount++;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        if (!dot) { dot = document.createElement('span'); dot.className = 'lc-new-dot'; host.appendChild(dot); }
        if (!el._lcNewWired) {
          el._lcNewWired = true;
          el.addEventListener('click', () => markSeen(scope, id), true);
        }
      } else if (dot) {
        dot.remove();
      }
    });

    updateBanner(scope, newCount);
    try { localStorage.setItem(LS.count(scope), String(newCount)); } catch (_) {}
    refreshNavDots();
    if (typeof cfg.onCount === 'function') cfg.onCount(newCount);
    return { newCount };
  }

  /* Jump to the next still-new item, cycling through them on repeated clicks.
     Saves hunting for a small gold dot in a long grid. */
  const jumpIndex = {};
  const jumpRetried = {};
  const jumpFlash = { timer: null, host: null, prev: '' };
  function jumpToNext(scope) {
    const cfg = registry[scope];
    if (!cfg) return;
    const seen = readSeen(scope);
    const baseline = getBaseline(scope);
    const newOnes = [...document.querySelectorAll(cfg.itemSelector)].filter(el => {
      const id = cfg.getId(el);
      if (!id || seen.has(id)) return false;
      /* skip anything currently hidden (e.g. by an active search filter) —
         scrolling to a display:none element does nothing */
      if (el.classList.contains('search-hidden') || el.offsetParent === null) return false;
      const t = toTime(cfg.getDate(el));
      return t != null && baseline != null && t > baseline;
    });
    if (!newOnes.length) {
      /* everything new is filtered out of view — clear the search once and retry */
      const searchBox = document.getElementById('gallery-search');
      if (searchBox && searchBox.value.trim() && !jumpRetried[scope]) {
        jumpRetried[scope] = true;
        searchBox.value = '';
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => { jumpToNext(scope); jumpRetried[scope] = false; }, 250);
      }
      return;
    }

    const i = (jumpIndex[scope] || 0) % newOnes.length;
    jumpIndex[scope] = i + 1;
    const target = newOnes[i];

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    /* brief gold flash so it's obvious which one we landed on.
       Clear any in-flight flash first — otherwise a rapid second click captures
       the gold value as "previous" and restores it permanently. */
    const host = (cfg.dotTarget ? cfg.dotTarget(target) : target) || target;
    if (jumpFlash.timer) {
      clearTimeout(jumpFlash.timer);
      if (jumpFlash.host) jumpFlash.host.style.boxShadow = jumpFlash.prev || '';
    }
    jumpFlash.host = host;
    jumpFlash.prev = host.style.boxShadow;
    host.style.transition = 'box-shadow 0.35s ease';
    host.style.boxShadow = '0 0 0 3px #c9a84c, 0 0 22px rgba(201,168,76,0.75)';
    jumpFlash.timer = setTimeout(() => {
      host.style.boxShadow = jumpFlash.prev || '';
      jumpFlash.timer = null; jumpFlash.host = null;
    }, 1600);
  }

  function updateBanner(scope, count) {
    const cfg = registry[scope];
    if (!cfg || !cfg.bannerMount) return;
    const mount = typeof cfg.bannerMount === 'string' ? document.querySelector(cfg.bannerMount) : cfg.bannerMount;
    if (!mount) return;
    let banner = document.getElementById('lc-new-banner-' + scope);

    if (count <= 0) { if (banner) banner.remove(); return; }

    const text = (cfg.bannerText ? cfg.bannerText(count) : `${count} new since your last visit`);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'lc-new-banner-' + scope;
      banner.className = 'lc-new-banner';
      banner.innerHTML = `<span class="lc-new-banner-dot"></span>` +
                         `<button type="button" class="lc-new-banner-jump"><span class="lc-new-banner-text"></span></button>` +
                         `<button type="button" class="lc-new-banner-seen">Mark all seen</button>`;
      banner.querySelector('.lc-new-banner-seen').addEventListener('click', () => markAllSeen(scope));
      banner.querySelector('.lc-new-banner-jump').addEventListener('click', () => jumpToNext(scope));
      mount.parentNode.insertBefore(banner, mount);
    }
    banner.querySelector('.lc-new-banner-text').textContent = text;
    const jump = banner.querySelector('.lc-new-banner-jump');
    if (jump) jump.title = 'Click to jump to the next new item';
  }

  function markSeen(scope, id) {
    const seen = readSeen(scope);
    if (seen.has(id)) return;
    seen.add(id);
    writeSeen(scope, seen);
    const cfg = registry[scope];
    if (cfg && typeof cfg.onSeen === 'function') cfg.onSeen(id);
    scan(scope);
  }

  function markAllSeen(scope) {
    const cfg = registry[scope];
    if (!cfg) return;
    const seen = readSeen(scope);
    document.querySelectorAll(cfg.itemSelector).forEach(el => {
      const id = cfg.getId(el);
      if (id) seen.add(id);
    });
    writeSeen(scope, seen);
    scan(scope);
  }

  window.LCWhatsNew = {
    init(cfg) {
      if (!cfg || !cfg.scope) return;
      ensureDotStyles();
      registry[cfg.scope] = cfg;
      const run = () => scan(cfg.scope);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
      else run();
      // catch late async tiles
      const grids = (cfg.observe || []).map(s => document.querySelector(s)).filter(Boolean);
      if (grids.length) {
        const mo = new MutationObserver(() => { clearTimeout(cfg._t); cfg._t = setTimeout(run, 120); });
        grids.forEach(g => mo.observe(g, { childList: true, subtree: true }));
      }
    },
    rescan: scan,
    markSeen,
    markAllSeen,
    /* Nav-link dot: shows a dot on a nav <a> when any of the given scopes has
       unseen-new items. Reads the LAST-KNOWN count from localStorage, so it works
       on pages that don't themselves load that scope's data (e.g. show the Gallery
       dot while sitting on the Content page). The count is refreshed to truth
       whenever the visitor actually opens that scope's page. */
    navDot(linkSelector, scopes) {
      navDotRegistry.push({ linkSelector, scopes });
      const run = () => refreshNavDots();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
      else run();
    }
  };

  const navDotRegistry = [];
  function storedCount(scope) {
    const v = localStorage.getItem(LS.count(scope));
    return v ? Number(v) : 0;
  }
  function refreshNavDots() {
    navDotRegistry.forEach(({ linkSelector, scopes }) => {
      const link = document.querySelector(linkSelector);
      if (!link) return;
      const any = scopes.some(s => storedCount(s) > 0);
      let dot = link.querySelector('.lc-nav-new-dot');
      if (any && !dot) { dot = document.createElement('span'); dot.className = 'lc-nav-new-dot'; link.appendChild(dot); }
      else if (!any && dot) dot.remove();
    });
  }
})();
