// ── Ludicrous Chronicles — Emoji System ──
(function() {
  const _EM_URL = 'https://stdxmneifvavkzwttbzj.supabase.co';
  const _EM_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0ZHhtbmVpZnZhdmt6d3R0YnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDczNTYsImV4cCI6MjA5MTg4MzM1Nn0.jWNSXOaSw5KEoFFPHSZqFZi17d9diq2ScBWCeS2o4XU';
  const _EM_HDR = { 'apikey': _EM_KEY, 'Authorization': 'Bearer ' + _EM_KEY, 'Content-Type': 'application/json' };

  // ── Hardcoded defaults (fallback until CMS index is populated) ──
  const EMOJI_DEFAULTS = [
    { id: 'baffled-silvester',           src: '/images/emojis/Baffled_Silvester.png',            label: 'Baffled Silvester',          size: 32 },
    { id: 'elijah-anxious',              src: '/images/emojis/Elijah_Anxious.png',               label: 'Elijah Anxious',             size: 32 },
    { id: 'eniaz-stare',                 src: '/images/emojis/Eniaz_Stare.png',                  label: 'Eniaz Stare',                size: 32 },
    { id: 'i-smell-desperation-vasily',  src: '/images/emojis/I_Smell_Desperation_Vasily.png',   label: 'I Smell Desperation',        size: 32 },
    { id: 'jackson-popcorn',             src: '/images/emojis/JacksonPopcorn.png',               label: 'Jackson Popcorn',            size: 32 },
    { id: 'jackson-dead',                src: '/images/emojis/Jackson_Dead.png',                 label: 'Jackson Dead',               size: 32 },
    { id: 'jackson-middle-finger',       src: '/images/emojis/Jacksonmiddlefinger.png',          label: 'Jackson Middle Finger',      size: 32 },
    { id: 'lizzie-adore',                src: '/images/emojis/Lizzie_Adore.png',                 label: 'Lizzie Adore',               size: 32 },
    { id: 'lizzie-what',                 src: '/images/emojis/Lizzie_WHAT.png',                  label: 'Lizzie WHAT',                size: 32 },
    { id: 'lizzle-fizzle-fire',          src: '/images/emojis/Lizzle_Fizzle_Fire.png',           label: 'Lizzle Fizzle Fire',         size: 32 },
    { id: 'rachel-flushed',              src: '/images/emojis/Rachel_Flushed.png',               label: 'Rachel Flushed',             size: 32 },
    { id: 'silvester-dead',              src: '/images/emojis/Silvester_dead.png',               label: 'Silvester Dead',             size: 32 },
    { id: 'vasily-belly-laugh',          src: '/images/emojis/VasilyBellyLaugh.png',             label: 'Vasily Belly Laugh',         size: 32 },
    { id: 'vasily-huh',                  src: '/images/emojis/Vasily_Huh.png',                   label: 'Vasily Huh',                 size: 32 },
    { id: 'zane-annoyed',                src: '/images/emojis/Zane_Annoyed.png',                 label: 'Zane Annoyed',               size: 32 },
    { id: 'listen-here',                 src: '/images/emojis/listenhereyoulittleshit.png',       label: 'Listen Here',                size: 32 },
  ];

  // ── Inject styles ──
  const style = document.createElement('style');
  style.textContent = `
    /* Reaction row */
    .lc-reactions-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid var(--border, rgba(201,168,76,0.18));
      min-height: 48px;
    }
    /* Existing reaction chips (only shown when count > 0) */
    .lc-reaction-btn {
      background: rgba(10,8,6,0.6);
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: border-color 0.2s, background 0.2s, transform 0.1s;
    }
    .lc-reaction-btn:hover { border-color: var(--gold-dim, #8a6e2f); background: rgba(201,168,76,0.08); }
    .lc-reaction-btn.reacted { border-color: var(--gold, #c9a84c); background: rgba(201,168,76,0.12); }
    .lc-reaction-btn:active { transform: scale(0.93); }
    .lc-reaction-btn img { display: block; image-rendering: auto; }
    .lc-reaction-count {
      font-family: 'Cinzel', serif;
      font-size: 9px;
      letter-spacing: 0.1em;
      color: var(--text-muted, #7a7260);
      min-width: 10px;
      transition: color 0.2s;
    }
    .lc-reaction-btn.reacted .lc-reaction-count { color: var(--gold, #c9a84c); }
    /* Add reaction "+" button */
    .lc-add-reaction-btn {
      background: none;
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--text-muted, #7a7260);
      font-family: 'Cinzel', serif;
      font-size: 9px;
      letter-spacing: 0.15em;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
    }
    .lc-add-reaction-btn:hover { border-color: var(--gold-dim, #8a6e2f); color: var(--gold, #c9a84c); background: rgba(201,168,76,0.06); }
    .lc-add-reaction-btn svg { fill: currentColor; width: 14px; height: 14px; flex-shrink: 0; }
    /* Reaction picker (fixed, viewport-aware) */
    .lc-reaction-picker {
      position: fixed;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      padding: 0.5rem;
      background: rgba(10,8,6,0.98);
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      width: 220px;
      max-width: calc(100vw - 20px);
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      animation: lcPopIn 0.12s ease;
    }

    /* Emoji popup */
    .lc-emoji-popup {
      position: absolute;
      z-index: 9999;
      background: rgba(10,8,6,0.98);
      border: 1px solid var(--gold-dim, #8a6e2f);
      padding: 1rem;
      text-align: center;
      width: 160px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.7);
      animation: lcPopIn 0.12s ease;
    }
    @keyframes lcPopIn {
      from { opacity: 0; transform: scale(0.88) translateY(4px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .lc-emoji-popup img { display: block; margin: 0 auto 0.5rem; image-rendering: auto; }
    .lc-emoji-popup-name {
      font-family: 'Cinzel', serif;
      font-size: 9px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--parchment, #f5f0e8);
      margin-bottom: 0.2rem;
    }
    .lc-emoji-popup-count {
      font-family: 'Cinzel', serif;
      font-size: 8px;
      letter-spacing: 0.1em;
      color: var(--text-muted, #7a7260);
      margin-bottom: 0.75rem;
    }
    .lc-emoji-popup-btn {
      width: 100%;
      font-family: 'Cinzel', serif;
      font-size: 9px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--ink, #0a0806);
      background: var(--gold, #c9a84c);
      border: none;
      padding: 0.55em;
      cursor: pointer;
      transition: background 0.2s;
    }
    .lc-emoji-popup-btn:hover { background: var(--gold-bright, #e8c96a); }
    .lc-emoji-popup-btn.reacted {
      background: transparent;
      color: var(--text-muted, #7a7260);
      border: 1px solid var(--border, rgba(201,168,76,0.18));
    }
    .lc-emoji-popup-btn.reacted:hover { color: #c0705a; border-color: #c0705a; }

    /* Emoji picker */
    .lc-emoji-picker-wrap {
      position: relative;
      display: inline-block;
    }
    .lc-emoji-picker-btn {
      background: none;
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      padding: 0.35rem 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: border-color 0.2s;
    }
    .lc-emoji-picker-btn svg { fill: var(--text-muted, #7a7260); transition: fill 0.2s; }
    .lc-emoji-picker-btn:hover { border-color: var(--gold-dim, #8a6e2f); }
    .lc-emoji-picker-btn:hover svg { fill: var(--gold, #c9a84c); }
    .lc-emoji-grid {
      position: fixed;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      padding: 0.5rem;
      background: rgba(10,8,6,0.98);
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      width: 220px;
      max-width: calc(100vw - 20px);
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      animation: lcPopIn 0.12s ease;
    }
    .lc-emoji-grid-item {
      background: none;
      border: 1px solid transparent;
      padding: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      transition: background 0.15s, border-color 0.15s;
      overflow: hidden;
      width: 32px;
      height: 32px;
      box-sizing: border-box;
    }
    .lc-emoji-grid-item:hover {
      background: rgba(201,168,76,0.1);
      border-color: var(--border, rgba(201,168,76,0.18));
    }
    .lc-emoji-grid-item img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: auto;
      max-width: 26px;
      max-height: 26px;
    }

    /* Emoji hover preview tooltip */
    .lc-emoji-tip {
      position: fixed;
      z-index: 99999;
      background: rgba(10,8,6,0.98);
      border: 1px solid var(--border, rgba(201,168,76,0.18));
      padding: 0.5rem 0.75rem;
      pointer-events: none;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      animation: lcPopIn 0.1s ease;
      display: none;
    }
    .lc-emoji-tip img { display: block; margin: 0 auto 0.3rem; image-rendering: auto; }
    .lc-emoji-tip-label {
      font-family: 'Cinzel', serif;
      font-size: 8px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-muted, #7a7260);
      white-space: nowrap;
    }
    .lb-comment-body img.lc-emoji,
    .comment-body img.lc-emoji {
      vertical-align: middle;
      display: inline;
      image-rendering: auto;
    }

    /* Emoji form row */
    .lc-form-row {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      margin-bottom: 0.5rem;
    }
    .lc-form-row .lb-input,
    .lc-form-row .lb-submit {
      margin-bottom: 0;
    }

    @media (max-width: 768px) {
      .lc-reactions-row { padding: 0.6rem 1rem; gap: 4px; }
      .lc-emoji-grid { grid-template-columns: repeat(5, 1fr); width: 185px; right: 0; }
    }
  `;
  document.head.appendChild(style);

  // ── Emoji hover preview tooltip ──
  const _tip = document.createElement('div');
  _tip.className = 'lc-emoji-tip';
  _tip.innerHTML = '<img id="lc-tip-img" width="56" height="56" style="width:56px;height:56px;object-fit:contain;"><div class="lc-emoji-tip-label" id="lc-tip-label"></div>';
  document.body.appendChild(_tip);

  function showTip(emoji, anchorEl) {
    document.getElementById('lc-tip-img').src = emoji.src;
    document.getElementById('lc-tip-img').alt = emoji.label;
    document.getElementById('lc-tip-label').textContent = emoji.label;
    // Use known fixed size to avoid layout timing issue
    const TW = 100, TH = 90;
    const rect = anchorEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - TW / 2;
    let top  = rect.top - TH - 8;
    if (top < 8) top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + TW > window.innerWidth - 8) left = window.innerWidth - TW - 8;
    _tip.style.left = left + 'px';
    _tip.style.top  = top  + 'px';
    _tip.style.display = 'block';
  }

  function hideTip() { _tip.style.display = 'none'; }

  // Wire hover on any element with data-emoji-id
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-emoji-id]');
    if (!el) return;
    loadEmojis().then(emojis => {
      const emoji = emojis.find(em => em.id === el.dataset.emojiId);
      if (emoji) showTip(emoji, el);
    });
  });
  document.addEventListener('mouseout', e => {
    if (!e.target.closest('[data-emoji-id]')) return;
    hideTip();
  });

  // ── State ──
  let _emojis = null;
  let _emojiLoadPromise = null;

  function getVisitorId() {
    let id = localStorage.getItem('lc_visitor_id');
    if (!id) { id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('lc_visitor_id', id); }
    return id;
  }

  async function emFetch(path, opts = {}) {
    const res = await fetch(_EM_URL + '/rest/v1/' + path, {
      headers: { ..._EM_HDR, 'Prefer': opts.prefer || 'return=minimal', ...opts.headers },
      method: opts.method || 'GET',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!opts.method || opts.method === 'GET') return res.json();
    return res;
  }

  // ── Load emoji list ──
  async function loadEmojis() {
    if (_emojis) return _emojis;
    if (_emojiLoadPromise) return _emojiLoadPromise;
    _emojiLoadPromise = (async () => {
      try {
        const res = await fetch('/_data/emojis-index.json');
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            _emojis = items
              .filter(e => e.active !== false && e.active !== 'false')
              .map(e => ({
                id: e.filename ? e.filename.replace('.md','') : e.title.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
                src: e.image || '',
                label: e.title || '',
                size: parseInt(e.size) || 32
              }));
            return _emojis;
          }
        }
      } catch(e) {}
      _emojis = EMOJI_DEFAULTS;
      return _emojis;
    })();
    return _emojiLoadPromise;
  }

  // ── Popup ──
  let _popup = null;

  function closePopup() {
    if (_popup) { _popup.remove(); _popup = null; }
  }

  function showEmojiPopup(emoji, count, hasReacted, onToggle, anchorEl) {
    closePopup();
    const popup = document.createElement('div');
    popup.className = 'lc-emoji-popup';
    const displaySize = Math.min(emoji.size * 2, 80);
    popup.innerHTML = `
      <img src="${emoji.src}" alt="${emoji.label}" width="${displaySize}" height="${displaySize}" style="width:${displaySize}px;height:${displaySize}px;object-fit:contain;">
      <div class="lc-emoji-popup-name">${emoji.label}</div>
      <div class="lc-emoji-popup-count">${count} reaction${count !== 1 ? 's' : ''}</div>
      <button class="lc-emoji-popup-btn${hasReacted ? ' reacted' : ''}">${hasReacted ? 'Remove Reaction' : 'React'}</button>
    `;
    popup.querySelector('.lc-emoji-popup-btn').addEventListener('click', async e => {
      e.stopPropagation();
      await onToggle();
      closePopup();
    });
    document.body.appendChild(popup);
    _popup = popup;

    // Position near anchor
    const rect = anchorEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const popW = 160, popH = 190;
    let left = rect.left + rect.width / 2 - popW / 2 + scrollX;
    let top  = rect.top - popH - 8 + scrollY;
    if (top < scrollY + 10) top = rect.bottom + 8 + scrollY;
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';

    setTimeout(() => document.addEventListener('click', closePopup, { once: true }), 10);
  }

  // ── Render shortcodes ──
  function renderEmojiShortcodes(text) {
    if (!text) return '';
    const emojis = _emojis || EMOJI_DEFAULTS;
    return text.replace(/:([a-z0-9-]+):/g, (match, id) => {
      const emoji = emojis.find(e => e.id === id);
      if (!emoji) return match;
      const s = Math.min(emoji.size, 22);
      return `<img src="${emoji.src}" alt="${emoji.label}" title="${emoji.label}" class="lc-emoji" data-emoji-id="${emoji.id}" width="${s}" height="${s}" style="width:${s}px;height:${s}px;object-fit:contain;vertical-align:middle;display:inline;">`;
    });
  }

  // ── Reactions UI (Discord-style) ──
  async function initReactions(contentId, containerEl) {
    if (!containerEl) return;
    const emojis = await loadEmojis();
    const visitorId = getVisitorId();

    // Fetch existing reactions
    let reactionData = [];
    try {
      reactionData = await emFetch(`reactions?content_id=eq.${encodeURIComponent(contentId)}&select=emoji_id,visitor_id`);
      if (!Array.isArray(reactionData)) reactionData = [];
    } catch(e) {}

    const counts = {}, myReactions = new Set();
    reactionData.forEach(r => {
      counts[r.emoji_id] = (counts[r.emoji_id] || 0) + 1;
      if (r.visitor_id === visitorId) myReactions.add(r.emoji_id);
    });

    // Render the full reaction bar
    function render() {
      containerEl.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'lc-reactions-row';

      // Show only emojis that have at least one reaction
      emojis.forEach(emoji => {
        const count = counts[emoji.id] || 0;
        if (count === 0) return;
        const reacted = myReactions.has(emoji.id);
        const s = emoji.size;
        const chip = document.createElement('button');
        chip.className = 'lc-reaction-btn' + (reacted ? ' reacted' : '');
        chip.title = emoji.label + (reacted ? ' (click to remove)' : ' (click to add)');
        chip.dataset.emojiId = emoji.id;
        chip.innerHTML = `<img src="${emoji.src}" alt="${emoji.label}" width="${s}" height="${s}" style="width:${s}px;height:${s}px;object-fit:contain;"><span class="lc-reaction-count">${count}</span>`;
        chip.addEventListener('click', async e => {
          e.stopPropagation();
          try {
            if (reacted) {
              await emFetch(`reactions?content_id=eq.${encodeURIComponent(contentId)}&emoji_id=eq.${emoji.id}&visitor_id=eq.${visitorId}`, { method: 'DELETE' });
              myReactions.delete(emoji.id);
              counts[emoji.id] = Math.max(0, (counts[emoji.id] || 1) - 1);
            } else {
              await emFetch('reactions', { method: 'POST', body: { content_id: contentId, emoji_id: emoji.id, visitor_id: visitorId } });
              myReactions.add(emoji.id);
              counts[emoji.id] = (counts[emoji.id] || 0) + 1;
            }
            render();
          } catch(err) {}
        });
        row.appendChild(chip);
      });

      // "Add reaction" button
      const addBtn = document.createElement('button');
      addBtn.className = 'lc-add-reaction-btn';
      addBtn.title = 'Add reaction';
      addBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm3.5-9c.8 0 1.5-.7 1.5-1.5S16.3 8 15.5 8 14 8.7 14 9.5s.7 1.5 1.5 1.5zm-7 0c.8 0 1.5-.7 1.5-1.5S9.3 8 8.5 8 7 8.7 7 9.5 7.7 11 8.5 11zm3.5 6.5c2.3 0 4.3-1.5 5.1-3.5H6.9c.8 2 2.8 3.5 5.1 3.5z"/></svg>`;

      addBtn.addEventListener('click', e => {
        e.stopPropagation();
        // Build picker
        const existing = document.getElementById('lc-rpicker-' + CSS.escape(contentId));
        if (existing) { existing.remove(); return; }
        const picker = document.createElement('div');
        picker.id = 'lc-rpicker-' + CSS.escape(contentId);
        picker.className = 'lc-reaction-picker';
        emojis.forEach(emoji => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'lc-emoji-grid-item' + (myReactions.has(emoji.id) ? ' reacted' : '');
          item.title = emoji.label;
          item.dataset.emojiId = emoji.id;
          const s = Math.min(emoji.size, 28);
          item.innerHTML = `<img src="${emoji.src}" alt="${emoji.label}" width="${s}" height="${s}" style="width:${s}px;height:${s}px;object-fit:contain;">`;
          item.addEventListener('click', async ev => {
            ev.stopPropagation();
            picker.remove();
            try {
              if (myReactions.has(emoji.id)) {
                await emFetch(`reactions?content_id=eq.${encodeURIComponent(contentId)}&emoji_id=eq.${emoji.id}&visitor_id=eq.${visitorId}`, { method: 'DELETE' });
                myReactions.delete(emoji.id);
                counts[emoji.id] = Math.max(0, (counts[emoji.id] || 1) - 1);
              } else {
                await emFetch('reactions', { method: 'POST', body: { content_id: contentId, emoji_id: emoji.id, visitor_id: visitorId } });
                myReactions.add(emoji.id);
                counts[emoji.id] = (counts[emoji.id] || 0) + 1;
              }
              render();
            } catch(err) {}
          });
          picker.appendChild(item);
        });
        document.body.appendChild(picker);
        // Position picker near button
        const rect = addBtn.getBoundingClientRect();
        const w = 220, h = 160;
        let left = rect.right - w;
        let top  = rect.top - h - 8;
        if (left < 10) left = 10;
        if (left + w > window.innerWidth - 10) left = window.innerWidth - w - 10;
        if (top < 10) top = rect.bottom + 8;
        picker.style.left = left + 'px';
        picker.style.top  = top  + 'px';
        setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 10);
      });

      row.appendChild(addBtn);
      containerEl.appendChild(row);
    }

    render();
  }

  // ── Emoji picker for textarea ──
  function createEmojiPicker(textarea, insertContainer) {
    loadEmojis().then(emojis => {
      const wrap = document.createElement('div');
      wrap.className = 'lc-emoji-picker-wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lc-emoji-picker-btn';
      btn.title = 'Insert emoji';
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm3.5-9c.8 0 1.5-.7 1.5-1.5S16.3 8 15.5 8 14 8.7 14 9.5s.7 1.5 1.5 1.5zm-7 0c.8 0 1.5-.7 1.5-1.5S9.3 8 8.5 8 7 8.7 7 9.5 7.7 11 8.5 11zm3.5 6.5c2.3 0 4.3-1.5 5.1-3.5H6.9c.8 2 2.8 3.5 5.1 3.5z"/></svg>`;

      const grid = document.createElement('div');
      grid.className = 'lc-emoji-grid';
      grid.style.display = 'none';
      document.body.appendChild(grid);

      function positionGrid() {
        const rect = btn.getBoundingClientRect();
        const gw = grid.offsetWidth || 220;
        const gh = grid.offsetHeight || 160;
        let left = rect.right - gw;
        let top  = rect.top - gh - 8;
        if (left < 10) left = 10;
        if (left + gw > window.innerWidth - 10) left = window.innerWidth - gw - 10;
        if (top < 10) top = rect.bottom + 8;
        grid.style.left = left + 'px';
        grid.style.top  = top  + 'px';
      }

      function closeGrid() { grid.style.display = 'none'; }

      // Reposition on any scroll so picker follows the button
      window.addEventListener('scroll', () => {
        if (grid.style.display !== 'none') requestAnimationFrame(positionGrid);
      }, { capture: true });

      emojis.forEach(emoji => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'lc-emoji-grid-item';
        item.title = emoji.label;
        item.dataset.emojiId = emoji.id;
        item.innerHTML = `<img src="${emoji.src}" alt="${emoji.label}">`;
        item.addEventListener('click', e => {
          e.stopPropagation();
          const code = `:${emoji.id}:`;
          const start = textarea.selectionStart ?? textarea.value.length;
          const end   = textarea.selectionEnd   ?? textarea.value.length;
          textarea.value = textarea.value.slice(0, start) + code + textarea.value.slice(end);
          textarea.selectionStart = textarea.selectionEnd = start + code.length;
          textarea.focus();
          closeGrid();
        });
        grid.appendChild(item);
      });

      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (grid.style.display !== 'none') { closeGrid(); return; }
        const gw = Math.min(220, window.innerWidth - 20);
        grid.style.width = gw + 'px';
        grid.style.display = 'grid';
        requestAnimationFrame(() => {
          positionGrid();
          setTimeout(() => document.addEventListener('click', closeGrid, { once: true }), 10);
        });
      });

      wrap.appendChild(btn);
      insertContainer.appendChild(wrap);
    });
  }

  // ── Global exports ──
  window.initReactions        = initReactions;
  window.createEmojiPicker    = createEmojiPicker;
  window.renderEmojiShortcodes = renderEmojiShortcodes;
  window.loadEmojis           = loadEmojis;

  // Pre-load emoji list
  loadEmojis();
})();
