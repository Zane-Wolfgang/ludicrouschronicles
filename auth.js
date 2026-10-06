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

/* ── Combined: Vintage Toggle + Gatsby Quote + Holiday Modes ──
   Everything self-contained here — no extra script tags needed.
   Holiday CSS animations run when body.halloween / body.christmas are set.
   The admin CMS controls which holiday options appear in the tooltip.        */
(function () {
  var LS_VINTAGE  = 'lc_vintage_mode';
  var LS_HOLIDAY  = 'lc_holiday_mode';
  var siteSettings = {};
  var animFrame = null, particleCanvas = null, fogCanvas = null;
  var xmasLights = [];

  /* ── Settings ── */
  function loadSettings() {
    return fetch('/_data/site-settings.yml', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.text() : ''; })
      .then(function(t){
        t.split('\n').forEach(function(raw){
          var line = raw.trim();
          if (!line || line[0]==='#') return;
          var c = line.indexOf(':'); if (c===-1) return;
          var k = line.slice(0,c).trim();
          var v = line.slice(c+1).trim().replace(/^['"]|['"]$/g,'');
          if (k) siteSettings[k] = v;
        });
      })
      .catch(function(){});
  }

  function holidaysEnabled() {
    var h = [];
    if (siteSettings.halloween_enabled === 'true') h.push('halloween');
    if (siteSettings.christmas_enabled === 'true') h.push('christmas');
    return h;
  }

  /* ── Apply modes ── */
  function applyVintage(on) {
    document.body.classList.toggle('vintage', on);
    var wrap = document.getElementById('lc-btn-wrap');
    if (!wrap) return;
    wrap.classList.toggle('vintage-on', on);
    var btn = wrap.querySelector('.lc-btn-circle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.title = on ? 'Vintage ON — click to turn off' : 'Vintage OFF — click to turn on';
      btn.innerHTML = on ? '\u2713' : '\u25c6';
    }
  }

  function toggleVintage() {
    var next = !document.body.classList.contains('vintage');
    localStorage.setItem(LS_VINTAGE, next ? '1' : '0');
    applyVintage(next);
  }

  function applyHoliday(mode) {
    document.body.classList.remove('halloween','christmas');
    if (mode) document.body.classList.add(mode);
    localStorage.setItem(LS_HOLIDAY, mode || '');
    stopAnimations();
    if (mode === 'halloween') startHalloween();
    if (mode === 'christmas') startChristmas();
    updateHolidayButtons();
  }

  function updateHolidayButtons() {
    var current = localStorage.getItem(LS_HOLIDAY) || '';
    document.querySelectorAll('.lc-holiday-btn').forEach(function(b){
      var active = b.dataset.mode === current;
      b.style.borderColor = active ? 'var(--gold)' : 'rgba(201,168,76,0.3)';
      b.style.background  = active ? 'rgba(201,168,76,0.15)' : 'transparent';
      b.style.color       = active ? 'var(--gold)' : 'var(--text-muted)';
    });
  }

  /* ── Animations ── */
  function stopAnimations() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (particleCanvas) {
      if (particleCanvas._lcResize) window.removeEventListener('resize', particleCanvas._lcResize);
      if (particleCanvas.parentNode) particleCanvas.parentNode.removeChild(particleCanvas);
      particleCanvas = null;
    }
    if (fogCanvas) {
      if (fogCanvas._lcResize) window.removeEventListener('resize', fogCanvas._lcResize);
      if (fogCanvas.parentNode) fogCanvas.parentNode.removeChild(fogCanvas);
      fogCanvas = null;
    }
    xmasLights.forEach(function(l){ if (l.parentNode) l.parentNode.removeChild(l); });
    xmasLights = [];
  }

  function startParticles(mode) {
    particleCanvas = document.createElement('canvas');
    particleCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:799;';
    document.body.appendChild(particleCanvas);
    var ctx = particleCanvas.getContext('2d');
    var W, H;
    function resize(){ W = particleCanvas.width = window.innerWidth; H = particleCanvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize); particleCanvas._lcResize = resize;
    var count = mode === 'halloween' ? 28 : 60;
    var particles = [];
    for (var i=0;i<count;i++) {
      particles.push({
        x:Math.random()*window.innerWidth, y:Math.random()*window.innerHeight,
        size: mode==='halloween'?(i%3===0?10+Math.random()*8:4+Math.random()*5):(1.5+Math.random()*2.5),
        vx:(Math.random()-0.5)*(mode==='halloween'?1.2:0.5),
        vy:mode==='halloween'?0.5+Math.random()*0.8:0.8+Math.random()*1.2,
        wobble:Math.random()*Math.PI*2, wobbleSpeed:0.02+Math.random()*0.03,
        type:mode==='halloween'?(i%3===0?'bat':'leaf'):'snow',
        wingPhase:Math.random()*Math.PI*2, angle:Math.random()*Math.PI*2
      });
    }
    function drawBat(c,x,y,sz,wp){
      c.save();c.translate(x,y);c.fillStyle='rgba(20,5,25,0.85)';
      c.beginPath();c.ellipse(0,0,sz*0.3,sz*0.2,0,0,Math.PI*2);c.fill();
      var w=sz*(1+Math.sin(wp)*0.3);
      c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-w*0.5,-sz*0.4,-w,sz*0.1);c.quadraticCurveTo(-w*0.6,sz*0.2,0,0);c.fill();
      c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(w*0.5,-sz*0.4,w,sz*0.1);c.quadraticCurveTo(w*0.6,sz*0.2,0,0);c.fill();
      c.restore();
    }
    function drawLeaf(c,x,y,sz,ang){
      c.save();c.translate(x,y);c.rotate(ang);
      c.fillStyle='rgba(140,40,10,0.75)';
      c.beginPath();c.ellipse(0,0,sz*0.4,sz*0.7,0,0,Math.PI*2);c.fill();c.restore();
    }
    function tick(){
      if (!particleCanvas.parentNode) return;
      ctx.clearRect(0,0,W,H);
      particles.forEach(function(p){
        p.wobble+=p.wobbleSpeed; p.x+=p.vx+Math.sin(p.wobble)*0.6; p.y+=p.vy; p.angle+=0.02; p.wingPhase+=0.12;
        if (p.y>H+20){p.y=-20;p.x=Math.random()*W;}
        if (p.x<-20)p.x=W+20; if(p.x>W+20)p.x=-20;
        if (p.type==='bat') drawBat(ctx,p.x,p.y,p.size,p.wingPhase);
        else if (p.type==='leaf') drawLeaf(ctx,p.x,p.y,p.size,p.angle);
        else { ctx.fillStyle='rgba(220,240,255,0.85)';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill(); }
      });
      animFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  function startFog(){
    fogCanvas = document.createElement('canvas');
    fogCanvas.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:180px;pointer-events:none;z-index:798;';
    document.body.appendChild(fogCanvas);
    var ctx = fogCanvas.getContext('2d');
    function resize(){ fogCanvas.width=window.innerWidth; fogCanvas.height=180; }
    resize(); window.addEventListener('resize',resize); fogCanvas._lcResize=resize;
    var blobs=[];
    for(var i=0;i<6;i++) blobs.push({x:Math.random()*window.innerWidth,y:80+Math.random()*80,r:120+Math.random()*160,vx:(Math.random()-0.5)*0.4,vy:(Math.random()-0.5)*0.15});
    function draw(){
      if(!fogCanvas.parentNode) return;
      ctx.clearRect(0,0,fogCanvas.width,180);
      blobs.forEach(function(b){
        b.x+=b.vx; b.y+=b.vy;
        if(b.x<-b.r)b.x=fogCanvas.width+b.r; if(b.x>fogCanvas.width+b.r)b.x=-b.r;
        b.y=Math.max(40,Math.min(160,b.y));
        var g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
        g.addColorStop(0,'rgba(30,10,40,0.18)'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r,b.r*0.45,0,0,Math.PI*2); ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  function startHalloween(){ startParticles('halloween'); startFog(); }

  function startChristmas(){
    startParticles('christmas');
    /* Nav lights with retry */
    function addLights(attempt){
      var links = document.querySelectorAll('.nav-links a');
      if (!links.length){ if((attempt||0)<10) setTimeout(function(){addLights((attempt||0)+1);},200); return; }
      var colors=['red','green','gold','blue','white'];
      links.forEach(function(a,i){
        if(i===links.length-1) return;
        var l=document.createElement('span'); l.className='lc-xmas-light '+colors[i%colors.length];
        l.style.animationDelay=(i*0.18)+'s'; a.parentNode.insertBefore(l,a.nextSibling); xmasLights.push(l);
      });
    }
    addLights(0);
  }

  /* ── Tooltip holiday section ── */
  function buildHolidaySection(tip, holidays) {
    var old = tip.querySelector('.lc-holiday-section'); if (old) old.remove();
    if (!holidays.length) return;
    var section = document.createElement('div');
    section.className = 'lc-holiday-section';
    section.style.cssText = 'margin-top:0.9rem;padding-top:0.75rem;border-top:1px solid var(--border);';
    var label = document.createElement('div');
    label.style.cssText = 'font-family:"Cinzel",serif;font-size:8px;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:0.5rem;';
    label.textContent = 'Seasonal Themes'; section.appendChild(label);
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    var current = localStorage.getItem(LS_HOLIDAY) || '';
    holidays.forEach(function(mode){
      var btn = document.createElement('button');
      btn.type='button'; btn.className='lc-holiday-btn'; btn.dataset.mode=mode;
      btn.textContent = mode==='halloween' ? '\ud83c\udf83 Halloween' : '\ud83c\udf84 Christmas';
      var active = current===mode;
      btn.style.cssText='font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.1em;padding:0.4em 0.7em;cursor:pointer;border-radius:3px;transition:all 0.2s;border:1px solid '+(active?'var(--gold)':'rgba(201,168,76,0.3)')+';background:'+(active?'rgba(201,168,76,0.15)':'transparent')+';color:'+(active?'var(--gold)':'var(--text-muted)')+';';
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var cur=localStorage.getItem(LS_HOLIDAY)||'';
        applyHoliday(cur===mode?'':mode);
      });
      row.appendChild(btn);
    });
    section.appendChild(row); tip.appendChild(section);
  }

  /* ── Inject button ── */
  function inject(holidays) {
    if (document.getElementById('lc-btn-wrap')) return;
    var isOn = document.body.classList.contains('vintage');
    var wrap = document.createElement('div');
    wrap.id='lc-btn-wrap'; wrap.className='lc-btn-wrap'+(isOn?' vintage-on':'');

    var btn = document.createElement('button');
    btn.className='lc-btn-circle'; btn.type='button';
    btn.innerHTML=isOn?'\u2713':'\u25c6';
    btn.setAttribute('aria-pressed',String(isOn));
    btn.title=isOn?'Vintage ON — click to turn off':'Vintage OFF — click to turn on';

    btn.addEventListener('click', function(){
      if (holidays.length > 0) {
        /* With holidays: pin the tooltip so user can pick; vintage stays separate */
        wrap.classList.toggle('lc-tooltip-open');
      } else {
        toggleVintage();
      }
    });

    var tip = document.createElement('div');
    tip.className='lc-btn-tooltip'; tip.setAttribute('role','tooltip'); tip.setAttribute('aria-hidden','true');
    tip.innerHTML=
      '<div class="lc-btn-ornament">\u25c8 \u2015 \u25c8 \u2015 \u25c8</div>'+
      '<p class="lc-btn-quote-text">Then wear the gold hat, if that will move her;<br>If you can bounce high, bounce for her too,<br>till she cry \u201cLover, gold-hatted,<br>high-bouncing lover,<br>I must have you!\u201d</p>'+
      '<hr class="lc-btn-divider">'+
      '<div class="lc-btn-attr">Thomas Parke D\u2019Invilliers</div>'+
      '<div class="lc-btn-hint">'+(holidays.length>0?'Click for theme options':'Click to toggle 1920s mode')+'</div>';

    if (holidays.length > 0) {
      /* Add vintage row inside tooltip */
      var vrow = document.createElement('div');
      vrow.style.cssText='margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border);';
      var vbtn = document.createElement('button');
      vbtn.type='button';
      vbtn.style.cssText='font-family:"Cinzel",serif;font-size:9px;letter-spacing:0.1em;padding:0.4em 0.8em;cursor:pointer;border-radius:3px;border:1px solid rgba(201,168,76,0.3);background:transparent;color:var(--text-muted);width:100%;transition:all 0.2s;';
      vbtn.textContent='\u00c6 Toggle 1920s Vintage';
      vbtn.addEventListener('click',function(e){e.stopPropagation();toggleVintage();});
      vrow.appendChild(vbtn); tip.appendChild(vrow);
      buildHolidaySection(tip, holidays);
      document.addEventListener('click',function(e){ if(!wrap.contains(e.target)) wrap.classList.remove('lc-tooltip-open'); });
    }

    wrap.appendChild(tip); wrap.appendChild(btn); document.body.appendChild(wrap);

    var savedHoliday = localStorage.getItem(LS_HOLIDAY)||'';
    if (savedHoliday && holidays.indexOf(savedHoliday)!==-1) applyHoliday(savedHoliday);
  }

  /* ── Boot ── */
  function boot() {
    loadSettings().then(function(){
      var holidays = holidaysEnabled();
      var saved = localStorage.getItem(LS_VINTAGE);
      var vintageOn = saved !== null ? saved==='1' : siteSettings.vintage_mode==='true';
      applyVintage(vintageOn);
      inject(holidays);
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
