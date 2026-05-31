// ── Supabase config ──
const SUPABASE_URL = 'https://stdxmneifvavkzwttbzj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ie6tEdR7DxrJ2IGc3i6a1g_LJtU2j_e';

function getVisitorId() {
  let id = localStorage.getItem('lc_visitor_id');
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('lc_visitor_id', id);
  }
  return id;
}

async function sb(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=minimal',
      ...options.headers
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (options.method === 'GET' || !options.method) return res.json();
  return res;
}

// ── Admin check (lazy, runs once per page) ──
let _engIsAdmin = false;
let _engAdminChecked = false;
async function checkEngAdmin() {
  if (_engAdminChecked) return;
  _engAdminChecked = true;
  try {
    if (!window.waitForIdentity) return;
    const user = await window.waitForIdentity();
    if (user && user.app_metadata?.roles?.includes('admin')) _engIsAdmin = true;
  } catch(e) {}
}

async function initEngagement(chapterId) {
  const visitorId = getVisitorId();
  await checkEngAdmin();

  // ── Witnesses ──
  async function loadWitnesses() {
    try {
      const data = await sb(`witnesses?chapter=eq.${encodeURIComponent(chapterId)}&select=id`, { headers: { 'Prefer': 'count=exact' } });
      const count = Array.isArray(data) ? data.length : 0;
      const el = document.getElementById('witness-count');
      if (el) el.textContent = count;
      const seen = localStorage.getItem('witnessed_' + chapterId);
      if (!seen) {
        await sb('witnesses', { method: 'POST', body: { chapter: chapterId, visitor_id: visitorId }, prefer: 'return=minimal' });
        localStorage.setItem('witnessed_' + chapterId, '1');
        if (el) el.textContent = count + 1;
      }
    } catch(e) {}
  }

  // ── Likes ──
  async function loadLikes() {
    try {
      const data = await sb(`likes?chapter=eq.${encodeURIComponent(chapterId)}&select=id`);
      const count = Array.isArray(data) ? data.length : 0;
      const el = document.getElementById('like-count');
      if (el) el.textContent = count;
      const myLike = await sb(`likes?chapter=eq.${encodeURIComponent(chapterId)}&visitor_id=eq.${visitorId}&select=id`);
      const btn = document.getElementById('like-btn');
      if (Array.isArray(myLike) && myLike.length > 0 && btn) btn.classList.add('liked');
    } catch(e) {}
  }

  async function toggleLike() {
    const btn = document.getElementById('like-btn');
    const el  = document.getElementById('like-count');
    if (!btn || btn.classList.contains('liked')) return;
    try {
      await sb('likes', { method: 'POST', body: { chapter: chapterId, visitor_id: visitorId }, prefer: 'return=minimal' });
      btn.classList.add('liked');
      btn.style.transform = 'scale(1.3)';
      setTimeout(() => { btn.style.transform = ''; }, 300);
      if (el) el.textContent = parseInt(el.textContent || 0) + 1;
    } catch(e) {}
  }

  // ── Comments ──
  async function loadComments(showAll = false) {
    try {
      const data = await sb(`comments?chapter=eq.${encodeURIComponent(chapterId)}&order=pinned.desc,created_at.asc&select=*`);
      if (!Array.isArray(data)) return;

      const container = document.getElementById('comments-list');
      const moreBtn   = document.getElementById('comments-more-btn');
      if (!container) return;

      // Mark section as admin for CSS delete button visibility
      const section = container.closest('.comments-section');
      if (_engIsAdmin && section) section.classList.add('is-admin');

      const pinned  = data.filter(c => c.pinned);
      const rest    = data.filter(c => !c.pinned);
      const visible = showAll ? [...pinned, ...rest] : [...pinned, ...rest.slice(0, 1)];
      const hidden  = rest.length - (showAll ? rest.length : Math.min(1, rest.length));

      // Load comment likes
      const likedSet   = new Set();
      const likeCounts = {};
      try {
        const myLikes = await sb(`comment_likes?visitor_id=eq.${visitorId}&select=comment_id`);
        if (Array.isArray(myLikes)) myLikes.forEach(l => likedSet.add(l.comment_id));
        const allLikes = await sb(`comment_likes?select=comment_id`);
        if (Array.isArray(allLikes)) allLikes.forEach(l => { likeCounts[l.comment_id] = (likeCounts[l.comment_id] || 0) + 1; });
      } catch(e) {}

      container.innerHTML = '';

      visible.forEach(c => {
        const date    = new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const liked   = likedSet.has(c.id);
        const likeCount = likeCounts[c.id] || 0;
        const div = document.createElement('div');
        div.className = `comment-item${c.pinned ? ' comment-pinned' : ''}`;
        div.innerHTML = `
          ${c.pinned ? '<div class="comment-pin-label">Pinned</div>' : ''}
          <div class="comment-meta">
            <span class="comment-name">${c.name || 'Anonymous'}</span>
            <span class="comment-date">${date}</span>
          </div>
          <div class="comment-body">${c.message}</div>
          <div class="comment-footer">
            <button class="comment-like-btn${liked ? ' liked' : ''}" data-id="${c.id}">
              <svg viewBox="0 0 24 24"><path d="M12 21.4l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.6L12 21.4z"/></svg>
              <span class="clc">${likeCount > 0 ? likeCount : ''}</span>
            </button>
            <button class="comment-delete-btn" data-id="${c.id}">Delete</button>
          </div>`;

        // Like handler
        div.querySelector('.comment-like-btn').addEventListener('click', async function() {
          if (this.classList.contains('liked')) return;
          try {
            await sb('comment_likes', { method: 'POST', body: { comment_id: c.id, visitor_id: visitorId }, prefer: 'return=minimal' });
            this.classList.add('liked');
            const countEl = this.querySelector('.clc');
            countEl.textContent = (parseInt(countEl.textContent || 0) + 1) || 1;
          } catch(e) {}
        });

        // Delete handler (admin only)
        div.querySelector('.comment-delete-btn').addEventListener('click', async function() {
          if (!confirm('Delete this comment?')) return;
          try {
            await sb(`comments?id=eq.${c.id}`, { method: 'DELETE' });
            div.remove();
            const countEl = document.getElementById('comment-count');
            if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || 0) - 1);
            if (!container.querySelector('.comment-item')) {
              container.innerHTML = '<div style="font-style:italic;color:var(--text-muted);padding:1rem 0;">No comments yet.</div>';
            }
          } catch(e) {}
        });

        container.appendChild(div);
      });

      if (moreBtn) {
        if (hidden > 0 && !showAll) {
          moreBtn.style.display = 'block';
          moreBtn.textContent = `${hidden} more comment${hidden !== 1 ? 's' : ''} →`;
          moreBtn.onclick = () => loadComments(true);
        } else {
          moreBtn.style.display = 'none';
        }
      }

      const countEl = document.getElementById('comment-count');
      if (countEl) countEl.textContent = data.length;
    } catch(e) {}
  }

  async function submitComment(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('comment-name');
    const msgInput  = document.getElementById('comment-message');
    const submitBtn = document.getElementById('comment-submit');
    if (!nameInput || !msgInput) return;
    const name    = nameInput.value.trim() || 'Anonymous';
    const message = msgInput.value.trim();
    if (!message) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Leaving mark...';
    try {
      await sb('comments', { method: 'POST', body: { chapter: chapterId, name, message, pinned: false }, prefer: 'return=minimal' });
      nameInput.value = '';
      msgInput.value  = '';
      await loadComments(true);
    } catch(e) {}
    submitBtn.disabled = false;
    submitBtn.textContent = 'Leave Your Mark';
  }

  // Init
  loadWitnesses();
  loadLikes();
  loadComments();

  const likeBtn = document.getElementById('like-btn');
  if (likeBtn) likeBtn.addEventListener('click', toggleLike);

  const submitBtn2 = document.getElementById('comment-submit');
  if (submitBtn2) submitBtn2.addEventListener('click', submitComment);
}

