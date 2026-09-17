#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   og-inject.js  —  build-time Open Graph image injector

   Reads _data/page-previews.yml (set via CMS admin → Site Settings →
   Page Preview Images) and rewrites the og:image / twitter:image tags in
   every HTML page to use whatever screenshot you've uploaded there.

   Also routes all OG images through Netlify's Image CDN (640px / 60% quality)
   so link-preview cards are low-res and can't be stolen at full resolution.

   Run automatically during build (see netlify.toml build command).
   Safe to run even when page-previews.yml doesn't exist yet — it just skips.
   ───────────────────────────────────────────────────────────────────────── */

const fs   = require("fs");
const path = require("path");

const SITE    = "https://ludicrous-chronicles.netlify.app";
const CDN_W   = 640;
const CDN_Q   = 60;

/* ── helpers ─────────────────────────────────────────────────────────── */

function cdnUrl(rawPath) {
  /* rawPath is either a full https URL or a /images/... path */
  if (!rawPath) return null;
  let src = rawPath.trim();
  if (src.startsWith(SITE)) src = src.slice(SITE.length);
  if (src.startsWith("/.netlify/images")) return rawPath; /* already transformed */
  if (!src.startsWith("/")) src = "/" + src;
  return `${SITE}/.netlify/images?url=${encodeURIComponent(src)}&w=${CDN_W}&q=${CDN_Q}&fm=jpg`;
}

function parseYml(text) {
  /* Parses a simple flat YAML file (key: value).
     Handles unquoted, single-quoted, double-quoted values, blank lines, comments. */
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const k = line.slice(0, colon).trim();
    let v = line.slice(colon + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && v) out[k] = v;
  }
  return out;
}

function setMetaTag(html, attr, name, value) {
  /* Replace an existing meta tag's content, or insert before </head> if absent. */
  const safe = value.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  const re = new RegExp(
    `(<meta\\s+${attr}=["']${name}["']\\s+content=["'])([^"']*)(["'][^>]*>)`, "i"
  );
  if (re.test(html)) return html.replace(re, `$1${safe}$3`);
  return html.replace(/<\/head>/i, `  <meta ${attr}="${name}" content="${safe}">\n</head>`);
}

/* ── page → yml key map ──────────────────────────────────────────────── */
const PAGE_KEY = {
  "index.html":       "homepage",   /* no CMS field yet — skipped gracefully */
  "gallery.html":     "gallery",
  "videos.html":      "videos",
  "content.html":     "content",
  "about.html":       "about",
  "news.html":        "news",
  "membership.html":  "membership",
  "contact.html":     "contact",
  "merch.html":       "merch",
  "chapter.html":     "chapter",
  "chapter-1.html":   "chapter",   /* shares the chapter screenshot */
};

/* ── main ────────────────────────────────────────────────────────────── */

const previewsPath = path.join(__dirname, "_data", "page-previews.yml");
let previews = {};
if (fs.existsSync(previewsPath)) {
  previews = parseYml(fs.readFileSync(previewsPath, "utf8"));
  console.log("[og-inject] page-previews.yml loaded:", Object.keys(previews).join(", "));
} else {
  console.log("[og-inject] page-previews.yml not found — using existing OG tags as-is.");
}

let updated = 0;
for (const [file, key] of Object.entries(PAGE_KEY)) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) continue;

  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  /* 1. If admin set a screenshot for this page, use it. */
  const rawImg = previews[key];
  if (rawImg) {
    const small = cdnUrl(rawImg);
    if (small) {
      html = setMetaTag(html, "property", "og:image",             small);
      html = setMetaTag(html, "property", "og:image:secure_url",  small);
      html = setMetaTag(html, "property", "og:image:type",        "image/jpeg");
      html = setMetaTag(html, "name",     "twitter:image",        small);
      changed = true;
    }
  }

  /* 2. Even without a custom screenshot, make sure any existing og:image
        that points to a raw /images/ file is routed through the CDN so
        it's always low-res in preview cards. */
  html = html.replace(
    /(<meta\s+property="og:image(?::secure_url)?"\s+content=")([^"]+)(")/gi,
    (match, pre, url, post) => {
      if (url.includes("/.netlify/images")) return match; /* already done */
      const small = cdnUrl(url);
      if (!small || small === url) return match;
      changed = true;
      return pre + small + post;
    }
  );
  html = html.replace(
    /(<meta\s+name="twitter:image"\s+content=")([^"]+)(")/gi,
    (match, pre, url, post) => {
      if (url.includes("/.netlify/images")) return match;
      const small = cdnUrl(url);
      if (!small || small === url) return match;
      changed = true;
      return pre + small + post;
    }
  );

  if (changed) {
    fs.writeFileSync(filePath, html, "utf8");
    updated++;
    console.log(`[og-inject] ${file} → updated`);
  }
}

console.log(`[og-inject] done. ${updated} file(s) updated.`);
