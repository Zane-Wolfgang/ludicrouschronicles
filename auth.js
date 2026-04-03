// Ludicrous Chronicles — Auth Helper
// Checks Netlify Identity for user role and gates content accordingly

const tierRank = { free: 0, devoted: 1, bound: 2 };

async function getUserTier() {
  // Check if Netlify Identity is available
  if (!window.netlifyIdentity) return 'free';

  return new Promise((resolve) => {
    window.netlifyIdentity.on('init', user => {
      if (!user) { resolve('free'); return; }
      const roles = user.app_metadata?.roles || [];
      if (roles.includes('bound')) resolve('bound');
      else if (roles.includes('devoted')) resolve('devoted');
      else resolve('free');
    });

    // If already initialized
    const user = window.netlifyIdentity.currentUser();
    if (user !== undefined) {
      const roles = user?.app_metadata?.roles || [];
      if (roles.includes('bound')) resolve('bound');
      else if (roles.includes('devoted')) resolve('devoted');
      else resolve('free');
    }

    // Timeout fallback
    setTimeout(() => resolve('free'), 3000);
  });
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
