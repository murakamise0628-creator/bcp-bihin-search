const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function walkHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) return walkHtml(file);
    return file.endsWith('.html') ? [file] : [];
  });
}

const files = [
  path.join(root, 'index.html'),
  ...walkHtml(path.join(root, 'pages')),
  ...walkHtml(path.join(root, 'topics'))
];
const knownFiles = new Set(files.map((file) => path.resolve(file)));
const forbidden = /編集方針|参考サイトから反映|反映した入口|TOPの上部|商品取得を改善|取得条件|プロンプト|作業メモ|AI臭|UI上|次工程/;
const issues = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) issues.push(`${relative}: H1 must appear once`);
  if (!html.includes('G-LN824MSD7X')) issues.push(`${relative}: GA4 tag missing`);
  if (!/<title>[^<]+<\/title>/.test(html)) issues.push(`${relative}: title missing`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) issues.push(`${relative}: description missing`);
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1] || '';
  if (description.length < 70) issues.push(`${relative}: description is too short for a useful summary`);
  if (!/<link rel="canonical" href="[^"]+">/.test(html)) issues.push(`${relative}: canonical missing`);
  if (!/<meta property="og:title" content="[^"]+">/.test(html)) issues.push(`${relative}: OGP title missing`);
  if (!/<meta property="og:description" content="[^"]+">/.test(html)) issues.push(`${relative}: OGP description missing`);
  if (!/<meta property="og:url" content="[^"]+">/.test(html)) issues.push(`${relative}: OGP URL missing`);
  if (!/<meta name="twitter:card" content="[^"]+">/.test(html)) issues.push(`${relative}: Twitter Card missing`);
  if (forbidden.test(html)) issues.push(`${relative}: production-side wording found`);
  if (/<<<<<<<|=======|>>>>>>>/.test(html)) issues.push(`${relative}: conflict marker found`);
  if (!html.includes('source-references')) issues.push(`${relative}: public source section missing`);
  if (!html.includes('www.bousai.go.jp')) issues.push(`${relative}: Cabinet Office citation missing`);
  if (!html.includes('"citation":[')) issues.push(`${relative}: WebPage citation metadata missing`);

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(match[1]); } catch { issues.push(`${relative}: invalid JSON-LD`); }
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    try {
      const url = new URL(match[1], `https://jigyousho-bousai.com/${relative.replaceAll('\\', '/')}`);
      if (url.hostname !== 'jigyousho-bousai.com' || !url.pathname.endsWith('.html')) continue;
      const linkedFile = path.resolve(root, url.pathname.replace(/^\//, ''));
      if (!knownFiles.has(linkedFile)) issues.push(`${relative}: broken internal link ${url.pathname}`);
    } catch { issues.push(`${relative}: invalid link ${match[1]}`); }
  }
}

const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8'));
for (const page of data.pages || []) {
  if ((page.products || []).length < 8) issues.push(`${page.slug}: fewer than 8 products`);
}

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!/User-agent: OAI-SearchBot\s+Allow: \//.test(robots)) issues.push('robots.txt: OAI-SearchBot is not explicitly allowed');
if (!robots.includes(`Sitemap: https://jigyousho-bousai.com/sitemap.xml`)) issues.push('robots.txt: sitemap declaration missing');

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`Site verification passed: ${files.length} HTML files`);
