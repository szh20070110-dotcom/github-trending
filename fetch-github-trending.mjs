#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://github.com/trending?since=daily';
const TOP_N = 10;
const ROOT = dirname(fileURLToPath(import.meta.url));
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const THEME_RULES = [
  [/agent|assistant|copilot|autonomous/i, 'AI 智能体'],
  [
    /\bllm\b|gpt|claude|openai|language model|foundation model|moe\b|\bmodels?\b|inference|serving|embedding/i,
    '大模型与推理',
  ],
  [/\bmcp\b|model context protocol/i, 'MCP 工具链'],
  [/scrap|crawl|spider|browser automation/i, '数据采集'],
  [/security|vulnerab|pentest|exploit|malware/i, '安全与逆向'],
  [/cli|terminal|command[- ]line|shell/i, '命令行工具'],
  [/tutorial|course|learn|guide|handbook|book/i, '学习教程'],
  [/awesome|curated|collection|resources/i, '资源合集'],
  [/wayland|compositor|window manager|tiling/i, '桌面环境'],
  [/framework|sdk|library|toolkit|boilerplate/i, '开发框架'],
  [/database|sql|storage|orm/i, '数据存储'],
  [/docker|kubernetes|devops|deploy|infra|ci\/cd/i, 'DevOps'],
  [/ui|design|component|css|animation/i, '界面与设计'],
  [/game|engine|graphics|render/i, '游戏与图形'],
  [/video|audio|image|media|ffmpeg/i, '多媒体'],
  [/api|server|backend|http|proxy/i, '后端服务'],
  [/browser|frontend|react|vue|web app/i, 'Web 前端'],
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function fetchHtml(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }
    console.warn(`第 ${attempt} 次抓取失败：${error.message}，2 秒后重试`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return fetchHtml(url, attempt + 1);
  }
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const safeCut = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut.trim()}…`;
}

function parseRepository(article) {
  const headerStart = article.indexOf('<h2');
  const headerEnd = article.indexOf('</h2>');
  if (headerStart === -1 || headerEnd === -1) {
    return null;
  }
  const header = article.slice(headerStart, headerEnd);
  const fullName = header.match(/href="\/([^"?#]+)"/)?.[1];
  if (!fullName || !fullName.includes('/')) {
    return null;
  }

  const descriptionHtml =
    article.match(/<p class="[^"]*color-fg-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
  const language = cleanText(
    article.match(/itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''
  );
  const starsToday = Number(
    (article.match(/([\d,]+)\s+stars?\s+today/i)?.[1] ?? '0').replace(/,/g, '')
  );
  const totalStars = Number(
    cleanText(
      article.match(/href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '0'
    ).replace(/,/g, '')
  );

  return {
    fullName,
    url: `https://github.com/${fullName}`,
    description: cleanText(descriptionHtml),
    language,
    starsToday,
    totalStars: Number.isFinite(totalStars) ? totalStars : 0,
  };
}

function parseTrending(html) {
  const articles =
    html.match(/<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>[\s\S]*?<\/article>/g) ?? [];
  return articles.map(parseRepository).filter(Boolean);
}

function detectTheme(repository) {
  const text = `${repository.fullName} ${repository.description}`;
  for (const [pattern, theme] of THEME_RULES) {
    if (pattern.test(text)) {
      return theme;
    }
  }
  const language = repository.language.toLowerCase();
  if (language === 'rust') return '系统工具';
  if (language === 'python') return '数据与脚本工具';
  if (language === 'typescript' || language === 'javascript') return 'Web 工具';
  if (language === 'go') return '服务端工具';
  if (language === 'c' || language === 'c++') return '底层系统';
  return '通用开发';
}

function buildComment(repository, rank) {
  const language = repository.language
    ? `基于 ${repository.language} 的`
    : '多语言实现的';
  const theme = detectTheme(repository);
  const detail = repository.description
    ? `围绕「${truncate(repository.description, 72)}」展开`
    : '仓库暂未提供简介';

  let heat;
  if (rank === 1) {
    heat = '单日新增领跑全榜，是今天最抢眼的爆款';
  } else if (rank <= 3) {
    heat = '稳居前三，热度处于第一梯队';
  } else if (repository.starsToday >= 800) {
    heat = '单日新增接近千星，正在快速破圈';
  } else if (repository.starsToday >= 300) {
    heat = '单日涨幅可观，扩散势头明显';
  } else {
    heat = '保持稳定增长，属于榜单长尾';
  }

  const separator = /^[A-Za-z]/.test(theme) ? ' ' : '';
  return `${language}${separator}${theme}项目，${detail}，${heat}。`;
}

