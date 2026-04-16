// ── Supabase config ──
const SUPABASE_URL = 'https://stdxmneifvavkzwttbzj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ie6tEdR7DxrJ2IGc3i6a1g_LJtU2j_e';

// Get or create a unique visitor ID stored in localStorage
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

async function initEngagement(chapterId) {
  const visitorId = getVisitorId();

  // ── Witnesses ──
  async function loadWitnesses() {
    try {
      const data = await sb(`witnesses?chapter=eq.${encodeURIComponent(chapterId)}&select=id`, { headers: { 'Prefer': 'count=exact' } });
      const count = Array.isArray(data) ? data.length : 0;
      const el = document.getElementById('witness-count');
      if (el) el.textContent = count;

      // Record this visit if not already seen
      const seen = localStorage.getItem('witnessed_' + chapterId);
      if (!seen) {
        await sb('witnesses', {
          method: 'POST',
          body: { chapter: chapterId, visitor_id: visitorId },
          prefer: 'return=minimal'
        });
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

      // Check if this visitor already liked
      const myLike = await sb(`likes?chapter=eq.${encodeURIComponent(chapterId)}&visitor_id=eq.${visitorId}&select=id`);
      const btn = document.getElementById('like-btn');
      if (Array.isArray(myLike) && myLike.length > 0) {
        if (btn) btn.classList.add('liked');
      }
    } catch(e) {}
  }

  async function toggleLike() {
    const btn = document.getElementById('like-btn');
    const el = document.getElementById('like-count');
    if (!btn) return;

    if (btn.classList.contains('liked')) return; // no unliking — AO3 style

    try {
      await sb('likes', {
        method: 'POST',
        body: { chapter: chapterId, visitor_id: visitorId },
        prefer: 'return=minimal'
      });
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
      const moreBtn = document.getElementById('comments-more-btn');
      if (!container) return;

      const pinned = data.filter(c => c.pinned);
      const rest = data.filter(c => !c.pinned);
      const visible = showAll ? [...pinned, ...rest] : [...pinned, ...rest.slice(0, 1)];
      const hidden = rest.length - (showAll ? rest.length : Math.min(1, rest.length));

      container.innerHTML = visible.map(c => {
        const date = new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `<div class="comment-item${c.pinned ? ' comment-pinned' : ''}">
          ${c.pinned ? '<div class="comment-pin-label">Pinned</div>' : ''}
          <div class="comment-meta">
            <span class="comment-name">${c.name || 'Anonymous'}</span>
            <span class="comment-date">${date}</span>
          </div>
          <div class="comment-body">${c.message}</div>
        </div>`;
      }).join('');

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
    e.preventDefault();
    const nameInput = document.getElementById('comment-name');
    const msgInput = document.getElementById('comment-message');
    const submitBtn = document.getElementById('comment-submit');
    if (!nameInput || !msgInput) return;

    const name = nameInput.value.trim() || 'Anonymous';
    const message = msgInput.value.trim();
    if (!message) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Leaving mark...';

    try {
      await sb('comments', {
        method: 'POST',
        body: { chapter: chapterId, name, message, pinned: false },
        prefer: 'return=minimal'
      });
      nameInput.value = '';
      msgInput.value = '';
      await loadComments(true);
    } catch(e) {}

    submitBtn.disabled = false;
    submitBtn.textContent = 'Leave Your Mark';
  }

  // Init all
  loadWitnesses();
  loadLikes();
  loadComments();

  const likeBtn = document.getElementById('like-btn');
  if (likeBtn) likeBtn.addEventListener('click', toggleLike);

  const form = document.getElementById('comment-form');
  if (form) form.addEventListener('submit', submitComment);
}
