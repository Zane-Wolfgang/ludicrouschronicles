/* ─────────────────────────────────────────────────────────────────────────
   holiday.js  —  Halloween & Christmas mode engine

   • Reads /_data/site-settings.yml to know which modes you've enabled
   • Manages the theme toggle button cycle: off → vintage → halloween → christmas
     (only includes modes you've turned on in the CMS)
   • Runs canvas animations per mode:
       Halloween: falling bats + leaves, fog at bottom, image flicker (CSS)
       Christmas: falling snow, twinkling nav lights
   • Persists the visitor's choice in localStorage

   Drop <script src="holiday.js"></script> on every page, after style.css.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'lc_theme_mode'; /* off | vintage | halloween | christmas */
  var settings = { halloween_enabled: false, christmas_enabled: false };
  var currentMode = localStorage.getItem(STORAGE_KEY) || 'off';
  var animFrame = null, fogCanvas = null, particleCanvas = null;

  /* ── YAML settings fetch ────────────────────────────────────────────── */
  function parseYml(text) {
    var out = {};
    (text || '').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.startsWith('#')) return;
      var colon = line.indexOf(':');
      if (colon === -1) return;
      var k = line.slice(0, colon).trim();
      var v = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
      if (k) out[k] = v;
    });
    return out;
  }

  function loadSettings(cb) {
    fetch('/_data/site-settings.yml', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        var s = parseYml(t);
        settings.halloween_enabled = s.halloween_enabled === 'true';
        settings.christmas_enabled = s.christmas_enabled === 'true';
        cb();
      })
      .catch(function () { cb(); });
  }

  /* ── Mode cycle ─────────────────────────────────────────────────────── */
  function buildCycle() {
    var cycle = ['off', 'vintage'];
    if (settings.halloween_enabled) cycle.push('halloween');
    if (settings.christmas_enabled) cycle.push('christmas');
    return cycle;
  }

  function nextMode() {
    var cycle = buildCycle();
    var idx = cycle.indexOf(currentMode);
    return cycle[(idx + 1) % cycle.length];
  }

  /* ── Apply mode ─────────────────────────────────────────────────────── */
  var EMOJIS = { off: '✦', vintage: 'Æ', halloween: '🎃', christmas: '🎄' };
  var LABELS = { off: 'Off', vintage: '1920s Vintage', halloween: 'Halloween', christmas: 'Christmas' };

  function applyMode(mode) {
    document.body.classList.remove('vintage', 'halloween', 'christmas');
    if (mode === 'vintage')   document.body.classList.add('vintage');
    if (mode === 'halloween') document.body.classList.add('halloween');
    if (mode === 'christmas') document.body.classList.add('christmas');

    /* sync the existing vintage-on class on the button wrap */
    var wrap = document.querySelector('.lc-btn-wrap');
    if (wrap) {
      wrap.classList.toggle('vintage-on', mode === 'vintage');
      wrap.classList.toggle('halloween-on', mode === 'halloween');
      wrap.classList.toggle('christmas-on', mode === 'christmas');
    }

    /* update button emoji */
    var circle = document.querySelector('.lc-btn-circle');
    if (circle) {
      /* preserve existing children (ornament etc.) — just update the text node */
      var emojiSpan = circle.querySelector('.lc-mode-emoji');
      if (!emojiSpan) {
        emojiSpan = document.createElement('span');
        emojiSpan.className = 'lc-mode-emoji';
        circle.insertBefore(emojiSpan, circle.firstChild);
      }
      emojiSpan.textContent = EMOJIS[mode] || '✦';
      circle.title = LABELS[mode] || '';
    }

    stopAnimations();
    if (mode === 'halloween') startHalloween();
    if (mode === 'christmas') startChristmas();

    localStorage.setItem(STORAGE_KEY, mode);
    currentMode = mode;
  }

  /* ── Intercept the existing toggle button click ──────────────────────
     The button already has its own click handler for vintage mode.
     We hook into it and override the behaviour so the cycle covers all modes. */
  function hookButton() {
    var circle = document.querySelector('.lc-btn-circle');
    if (!circle) return;
    circle.addEventListener('click', function (e) {
      e.stopImmediatePropagation(); /* take over from the vintage-only handler */
      applyMode(nextMode());
    }, true /* capture — fires before existing handlers */);
  }

  /* ── HALLOWEEN ANIMATIONS ────────────────────────────────────────────
     Canvas 1: bats + falling leaves (above content)
     Canvas 2: fog layer at the bottom                                   */

  function startHalloween() {
    startParticles('halloween');
    startFog();
  }

  function startFog() {
    fogCanvas = document.createElement('canvas');
    fogCanvas.id = 'lc-fog-canvas';
    fogCanvas.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:180px;pointer-events:none;z-index:800;';
    document.body.appendChild(fogCanvas);
    var ctx = fogCanvas.getContext('2d');
    function resizeFog() { fogCanvas.width = window.innerWidth; fogCanvas.height = 180; }
    resizeFog();
    window.addEventListener('resize', resizeFog);
    fogCanvas._lcResizeFog = resizeFog;
    var blobs = [];
    for (var i = 0; i < 6; i++) {
      blobs.push({ x: Math.random() * fogCanvas.width, y: 80 + Math.random() * 80,
        r: 120 + Math.random() * 160, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.15 });
    }
    function drawFog() {
      ctx.clearRect(0, 0, fogCanvas.width, 180);
      blobs.forEach(function (b) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.r) b.x = fogCanvas.width + b.r;
        if (b.x > fogCanvas.width + b.r) b.x = -b.r;
        b.y = Math.max(40, Math.min(160, b.y));
        var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, 'rgba(30,10,40,0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    (function fogLoop() { if (!fogCanvas.parentNode) return; drawFog(); requestAnimationFrame(fogLoop); })();
  }

  /* ── SHARED PARTICLE SYSTEM ─────────────────────────────────────────
     Handles both falling bats/leaves (halloween) and snow (christmas)  */

  var PARTICLE_COUNT = { halloween: 28, christmas: 60 };

  function startParticles(mode) {
    particleCanvas = document.createElement('canvas');
    particleCanvas.id = 'lc-holiday-canvas';
    particleCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:799;';
    document.body.appendChild(particleCanvas);
    var ctx = particleCanvas.getContext('2d');
    var particles = [];
    var count = PARTICLE_COUNT[mode] || 40;
    var W, H;

    function resize() { W = particleCanvas.width = window.innerWidth; H = particleCanvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    particleCanvas._lcResizeHandler = resize; /* tracked for cleanup */

    /* Bat path (tiny SVG-like drawn via canvas) */
    function drawBat(ctx, x, y, size, wing) {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(20,5,25,0.85)';
      /* body */
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.3, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      /* wings */
      var w = size * (1 + Math.sin(wing) * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(-w * 0.5, -size * 0.4, -w, size * 0.1);
      ctx.quadraticCurveTo(-w * 0.6, size * 0.2, 0, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(w * 0.5, -size * 0.4, w, size * 0.1);
      ctx.quadraticCurveTo(w * 0.6, size * 0.2, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    function drawLeaf(ctx, x, y, size, angle) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = 'rgba(140,40,10,' + (0.6 + Math.random() * 0.3) + ')';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.4, size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }

    function drawSnowflake(ctx, x, y, size) {
      ctx.fillStyle = 'rgba(220,240,255,0.85)';
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }

    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: mode === 'halloween' ? (i % 3 === 0 ? 10 + Math.random() * 8 : 4 + Math.random() * 5)
                                   : (1.5 + Math.random() * 2.5),
        vx: (Math.random() - 0.5) * (mode === 'halloween' ? 1.2 : 0.5),
        vy: mode === 'halloween' ? 0.5 + Math.random() * 0.8 : 0.8 + Math.random() * 1.2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        type: mode === 'halloween' ? (i % 3 === 0 ? 'bat' : 'leaf') : 'snow',
        wingPhase: Math.random() * Math.PI * 2,
        angle: Math.random() * Math.PI * 2
      });
    }

    function tick() {
      if (!particleCanvas.parentNode) return;
      ctx.clearRect(0, 0, W, H);
      particles.forEach(function (p) {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.6;
        p.y += p.vy;
        p.angle += 0.02;
        p.wingPhase += 0.12;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.type === 'bat')  drawBat(ctx, p.x, p.y, p.size, p.wingPhase);
        else if (p.type === 'leaf') drawLeaf(ctx, p.x, p.y, p.size, p.angle);
        else drawSnowflake(ctx, p.x, p.y, p.size);
      });
      animFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  /* ── CHRISTMAS: twinkling nav lights ────────────────────────────────── */
  var xmasLights = [];
  var LIGHT_COLORS = ['red','green','gold','blue','white'];

  function startChristmas() {
    startParticles('christmas');
    addNavLights();
  }

  function addNavLights(attempt) {
    var nav = document.querySelector('nav');
    var links = nav ? nav.querySelectorAll('.nav-links a') : [];
    if (!links.length) {
      /* Nav links not rendered yet — retry up to 10 times */
      if ((attempt || 0) < 10) setTimeout(function () { addNavLights((attempt || 0) + 1); }, 200);
      return;
    }
    links.forEach(function (a, i) {
      if (i === links.length - 1) return;
      var light = document.createElement('span');
      light.className = 'lc-xmas-light ' + LIGHT_COLORS[i % LIGHT_COLORS.length];
      light.style.animationDelay = (i * 0.18) + 's';
      a.parentNode.insertBefore(light, a.nextSibling);
      xmasLights.push(light);
    });
  }

  function removeNavLights() {
    xmasLights.forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    xmasLights = [];
  }

  /* ── Stop all animations ─────────────────────────────────────────────── */
  function stopAnimations() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (particleCanvas) {
      if (particleCanvas._lcResizeHandler) window.removeEventListener('resize', particleCanvas._lcResizeHandler);
      if (particleCanvas.parentNode) particleCanvas.parentNode.removeChild(particleCanvas);
      particleCanvas = null;
    }
    if (fogCanvas) {
      if (fogCanvas._lcResizeFog) window.removeEventListener('resize', fogCanvas._lcResizeFog);
      if (fogCanvas.parentNode) fogCanvas.parentNode.removeChild(fogCanvas);
      fogCanvas = null;
    }
    removeNavLights();
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  function boot() {
    loadSettings(function () {
      /* Clamp stored mode to what's currently available */
      var cycle = buildCycle();
      if (cycle.indexOf(currentMode) === -1) currentMode = 'off';
      applyMode(currentMode);
      hookButton();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
