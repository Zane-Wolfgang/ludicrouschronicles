// Ludicrous Chronicles — Auth Helper
// Checks Netlify Identity for user role and gates content accordingly
const tierRank = { free: 0, devoted: 1, bound: 2 };

function tierFromUser(user) {
  if (!user) return 'free';
  const roles = user.app_metadata?.roles || [];
  if (roles.includes('admin')) {
    // Admin override: read simulated tier from sessionStorage, default to bound
    const simulated = sessionStorage.getItem('admin-tier') || 'bound';
    return ['free', 'devoted', 'bound'].includes(simulated) ? simulated : 'bound';
  }
  if (roles.includes('bound')) return 'bound';
  if (roles.includes('devoted')) return 'devoted';
  return 'free';
}

// Wait for Netlify Identity to be ready, then resolve the user.
// Uses polling instead of event listeners because 'init' may have already fired
// by the time auth.js loads (common when user is loaded from localStorage cache).
let _identityReady = null;
function waitForIdentity() {
  if (_identityReady) return _identityReady;
  _identityReady = new Promise((resolve) => {
    if (!window.netlifyIdentity) {
      setTimeout(() => resolve(null), 2000);
      return;
    }

    const startTime = Date.now();
    const maxWaitMs = 3000;
    const pollIntervalMs = 50;

    function checkUser() {
      const current = window.netlifyIdentity.currentUser();
      // currentUser() returns undefined before init, null (not logged in) or user object after
      if (current !== undefined) {
        resolve(current);
        return;
      }
      if (Date.now() - startTime >= maxWaitMs) {
        resolve(null);
        return;
      }
      setTimeout(checkUser, pollIntervalMs);
    }

    checkUser();
  });
  return _identityReady;
}

async function getUserTier() {
  const user = await waitForIdentity();
  return tierFromUser(user);
}

function canAccess(contentTier, userTier) {
  return tierRank[userTier || 'free'] >= tierRank[contentTier || 'free'];
}

// Add subtle member login to footer only
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
    div.querySelector('#auth-btn').addEventListener('click', (e) => {
      e.preventDefault();
      window.netlifyIdentity.logout();
    });
  } else {
    div.innerHTML = `<a href="#" id="auth-btn" style="color:var(--gold-dim);text-decoration:none;opacity:0.5;">Member login</a>`;
    div.querySelector('#auth-btn').addEventListener('click', (e) => {
      e.preventDefault();
      window.netlifyIdentity.open();
    });
  }
  footer.appendChild(div);
  window.netlifyIdentity.on('login', () => location.reload());
  window.netlifyIdentity.on('logout', () => location.reload());
}

// Admin-only tier switcher panel
async function addAdminSwitcher() {
  if (!window.netlifyIdentity) return;
  // Wait for identity to be ready so we can check role
  const user = await waitForIdentity();
  if (!user) return;
  const roles = user.app_metadata?.roles || [];
  if (!roles.includes('admin')) return;

  const current = sessionStorage.getItem('admin-tier') || 'bound';

  const panel = document.createElement('div');
  panel.id = 'admin-tier-switcher';
  panel.style.cssText = `
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 9999;
    background: rgba(10,8,6,0.97);
    border: 1px solid var(--gold-dim, #8a6e2f);
    padding: 0.75rem 0.9rem;
    font-family: 'Cinzel', serif;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    min-width: 200px;
  `;

  const label = document.createElement('div');
  label.style.cssText = 'font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold-dim, #8a6e2f);margin-bottom:0.5rem;';
  label.textContent = 'Admin · Viewing as: ' + current;

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:0.3rem;';

  ['free', 'devoted', 'bound'].forEach(tier => {
    const btn = document.createElement('button');
    btn.textContent = tier;
    btn.style.cssText = `
      font-family: 'Cinzel', serif;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 0.4em 0.7em;
      cursor: pointer;
      border: 1px solid ${tier === current ? 'var(--gold, #c9a84c)' : 'var(--border, rgba(201,168,76,0.18))'};
      background: ${tier === current ? 'var(--gold, #c9a84c)' : 'transparent'};
      color: ${tier === current ? '#0a0806' : 'var(--text-muted, #7a7260)'};
      transition: all 0.2s;
      flex: 1;
    `;
    btn.addEventListener('click', () => {
      sessionStorage.setItem('admin-tier', tier);
      location.reload();
    });
    buttons.appendChild(btn);
  });

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:8px;color:var(--text-muted, #7a7260);margin-top:0.5rem;font-style:italic;font-family:"EB Garamond",serif;letter-spacing:0.05em;';
  hint.textContent = 'Session only · only you see this';

  panel.appendChild(label);
  panel.appendChild(buttons);
  panel.appendChild(hint);
  document.body.appendChild(panel);
}

document.addEventListener('DOMContentLoaded', () => {
  addAuthButton();
  addAdminSwitcher();
});

// Export for use in other scripts
window.getUserTier = getUserTier;
window.canAccess = canAccess;
window.tierRank = tierRank;
