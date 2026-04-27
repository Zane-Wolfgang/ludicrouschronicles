const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) { block.push(lines[i].trim()); i++; }
      fm[key] = block.join(' ').trim();
    } else if (val === '|' || val === '|-') {
      let block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) { block.push(lines[i].slice(2)); i++; }
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
  if (typeof v === 'string') { const s = v.trim().toLowerCase(); return s === 'true' || s === 'yes' || s === '1'; }
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

// ── Build indexes ──

const galleryRaw = [...readDataDir('_data/gallery'), ...readDataDir('gallery')];
const gallery = galleryRaw.map(item => {
  const images = [item.image].filter(Boolean);
  if (item.image2) images.push(item.image2);
  if (item.image3) images.push(item.image3);
  if (item.image4) images.push(item.image4);
  return { ...item, images };
});
fs.writeFileSync('_data/gallery-index.json', JSON.stringify(gallery, null, 2));
console.log(`Gallery: ${gallery.length} items`);

const announcements = readDataDir('_data/announcements');
fs.writeFileSync('_data/announcements-index.json', JSON.stringify(announcements, null, 2));
console.log(`Announcements: ${announcements.length} items`);

const chapterNums = { 1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X' };

const chapters = readDataDir('_data/chapters').map(c => ({
  ...c, type: 'Chapter', label: 'Ghost in Me Book', filter_type: 'story',
  is_voice: toBool(c.is_voice),
  title: c.number == 1 ? c.title : ('Chapter ' + (chapterNums[parseInt(c.number)] || c.number) + ' \u2014 ' + c.title),
  href: c.number == 1 ? 'chapter-1.html' : ('chapter.html?chapter=' + c.number),
  thumbnail: c.art || '', body: c.body || ''
}));

const videos = readDataDir('_data/videos').map(v => ({
  ...v, type: 'Video', label: 'Video', filter_type: 'video',
  is_voice: toBool(v.is_voice), href: 'videos.html',
  description: v.description || '', thumbnail: v.thumbnail || ''
}));

const shortStories = readDataDir('_data/short-stories').map(s => {
  const slug = s.filename ? s.filename.replace('.md','') : s.title.toLowerCase().replace(/\s+/g,'-');
  return { ...s, slug, type: 'Short Story', label: 'Short Story', filter_type: 'story',
    href: `story.html?story=${slug}`, thumbnail: s.art || s.thumbnail || '' };
});

const wips = readDataDir('_data/wips').map(w => ({
  ...w, type: 'WIP', label: w.type || 'WIP', filter_type: 'behind',
  href: 'membership.html', thumbnail: w.image || ''
}));

const sortedChapters = [...chapters].sort((a,b) => parseInt(a.number||0) - parseInt(b.number||0));
const sortedOther = [...videos, ...shortStories, ...wips].sort((a,b) => new Date(b.date) - new Date(a.date));
const contentIndex = [...sortedChapters, ...sortedOther];

fs.writeFileSync('_data/content-index.json', JSON.stringify(contentIndex, null, 2));
console.log(`Content: ${contentIndex.length} items`);

fs.writeFileSync('_data/short-stories-index.json', JSON.stringify(shortStories, null, 2));
console.log(`Short Stories: ${shortStories.length} items`);

const socials = readDataDir('_data/socials')
  .filter(s => s.active !== false && s.active !== 'false')
  .sort((a, b) => (parseInt(a.order) || 99) - (parseInt(b.order) || 99));
fs.writeFileSync('_data/socials-index.json', JSON.stringify(socials, null, 2));
console.log(`Socials: ${socials.length} items`);

console.log('Build complete!');

// ── Newsletter ──

async function maybeSendNewsletter() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.log('No BREVO_API_KEY — skipping newsletter'); return; }

  let commitMsg = '';
  try {
    commitMsg = execSync('git log -1 --pretty=%s').toString().trim();
    console.log('Commit message:', commitMsg);
  } catch(e) { console.log('Could not read git log — skipping newsletter'); return; }

  const cmsPattern = /^(Create|Update)\s+(Chapters|Videos|Gallery|Announcements|Short Stories|Short_stories)\s+/i;
  if (!cmsPattern.test(commitMsg)) { console.log('Not a CMS publish commit — skipping newsletter'); return; }

  let character, quote, contentType, link, subject, title = '';

  if (/Chapters/i.test(commitMsg)) {
    const latest = sortedChapters[sortedChapters.length - 1] || chapters[0];
    title = latest ? latest.title : 'A New Chapter';
    character = 'Vasily'; contentType = 'Chapter';
    link = 'https://ludicrous-chronicles.netlify.app/content.html';
    subject = `${title} — Ludicrous Chronicles`;
    quote = `Ah, what delightful fortune brings you to my correspondence~! A new tale has unfurled itself, dear reader. Come — indulge me~.`;
  } else if (/Videos/i.test(commitMsg)) {
    const latest = videos[0];
    title = latest ? latest.title : 'A New Video';
    character = 'Jackson'; contentType = 'Video';
    link = 'https://ludicrous-chronicles.netlify.app/videos.html';
    subject = `${title} — Ludicrous Chronicles`;
    quote = `New picture's up. By all means, take it or leave it.`;
  } else if (/Gallery/i.test(commitMsg)) {
    const latest = gallery[0];
    title = latest ? latest.title : 'New Art';
    character = 'Rachel'; contentType = 'Gallery';
    link = 'https://ludicrous-chronicles.netlify.app/gallery.html';
    subject = `New in the Gallery — Ludicrous Chronicles`;
    quote = `Oh! Forgive the intrusion — why, I do hope I'm not bothering you — There is... a new work in the gallery, if you'd care to have a look.`;
  } else if (/Announcements/i.test(commitMsg)) {
    const latest = announcements[0];
    title = latest ? latest.title : 'News';
    character = 'Lizzie'; contentType = 'News';
    link = 'https://ludicrous-chronicles.netlify.app/news.html';
    subject = `${title} — Ludicrous Chronicles`;
    quote = `Oh, isn't this just the bee's knees! There's news — fresh off the press! Don't be a flat tire, honey, come have a look!`;
  } else if (/Short.Stories/i.test(commitMsg)) {
    const latest = shortStories[0];
    title = latest ? latest.title : 'A New Story';
    character = 'Vasily'; contentType = 'Short Story';
    link = 'https://ludicrous-chronicles.netlify.app/content.html';
    subject = `${title} — Ludicrous Chronicles`;
    quote = `Ah, what delightful fortune brings you to my correspondence~! A new tale has unfurled itself, dear reader. Come — indulge me~.`;
  }

  if (!character) { console.log('Could not determine content type — skipping newsletter'); return; }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0806;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0806;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2a2218;">
          <p style="margin:0;font-family:Georgia,serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#8a6e2f;">Ludicrous Chronicles</p>
        </td></tr>
        <tr><td style="padding:40px 0 24px;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8a6e2f;">${character}</p>
          <p style="margin:0;font-family:Georgia,serif;font-size:18px;line-height:1.7;color:#c9a84c;font-style:italic;">"${quote}"</p>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <table width="80" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:#8a6e2f;font-size:0;">&nbsp;</td></tr></table>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8a6e2f;">${contentType}</p>
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#e8d5a0;font-weight:normal;">${title}</p>
        </td></tr>
        <tr><td style="padding-bottom:48px;">
          <a href="${link}" style="display:inline-block;font-family:Georgia,serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#0a0806;background:#c9a84c;text-decoration:none;padding:14px 32px;">Come See</a>
        </td></tr>
        <tr><td style="border-top:1px solid #2a2218;padding-top:24px;text-align:center;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a3f2f;">Ludicrous Chronicles &nbsp;·&nbsp; Story, Art & Voice by Mistress Spite</p>
          <p style="margin:0;font-family:Georgia,serif;font-size:9px;color:#4a3f2f;">You signed up for updates. <a href="https://ludicrous-chronicles.netlify.app" style="color:#8a6e2f;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const contactsRes = await fetch(`https://api.brevo.com/v3/contacts?listId=3&limit=100`, {
      headers: { 'api-key': apiKey, 'accept': 'application/json' }
    });
    const contactsData = await contactsRes.json();

    // Deduplicate by email address — prevents double-sending if API returns duplicates
    const seen = new Set();
    const contacts = (contactsData.contacts || [])
      .filter(c => !c.emailBlacklisted && c.email)
      .filter(c => {
        if (seen.has(c.email.toLowerCase())) return false;
        seen.add(c.email.toLowerCase());
        return true;
      });

    if (contacts.length === 0) { console.log('No subscribers yet — skipping newsletter send'); return; }

    console.log(`Sending newsletter to ${contacts.length} subscriber(s)...`);

    let sent = 0;
    for (const contact of contacts) {
      try {
        const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'content-type': 'application/json', 'accept': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'Ludicrous Chronicles', email: 'zljr2008@gmail.com' },
            to: [{ email: contact.email }],
            subject,
            htmlContent: emailHtml,
            replyTo: { email: 'zljr2008@gmail.com', name: 'Ludicrous Chronicles' }
          })
        });
        if (sendRes.ok) {
          sent++;
          console.log(`Sent to ${contact.email}`);
        } else {
          const err = await sendRes.json();
          console.error(`Failed to send to ${contact.email}:`, err.message);
        }
      } catch(e) {
        console.error(`Error sending to ${contact.email}:`, e.message);
      }
    }

    console.log(`Newsletter sent to ${sent}/${contacts.length} subscribers`);
  } catch(e) {
    console.error('Newsletter send error:', e.message);
  }
}

maybeSendNewsletter().catch(e => console.error('Newsletter error:', e.message));
