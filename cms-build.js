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
