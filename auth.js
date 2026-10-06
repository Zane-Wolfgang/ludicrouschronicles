/* ── Preload 1920s vintage fonts (Limelight + Josefin Sans via Google Fonts) ── */
(function () {
  if (document.getElementById('lc-vintage-fonts')) return;
  var link = document.createElement('link');
  link.id   = 'lc-vintage-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Limelight&family=Josefin+Sans:ital,wght@0,300;0,400;0,600;1,300&display=swap';
  document.head.appendChild(link);
})();

// Ludicrous Chronicles — Auth Helper
// Checks Netlify Identity for user role and gates content accordingly
const tierRank = { free: 0, devoted: 1, bound: 2 };

// ── Bookmark cloud helpers (scoped to avoid conflict with engagement.js constants) ──
(function() {
  const _BM_URL = 'https://stdxmneifvavkzwttbzj.supabase.co';
  const _BM_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZHhtbmVpZnZhdmt6d3R0YnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDczNTYsImV4cCI6MjA5MTg4MzM1Nn0.jWNSXOaSw5KEoFFPHSZqFZi17d9diq2ScBWCeS2o4XU';
  const _BM_HDR = { 'apikey': _BM_KEY, 'Authorization': 'Bearer ' + _BM_KEY, 'Content-Type': 'application/json' };

  async function saveBookmarkCloud(slug, data) {
    try {
      const user = await waitForIdentity();
      if (!user) return false;
      const res = await fetch(`${_BM_URL}/rest/v1/bookmarks`, {
        method: 'POST',
        headers: { ..._BM_HDR, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: user.id, story_slug: slug, data, updated_at: new Date().toISOString() })
      });
      return res.ok;
    } catch { return false; }
  }

  async function loadBookmarkCloud(slug) {
    try {
      const user = await waitForIdentity();
      if (!user) return null;
      const res = await fetch(
        `${_BM_URL}/rest/v1/bookmarks?user_id=eq.${encodeURIComponent(user.id)}&story_slug=eq.${encodeURIComponent(slug)}&select=data`,
        { headers: _BM_HDR }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      return rows && rows.length > 0 ? rows[0].data : null;
    } catch { return null; }
  }

  async function deleteBookmarkCloud(slug) {
    try {
      const user = await waitForIdentity();
      if (!user) return false;
      const res = await fetch(
        `${_BM_URL}/rest/v1/bookmarks?user_id=eq.${encodeURIComponent(user.id)}&story_slug=eq.${encodeURIComponent(slug)}`,
        { method: 'DELETE', headers: _BM_HDR }
      );
      return res.ok;
    } catch { return false; }
  }

  window.saveBookmarkCloud   = saveBookmarkCloud;
  window.loadBookmarkCloud   = loadBookmarkCloud;
  window.deleteBookmarkCloud = deleteBookmarkCloud;
})();

function tierFromUser(user) {
  if (!user) return 'free';
  const roles = user.app_metadata?.roles || [];
  if (roles.includes('admin')) {
    const simulated = sessionStorage.getItem('admin-tier') || 'bound';
    return ['free', 'devoted', 'bound'].includes(simulated) ? simulated : 'bound';
  }
  if (roles.includes('bound')) return 'bound';
  if (roles.includes('devoted')) return 'devoted';
  return 'free';
}

function waitForIdentity() {
  return new Promise((resolve) => {
    if (!window.netlifyIdentity) {
      let widgetWait = 0;
      const widgetInt = setInterval(() => {
        if (window.netlifyIdentity) {
          clearInterval(widgetInt);
          waitForCurrentUser(resolve);
        } else if ((widgetWait += 50) >= 2000) {
          clearInterval(widgetInt);
          resolve(null);
        }
      }, 50);
      return;
    }
    waitForCurrentUser(resolve);
  });
}

function waitForCurrentUser(resolve) {
  const immediate = window.netlifyIdentity.currentUser();
  if (immediate) { resolve(immediate); return; }
  let waited = 0;
  const interval = setInterval(() => {
    const user = window.netlifyIdentity.currentUser();
    if (user) { clearInterval(interval); resolve(user); return; }
    waited += 50;
    if (waited >= 3000) { clearInterval(interval); resolve(null); }
  }, 50);
}

