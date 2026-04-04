const fs = require('fs');
const path = require('path');

// Parse frontmatter from markdown files
process.on('uncaughtException', err => { console.error('CRASH:', err); process.exit(1); });
function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---([\s\S]*)$/);
  if (!match) return {};
  const fm = {};
  const lines = match[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val === '>-' || val === '>') {
      // YAML block scalar — collect indented lines
      let block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        block.push(lines[i].trim());
        i++;
      }
      fm[key] = block.join(' ').trim();
    } else if (val === '|' || val === '|-') {
      // Literal block scalar
      let block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        block.push(lines[i].slice(2));
        i++;
      }
      fm[key] = block.join('\n').trim();
    } else {
      fm[key] = val.replace(/^["']|["']$/g, '');
      i++;
    }
  }
  // Body content below frontmatter
  const body = match[2] ? match[2].trim() : '';
  if (body) fm.body = body;
  return fm;
}

function readDataDir(dir) {
  // Try both relative path and path relative to this script
  const dirs = [
    dir,
    path.join(__dirname, dir),
  ];
  for (const d of dirs) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d).filter(f => f.endsWith('.md') && !f.startsWith('.'));
      if (files.length > 0) {
        return files.map(f => {
          const content = fs.readFileSync(path.join(d, f), 'utf8');
          return { ...parseFrontmatter(content), filename: f };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
      }
    }
  }
  return [];
}

// Generate gallery index — read from both locations since CMS sometimes saves to wrong folder
const galleryRaw = [
  ...readDataDir('_data/gallery'),
  ...readDataDir('gallery'),
];
// Build slideshow arrays from image2/3/4 fields
const gallery = galleryRaw.map(item => {
  const images = [item.image].filter(Boolean);
  if (item.image2) images.push(item.image2);
  if (item.image3) images.push(item.image3);
  if (item.image4) images.push(item.image4);
  return { ...item, images };
});
fs.writeFileSync('_data/gallery-index.json', JSON.stringify(gallery, null, 2));
console.log(`Gallery: ${gallery.length} items`);
console.log('Gallery dirs checked:', ['_data/gallery','gallery'].map(d => d + ': ' + (require('fs').existsSync(d) ? require('fs').readdirSync(d).length + ' files' : 'missing')));

// Generate announcements index
const announcements = readDataDir('_data/announcements');
fs.writeFileSync('_data/announcements-index.json', JSON.stringify(announcements, null, 2));
console.log(`Announcements: ${announcements.length} items`);

// Generate content index (chapters + videos + short stories + wips)
const chapterNums = { 1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X' };
const chapters = readDataDir('_data/chapters').map(c => ({
  ...c,
  type: 'Chapter',
  label: 'Ghost in Me Book',
  filter_type: 'story',
  title: c.number == 1 ? c.title : ('Chapter ' + (chapterNums[parseInt(c.number)] || c.number) + ' \u2014 ' + c.title),
  href: c.number == 1 ? 'chapter-1.html' : ('chapter.html?chapter=' + c.number),
  thumbnail: c.art || '',
  body: c.body || ''
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

// Chapters sorted by number, everything else newest first
const sortedChapters = [...chapters].sort((a,b) => parseInt(a.number||0) - parseInt(b.number||0));
const sortedOther = [...videos, ...shortStories, ...wips].sort((a,b) => new Date(b.date) - new Date(a.date));
const contentIndex = [...sortedChapters, ...sortedOther];

fs.writeFileSync('_data/content-index.json', JSON.stringify(contentIndex, null, 2));
console.log(`Content: ${contentIndex.length} items`);

console.log('Build complete!');

// Generate short stories index (reuse existing shortStories variable)
const shortStoriesIndexed = shortStories.map(s => ({
  ...s,
  slug: s.filename ? s.filename.replace('.md','') : s.title.toLowerCase().replace(/\s+/g,'-'),
  type: 'Story',
  label: 'Short Story',
  filter_type: 'story',
  href: `story.html?story=${s.filename ? s.filename.replace('.md','') : s.title.toLowerCase().replace(/\s+/g,'-')}`,
  thumbnail: s.art || s.thumbnail || '',
  description: s.description || ''
}));
fs.writeFileSync('_data/short-stories-index.json', JSON.stringify(shortStoriesIndexed, null, 2));
console.log(`Short Stories: ${shortStoriesIndexed.length} items`);

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

// ── Image compression ──
// Compresses images in images/uploads/ to max 1200px wide
// Originals are preserved, compressed versions overwrite for web serving
const sharp = require('sharp');

async function compressImages() {
  const uploadsDir = 'images/uploads';
  if (!fs.existsSync(uploadsDir)) return;

  const files = fs.readdirSync(uploadsDir).filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.')
  );

  let compressed = 0;
  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const tmpPath = filePath + '.tmp';
    try {
      const meta = await sharp(filePath).metadata();
      // Only compress if wider than 1200px or larger than 500KB
      const stats = fs.statSync(filePath);
      if (meta.width <= 2400 && stats.size <= 2048000) continue;

      await sharp(filePath)
        .resize({ width: 2400, withoutEnlargement: true })
        .jpeg({ quality: 93, progressive: true })
        .toFile(tmpPath);

      fs.renameSync(tmpPath, filePath);
      compressed++;
    } catch(e) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }
  console.log(`Images compressed: ${compressed} of ${files.length}`);
}

compressImages().catch(console.error);
