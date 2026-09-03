/* ─────────────────────────────────────────────────────────────────────────
   Connection & loading indicator  (site-wide, no dependencies)

   Purpose: visitors on bad wifi were assuming the site was broken. This shows
   an obvious-but-tasteful signal that the page is genuinely still working:

     • a thin gold progress bar across the very top while the page loads
     • a small corner card that ESCALATES its message the longer things take:
         ~0.4s   "Loading…"                         (quiet, only if not done yet)
         ~3s     "Slow connection — hang tight."     (reassurance)
         ~8s     "Still working — your connection is just slow, not broken."

   It also listens for the browser going offline/online and for the Network
   Information API (effectiveType) to detect slow links up front.

   Everything is self-contained. Drop <script src="connection.js"></script> on
   a page and it runs automatically. Safe to include on every page.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  /* Respect users who asked for reduced motion — no shimmer, just a static bar. */
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- styles ---------- */
  var css = document.createElement("style");
  css.textContent = [
    "#lc-load-bar{position:fixed;top:0;left:0;height:3px;width:0;z-index:2147483600;",
    "background:linear-gradient(90deg,#8a6e2f,#c9a84c,#e8c96a);",
    "box-shadow:0 0 10px rgba(201,168,76,.7);transition:width .4s ease,opacity .5s ease;pointer-events:none;}",
    reduceMotion ? "" :
      "#lc-load-bar.lc-shimmer::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);animation:lcShimmer 1.1s linear infinite;}",
    "@keyframes lcShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}",
    "#lc-conn-card{position:fixed;bottom:1.1rem;right:1.1rem;z-index:2147483600;max-width:280px;",
    "background:rgba(14,11,7,.97);border:1px solid var(--gold-dim,#8a6e2f);border-radius:10px;",
    "padding:.7rem .9rem .7rem .8rem;display:flex;align-items:center;gap:.65rem;",
    "font-family:'EB Garamond',Georgia,serif;color:var(--parchment,#f0deb4);font-size:.9rem;line-height:1.35;",
    "box-shadow:0 6px 26px rgba(0,0,0,.55);opacity:0;transform:translateY(8px);",
    "transition:opacity .35s ease,transform .35s ease;pointer-events:none;}",
    "#lc-conn-card.show{opacity:1;transform:translateY(0);}",
    "#lc-conn-spinner{width:15px;height:15px;flex-shrink:0;border-radius:50%;",
    "border:2px solid rgba(201,168,76,.25);border-top-color:#c9a84c;",
    reduceMotion ? "" : "animation:lcSpin .8s linear infinite;}",
    "@keyframes lcSpin{to{transform:rotate(360deg)}}",
    "#lc-conn-card .lc-conn-title{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.18em;",
    "text-transform:uppercase;color:var(--gold-dim,#8a6e2f);display:block;margin-bottom:1px;}",
    "#lc-conn-card.offline{border-color:#c0705a;}",
    "#lc-conn-card.offline #lc-conn-spinner{border-top-color:#c0705a;animation:none;}"
  ].join("");
  (document.head || document.documentElement).appendChild(css);

  /* ---------- top progress bar ---------- */
  var bar = document.createElement("div");
  bar.id = "lc-load-bar";
  var cardMounted = false, card, spinner, titleEl, msgEl;

  function mount() {
    if (!document.body) return;
    if (!bar.parentNode) document.body.appendChild(bar);
    if (!cardMounted) {
      card = document.createElement("div");
      card.id = "lc-conn-card";
      card.innerHTML =
        '<div id="lc-conn-spinner"></div>' +
        '<div><span class="lc-conn-title" id="lc-conn-title">Loading</span>' +
        '<span id="lc-conn-msg">One moment…</span></div>';
      document.body.appendChild(card);
      spinner = card.querySelector("#lc-conn-spinner");
      titleEl = card.querySelector("#lc-conn-title");
      msgEl = card.querySelector("#lc-conn-msg");
      cardMounted = true;
    }
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  /* animate the bar toward a target width */
  var progress = 0, done = false;
  function setBar(pct) {
    progress = pct;
    bar.style.width = pct + "%";
    if (!reduceMotion) bar.classList.toggle("lc-shimmer", pct > 0 && pct < 100);
  }
  setBar(8);
  /* creep forward so it always feels alive, even before load fires */
  var creep = setInterval(function () {
    if (done) return;
    if (progress < 90) setBar(progress + (90 - progress) * 0.08);
  }, 400);

  function finishBar() {
    if (done) return;
    done = true;
    clearInterval(creep);
    setBar(100);
    setTimeout(function () { bar.style.opacity = "0"; }, 250);
  }

  /* ---------- escalating reassurance card ---------- */
  var t1, t2, t3, shown = false;
  function showCard(title, msg) {
    mount();
    if (!card) return;
    titleEl.textContent = title;
    msgEl.textContent = msg;
    card.classList.add("show");
    shown = true;
  }
  function hideCard() {
    if (card) card.classList.remove("show");
  }

  /* Detect an already-slow link so we can speak up sooner. */
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var slowLink = conn && /^(slow-2g|2g|3g)$/.test(conn.effectiveType || "");

  /* Stage timers — only fire if the page hasn't finished yet. */
  t1 = setTimeout(function () { if (!done) showCard("Loading", "Fetching the page…"); }, slowLink ? 200 : 500);
  t2 = setTimeout(function () { if (!done) showCard("Slow connection", "Hang tight — this is loading, not broken."); }, slowLink ? 1800 : 3000);
  t3 = setTimeout(function () { if (!done) showCard("Still working", "Your connection is just slow. Give it a moment — it will arrive."); }, slowLink ? 5000 : 8000);

  function allDone() {
    finishBar();
    clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    if (shown) {
      /* let them see a friendly "done" beat, then fade */
      showCard("Loaded", "Thanks for waiting.");
      setTimeout(hideCard, 1200);
    } else {
      hideCard();
    }
  }

  /* Page load is the primary "done" signal. */
  if (document.readyState === "complete") setTimeout(allDone, 50);
  else window.addEventListener("load", function () { setTimeout(allDone, 50); });

  /* ---------- offline / online awareness ---------- */
  window.addEventListener("offline", function () {
    mount();
    if (!card) return;
    card.classList.add("offline", "show");
    titleEl.textContent = "Offline";
    msgEl.textContent = "You've lost connection. We'll resume when it's back.";
    shown = true;
  });
  window.addEventListener("online", function () {
    if (card) card.classList.remove("offline");
    if (!done) showCard("Reconnected", "Back online — loading…");
    else hideCard();
  });

  /* ---------- optional public hook ----------
     Long-running fetches (e.g. gallery JSON) can call these to keep the bar
     honest if they finish after window.load:
        window.LCLoading.tick()   // nudge the bar forward
        window.LCLoading.done()   // force-complete
  */
  window.LCLoading = {
    tick: function () { if (!done && progress < 95) setBar(progress + 3); },
    done: allDone,
    slow: function () { if (!done) showCard("Slow connection", "Hang tight — still loading."); }
  };
})();
