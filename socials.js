// ── News dot smart re-show ──
(function() {
  async function checkNewsDot() {
    const dot  = document.getElementById('news-dot');
    const cord = document.getElementById('cord-wrap');
    if (!dot) return;
    const dismissedAt = localStorage.getItem('news-dismissed-at');
    try {
      const res = await fetch('/_data/announcements-index.json');
      if (!res.ok) return;
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) return;
      const latest = items.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
      const latestDate = new Date(latest.date);
      if (!dismissedAt || new Date(dismissedAt) < latestDate) {
        dot.classList.remove('off');
        if (cord) cord.classList.remove('pulled');
      } else {
        dot.classList.add('off');
        if (cord) cord.classList.add('pulled');
      }
    } catch(e) {}
  }

  function wireCord() {
    const cord = document.getElementById('cord-wrap');
    if (cord && !cord.dataset.wired) {
      cord.dataset.wired = '1';
      cord.addEventListener('click', () => {
        localStorage.setItem('news-dismissed-at', new Date().toISOString());
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { checkNewsDot(); wireCord(); });
  } else {
    checkNewsDot(); wireCord();
  }
})();

// ── Load music player on every page ──
(function() {
  if (document.getElementById('lc-music-player')) return;
  const s = document.createElement('script');
  s.src = 'music-player.js';
  document.head.appendChild(s);
})();

// ── Admin Recent Comments Panel ──
(function() {
  const _AP_URL = 'https://stdxmneifvavkzwttbzj.supabase.co';
  const _AP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZHhtbmVpZnZhdmt6d3R0YnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDczNTYsImV4cCI6MjA5MTg4MzM1Nn0.jWNSXOaSw5KEoFFPHSZqFZi17d9diq2ScBWCeS2o4XU';
  const _AP_HDR = { 'apikey': _AP_KEY, 'Authorization': 'Bearer ' + _AP_KEY };

  async function apFetch(path) {
    const res = await fetch(_AP_URL + '/rest/v1/' + path, { headers: _AP_HDR });
    return res.json();
  }

  async function setup() {
    if (!window.waitForIdentity) { setTimeout(setup, 200); return; }
    if (document.getElementById('ap-toggle')) return;
    const user = await window.waitForIdentity();
    if (!user || !user.app_metadata?.roles?.includes('admin')) return;

    if (!document.getElementById('ap-style')) {
      const s = document.createElement('style');
      s.id = 'ap-style';
      s.textContent = `
        .admin-panel-tab { position:fixed; top:50%; left:0; transform:translateY(-50%); z-index:99998; display:block; }
        .admin-panel-toggle { display:flex; align-items:center; gap:0.4rem; padding:0.5rem 0.75rem; background:rgba(10,8,6,0.95); border:1px solid rgba(201,168,76,0.18); border-left:none; cursor:pointer; font-family:'Cinzel',serif; font-size:9px; letter-spacing:0.2em; text-transform:uppercase; color:#7a7260; transition:color 0.2s, border-color 0.2s; writing-mode:vertical-rl; text-orientation:mixed; }
        .admin-panel-toggle:hover { color:var(--gold,#c9a84c); border-color:var(--gold,#c9a84c); }
        .admin-panel-toggle svg { width:10px; height:10px; fill:currentColor; }
        .admin-panel-body { position:fixed; top:0; left:-320px; width:300px; height:100vh; background:rgba(10,8,6,0.98); border-right:1px solid rgba(201,168,76,0.18); overflow-y:auto; transition:left 0.25s ease; z-index:99997; padding:1.5rem 1rem; box-sizing:border-box; }
        .admin-panel-body.open { left:0; }
        .admin-panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(201,168,76,0.18); }
        .admin-panel-title { font-family:'Cinzel',serif; font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:var(--parchment,#f5f0e8); }
        .admin-panel-actions { display:flex; align-items:center; gap:0.5rem; }
        .admin-panel-refresh, .admin-panel-close { background:none; border:1px solid rgba(201,168,76,0.18); color:#7a7260; font-family:'Cinzel',serif; font-size:8px; letter-spacing:0.15em; padding:0.3em 0.6em; cursor:pointer; transition:color 0.2s, border-color 0.2s; }
        .admin-panel-refresh:hover { color:var(--gold,#c9a84c); border-color:var(--gold,#c9a84c); }
        .admin-panel-close:hover { color:#c0705a; border-color:#c0705a; }
        .admin-panel-empty { font-family:'EB Garamond',serif; font-style:italic; color:#7a7260; font-size:0.9rem; padding:0.5rem 0; }
        .admin-comment-item { padding:0.75rem 0; border-bottom:1px solid rgba(201,168,76,0.1); }
        .admin-comment-item:last-child { border-bottom:none; }
        .admin-comment-piece { font-family:'Cinzel',serif; font-size:8px; letter-spacing:0.2em; text-transform:uppercase; color:var(--gold-dim,#8a6e2f); margin-bottom:0.25rem; }
        .admin-comment-meta { display:flex; gap:0.75rem; margin-bottom:0.2rem; }
        .admin-comment-name { font-family:'Cinzel',serif; font-size:8px; letter-spacing:0.15em; text-transform:uppercase; color:var(--parchment,#f5f0e8); }
        .admin-comment-date { font-family:'Cinzel',serif; font-size:8px; color:#7a7260; }
        .admin-comment-body { font-family:'EB Garamond',serif; font-size:0.88rem; color:#b0a898; line-height:1.5; margin-bottom:0.4rem; }
        .admin-comment-delete { background:none; border:none; color:#7a7260; font-family:'Cinzel',serif; font-size:7px; letter-spacing:0.15em; text-transform:uppercase; cursor:pointer; padding:0; transition:color 0.2s; }
        .admin-comment-delete:hover { color:#c0705a; }
        @media (max-width:768px) { .admin-panel-body { width:100vw; left:-100vw; } .admin-panel-tab { top:auto; bottom:5rem; } }
      `;
      document.head.appendChild(s);
    }

    const tab = document.createElement('div');
    tab.className = 'admin-panel-tab';
    tab.innerHTML = `
      <div class="admin-panel-toggle" id="ap-toggle">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        Comments
      </div>
      <div class="admin-panel-body" id="ap-body">
        <div class="admin-panel-header">
          <span class="admin-panel-title">Recent Comments</span>
          <div class="admin-panel-actions">
            <button class="admin-panel-refresh" id="ap-refresh">↻ Refresh</button>
            <button class="admin-panel-close" id="ap-close">✕ Close</button>
          </div>
        </div>
        <div class="admin-panel-list" id="ap-list">
          <div class="admin-panel-empty">Click refresh to load.</div>
        </div>
      </div>`;
    document.body.appendChild(tab);

    let isOpen = false;

    function closePanel() {
      isOpen = false;
      document.getElementById('ap-body').classList.remove('open');
    }

    document.getElementById('ap-toggle').addEventListener('click', () => {
      isOpen = !isOpen;
      document.getElementById('ap-body').classList.toggle('open', isOpen);
      if (isOpen) load();
    });
    document.getElementById('ap-refresh').addEventListener('click', load);
    document.getElementById('ap-close').addEventListener('click', closePanel);

    async function load() {
      const list = document.getElementById('ap-list');
      list.innerHTML = '<div class="admin-panel-empty">Loading…</div>';
      try {
        const data = await apFetch('comments?order=created_at.desc&limit=50&select=*');
        if (!Array.isArray(data) || data.length === 0) {
          list.innerHTML = '<div class="admin-panel-empty">No comments yet.</div>'; return;
        }
        list.innerHTML = '';
        data.forEach(c => {
          const raw   = c.chapter || '';
          const piece = raw.startsWith('gallery-') ? raw.replace('gallery-','') + ' (Gallery)'
                      : raw.startsWith('video-')   ? raw.replace('video-','')   + ' (Video)'
                      : raw.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase());
          const date  = new Date(c.created_at).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' });
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
              await fetch(_AP_URL + '/rest/v1/comments?id=eq.' + c.id, { method:'DELETE', headers:_AP_HDR });
              div.remove();
              if (!list.querySelector('.admin-comment-item')) list.innerHTML = '<div class="admin-panel-empty">No comments yet.</div>';
            } catch(e) {}
          });
          list.appendChild(div);
        });
      } catch(e) { list.innerHTML = '<div class="admin-panel-empty">Could not load.</div>'; }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
