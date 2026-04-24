const fs = require('fs');
const path = require('path');

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
      let block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        block.push(lines[i].trim());
        i++;
      }
      fm[key] = block.join(' ').trim();
    } else if (val === '|' || val === '|-') {
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
  const body = match[2] ? match[2].trim() : '';
  if (body) fm.body = body;
  return fm;
}

function toBool(v) {
  if (v === true || v === false) return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
  }
  return false;
}

function readDataDir(dir) {
  const dirs = [dir, path.join(__dirname, dir)];
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

// Gallery index
const galleryRaw = [
  ...readDataDir('_data/gallery'),
  ...readDataDir('gallery'),
];
const gallery = galleryRaw.map(item => {
  const images = [item.image].filter(Boolean);
  if (item.image2) images.push(item.image2);
  if (item.image3) images.push(item.image3);
  if (item.image4) images.push(item.image4);
  return { ...item, images };
});
fs.writeFileSync('_data/gallery-index.json', JSON.stringify(gallery, null, 2));
console.log(`Gallery: ${gallery.length} items`);

// Announcements index
const announcements = readDataDir('_data/announcements');
fs.writeFileSync('_data/announcements-index.json', JSON.stringify(announcements, null, 2));
console.log(`Announcements: ${announcements.length} items`);

// Content index
const chapterNums = { 1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X' };

const chapters = readDataDir('_data/chapters').map(c => ({
  ...c,
  type: 'Chapter',
  label: 'Ghost in Me Book',
  filter_type: 'story',
  is_voice: toBool(c.is_voice),
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
  is_voice: toBool(v.is_voice),
  href: 'videos.html',
  description: v.description || '',
  thumbnail: v.thumbnail || ''
}));

const shortStories = readDataDir('_data/short-stories').map(s => {
  const slug = s.filename ? s.filename.replace('.md','') : s.title.toLowerCase().replace(/\s+/g,'-');
  return {
    ...s,
    slug,
    type: 'Short Story',
    label: 'Short Story',
    filter_type: 'story',
    href: `story.html?story=${slug}`,
    thumbnail: s.art || s.thumbnail || ''
  };
});

const wips = readDataDir('_data/wips').map(w => ({
  ...w,
  type: 'WIP',
  label: w.type || 'WIP',
  filter_type: 'behind',
  href: 'membership.html',
  thumbnail: w.image || ''
}));

const sortedChapters = [...chapters].sort((a,b) => parseInt(a.number||0) - parseInt(b.number||0));
const sortedOther = [...videos, ...shortStories, ...wips].sort((a,b) => new Date(b.date) - new Date(a.date));
const contentIndex = [...sortedChapters, ...sortedOther];

fs.writeFileSync('_data/content-index.json', JSON.stringify(contentIndex, null, 2));
console.log(`Content: ${contentIndex.length} items`);

// Short stories index
fs.writeFileSync('_data/short-stories-index.json', JSON.stringify(shortStories, null, 2));
console.log(`Short Stories: ${shortStories.length} items`);

// Socials index
const socials = readDataDir('_data/socials')
  .filter(s => s.active !== false && s.active !== 'false')
  .sort((a, b) => (parseInt(a.order) || 99) - (parseInt(b.order) || 99));
fs.writeFileSync('_data/socials-index.json', JSON.stringify(socials, null, 2));
console.log(`Socials: ${socials.length} items`);

console.log('Build complete!');
