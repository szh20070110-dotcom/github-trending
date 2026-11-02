// 把日报 Markdown 渲染成一个静态 HTML 页面（零依赖，正则解析表格）
import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

function pickLatest() {
  const dir = join(ROOT, 'report');
  try {
    const files = readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
    return files.length ? files[files.length - 1].replace(/\.md$/, '') : null;
  } catch {
    return null;
  }
}

const date = process.argv[2] || pickLatest();
if (!date) {
  console.error('report/ 下没有找到任何 .md 日报，先跑 fetch-github-trending.mjs');
  process.exit(1);
}
const mdPath = join(ROOT, 'report', `${date}.md`);

const md = await readFile(mdPath, 'utf8');
const lines = md.split(/\r?\n/);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

let title = 'GitHub 热门日报';
let quote = '';
let totalStars = 0;
const rows = [];
let trend = [];
let inTrend = false;

for (const line of lines) {
  if (line.startsWith('# ')) { title = line.slice(2).trim(); continue; }
  if (/^>\s?/.test(line) && !quote) { quote = line.replace(/^>\s?/, '').trim(); continue; }
  if (line.startsWith('## ')) { inTrend = line.includes('趋势'); continue; }
  if (inTrend && line.trim()) { trend.push(line.trim()); continue; }
  if (!line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (!cells.length || /^-+$/.test(cells[0].replace(/:/g, ''))) continue;
  if (cells[0] === '#') continue;
  const [rank, repo, lang, stars, comment] = cells;
  const num = Number(String(stars).replace(/[^\d]/g, '')) || 0;
  totalStars += num;
  rows.push({ rank, repo, lang, stars, comment, num });
}

const rowsHtml = rows
  .map(
    (r) => `<tr>
      <td class="rank">${esc(r.rank)}</td>
      <td class="repo">${inline(r.repo)}</td>
      <td class="lang"><span>${esc(r.lang || '—')}</span></td>
      <td class="stars">+${r.num.toLocaleString('en-US')}</td>
      <td class="comment">${inline(r.comment || '')}</td>
    </tr>`
  )
  .join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 48px 24px 72px;
    background: radial-gradient(1100px 520px at 50% -10%, #1b2740, #080b12 70%);
    color: #e8edf6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }
  .wrap { max-width: 1120px; margin: 0 auto; }
  .eyebrow { font-size: 12px; letter-spacing: 3px; color: #6f8cff; margin: 0 0 10px; }
  h1 { margin: 0 0 10px; font-size: 30px; letter-spacing: 0.5px; }
  .quote { margin: 0 0 26px; font-size: 13px; color: #93a1b8; }
  .stats { display: flex; gap: 12px; margin-bottom: 26px; flex-wrap: wrap; }
  .stat { padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); min-width: 130px; }
  .stat b { display: block; font-size: 20px; }
  .stat span { font-size: 12px; color: #8b9bb4; }
  table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 14px; overflow: hidden; }
  th { text-align: left; font-size: 12px; color: #8b9bb4; font-weight: 500; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  td { padding: 13px 14px; font-size: 13.5px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .rank { color: #6f8cff; font-weight: 600; width: 44px; }
  .repo a { color: #dfe7f5; text-decoration: none; font-weight: 600; }
  .repo a:hover { color: #6f8cff; }
  .lang span { font-size: 12px; padding: 2px 8px; border-radius: 99px; background: rgba(111,140,255,0.14); color: #a9bcff; white-space: nowrap; }
  .stars { color: #3ddc97; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .comment { color: #a7b4c8; line-height: 1.6; }
  .trend { margin-top: 26px; padding: 18px 20px; border-radius: 14px; background: rgba(61,220,151,0.06); border: 1px solid rgba(61,220,151,0.16); }
  .trend h2 { margin: 0 0 10px; font-size: 15px; color: #3ddc97; }
  .trend p { margin: 0; line-height: 1.8; color: #b9c6d8; font-size: 13.5px; }
  footer { margin-top: 28px; font-size: 12px; color: #6c7a90; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">GITHUB TRENDING · DAILY</p>
    <h1>${esc(title)}</h1>
    <p class="quote">${esc(quote)}</p>
    <div class="stats">
      <div class="stat"><b>${rows.length}</b><span>上榜仓库</span></div>
      <div class="stat"><b>+${totalStars.toLocaleString('en-US')}</b><span>今日合计新增星</span></div>
      <div class="stat"><b>${rows.length ? Math.round(totalStars / rows.length) : 0}</b><span>平均每仓库</span></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>仓库</th><th>语言</th><th>今日新增</th><th>点评</th></tr></thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>
    ${trend.length ? `<section class="trend"><h2>整体趋势</h2><p>${inline(trend.join(' '))}</p></section>` : ''}
    <footer>数据来源 GitHub Trending（今日）· 本页由 fetch-github-trending.mjs 的日报自动渲染</footer>
  </div>
</body>
</html>`;

const out = join(ROOT, 'report', `${date}.html`);
await writeFile(out, html, 'utf8');
console.log(`已写入 ${out}（${rows.length} 行）`);
