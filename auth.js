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
