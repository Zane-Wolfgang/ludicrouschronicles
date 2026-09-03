/* ─────────────────────────────────────────────────────────────────────────
   Per-item link previews (Open Graph) — Netlify Edge Function

   WHY THIS EXISTS
   Discord / X / Slack fetch the raw HTML of a URL and read its <meta> tags to
   build the preview card. Two problems with a JS-rendered site:
     1. Hash fragments (#Some Title) are NEVER sent to the server, so the
        crawler cannot know which piece was linked.
     2. The artwork is loaded by JavaScript after the page arrives, and
        crawlers don't run JavaScript.
   So every gallery link previewed identically.

   WHAT THIS DOES
   Intercepts requests for gallery.html / videos.html / content.html / chapter
   pages. If the URL carries an item query param, it looks that item up in the
   matching _data JSON and REWRITES the og:/twitter: tags in the HTML response
   so the card shows that item's own title and image.

   Real visitors get the identical page (the tag swap is invisible to them);
   crawlers get accurate per-item cards.

   URL FORMATS UNDERSTOOD
     gallery.html?piece=<title>    art / stills / traditional / wips
     videos.html?play=<title>      videos            (already used by the site)
     content.html?item=<title>     anything in content-index
     chapter.html?ch=<title|number>

   Deploy: place at  netlify/edge-functions/og-preview.js
   and register it in netlify.toml (see notes at the bottom of this file).
   ───────────────────────────────────────────────────────────────────────── */

const SITE = "https://ludicrous-chronicles.netlify.app";

/* Feeds searched, in order. First title match wins. */
const FEEDS = [
  "/_data/gallery-index.json",
  "/_data/stills-index.json",
  "/_data/traditional-art-index.json",
  "/_data/wips-index.json",
  "/_data/content-index.json",
];

/* Same normalisation the site uses for title matching: case-insensitive,
   whitespace-collapsed, punctuation-stripped. Keeps links working even if a
   title has quotes, braces or odd spacing. */
function key(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w ]/g, "");
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Pull the first usable image off an entry, whichever field it uses. */
function itemImage(item) {
  if (Array.isArray(item.images) && item.images.length && item.images[0]) return item.images[0];
  if (item.image) return item.image;
  if (item.thumbnail) return item.thumbnail;
  if (item.art) return item.art;
  if (item.cover) return item.cover;
  return null;
}

function absolute(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return SITE + (path.startsWith("/") ? "" : "/") + path;
}

/* Link-preview images are deliberately served SMALL and compressed.
   Discord/X display cards at roughly 600px wide, so this looks identical in the
   card — but the file someone could right-click-save from that card is too low
   resolution to reprint or resell. The full-quality original is untouched on the
   site itself. Uses Netlify Image CDN (/.netlify/images).
   NOTE: this only downgrades the SHAREABLE preview. It is not real protection —
   the full-res file still lives at its normal URL on the site. */
const PREVIEW_WIDTH = 640;
const PREVIEW_QUALITY = 60;
function previewVersion(absUrl) {
  if (!absUrl) return null;
  /* Only transform images we host; leave external URLs alone. */
  if (!absUrl.startsWith(SITE)) return absUrl;
  const path = absUrl.slice(SITE.length);
  const src = path.startsWith("/") ? path : "/" + path;
  return `${SITE}/.netlify/images?url=${encodeURIComponent(src)}&w=${PREVIEW_WIDTH}&q=${PREVIEW_QUALITY}&fm=jpg`;
}

/* Find the requested item across the feeds. */
async function findItem(request, wanted) {
  const target = key(wanted);
  if (!target) return null;

  for (const feed of FEEDS) {
    try {
      const res = await fetch(new URL(feed, SITE).toString(), {
        headers: { accept: "application/json" },
      });
      if (!res.ok) continue;
      const items = await res.json();
      if (!Array.isArray(items)) continue;
      const hit = items.find((it) => key(it.title) === target);
      if (hit) return hit;
    } catch (_) {
      /* a feed being unavailable must never break the page */
    }
  }
  return null;
}

/* Replace an existing meta tag's content, or append the tag if absent. */
function setMeta(html, attr, name, value) {
  const safe = escapeAttr(value);
  const re = new RegExp(
    `(<meta\\s+${attr}=["']${name}["']\\s+content=["'])([^"']*)(["'][^>]*>)`,
    "i"
  );
  if (re.test(html)) {
    return html.replace(re, `$1${safe}$3`);
  }
  /* not present — insert just before </head> */
  const tag = `<meta ${attr}="${name}" content="${safe}">`;
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

export default async function handler(request, context) {
  const url = new URL(request.url);

  /* Which query param carries the item name on this page? */
  const wanted =
    url.searchParams.get("piece") ||
    url.searchParams.get("play") ||
    url.searchParams.get("item") ||
    url.searchParams.get("ch");

  /* No item requested → serve the page untouched (its static tags apply). */
  if (!wanted) return;

  const response = await context.next();

  /* Only rewrite HTML. */
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  const item = await findItem(request, wanted);
  if (!item) return response;   /* unknown item → leave the page's own tags */

  const title = item.title || wanted;
  const img = absolute(itemImage(item));
  const desc =
    item.description ||
    item.notes ||
    item.note ||
    `${item.type || "A piece"} from the Ludicrous Chronicles.`;

  /* Strip markdown-ish syntax and collapse to a single tidy line. */
  const cleanDesc = String(desc)
    .replace(/[*_`#>\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  let html = await response.text();

  const fullTitle = `${title} — Ludicrous Chronicles`;
  html = setMeta(html, "property", "og:title", fullTitle);
  html = setMeta(html, "property", "og:description", cleanDesc);
  html = setMeta(html, "property", "og:url", url.toString());
  html = setMeta(html, "name", "twitter:title", fullTitle);
  html = setMeta(html, "name", "twitter:description", cleanDesc);
  html = setMeta(html, "name", "description", cleanDesc);

  if (img) {
    const small = previewVersion(img);
    html = setMeta(html, "property", "og:image", small);
    html = setMeta(html, "property", "og:image:secure_url", small);
    html = setMeta(html, "name", "twitter:image", small);
    html = setMeta(html, "property", "og:image:alt", title);
    /* jpg after transform */
    html = setMeta(html, "property", "og:image:type", "image/jpeg");
  }

  /* Also update the visible <title> so the tab/name matches the piece. */
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(fullTitle)}</title>`);

  return new Response(html, {
    status: response.status,
    headers: response.headers,
  });
}

/* ── netlify.toml registration ──────────────────────────────────────────────
   Add these to your netlify.toml:

   [[edge_functions]]
     path = "/gallery.html"
     function = "og-preview"

   [[edge_functions]]
     path = "/videos.html"
     function = "og-preview"

   [[edge_functions]]
     path = "/content.html"
     function = "og-preview"

   [[edge_functions]]
     path = "/chapter.html"
     function = "og-preview"
   ────────────────────────────────────────────────────────────────────────── */
