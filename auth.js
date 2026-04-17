// Ludicrous Chronicles — Auth Helper
// Checks Netlify Identity for user role and gates content accordingly
const tierRank = { free: 0, devoted: 1, bound: 2 };

function tierFromUser(user) {
  if (!user) return 'free';
  const roles = user.app_metadata?.roles || [];
  if (roles.includes('bound')) return 'bound';
  if (roles.includes('devoted')) return 'devoted';
  return 'free';
}

// Wait for Netlify Identity to be ready, then resolve the user
let _identityReady = null;
function waitForIdentity() {
  if (_identityReady) return _identityReady;
  _identityReady = new Promise((resolve) => {
    if (!window.netlifyIdentity) {
      setTimeout(() => resolve(null), 2000);
      return;
    }
    // currentUser() returns null if not logged in (after init), undefined if not initialized yet
    const current = window.netlifyIdentity.currentUser();
    if (current !== undefined) {
      resolve(current);
      return;
    }
    // Not initialized yet — listen for init
    window.netlifyIdentity.on('init', (user) => resolve(user));
    // Safety fallback in case init never fires
    setTimeout(() => resolve(window.netlifyIdentity.currentUser() || null), 3000);
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

document.addEventListener('DOMContentLoaded', addAuthButton);

// Export for use in other scripts
window.getUserTier = getUserTier;
window.canAccess = canAccess;
window.tierRank = tierRank;