function buildSummary(repositories) {
  const top = repositories.slice(0, TOP_N);
  if (top.length === 0) {
    return '本次未抓到有效数据。';
  }

  const total = top.reduce((sum, repository) => sum + repository.starsToday, 0);
  const average = Math.round(total / top.length);
  const languageCounter = new Map();
  for (const repository of top) {
    const key = repository.language || '未标注语言';
    languageCounter.set(key, (languageCounter.get(key) ?? 0) + 1);
  }
  const languages = [...languageCounter.entries()].sort((a, b) => b[1] - a[1]);
  const languageText = languages
    .slice(0, 3)
    .map(([name, count]) => `${name}（${count} 个）`)
    .join('、');
  const aiCount = top.filter(repository =>
    /agent|assistant|llm|gpt|claude|openai|\bmcp\b|language model|\bmodels?\b/i.test(
      `${repository.fullName} ${repository.description}`
    )
  ).length;
  const leader = top[0];
  const tail = top[top.length - 1];
  const gap = leader.starsToday - tail.starsToday;

  const sentences = [
    `本次 Top ${top.length} 合计新增约 ${total.toLocaleString('en-US')} 星，平均每个仓库单日 +${average.toLocaleString('en-US')} 星，头部项目吸走了大部分注意力。`,
    `语言分布上，${languageText}位居前列，${languages[0][0]} 是今天最活跃的技术栈。`,
    aiCount > 0
      ? `榜单中有 ${aiCount} 个项目直接围绕 AI / 智能体 / 大模型展开，说明“让 AI 真正动手做事”仍是当前最强的叙事。`
      : '榜单没有明显的单一主题，工具类与基础设施项目各自吸引了一批受众。',
    `榜首 ${leader.fullName} 比第十名多出约 ${gap.toLocaleString('en-US')} 星，${
      gap > average * 3
        ? '头部与长尾差距明显，热度高度集中'
        : '头部与长尾的差距不算悬殊，榜单竞争相对均衡'
    }。`,
  ];

  return sentences.join('');
}

function toCell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function buildMarkdown(repositories, date, fetchedAt) {
  const top = repositories.slice(0, TOP_N);
  const lines = [
    `# GitHub 热门日报 · ${date}`,
    '',
    `> 数据来源：[GitHub Trending（今日）](${SOURCE_URL}) · 抓取时间：${fetchedAt} · 榜单按“今日新增星数”降序`,
    '',
    `## Top ${top.length}`,
    '',
    '| # | 仓库 | 语言 | 今日新增 | 一句话点评 |',
    '|---:|---|---|---:|---|',
  ];

  for (const repository of top) {
    lines.push(
      `| ${repository.rank} | [${repository.fullName}](${repository.url}) | ${toCell(
        repository.language || '—'
      )} | +${repository.starsToday.toLocaleString('en-US')} | ${toCell(
        repository.comment
      )} |`
    );
  }

  lines.push('', '## 整体趋势', '', buildSummary(repositories), '');
  return lines.join('\n');
}

async function main() {
  const now = new Date();
  const date = formatDate(now);
  const fetchedAt = formatDateTime(now);

  console.log(`抓取 ${SOURCE_URL} …`);
  let html = '';
  let offline = false;
  try {
    html = await fetchHtml(SOURCE_URL);
  } catch (error) {
    offline = true;
    console.warn(`在线抓取失败（${error.message}），改用上次缓存 data/trending.json`);
  }
  const cached = offline
    ? JSON.parse(await readFile(join(ROOT, 'data', 'trending.json'), 'utf8'))
    : null;
  const repositories = (offline ? (cached.repositories || []) : parseTrending(html))

  if (repositories.length === 0) {
    throw new Error('页面结构可能已变化，未能解析出任何仓库');
  }

  const payload = {
    source: SOURCE_URL,
    date,
    fetchedAt,
    generatedAt: now.toISOString(),
    totalRepositories: repositories.length,
    repositories,
  };

  await mkdir(join(ROOT, 'data'), { recursive: true });
  await mkdir(join(ROOT, 'report'), { recursive: true });

  const jsonPath = join(ROOT, 'data', 'trending.json');
  const markdownPath = join(ROOT, 'report', `${date}.md`);

  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  let markdown = buildMarkdown(repositories, date, fetchedAt);
  if (offline) markdown = '> 本次实时抓取失败，以下为上次成功缓存的榜单（' + cached.fetchedAt + '）\n\n' + markdown;
  await writeFile(markdownPath, markdown, 'utf8');

  console.log(`已写入 ${jsonPath}`);
  console.log(`已写入 ${markdownPath}`);
  console.log(`共抓取 ${repositories.length} 个仓库，Top ${TOP_N} 日报已生成`);
}

main().catch(error => {
  console.error(`抓取失败：${error.message}`);
  process.exitCode = 1;
});