// ── Admin Recent Comments Panel ──
(function initAdminPanel() {
  async function setup() {
    // Wait for auth.js to be ready
    if (!window.waitForIdentity) {
      setTimeout(setup, 200);
      return;
    }
    const user = await window.waitForIdentity();
    if (!user || !user.app_metadata?.roles?.includes('admin')) return;

    // Inject panel HTML
    const tab = document.createElement('div');
    tab.className = 'admin-panel-tab visible';
    tab.innerHTML = `
      <div class="admin-panel-toggle" id="ap-toggle">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        Comments
      </div>
      <div class="admin-panel-body" id="ap-body">
        <div class="admin-panel-header">
          <span class="admin-panel-title">Recent Comments</span>
          <button class="admin-panel-refresh" id="ap-refresh">↻ Refresh</button>
        </div>
        <div class="admin-panel-list" id="ap-list">
          <div class="admin-panel-empty">Loading…</div>
        </div>
      </div>`;
    document.body.appendChild(tab);

    const toggle = document.getElementById('ap-toggle');
    const body   = document.getElementById('ap-body');
    const list   = document.getElementById('ap-list');
    let isOpen   = false;

    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      body.classList.toggle('open', isOpen);
      if (isOpen) loadRecentComments();
    });

    document.getElementById('ap-refresh').addEventListener('click', loadRecentComments);

    async function loadRecentComments() {
      list.innerHTML = '<div class="admin-panel-empty">Loading…</div>';
      try {
        const data = await sb(`comments?order=created_at.desc&limit=50&select=*`);
        if (!Array.isArray(data) || data.length === 0) {
          list.innerHTML = '<div class="admin-panel-empty">No comments yet.</div>';
          return;
        }
        list.innerHTML = '';
        data.forEach(c => {
          const raw   = c.chapter || '';
          const piece = raw.startsWith('gallery-')
            ? raw.replace('gallery-', '') + ' (Gallery)'
            : raw.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const date  = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const div   = document.createElement('div');
          div.className = 'admin-comment-item';
          div.innerHTML = `
            <div class="admin-comment-piece">${piece}</div>
            <div class="admin-comment-meta">
              <span class="admin-comment-name">${c.name || 'Anonymous'}</span>
              <span class="admin-comment-date">${date}</span>
            </div>
            <div class="admin-comment-body">${c.message}</div>
            <button class="admin-comment-delete" data-id="${c.id}">Delete</button>`;
          div.querySelector('.admin-comment-delete').addEventListener('click', async function() {
            if (!confirm('Delete this comment?')) return;
            try {
              await sb(`comments?id=eq.${c.id}`, { method: 'DELETE' });
              div.remove();
              if (!list.querySelector('.admin-comment-item')) {
                list.innerHTML = '<div class="admin-panel-empty">No comments yet.</div>';
              }
            } catch(e) {}
          });
          list.appendChild(div);
        });
      } catch(e) {
        list.innerHTML = '<div class="admin-panel-empty">Could not load comments.</div>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
