# GitHub 热门日报

每天抓取 [GitHub Trending 日榜](https://github.com/trending?since=daily)，解析仓库名、描述、语言和今日新增星数，生成结构化数据与中文日报。

只用 Node.js 内置模块和全局 `fetch`，零第三方依赖。

## 环境要求

- Node.js 18 或更高版本（18+ 才有内置 `fetch`）
- 能访问 `https://github.com`

## 运行

```bash
node fetch-github-trending.mjs
```

运行完成后生成：

```text
data/trending.json      # 当日完整榜单（含排名、仓库、描述、语言、今日/总星数、点评）
report/YYYY-MM-DD.md    # Top 10 中文日报，按今日新增星数排序
```

`data/trending.json` 字段示例：

```json
{
  "source": "https://github.com/trending?since=daily",
  "date": "2026-11-03",
  "fetchedAt": "2026-11-03 09:00:12",
  "totalRepositories": 25,
  "repositories": [
    {
      "rank": 1,
      "pageRank": 3,
      "fullName": "owner/repo",
      "url": "https://github.com/owner/repo",
      "description": "仓库描述",
      "language": "Rust",
      "starsToday": 2243,
      "totalStars": 8924,
      "comment": "一句话点评"
    }
  ]
}
```

`rank` 是今日新增星数排名，`pageRank` 是该仓库在 Trending 页面上的原始位置。

可调整 `fetch-github-trending.mjs` 顶部的 `SOURCE_URL`（例如改成 `since=weekly`）和 `TOP_N`（日报条数）。

## Windows：每天 9 点自动执行

仓库根目录的 `run-daily.cmd` 会进入脚本目录、创建 `logs/` 并追加运行日志，任务计划程序直接调用它即可。

### 方式一：图形界面

1. 按 `Win + R`，输入 `taskschd.msc`，打开“任务计划程序”。
2. 右侧点击“创建基本任务”，名称填 `GitHubTrendingDaily`。
3. 触发器选“每天”，时间填 `09:00`。
4. 操作选“启动程序”：
   - 程序或脚本：`C:\Users\szh\Desktop\你还爱队不队\github-trending\run-daily.cmd`
   - 起始于：`C:\Users\szh\Desktop\你还爱队不队\github-trending`
5. 完成后在任务上右键“运行”测试一次，查看 `logs/daily.log`。
6. 建议在任务“属性”里：
   - “常规”勾选“不管用户是否登录都要运行”（需要输入当前用户密码）；
   - “条件”取消“只有在计算机使用交流电源时才启动”，避免笔记本用电池时跳过。

### 方式二：命令行（管理员 CMD）

```bat
schtasks /Create /TN "GitHubTrendingDaily" /TR "C:\Users\szh\Desktop\你还爱队不队\github-trending\run-daily.cmd" /SC DAILY /ST 09:00 /F
```

手动触发一次：

```bat
schtasks /Run /TN "GitHubTrendingDaily"
```

删除任务：

```bat
schtasks /Delete /TN "GitHubTrendingDaily" /F
```

如果项目路径包含空格，`/TR` 的路径需要额外转义为 `\"...\"`，或直接把项目放在无空格路径下。

> 注意：任务计划程序运行时的工作目录不是项目目录，因此 `run-daily.cmd` 用 `%~dp0` 定位自身，`fetch-github-trending.mjs` 用 `import.meta.url` 定位输出目录，不依赖当前工作目录。

## macOS / Linux：cron 每天 9 点

```bash
crontab -e
```

加入一行（把路径换成实际项目路径，`node` 换成 `command -v node` 的结果）：

```cron
0 9 * * * cd /path/to/github-trending && mkdir -p logs && /usr/bin/node fetch-github-trending.mjs >> logs/daily.log 2>&1
```

查看是否生效：

```bash
crontab -l
tail -f logs/daily.log
```

cron 使用系统本地时区；如果机器时区不是东八区，需要先调整 `TZ` 或换算执行时间。

## 说明

- 日报中的“一句话点评”和“整体趋势”由脚本按语言、描述关键词、星数档位规则生成，属于自动摘要，不是人工编辑。
- GitHub 可能对高频请求限流或调整页面结构；脚本已对失败请求重试 3 次，若长期失败请检查网络或更新解析规则。
- 每日运行会覆盖同一天的 `report/YYYY-MM-DD.md` 与 `data/trending.json`，历史日报按日期保留。