async function getUserTier() {
  const user = await waitForIdentity();
  return tierFromUser(user);
}

function canAccess(contentTier, userTier) {
  return tierRank[userTier || 'free'] >= tierRank[contentTier || 'free'];
}

function addAuthButton() {
  if (!window.netlifyIdentity) return;
  const footer = document.querySelector('footer');
  if (!footer) return;
  const user = window.netlifyIdentity.currentUser();
  const div = document.createElement('p');
  div.style.cssText = 'margin-top:0.75rem;font-family:Cinzel,serif;font-size:8px;letter-spacing:0.2em;color:var(--text-muted);';
  if (user) {
    const tier = (user.app_metadata?.roles || [])[0] || 'free';
    div.innerHTML = `<a href="#" id="auth-btn" style="color:var(--gold-dim);text-decoration:none;">
      ${tier !== 'free' ? '★ Member' : 'Logged in'} · <span style="text-decoration:underline;">Log out</span>
    </a>`;
    div.querySelector('#auth-btn').addEventListener('click', (e) => { e.preventDefault(); window.netlifyIdentity.logout(); });
  } else {
    div.innerHTML = `<a href="#" id="auth-btn" style="color:var(--gold-dim);text-decoration:none;opacity:0.5;">Member login</a>`;
    div.querySelector('#auth-btn').addEventListener('click', (e) => { e.preventDefault(); window.netlifyIdentity.open(); });
  }
  footer.appendChild(div);
  window.netlifyIdentity.on('login', () => location.reload());
  window.netlifyIdentity.on('logout', () => location.reload());
}

async function addAdminSwitcher() {
  const user = await waitForIdentity();
  if (!user) return;
  const roles = user.app_metadata?.roles || [];
  if (!roles.includes('admin')) return;
  if (document.getElementById('admin-tier-switcher')) return;

  const current = sessionStorage.getItem('admin-tier') || 'bound';
  const panel = document.createElement('div');
  panel.id = 'admin-tier-switcher';
  panel.style.cssText =
    'position:fixed;bottom:1rem;right:1rem;z-index:99999;' +
    'background:rgba(10,8,6,0.97);border:1px solid #8a6e2f;' +
    'padding:0.75rem 0.9rem;font-family:"Cinzel",serif;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.6);min-width:200px;';

  const label = document.createElement('div');
  label.style.cssText = 'font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:#8a6e2f;margin-bottom:0.5rem;';
  label.textContent = 'Admin · Viewing as: ' + current;

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:0.3rem;';
  ['free', 'devoted', 'bound'].forEach(tier => {
    const btn = document.createElement('button');
    btn.textContent = tier;
    const isActive = tier === current;
    btn.style.cssText =
      'font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.15em;' +
      'text-transform:uppercase;padding:0.4em 0.7em;cursor:pointer;' +
      'border:1px solid ' + (isActive ? '#c9a84c' : 'rgba(201,168,76,0.18)') + ';' +
      'background:' + (isActive ? '#c9a84c' : 'transparent') + ';' +
      'color:' + (isActive ? '#0a0806' : '#7a7260') + ';' +
      'transition:all 0.2s;flex:1;';
    btn.addEventListener('click', () => { sessionStorage.setItem('admin-tier', tier); location.reload(); });
    buttons.appendChild(btn);
  });

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:8px;color:#7a7260;margin-top:0.5rem;font-style:italic;font-family:"EB Garamond",serif;letter-spacing:0.05em;';
  hint.textContent = 'Session only · only you see this';

  panel.appendChild(label);
  panel.appendChild(buttons);
  panel.appendChild(hint);

  if (document.body) document.body.appendChild(panel);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));
}

