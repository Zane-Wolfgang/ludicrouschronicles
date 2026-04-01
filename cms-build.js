const fs = require('fs');
const path = require('path');

// Parse frontmatter from markdown files
function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);
  if (!match) return {};
  const fm = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });
  // Capture body content below the frontmatter
  const body = match[2] ? match[2].trim() : '';
  if (body) fm.body = body;
  return fm;
}

function readDataDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      return { ...parseFrontmatter(content), filename: f };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Generate gallery index
const gallery = readDataDir('_data/gallery');
fs.writeFileSync('_data/gallery-index.json', JSON.stringify(gallery, null, 2));
console.log(`Gallery: ${gallery.length} items`);

// Generate announcements index
const announcements = readDataDir('_data/announcements');
fs.writeFileSync('_data/announcements-index.json', JSON.stringify(announcements, null, 2));
console.log(`Announcements: ${announcements.length} items`);

// Generate content index (chapters + videos + short stories + wips)
const chapters = readDataDir('_data/chapters').map(c => ({
  ...c,
  type: 'Story',
  label: 'Chapter Art',
  filter_type: 'story',
  href: c.number == 1 ? 'chapter-1.html' : `chapter.html?chapter=${c.number}`,
  thumbnail: c.art || ''
}));

const videos = readDataDir('_data/videos').map(v => ({
  ...v,
  type: 'Video',
  label: 'Video',
  filter_type: 'video',
  href: 'videos.html',
  description: v.description || '',
  thumbnail: v.thumbnail || ''
}));

const shortStories = readDataDir('_data/short-stories').map(s => ({
  ...s,
  type: 'Short Story',
  label: 'Short Story',
  filter_type: 'story',
  href: 'membership.html',
  thumbnail: ''
}));

const wips = readDataDir('_data/wips').map(w => ({
  ...w,
  type: 'WIP',
  label: w.type || 'WIP',
  filter_type: 'behind',
  href: 'membership.html',
  thumbnail: w.image || ''
}));

const contentIndex = [...chapters, ...videos, ...shortStories, ...wips]
  .sort((a, b) => new Date(b.date) - new Date(a.date));

fs.writeFileSync('_data/content-index.json', JSON.stringify(contentIndex, null, 2));
console.log(`Content: ${contentIndex.length} items`);

console.log('Build complete!');

// Generate socials index
const socials = readDataDir('_data/socials')
  .filter(s => s.active !== false && s.active !== 'false')
  .sort((a, b) => (parseInt(a.order) || 99) - (parseInt(b.order) || 99));
fs.writeFileSync('_data/socials-index.json', JSON.stringify(socials, null, 2));
console.log(`Socials: ${socials.length} items`);

// ── Inject CMS content cards into content.html ──
const fs2 = require('fs');
const contentHtml = fs2.readFileSync('content.html', 'utf8');

// Read hardcoded titles to skip
const hardcodedTitles = [
  'The Beginning',
  'Chapter I \u2014 The Beginning',
  'Happy Birthday',
  "Don't You Miss Your Legs?",
  'Blue Threads',
  'A Helping Hand',
  'Nobody Special'
];

// Build cards from content index
const allContent = JSON.parse(fs2.readFileSync('_data/content-index.json', 'utf8'));
let newCards = '';

allContent.forEach(item => {
  if (hardcodedTitles.includes(item.title)) return;

  const isLocked = item.tier !== 'free';
  const href = isLocked ? 'membership.html' : (item.type === 'Video' ? `videos.html?play=${encodeURIComponent(item.title)}` : (item.href || '#'));
  const thumb = item.thumbnail || '';
  const filterType = item.type === 'Video' ? 'video' : (item.filter_type || 'story');
  const thumbStyle = thumb ? `background-image:url('${thumb}');background-size:cover;background-position:center;` : '';
  const blurClass = isLocked ? ' blurred' : '';
  const blurOverlay = isLocked ? '<div class="blur-overlay"></div>' : '';
  const lockIcon = isLocked ? `<div class="content-lock"><svg viewBox="0 0 10 12"><rect x="2" y="5" width="6" height="6" rx="1"/><path d="M3 5V3.5a2 2 0 014 0V5" stroke-width="1.2" stroke="#8a6e2f" fill="none"/></svg></div>` : '';
  const tierLabel = isLocked ? `${item.type} \u00b7 ${item.tier === 'devoted' ? 'Patron' : 'Bound'}` : item.type;
  const desc = isLocked ? 'Members only.' : '';

  newCards += `
      <a href="${href}" class="content-card" data-type="${filterType}">
        <div class="content-thumb${blurClass}" style="${thumbStyle}">
          ${blurOverlay}
          <span class="content-thumb-label" style="position:relative;z-index:1;">${item.label || item.type}</span>
          ${lockIcon}
        </div>
        <div class="content-info">
          <div class="content-type">${tierLabel}</div>
          <div class="content-title">${item.title}</div>
          <div class="content-desc">${desc}</div>
        </div>
      </a>`;
});

// Replace CMS-injected cards section (between markers)
let updatedHtml;
if (contentHtml.includes('<!-- CMS-START -->') && contentHtml.includes('<!-- CMS-END -->')) {
  updatedHtml = contentHtml.replace(
    /<!-- CMS-START -->[\s\S]*?<!-- CMS-END -->/,
    `<!-- CMS-START -->${newCards}\n      <!-- CMS-END -->`
  );
} else {
  // First run — insert markers
  updatedHtml = contentHtml.replace(
    '\n    </div>\n\n    <div class="members-cta">',
    `\n      <!-- CMS-START -->${newCards}\n      <!-- CMS-END -->\n    </div>\n\n    <div class="members-cta">`
  );
}

fs2.writeFileSync('content.html', updatedHtml);
console.log(`Content cards injected: ${allContent.filter(i => !hardcodedTitles.includes(i.title)).length}`);

