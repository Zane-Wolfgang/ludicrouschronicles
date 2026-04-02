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

// Add login/logout button to nav
function addAuthButton() {
  const nav = document.querySelector('.nav-links');
  if (!nav || !window.netlifyIdentity) return;

  const user = window.netlifyIdentity.currentUser();
  const li = document.createElement('li');

  if (user) {
    const tier = (user.app_metadata?.roles || [])[0] || 'free';
    li.innerHTML = `<a href="#" id="auth-btn" style="font-size:9px;letter-spacing:0.15em;">
      ${tier === 'free' ? '' : '★ '}${user.email.split('@')[0]} · Log out
    </a>`;
    li.querySelector('#auth-btn').addEventListener('click', (e) => {
      e.preventDefault();
      window.netlifyIdentity.logout();
    });
  } else {
    li.innerHTML = `<a href="#" id="auth-btn" style="font-size:9px;letter-spacing:0.15em;">Log in</a>`;
    li.querySelector('#auth-btn').addEventListener('click', (e) => {
      e.preventDefault();
      window.netlifyIdentity.open();
    });
  }

  nav.appendChild(li);

  // Refresh on login/logout
  window.netlifyIdentity.on('login', () => location.reload());
  window.netlifyIdentity.on('logout', () => location.reload());
}

document.addEventListener('DOMContentLoaded', addAuthButton);

// Export for use in other scripts
window.getUserTier = getUserTier;
window.canAccess = canAccess;
window.tierRank = tierRank;