function initAuth() {
  addAuthButton();
  addAdminSwitcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

// ── Exports ──
window.getUserTier     = getUserTier;
window.canAccess       = canAccess;
window.tierRank        = tierRank;
window.waitForIdentity = waitForIdentity;
window.tierFromUser    = tierFromUser;

/* \u2500\u2500 Combined: Vintage Toggle + Gatsby Quote + Holiday Modes \u2500\u2500 */
(function () {
  var LS_KEY         = 'lc_vintage_mode';
  var LS_HOLIDAY_KEY = 'lc_holiday_mode';

  /* \u2500\u2500 Settings fetch \u2500\u2500 */
  var siteSettings = null;
  function loadSiteSettings() {
    return fetch('/_data/site-settings.yml', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        var out = {};
        t.split('\n').forEach(function (raw) {
          var line = raw.trim();
          if (!line || line[0] === '#') return;
          var c = line.indexOf(':');
          if (c === -1) return;
          var k = line.slice(0, c).trim();
          var v = line.slice(c + 1).trim().replace(/^['"]|['"]$/g, '');
          if (k) out[k] = v;
        });
        siteSettings = out;
        return out;
      })
      .catch(function () { siteSettings = {}; return {}; });
  }

  function holidaysEnabled() {
    if (!siteSettings) return [];
    var h = [];
    if (siteSettings.halloween_enabled === 'true') h.push('halloween');
    if (siteSettings.christmas_enabled === 'true') h.push('christmas');
    return h;
  }

  /* \u2500\u2500 Vintage \u2500\u2500 */
  function getDefault() {
    return fetch('/_data/site-settings.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (s) { return !!(s && s.vintage_mode); })
      .catch(function () { return false; });
  }

  function applyVintage(on) {
    document.body.classList.toggle('vintage', on);
    var wrap = document.getElementById('lc-btn-wrap');
    if (!wrap) return;
    wrap.classList.toggle('vintage-on', on);
    var btn = wrap.querySelector('.lc-btn-circle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.title = on ? 'Vintage ON \u2014 click to turn off' : 'Vintage OFF \u2014 click to turn on';
      btn.innerHTML = on ? '\u2713' : '\u25c6';
    }
  }

  function toggle() {
    var next = !document.body.classList.contains('vintage');
    localStorage.setItem(LS_KEY, next ? '1' : '0');
    applyVintage(next);
  }

  /* \u2500\u2500 Holiday \u2500\u2500 */
  function applyHoliday(mode) {
    document.body.classList.remove('halloween', 'christmas');
    if (mode === 'halloween' || mode === 'christmas') document.body.classList.add(mode);
    localStorage.setItem(LS_HOLIDAY_KEY, mode || '');
    updateHolidayButtons();
  }

  function updateHolidayButtons() {
    var current = localStorage.getItem(LS_HOLIDAY_KEY) || '';
    document.querySelectorAll('.lc-holiday-btn').forEach(function (b) {
      var active = b.dataset.mode === current;
      b.style.borderColor = active ? 'var(--gold)' : 'rgba(201,168,76,0.3)';
      b.style.background  = active ? 'rgba(201,168,76,0.15)' : 'transparent';
      b.style.color       = active ? 'var(--gold)' : 'var(--text-muted)';
    });
  }

  function buildHolidaySection(tip, holidays) {
    var old = tip.querySelector('.lc-holiday-section');
    if (old) old.remove();
    if (!holidays.length) return;

    var section = document.createElement('div');
    section.className = 'lc-holiday-section';
    section.style.cssText = 'margin-top:0.9rem;padding-top:0.75rem;border-top:1px solid var(--border);';

    var label = document.createElement('div');
    label.style.cssText = 'font-family:"Cinzel",serif;font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:0.5rem;';
    label.textContent = 'Seasonal Themes';
    section.appendChild(label);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

    var current = localStorage.getItem(LS_HOLIDAY_KEY) || '';
    holidays.forEach(function (mode) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lc-holiday-btn';
      btn.dataset.mode = mode;
      btn.textContent = mode === 'halloween' ? '\ud83c\udf83 Halloween' : '\ud83c\udf84 Christmas';
      var active = current === mode;
      btn.style.cssText = 'font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.1em;padding:0.4em 0.7em;cursor:pointer;border-radius:3px;transition:all 0.2s;border:1px solid ' + (active ? 'var(--gold)' : 'rgba(201,168,76,0.3)') + ';background:' + (active ? 'rgba(201,168,76,0.15)' : 'transparent') + ';color:' + (active ? 'var(--gold)' : 'var(--text-muted)') + ';';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var cur = localStorage.getItem(LS_HOLIDAY_KEY) || '';
        applyHoliday(cur === mode ? '' : mode);
      });
      row.appendChild(btn);
    });

    section.appendChild(row);
    tip.appendChild(section);
  }

  /* \u2500\u2500 Inject \u2500\u2500 */
  function inject(holidays) {
    if (document.getElementById('lc-btn-wrap')) return;
    var isOn = document.body.classList.contains('vintage');

    var wrap = document.createElement('div');
    wrap.id        = 'lc-btn-wrap';
    wrap.className = 'lc-btn-wrap' + (isOn ? ' vintage-on' : '');

    var btn = document.createElement('button');
    btn.className = 'lc-btn-circle';
    btn.type      = 'button';
    btn.innerHTML = isOn ? '\u2713' : '\u25c6';
    btn.setAttribute('aria-pressed', String(isOn));
    btn.title = isOn ? 'Vintage ON \u2014 click to turn off' : 'Vintage OFF \u2014 click to turn on';
    btn.addEventListener('click', function () {
      toggle(); /* always toggle vintage */
      if (holidays.length > 0) {
        /* Also open the tooltip so holiday options are visible */
        wrap.classList.add('lc-tooltip-open');
      }
    });

    var tip = document.createElement('div');
    tip.className = 'lc-btn-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML =
      '<div class="lc-btn-ornament">\u25c8 \u2015 \u25c8 \u2015 \u25c8</div>' +
      '<p class="lc-btn-quote-text">' +
        'Then wear the gold hat, if that will move her;<br>' +
        'If you can bounce high, bounce for her too,<br>' +
        'till she cry \u201cLover, gold-hatted,<br>' +
        'high-bouncing lover,<br>' +
        'I must have you!\u201d' +
      '</p>' +
      '<hr class="lc-btn-divider">' +
      '<div class="lc-btn-attr">Thomas Parke D\u2019Invilliers</div>' +
      '<div class="lc-btn-hint">' + (holidays.length > 0 ? 'Click for theme options' : 'Click to toggle 1920s mode') + '</div>';

    buildHolidaySection(tip, holidays);

    /* Vintage toggle row inside tooltip when holidays are active */
    if (holidays.length > 0) {
      var vintageRow = document.createElement('div');
      vintageRow.style.cssText = 'margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border);';
      var vintageBtn = document.createElement('button');
      vintageBtn.type = 'button';
      vintageBtn.className = 'lc-vintage-inner-btn';
      vintageBtn.style.cssText = 'font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.1em;padding:0.4em 0.8em;cursor:pointer;border-radius:3px;border:1px solid rgba(201,168,76,0.3);background:transparent;color:var(--text-muted);transition:all 0.2s;width:100%;';
      vintageBtn.textContent = '\u00c6 Toggle 1920s Vintage Mode';
      vintageBtn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      vintageRow.appendChild(vintageBtn);
      tip.appendChild(vintageRow);

      /* Close when clicking outside */
      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) wrap.classList.remove('lc-tooltip-open');
      });
    }

    wrap.appendChild(tip);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    /* Restore saved holiday */
    var savedHoliday = localStorage.getItem(LS_HOLIDAY_KEY) || '';
    if (savedHoliday && holidays.indexOf(savedHoliday) !== -1) {
      applyHoliday(savedHoliday);
    }
  }

  function init() {
    loadSiteSettings().then(function () {
      var holidays = holidaysEnabled();
      var saved = localStorage.getItem(LS_KEY);
      var vintageDef = saved !== null
        ? Promise.resolve(saved === '1')
        : Promise.resolve(!!(siteSettings && siteSettings.vintage_mode === 'true'));
      vintageDef.then(function (on) {
        applyVintage(on);
        inject(holidays);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
