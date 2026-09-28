# 海外零预算推广计划（调研稿）

**状态**：只读调研。本文件不改站点代码，也不代表已经在任何平台发帖、注册或联系版主。  
**调研日期**：2026-09-28。  
**站点**：GitHub Pages **项目站**（子路径，不是域名根）。

| 版本 | 网址 |
| --- | --- |
| 简体 | https://1019666077-bit.github.io/wx-extract-mvp/ |
| 繁体 | https://1019666077-bit.github.io/wx-extract-mvp/zh-hant/ |
| 站点地图 | https://1019666077-bit.github.io/wx-extract-mvp/sitemap.xml |

2026-09-28 实测：站点地图含 **172** 个 `<loc>`。`https://1019666077-bit.github.io/robots.txt` 返回 GitHub Pages「Site not found」（HTTP 404，该账号没有用户站）。项目路径上的 `robots.txt` 可以打开，但爬虫不会把它当成这个主机的 robots 文件，见下文。

**前 14 天对外只推免费部分**：Level 1 第 1–5 课、打卡、错题本。仓库里的开通页（`pricing.html`）目前仍是微信人工收款，月付 ¥39 / 季卡 ¥99。任务说明里的 Waffo 美元价（30 天 US$5.99、90 天 US$13.99）尚未写进这个页面。美元价和结账链接等开通页改完再写。海外帖子里不要留微信号。

---

## 1. 搜索引擎提交

现在能用的资源类型只有 **网址前缀资源**。域名资源要往 DNS 里加记录，而 `github.io` 的 DNS 不在本仓库主人手里。Google 也不接受把公共后缀本身做成域名资源，所以不要去验证 `github.io`。

要添加的前缀（带协议、带结尾斜线）：

```text
https://1019666077-bit.github.io/wx-extract-mvp/
```

这一条已经盖住简体和 `/zh-hant/`。Google 写明：父资源验证之后，用同一方法添加的子资源会自动视为已验证。想把繁体单独看报表时，可以再加 `https://1019666077-bit.github.io/wx-extract-mvp/zh-hant/`。小站先用一条即可，成效报表里按网页过滤。

### 1.1 Google Search Console

入口：[Search Console](https://search.google.com/search-console)。步骤以 [添加资源](https://support.google.com/webmasters/answer/34592) 和 [验证所有权](https://support.google.com/webmasters/answer/9008080) 为准。

1. 用准备长期持有的 Google 账号登录。属性选择器里选 **+ 添加资源**。
2. 选 **网址前缀**，填上面的完整前缀。不要选「网域」。
3. 选一种下面写明的验证方式，部署到线上，用无痕窗口确认能公开打开，再点 **验证**。验证码和账号绑定，删掉之后权限会失效。Google 用 Google Site Verifier 定期复查。
4. 数据从有人把资源加进账号就开始记，验证前也会记，但通常要几天才会出现在报表里。

#### 在 github.io 子路径上可用的验证

| 方式 | 现在能否用 | 仓库里要放什么 |
| --- | --- | --- |
| HTML 文件 | 能。网址前缀可用，网域资源不可用 | 向导下载的那个文件，原样放在**仓库根目录**。线上地址必须是 `https://1019666077-bit.github.io/wx-extract-mvp/<向导给的文件名>`。文件名和正文都不要改。Google 找这个文件时不跟随跨网域重定向 |
| HTML 标记 | 能。网址前缀可用，网域资源不可用 | 向导给出的标记，放进**简体首页** `<head>`。官方示例是 `<meta name="google-site-verification" content="向导给出的字符串">`。标记要出现在未登录用户打开该前缀时实际落到的页面源码里，并且位于文件前 2MB 内 |
| Google Analytics / 代码管理工具 | 只有首页已经放了对应片段、且该 Google 账号有权限时才行 | 本站首页目前没有这两段代码。不要为了验证单独加 |
| DNS / 网域 | 不能 | 需要能改这个主机的 DNS。`github.io` 做不到 |

HTML 文件是更稳的一种：`js/seo-pages.js` 的 `patchSitePage` 会整段替换 `<!--seo:start-->` 到 `<!--seo:end-->`。验证标记若写进这个区间，下次 `node scripts/build-pages.js` 会把它盖掉。标记若仍要用，放在 `<!--seo:end-->` 之后、`</head>` 之前。构建脚本按文件名写出页面，不会主动删掉仓库根目录里一个额外的 `google….html`。

GitHub Pages 默认可能走 Jekyll。本次没有改仓库，也没有在线上放验证文件，所以 **Jekyll 会不会漏掉某个验证文件，尚未实测**。验证时用无痕窗口打开文件地址；若是 404，再查是不是被 Jekyll 排除。这是部署时要看的一点，不是本调研已经踩过的结果。

#### 提交站点地图

站点地图已经在：

```text
https://1019666077-bit.github.io/wx-extract-mvp/sitemap.xml
```

172 条网址，含 `zh-Hans`、`zh-Hant`、`x-default`。单文件上限是 50,000 条网址或未压缩 50MB，这份用不到拆分。[Google 的站点地图说明](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) 写明：站点地图可以放在子目录，但**除非从 Search Console 提交**，否则它只影响所在目录的下级。子路径站必须手动提交。

[站点地图报告](https://support.google.com/webmasters/answer/7451001) 的步骤：

1. 资源需要所有者权限。
2. 打开站点地图报告。输入框前面通常已经是资源前缀，填 `sitemap.xml`。若输入框要完整网址，则贴上表中的完整地址。
3. 提交后看状态。成功只表示 Google 收到了这份清单，不保证 172 页都会编入索引。
4. 只提交这一份。简繁已经在同一份里用 `xhtml:link` 标好。

项目里的 `robots.txt` 写了 `Sitemap:` 行，但爬虫读的是主机根。Google 帮助页 [Create a robots.txt file](https://support.google.com/webmasters/answer/6062596) 写明：要管 `http://www.example.com/` 以下的网址，robots.txt 必须放在 `http://www.example.com/robots.txt`，不能放在子目录（页面举的例子是 `http://example.com/pages/robots.txt`）。2026-09-28 主机根返回 404，所以这份 `Sitemap:` 现在不会被自动发现。可选的补救是另建一个用户站仓库，只放 `https://1019666077-bit.github.io/robots.txt`，里面指向项目站点地图。那是另一个仓库，本计划不实现。没有用户站时，Search Console 手动提交就是正路。

#### 网址检查与请求编入索引

工具说明：[网址检查工具](https://support.google.com/webmasters/answer/9012289)。

1. 在已验证资源顶部的检查框贴上完整网址。
2. 看「网页是否已编入索引」。若要看线上实况，跑实时检查。
3. 实时检查认为可以编入索引时，才会出现 **请求编入索引**。点下去只是进入队列。官方写明：通常大约一天，有时要一两周；提交不保证出现在索引里。
4. 官方只说「每天能提交的索引请求有上限」，**没有公布数字**。博客里常见的「每天 10 到 20 条」不是 Google 文档，本计划不采用那个数字。出现配额提示就停，其余交给站点地图。
5. Indexing API 的默认额度是每个云端项目每天 200 次发布，但只适用于带 `JobPosting` 或嵌在 `VideoObject` 里的 `BroadcastEvent` 的页面。本站用不上。网址检查 API 也不能代替「请求编入索引」按钮。

前 14 天手动请求的优先页（各做一次即可）：

- 简体首页、繁体首页
- 简繁两边的 Level 1 第 1–5 课（会写进帖子里的落地页）

其余课程页、打卡、错题本、开通页靠站点地图。不要把带 UTM 的网址送去请求编入索引。页面的 canonical 已经指向不带参数的地址。

### 1.2 Bing 网站管理员工具

入口：[Bing Webmaster Tools](https://www.bing.com/webmasters)。2025-06-17 的官方说明：[Start Using Bing Webmaster Tools](https://blogs.bing.com/webmaster/June-2025/Start-Using-Bing-Webmaster-Tools-to-Improve-Your-Site-Visibility)。验证细节：[Add and Verify site](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)。

Bing 的索引还会进 Yahoo、DuckDuckGo、Microsoft Copilot 等使用 Bing 索引的产品。Google 不收 IndexNow。

1. 用 Microsoft、Google 或 Facebook 账号登录。
2. 最快的路径：Google Search Console 验证完成之后，选 **从 Google Search Console 导入**。Bing 会读已验证资源和站点地图，导入后视为已验证，不必再传文件。导入上限一次 100 个网站；账号总上限 1,000。[导入说明](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)（文内写有后续更新）。Bing 会定期回查 Search Console 权限，断开之后要重连或改用别的验证。
3. 若手动添加：填同一个前缀 `https://1019666077-bit.github.io/wx-extract-mvp/`。`github.io` 没有 Domain Connect，向导会落到另外三种：XML 文件、meta 标记、DNS CNAME。DNS 同样做不到。

手动验证时，向导给出的文件或标记以屏幕上的为准：

| 方式 | 仓库里要放什么 |
| --- | --- |
| XML 文件 | 下载 `BingSiteAuth.xml`，放到**仓库根目录**。线上应能打开 `https://1019666077-bit.github.io/wx-extract-mvp/BingSiteAuth.xml`。官方表述是「注册网站的根目录」；注册的是项目前缀时，根就是这个前缀，不是 `https://1019666077-bit.github.io/` |
| Meta 标记 | 贴进简体首页 `<head>`，位置规则与 Google 标记相同，避开会被构建脚本覆盖的 `seo` 区间。公开教程里常见 `<meta name="msvalidate.01" content="…">`。**本次打开的官方帮助页只说「复制画面上的标记」**，没有把属性名写死，所以以向导原文为准，不要手打一个记得的名字 |

站点地图：左侧 **Sitemaps**，提交完整网址 `https://1019666077-bit.github.io/wx-extract-mvp/sitemap.xml`。[2025-07 的站点地图说明](https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search) 写明：提交后 Bing 会尽快抓取，之后大约每天再读一次。看提交状态、最后读取时间和错误。第三方文章常写 Bing 要完整网址、Google 的输入框常常只要相对路径；若某一边报错，换另一种贴法再试。这个差异不是 Bing 帮助页的原文，实施时以当时输入框的提示为准。

网址检查：同一篇 2025-06 官方文章列出了 **URL Inspection**，可看索引状态、HTTP 状态和被挡资源。对优先的 12 个落地页各查一次。Bing 这边没有写明和 Google 相同的「每天请求编入索引」配额；批量通知走 IndexNow，不要在检查工具里连点 172 次。

### 1.3 IndexNow（给 Bing，不给 Google）

协议：[IndexNow 文档](https://www.indexnow.org/documentation)。Bing 的入口说明：[bing.com/indexnow](https://www.bing.com/indexnow)。

钥匙文件有两种放法。推荐放在**主机根**，那样整站都能提交。本站做不到：主机根是 `https://1019666077-bit.github.io/`，那里没有用户站，2026-09-28 返回 404。要用第二种：钥匙放在项目目录里，并在每次请求里带 `keyLocation`。文档写明，钥匙文件所在目录决定能提交哪些网址。放在 `/wx-extract-mvp/` 下，就只能提交以这个前缀开头的网址。

钥匙：8–128 个字符，只能是 `a-z`、`A-Z`、`0-9` 和 `-`。UTF-8 文本文件，文件名是 `{钥匙}.txt`，文件内容就是这串钥匙。放到仓库根目录后，线上地址是：

```text
https://1019666077-bit.github.io/wx-extract-mvp/{钥匙}.txt
```

JSON 里的 `host` 是主机名，不带路径：`1019666077-bit.github.io`。单次最多 10,000 条网址。HTTP 200 只表示对方收到，不表示已经编入索引；202 表示已收到、钥匙仍在核验。

```bash
curl -sS -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data @- <<'EOF'
{
  "host": "1019666077-bit.github.io",
  "key": "换成你的钥匙",
  "keyLocation": "https://1019666077-bit.github.io/wx-extract-mvp/换成你的钥匙.txt",
  "urlList": [
    "https://1019666077-bit.github.io/wx-extract-mvp/",
    "https://1019666077-bit.github.io/wx-extract-mvp/zh-hant/",
    "https://1019666077-bit.github.io/wx-extract-mvp/lessons/lle1-01.html",
    "https://1019666077-bit.github.io/wx-extract-mvp/zh-hant/lessons/lle1-01.html"
  ]
}
EOF
```

参与 IndexNow 的引擎会互相分享提交。静态站没有 CMS 插件，上面这种手动 POST 就是启用方式。钥匙只给搜索引擎，不要写进公开帖。本文件用占位符，不生成真实钥匙。

### 1.4 以后买了自己的域名

自定义域名配在**这个项目仓库**的 Pages 设置里，站点才会从域名根提供。若只配在用户站上、项目仓库不单独覆盖，GitHub 的规则是项目站变成 `https://你的域名/wx-extract-mvp/`，子路径还在。[关于自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)。

DNS 按 [管理自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)：

- 子域名：CNAME 指向 `1019666077-bit.github.io`，**不要**带仓库名，也不要指向 `*.pages.github.io`。
- 顶点域名：四条 `A` 记录 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`，以及文档中的 `AAAA`。文档建议同时做 `www`。
- 先在仓库里写上自定义域名，再去 DNS 服务商添加记录，并在 GitHub 验证域名，避免域名被别人占用。
- 不要用 `*.example.com` 这种通配记录。

然后：

1. 改 `site.config.json` 的 `origin`（不要结尾斜线），运行 `node scripts/build-pages.js`。canonical、hreflang、Open Graph、JSON-LD、`sitemap.xml`、`robots.txt` 都会换成新源。README 已写这三步。
2. 新域名的 `robots.txt` 位于主机根，`Sitemap:` 才会被爬虫读到。
3. Search Console 新增 **网域**资源，用 DNS TXT 验证。它覆盖 `www`、顶点域名、http 和 https。也可以再加一条 `https://www.你的域名/` 网址前缀。
4. [变更地址工具](https://support.google.com/webmasters/answer/9370220) **不能**用于现在这条路径级资源。原文写明只能用于网域一级（`example.com`、`m.example.com`、`http://example.com`），不能用于 `http://example.com/petstore/` 这种带路径的资源。换域名后保留旧资源、提交新站点地图、靠 canonical。旧的 `github.io` 网址会不会自动 301 到新域名，本次读到的官方页没有写死；上线后用 `curl -I` 看响应。没有 301 时，不要删掉旧页，让 canonical 告诉 Google 新网址。
5. Bing 在新域名上用 DNS TXT 或 CNAME（向导提供的那条）。Domain Connect 要看域名商是否支持。然后提交新的站点地图网址。
6. IndexNow 改成主机根的钥匙文件（文档里的第一种），`host` 改为新主机名。子路径钥匙只能覆盖该子路径。
7. HTML 验证文件若还要维持旧的 `github.io` 资源，旧网址必须仍能直接打开该文件。Google 不跟随跨网域重定向。旧资源在跳转之后掉验证是可能的；新网域资源验证成功即可。

换域名时尽量保持路径形状：`/lessons/lle1-01.html`、`/zh-hant/lessons/lle1-01.html`。只改主机、不改路径，信号更好传递。变更地址工具的说明也建议搬家时不要同时大改网址结构。

---

## 2. 渠道

排名按「一个零预算、还没有粉丝的个人，14 天内能带来多少真实访问」排序。搜索引擎提交是第 1 节的基础设施，不跟论坛混在一张表里比。下面 1 最高。

受众是海外华人，以及台湾、香港、新加坡、马来西亚。简体页给新加坡和马来西亚，繁体页给台湾和香港。大陆社区不在此列：影片来自 VOA CDN，任务也排除了大陆。

| 名次 | 渠道 | 14 天角色 |
| --- | --- | --- |
| 1 | Threads，个人号 | 主阵地。台湾、香港文字讨论多，没有积分门槛 |
| 2 | YouTube Shorts，个人频道 | 一条片子会留在搜索里 |
| 3 | Instagram Reels，同一支片子 | 新加坡、马来西亚看影片的人更多 |
| 4 | Facebook 小组 | 只有人已经在群里、置顶规则允许资源分享时才发 |
| 5 | Dcard | 台湾学生很贴，商业链接风险高，最多一篇方法文 |
| 6 | Reddit 语言学习资源串 | 用英文，先读版规；地方版默认不发 |
| 7 | PTT | 英文板限制中文和商业，先站内信，14 天内不发广告 |
| 8 | LIHKG、Lowyat、HardwareZone | 书面规则禁止招揽，跳过 |
| — | r/ChineseLanguage、小红书 | 受众不对，跳过 |

### 2.1 Threads（名次 1）

- **受众**：台湾、香港的公开短文。新加坡、马来西亚也有人，但同一天的简体帖更适合 Instagram。
- **书面规则**：Threads 用 Meta 的社群守则。本次直接打开 `transparency.meta.com` 的垃圾信息专页返回 400，没有逐字核到「垃圾信息」正文。核到的是 [不实行为](https://transparency.meta.com/policies/community-standards/inauthentic-behavior/)：禁止用虚假账号、专页或小组欺骗身份或来源，或用来逃避执法。同一套守则会在 Facebook、Instagram、Messenger、Threads 统一，见 [统一社群守则说明](https://transparency.meta.com/en-gb/community-standards-unified/)（该页写 11 月 12 日起合成一份，规则本身不变）。**没有**找到 Threads 上类似论坛的「禁止自我推荐」专页。
- **账号年龄或积分**：公开文档里没有 karma 门槛。新号没有对话历史，推荐量会小。这是产品行为，不是一条写明的最低天数。
- **能发的角度**：个人学习笔记。第一句写明「这是我做的非官方页」。连到免费第 1 课，不连开通页，不写价格。
- **封号风险**：中等。重复贴链接、多账号对倒、假扮美国之音，会碰到不实行为。一个真人号、几天一条，风险低。
- **谁来发**：站主的个人号。空的品牌号像广播。
- **工夫**：低。一条文字，配一张课表截图即可。

### 2.2 YouTube Shorts（名次 2）

- **受众**：会搜「VOA 慢速英文」「Let's Learn English 中文字幕」的人。繁体、简体各一条，标题用对应文字。
- **书面规则**：[垃圾信息政策](https://support.google.com/youtube/answer/2801973)。禁止误导点击、重复评论引流、自动化批量生产，以及标题和影片内容不符。政策覆盖标题、说明、评论和缩图。
- **账号年龄或积分**：没有论坛式积分。新频道没有订阅者，Shorts 靠当次完播。具体推荐门槛本次未在帮助页看到，标为未核实。
- **能发的角度**：60 秒内讲自己怎么用第 1 课：听一句、对中文、做三题。说明文字放免费课链接，并写「非官方，影片与脚本属于公共领域，出处是 VOA Learning English」。不要上传整集课文，不要在别人的影片底下留相同评论。
- **封号风险**：中等偏高，若整集重传。YouTube 对重复使用内容很严，官方频道也可能有 Content ID。讲方法、少用原片画面，风险降到中等。
- **谁来发**：站主个人频道，频道名不要做成「VOA 官方」。
- **工夫**：高。要写口播、出镜或录屏、字幕。一条片子可以同时裁成 Reels。

### 2.3 Instagram Reels（名次 3）

- **受众**：新加坡、马来西亚的华人，以及已经在看 Threads 的台湾、香港用户。视觉平台，简体说明服务东南亚，繁体说明服务台港。14 天里优先发简体这一条，避免和第 2 名的繁体 Short 完全重复。
- **书面规则**：与 Threads 相同的 Meta 守则。Instagram 没有单独的「允许每周一条广告」条款被本次核到。
- **账号年龄或积分**：没有公开的 karma 门槛。
- **能发的角度**：与 Shorts 同一支方法片。说明第一行自我披露。链接放在个人档案或限时动态；Reels 说明里的外链经常点不到，这是产品限制，不是版规原文。
- **封号风险**：中等。同一支片子三天内在 Reels、Threads、Shorts 各发一次可以接受；同一天复制五次会像垃圾信息。
- **谁来发**：个人号，并在档案写「非官方自学笔记」。
- **工夫**：中。片子在 Shorts 那天已经做好，这里主要是简体标题、封面和档案链接。

### 2.4 Facebook 小组（名次 4）

- **受众**：地理最贴。例如台湾人在新加坡、台湾人在马来西亚、香港人学英文、海外华人家长。具体群名要站主自己已经加入的那些，本调研不代为加入。
- **书面规则**：平台层是 Meta 不实行为守则（见上）。**每个小组的置顶规则本次都没有核到**，因为规则在群内，未加入就不能当成已核实。常见写法是禁止广告和外链，但这是经验，不是本次读到的群规。
- **账号年龄或积分**：由各群管理员设置。没有统一数字。未核实。
- **能发的角度**：只有置顶规则允许「资源分享 / 学习方法」时，发一篇方法，链接指向免费课，并写「我是作者，非官方」。规则禁止链接或推广时，这一天改发 Threads，不硬贴。
- **封号风险**：高。群管可删帖并拉黑，平台也可能把新号连发链接当成垃圾信息。
- **谁来发**：已经在群里的个人号。不要新建品牌号进群发广告。
- **工夫**：中。先读置顶，再决定发或不发。读完发现不行，工夫就是二十分钟阅读。

### 2.5 Dcard（名次 5）

- **受众**：台湾学生、考证和留学讨论。语言板、留学板最贴。看板列表以 App 里当时的名称为准。
- **书面规则**：站规在 App / 网站登录后的公告里。本次搜索能看到转载标题「广告、商业内容定义与说明 2025.06.06」，但 **`site:dcard.tw` 没有返回那篇原文**。营销博客和博彩站对「删文加停权七天」「业配账号永久停权」的转述，不采用为已核实条文。发帖前要在 Dcard 里打开全站站规和该看板板规，逐字读「商业广告」「购买链接」几条。
- **账号年龄或积分**：公开网页没有给出可引用的官方等级数字。二级来源里的等级表不采用。新号可能发不了链接，以 App 提示为准，标为未核实。
- **能发的角度**：一篇「我怎么把 VOA 第 1 课拆成听力和三道题」的方法文。链接只到繁体免费第 1 课。开通页有价格和付款说明，在站规原文核完之前不要贴开通页。第一段写「我自己做的，非官方」。
- **封号风险**：高。站点本身有付费解锁，审核若把整站看成商业网站，方法文也会被删。所以 14 天最多一篇，被删就停，不换号重发。
- **谁来发**：站主个人卡。品牌卡更容易被当成业配。
- **工夫**：中。写文不难，读站规和等审核才是成本。

### 2.6 Reddit（名次 6）

本次从本环境请求 `reddit.com` 的 `about/rules` 被挡（「whoa there, pardner」网络策略页），**各子版侧栏的现行版规没有逐条打开**。下面只写本次实际读到的页面。

- **全站**：[Reddiquette](https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette) 在直接抓取时遇到验证页，搜索结果引用了该页原文：可以在合理范围内贴自己的内容；若几乎只贴自己的内容，就会被看成垃圾信息。常用经验是 9:1，即每 10 篇投稿里大约 1 篇是自己的内容。这是经验法则，不是每个子版的硬配额。同一页还禁止拉票和短时间灌入大量文章，严重时会进垃圾过滤，甚至影子封禁。
- **r/languagelearning**：版主公告写明，自我推广改为事先许可；除了置顶的 “Share your resources” 串，任何自我推广都要先把草稿私信版主，并清楚标成自我推广。[公告](https://www.reddit.com/r/languagelearning/comments/1u537kp/announcement_we_are_tightening_the_rules_around/)。14 天内若要出现，只走这根资源串或版主许可，用英文，说明免费前 5 课和非官方。
- **r/EnglishLearning**：2025-09 有版主回复说自我推广已由 Rule 2 涵盖（[讨论](https://www.reddit.com/r/EnglishLearning/comments/1nj6x6g/add_a_new_rule/)）。2022 年另一则版主提醒写过：免费服务若与版内已有服务不冲突，通常会留下；付费产品和招生会被严格处理（[提醒](https://www.reddit.com/r/EnglishLearning/comments/tgqq0q/reminder_englishlearning_does_not_endorse_any/)）。**现行侧栏全文未核实**。不要发隐藏广告。14 天内默认不发帖，除非当天打开侧栏，Rule 2 明确允许标明的自我推广。
- **r/Taiwan**：2016 年有一则「试行」讨论，写过广告会删、系列自我投稿需要同时参与其他讨论（[旧帖](https://www.reddit.com/r/taiwan/comments/51kmae/general_tentative_policy_changes_for_rtaiwan/)）。那是九年前的试行稿，**不能当成现在的版规**。现行版规未核实。地方版默认跳过。
- **r/HongKong、r/singapore、r/malaysia、海外华人子版、r/ChineseLanguage**：侧栏未核实。r/ChineseLanguage 是学中文的版，不是学英文的版，受众错开，跳过。其余地方版在版规未核实前不发链接。
- **账号年龄或积分**：很多子版用 AutoMod 卡新号，数字不公开。r/EnglishLearning 有人反映帖子被 Reddit 过滤器拿掉，但那不能推出具体 karma 数字。未核实。
- **封号风险**：直接开帖广告为高。在许可的资源串里发一条为中。
- **谁来发**：个人号，英文，署名 unofficial。新注册的空号不要第一篇就是链接。
- **工夫**：中到高。先读侧栏和置顶串，往往结论是这 14 天不发。

### 2.7 PTT（名次 7）

- **受众**：台湾。英文相关看板里，本次核到的是 EngTalk 和 IELTS。没有一个看板就叫「英文版」；EngTalk 是英文讨论板。TOEIC、studyabroad、language 等看板的现行板规 **本次没有打开**，不引用。
- **EngTalk 板规**：[Rules V.2](https://www.ptt.cc/bbs/EngTalk/M.1659832065.A.F6D.html)（2022-08-07）。1-4：避免使用中文，需要时放在括号里。1-6：未经板主许可，不得刊登商业商品或内容广告，违反者可能至少水桶一周。
- **IELTS 板规**：[板规](https://www.ptt.cc/bbs/IELTS/M.1431680104.A.4D6.html)（2015，文内有 2015-07-02 编辑）。第 5 条禁止家教、补习班广告文和征求文。第 6 条：第一次删文，第二次起劣文并水桶两周，严重可永久水桶。
- **账号**：站方 2021-07-26 公告开放任意信箱注册，非信任信箱要再认证。AOTP 手机认证限当时列出的台湾月租门号，简讯费由电信计收（[SYSOP 公告](https://www.ptt.cc/bbs/SYSOP/M.1627259537.A.390.html)）。各看板发文门槛不同，要在看板按 `i` 看，未达标会显示红字。地方板有人需要数十次登入（[ask 板讨论](https://www.ptt.cc/bbs/ask/M.1771335974.A.304.html)）。EngTalk / IELTS 的具体登入次数 **未核实**。
- **能发的角度**：EngTalk 若发，只能是英文方法文，而且商业内容要先站内信板主。中文推广帖直接违反 1-4 和 1-6。IELTS 不适合放课程广告。14 天计划不把 PTT 排进发帖日。
- **封号风险**：高。水桶是明文的。
- **谁来发**：若以后板主书面同意，用站主个人账号。不要用看起来像补习班的账号。
- **工夫**：高。认证、养登入天数、站内信，都比发一条 Threads 长。

### 2.8 LIHKG（名次 8，跳过）

- **受众**：香港讨论区，和慢速英文的学习意图只有部分重叠。
- **书面规则**：[使用条款](https://help.lihkg.com/tnc/) 第 6(g) 条：不同意把广告信函、促销资料、垃圾邮件、连锁信件、直销或其他任何形式的劝诱资料上传或张贴。第 6(c) 条禁止冒充机构。第 10 条禁止把服务用于商业目的的转售或使用。[禁止洗版](https://help.lihkg.com/rules/spamming/)：在大量主题里重复留言，会禁言，严重或再犯可能永久封锁。
- **账号**：[P 牌会员](https://help.lihkg.com/mechanism/p-member/)（帮助中心；P 牌页未单独标日期，会员权限表写着最后更新 2025-09-26）：上线日数未满 180 天会标 P 牌，每天只能开一个主题，回复没有推文效果，不能评分。[会员权限](https://help.lihkg.com/mechanism/member/) 的表格在抓取后列对齐不完整，每日主题上限以 P 牌专页的「每天一个」为准，不另猜正式会员的数字。
- **能发的角度**：条款写的是禁止劝诱资料。带本站链接的开帖属于招揽。14 天不发。
- **封号风险**：高。
- **谁来发**：跳过。不要用品牌号冒充媒体。
- **工夫**：若忽略规则去发，被封的成本高于收益。读条款本身只要几分钟。

### 2.9 Lowyat（名次 8，跳过）

- **受众**：马来西亚消费科技论坛。英文学习者不是主受众。
- **书面规则**：[Terms of Use](https://www.lowyat.net/terms-of-use/) 的 “Spam and commercial solicitation”：未经事先书面同意，不得向其他用户发送未经请求的讯息、广告或促销材料，也不得进行任何商业招揽。同一份条款把使用许可限制在个人、非商业用途。页面上的 “Advertising” 一节是说 Lowyat 自己会展示广告，以及用户不要挡广告，不是允许会员发广告。
- **账号年龄或积分**：条款页没有写发帖所需天数或积分。未核实。
- **能发的角度**：没有书面许可就不发带链接的帖。个人学习心得且完全不提网址，仍然可能被看成招揽，因为站点是带价目的产品。14 天跳过。
- **封号风险**：高。
- **谁来发**：跳过。
- **工夫**：低（决定不发）。

### 2.10 HardwareZone（名次 8，跳过）

- **受众**：新加坡综合论坛。学习帖不是主版面。
- **书面规则**：[Advertising, Promotion, Representation](https://forums.hardwarezone.com.sg/help/promo/)。所有带广告或推广内容的帖子都不允许。意图获利或推广商业实体的外链也不允许，版主可不经警告删除。重复违反可警告和封禁。冒充品牌或机构的账号会终止。未经 HWZ 书面授权，不得代表机构发言。合作要走媒体销售，页面给的是 `https://www.sph.com.sg/contact-us`。
- **账号年龄或积分**：该帮助页没有写最低账号年龄。未核实。
- **能发的角度**：帮助页没有给「学习资源分享」开例外。跳过。
- **封号风险**：高。删除不经警告。
- **谁来发**：跳过。品牌号还会碰到冒充条款。
- **工夫**：低（决定不发）。

### 2.11 看过、但不排进前 14 天的地方

- **小红书**：受众主要在中国大陆。任务范围排除大陆，VOA CDN 在大陆也经常打不开。不做。
- **微信群、WhatsApp 群、Telegram、Discord**：规则在每个群里，本次没有加入任何群，全部未核实。站主若本来就在某个学习群，沿用该群已经允许的分享方式，不要为了上线新加十个群发链接。
- **Mobile01、Plurk、Discuss.com.hk**：本次没有打开现行板规，不排期。

---

## 3. 前 14 天

时区按站主实际发帖的当地时间。语言：台湾和香港用繁体网址 `/zh-hant/`，新加坡和马来西亚用简体根路径。每天只做一个主动作。

### 3.1 UTM

```text
utm_source   threads | youtube | instagram | facebook | dcard | reddit
utm_medium   social | short | reel | group | forum
utm_campaign launch14d
utm_content  d04-method-hant 这种「日序-角度-文字」
utm_term     tw | hk | sg | my   （可选，受众地区）
```

示例：

```text
https://1019666077-bit.github.io/wx-extract-mvp/zh-hant/lessons/lle1-01.html?utm_source=threads&utm_medium=social&utm_campaign=launch14d&utm_content=d04-method-hant&utm_term=tw
```

```text
https://1019666077-bit.github.io/wx-extract-mvp/lessons/lle1-01.html?utm_source=instagram&utm_medium=reel&utm_campaign=launch14d&utm_content=d08-reel-hans&utm_term=sg
```

GitHub Pages 不提供访问日志。Search Console 的点击是 **Google 搜索点击**，不会把 Threads 的 UTM 算进来。UTM 要有计数，用一个免费的短链接服务看点击数，目标网址仍带上面的参数。以后若加上免费的 GA4，同一套参数可以直接用。14 天内不要为了统计去改站。不要把带 UTM 的网址提交索引。

Search Console 里要看的：

- 成效报告：查询、网页、国家/地区（台湾、香港、新加坡、马来西亚）、点击、曝光、平均排名
- 网页过滤：首页、`/zh-hant/`、`lle1-01` 到 `lle1-05` 的简繁网址
- 站点地图报告：已发现网址数和状态
- 网址检查：优先 12 页是否已编入索引

社交侧只记三件：短链接点击、帖子回复数、有没有被删。不记「感觉曝光不错」。

### 3.2 日程

| 天 | 渠道 | 角度 | 语言 | 衡量 |
| --- | --- | --- | --- | --- |
| 1 | Google Search Console | 添加网址前缀，HTML 文件验证，提交 `sitemap.xml` | 不发帖 | 验证成功；站点地图状态不是「无法抓取」 |
| 2 | Bing | 从 Search Console 导入；若导入失败，改放 `BingSiteAuth.xml`。提交同一份站点地图。放置 IndexNow 钥匙并提交首页和四条第 1 课网址（简繁首页 + 简繁 lle1-01） | 不发帖 | Bing 显示已验证；站点地图有最后读取时间或成功状态；IndexNow 返回 200 或 202 |
| 3 | Google 网址检查 | 请求编入索引：简繁首页和简繁 Level 1 第 1–5 课。配额提示出现就停 | 不发帖 | 每条网址的检查结果截图。记下已收录 / 已发现未收录 / 未知 |
| 4 | Threads | 方法：第 1 课怎么听。链到繁体 `lle1-01`，UTM `d04-method-hant` | 繁体，台湾、香港 | 短链接点击、回复数、帖子是否还在 |
| 5 | 不发新帖 | 看第 1–2 天的报表是否开始有行。准备第 6 天口播稿和 60 秒录屏 | — | Search Console 有无曝光。没有曝光也正常，不满 48 小时 |
| 6 | YouTube Shorts | 方法短片。说明放繁体第 1 课，UTM `d06-short-hant` | 繁体口播与标题 | 观看保留、说明链接点击、有无版权声明 |
| 7 | 不发新帖 | 回复第 4 天 Threads 下的提问。不在别的帖子下贴链接 | 繁体 | 回复数。搜索报表仍按第 3 天的页面过滤 |
| 8 | Instagram Reels | 同一支片子的简体标题与封面。档案或限时动态放简体第 1 课，UTM `d08-reel-hans` | 简体，新加坡、马来西亚 | 短链接点击、完播、有无被限流（播放长期为 0 就停，不连发） |
| 9 | Dcard 或改回 Threads | 仅当当天在 App 里读完站规，确认免费课链接允许，才发一篇方法文，UTM `d09-method-hant`。站规不允许购买站或外链时，改发一条 Threads 追问，不带新链接 | 繁体 | 是否过审、短链接点击。被删则记录原因，14 天内不再发 Dcard |
| 10 | Facebook 小组或跳过 | 只在已加入、置顶规则允许资源分享的一个群。繁体或简体按群的主要地区。UTM `d10-method-hant` 或 `d10-method-hans`。规则不明就跳过 | 按群 | 帖是否留下、短链接点击、被删原因 |
| 11 | YouTube Shorts | 第二支，简体，仍是方法不是广告。链到简体第 1 课，UTM `d11-short-hans` | 简体 | 与第 6 天对比保留率。出现再利用或版权提示就不再发第三支 |
| 12 | Reddit 或跳过 | 打开 r/languagelearning 置顶资源串。规则仍要求版主预审时，只发私信草稿，不公开贴链接。其他子版不发 | 英文 | 是否被允许、短链接点击。被删则停止 Reddit |
| 13 | Threads | 第二篇：打卡和错题本，仍然链到繁体免费第 1 课，不链开通页。UTM `d13-checkin-hant` | 繁体 | 点击是否高于第 4 天。低于第 4 天就不要在第 14 天加发 |
| 14 | 复盘 | 不发新渠道。汇总 Search Console 国家与网页、Bing 页面、各 UTM 点击、被删帖 | 简繁分开看 | 决定下一轮只保留点击最高的一个社交渠道。LIHKG、Lowyat、HardwareZone、PTT 广告帖维持不做 |

第 9、10、12 天的默认结果很可能是「读完规则后不发」。那仍然算完成。

---

## 4. 前五篇文案要点

全文另写。这里只定角度。五篇都不写美元价、不留微信、不链开通页。CTA 都是打开免费的第 1 课。

### 4.1 Threads，第 4 天，繁体方法

- **角度**：自己用 VOA 第 1 课练听力的步骤，顺手说明有一份非官方的中英对照。
- **要点**：非官方，与美国之音没有隶属或背书；课文来自 VOA Learning English，公共领域；只承诺前 5 课免费；三步是看片、对字幕、做三题。
- **长度**：150–220 字，一段即可。
- **语言**：繁体中文。
- **CTA**：繁体 `lle1-01`，UTM `d04-method-hant`。

### 4.2 YouTube Shorts，第 6 天，繁体方法片

- **角度**：60 秒演示「听一句、暂停、对中文、答一题」。
- **要点**：标题含「非官方」和 “Let's Learn English”；口播不说「VOA 官方课程」；画面以人脸或笔记为主，课文画面只作一两秒示意；说明栏署名 VOA Learning English，并链到 learningenglish.voanews.com 的原文。
- **长度**：45–60 秒。标题 40 字以内。说明 80–120 字。
- **语言**：繁体口播，标题繁体。
- **CTA**：说明栏第一条是繁体第 1 课，UTM `d06-short-hant`。

### 4.3 Instagram Reels，第 8 天，简体东南亚

- **角度**：同一支片子，改成给新加坡、马来西亚的简体说明。
- **要点**：第一句写明作者身份和非官方；不要写成补习班招生；不要 @ 一串无关账号。
- **长度**：片子不变。封面标题 12 字以内。说明 60–100 字。
- **语言**：简体中文。
- **CTA**：档案链接或限时动态贴纸指向简体第 1 课，UTM `d08-reel-hans`。

### 4.4 YouTube Shorts，第 11 天，简体方法片

- **角度**：换一个具体困难，例如「慢速英文仍然听不清时，怎么只听两句」。不要重复第 6 天的脚本。
- **要点**：仍只展示免费课；片尾口头说一次「不是 VOA 官方」；不出现价格。
- **长度**：45–60 秒。说明 80–120 字。
- **语言**：简体。
- **CTA**：简体第 1 课，UTM `d11-short-hans`。

### 4.5 Threads，第 13 天，繁体打卡与错题本

- **角度**：连续天数和错题怎么留下来，适合已经看过第 4 天、还没点击的人。
- **要点**：打卡和错题本不用开通；进度在浏览器本地，换设备不会跟着走（避免事后被说成有账号同步）；仍然非官方。
- **长度**：120–180 字。
- **语言**：繁体。
- **CTA**：繁体第 1 课，UTM `d13-checkin-hant`。需要举例时可以再提繁体打卡页，但主链接保持第 1 课。

---

## 5. 风险

### 5.1 VOA 名称与「非官方」

两份都要同时满足：

- [Request Our Content](https://learningenglish.voanews.com/p/6861.html)：Learning English 的文字、MP3、照片和影片在公共领域，允许为教育和商业目的重刊，并注明 learningenglish.voanews.com。美联社、路透社、法新社等通讯社的照片和画面不在此列，不能重刊。本站课文若混入这类素材，推广时不要把那些画面裁进短片。
- [Terms of Use](https://learningenglish.voanews.com/p/6021.html) 版权声明第 1 条：VOA 自己制作的文字、音频和视频在公共领域，使用时应向 voanews.com、Voice of America 或 VOA 署名。同一页第 3 条：「Voice of America」和「voanews.com」是商标，未经明确许可不得用于商业目的。

因此对外用语保持站点页脚已经在用的意思：非官方自学工具，与美国之音没有隶属或背书，课文来自 VOA Learning English，属于公共领域。不要用 VOA 标志，不要写「VOA 官方」「美国之音出品」「授权课程」。标题里的 “VOA” 只用在指认课文来源，并紧挨「非官方」。商业使用商标是否越过第 3 条，本调研不能下法律结论；在美元收费写进页面之前，公开帖不要把 VOA 放进品牌名或频道名。

### 5.2 平台广告规则

- **YouTube**：垃圾信息政策禁止误导标题和批量引流。整集重传还有重复内容和 Content ID 风险。短片是方法演示。
- **Meta（Facebook / Instagram / Threads）**：不实行为政策禁止虚假账号和逃避执法。一个真人个人号。小组规则未核实之前不贴链接。
- **Dcard**：商业定义的官方原文本次没有打开。默认把开通页当成可能违规的链接。
- **PTT、LIHKG、Lowyat、HardwareZone**：第 2 节已引用的板规或条款禁止未经许可的广告、促销或商业外链。14 天不在这些地方发。
- **Reddit**：9:1 只是全站经验；子版可以更严。r/languagelearning 已改成预先许可。

台湾公平交易委员会的 [荐证广告规范说明](https://www.ftc.gov.tw/internet/main/doc/docDetail.aspx?docid=13021) 写明：荐证者与广告主之间有一般人无法合理预期的利益关系，却没有在广告里充分揭露，足以影响交易秩序的，可能触及公平交易法第 25 条。站主推荐自己的网站，就属于这种关系。每篇公开帖的前两句写「我做的，非官方」。

### 5.3 会让站点被盯上的点

- **GitHub Pages 的使用范围**。[附加产品条款](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features) 和 [Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) 写明：Pages 不是用来免费托管线上生意、电子商务，或主要用于促成商业交易、提供商业软件服务的网站。捐赠按钮和众筹链接是举例允许的。GitHub 保留收回 `github.io` 子网域的权利。现在的开通页已经在收款。零预算推广若把流量打到付费解锁，等于把这个条款风险放大。前 14 天只推免费课；收费搬到自己的域名之后，再把开通页当作落地页。这不是律师意见，是条款原文和发布顺序。
- **开通页和宣传不一致**。页上仍是 ¥39 / ¥99 和微信。帖子若写 US$5.99 或 Waffo，访客对不上页面，也容易被平台当成误导。等页面改完再提价格。
- **兑换码格式**。README 写明空的 `codes.json` 下，浏览器会接受符合格式的码，这不是安全措施。公开帖不要讨论码的格式，不要发测试码。
- **商标加付费**。频道名、小组名、网域若做成 `voa-official` 一类，同时卖解锁，商标和仿冒风险叠在一起。网域用自己的课名，页面保留非官方声明。
- **索引与抓取**。主机根没有 robots.txt，不会挡住抓取，只是不会自动广告站点地图。不要在用户站的 robots.txt 里 `Disallow: /`。验证文件不要加登录。付费课的 HTML 目前仍可被抓到节选和付费墙，这是现站结构；推广不要承诺「搜索引擎看不到付费课正文」——前两句节选在页面里。
- **多账号**。同一篇文案换号重发，在 Meta、LIHKG、Reddit、PTT 都有对应的虚假身份、分身或垃圾信息条款。被删就停。

---

## 6. 来源与未核实清单

### 已打开或已引用的原文

- Google：[添加资源](https://support.google.com/webmasters/answer/34592)、[验证所有权](https://support.google.com/webmasters/answer/9008080)、[站点地图报告](https://support.google.com/webmasters/answer/7451001)、[网址检查](https://support.google.com/webmasters/answer/9012289)、[变更地址](https://support.google.com/webmasters/answer/9370220)、[建立并提交站点地图](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[robots.txt 必须在主机根](https://support.google.com/webmasters/answer/6062596)
- Bing：[2025-06 入门](https://blogs.bing.com/webmaster/June-2025/Start-Using-Bing-Webmaster-Tools-to-Improve-Your-Site-Visibility)、[2025-07 站点地图](https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search)、[添加并验证](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)、[从 Search Console 导入](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)、[IndexNow](https://www.indexnow.org/documentation)
- GitHub：[Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[附加产品条款](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features)、[关于自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)、[管理自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- VOA：[内容使用](https://learningenglish.voanews.com/p/6861.html)、[使用条款](https://learningenglish.voanews.com/p/6021.html)
- 渠道原文：PTT [EngTalk](https://www.ptt.cc/bbs/EngTalk/M.1659832065.A.F6D.html)、[IELTS](https://www.ptt.cc/bbs/IELTS/M.1431680104.A.4D6.html)、[SYSOP 认证公告](https://www.ptt.cc/bbs/SYSOP/M.1627259537.A.390.html)；LIHKG [条款](https://help.lihkg.com/tnc/)、[P 牌](https://help.lihkg.com/mechanism/p-member/)、[洗版](https://help.lihkg.com/rules/spamming/)；[Lowyat 条款](https://www.lowyat.net/terms-of-use/)；[HardwareZone 推广规则](https://forums.hardwarezone.com.sg/help/promo/)；Reddit [r/languagelearning 公告](https://www.reddit.com/r/languagelearning/comments/1u537kp/announcement_we_are_tightening_the_rules_around/)；Meta [不实行为](https://transparency.meta.com/policies/community-standards/inauthentic-behavior/)；YouTube [垃圾信息](https://support.google.com/youtube/answer/2801973)；[荐证广告说明](https://www.ftc.gov.tw/internet/main/doc/docDetail.aspx?docid=13021)

### 本次没有核实，正文里已标出

- Google「请求编入索引」的每日条数。只有「有上限」是官方的。
- Bing meta 标记的属性名是否永远是 `msvalidate.01`。以向导显示的标签为准。
- 本仓库的 GitHub Pages 是否启用 Jekyll，以及验证文件会不会因此 404。
- 换自定义域名后，旧的 `*.github.io/仓库名/` 是否自动 301。
- Dcard 全站站规和语言板板规的原文，以及发文等级数字。
- Reddit 各目标子版的现行侧栏。r/Taiwan 的 2016 帖不是现行版规。Reddiquette 页面直接抓取时遇到人机验证，9:1 文句来自该官方页的搜索摘录。
- Facebook 任何一个具体小组的置顶规则。
- Threads / Instagram 是否另有未挂在社群守则上的「外链降权」产品规则。
- YouTube 新频道进入推荐的最低订阅数。
- PTT EngTalk、IELTS 的登入次数门槛；TOEIC 等其他英文看板的板规。
- Lowyat、HardwareZone 的账号年龄门槛。
- LIHKG 会员权限表里、P 牌以外的每日开帖上限（表格抓取后列没有对齐）。
- Mobile01、Plurk、Discuss.com.hk、Telegram、Discord、WhatsApp 群的规则。

---

## 7. 品牌名（不含 VOA）

账号名、频道名和以后的域名用同一个品牌，字面里不出现 VOA、Voice of America，也不写成官方、授权、出品。课文出处仍写在影片说明和片尾，那是署名，不是品牌。

本节改两处旧安排，不改第 1 节的验证做法：

- 搜索提交（第 3 节第 1–3 天）放到 **Cloudflare Pages 接上新域名之后**。收费上线也在这次搬家之后。搬家目标是 Cloudflare Pages，不是把 GitHub Pages 绑到自定义域名，所以不要照第 1.4 节去填 GitHub 的 A/CNAME。新域名在 Cloudflare 上之后，Search Console 可以用 DNS TXT 做**网域**资源，Bing 同样用 DNS。站点地图改到新域名根，`robots.txt` 这时才会被爬虫读到。
- 发帖账号由助手在 **Linux 桌面浏览器**注册和发布。站主只在验证码或扫码时出现，不从手机发。帖子正文仍写「这是我做的，非官方」。

英文名必须让英语母语者**直接读出单词**，不用拼音。中文名 2–4 个字，简繁用同一组字，顺着英文的意思，读起来短。**不使用「一句慢」。** 已注册的 `.com`（含注册后挂牌出售）直接淘汰，不用 `.app` / `.io` 顶上。

### 7.1 上一轮拼音（已否决）

上一轮用拼音做英文名，**已否决，不再推荐**。当时的三个名字是：一句慢 / Yijuman、耳句 / Earju、慢耳句 / Manerju。2026-09-28 这三个 `.com` 都是 RDAP 404；`@earju` 已被占用，`@yijuman` 和 `@manerju` 看起来空闲。备用拼写 `yijumanlisten.com`、`slowjuman.com`、`earjulisten.com`、`getearju.com`、`erjuman.com` 当天也是 404。Threads / Instagram 是登录墙。拼音英语母语者读不出来，中文名「一句慢」也不再用。下面仍用第 7.2 节筛出的五个英文名，中文名全部重起。

### 7.2 这一轮怎么筛

用 sentence、line、slow、ear、listen、tune、step、one、echo、replay、pause、clear、phrase、word、pace、loop，再接 a、by、and、once、again、slowly、it，拼成能读出来的英文。2026-09-28 对 **533** 个只含字母、长度 4–16 的名字做了 Verisign RDAP（`https://rdap.verisign.com/com/v1/domain/<name>.com`）。**271 个返回 404（当时未注册），262 个返回 200（已注册），0 个请求失败。**

已注册、因此淘汰的例子：`slowline`、`linebyline`、`onesentence`、`slowlisten`、`listenline`、`replayline`、`pauseline`、`clearline`、`oneline`、`oneatatime`、`lineatatime`、`takeyourtime`、`unhurried`、`lendanear`、`allears`、`listenonce`、`eachline`、`wordbyword`、`bitbybit`、`stepbystep`、`playitslow`、`adagio`、`cadence`。

未注册的再按意思、朗读时会不会拼错、长度（尽量 ≤ 12 个字母）缩短。留下的名字用万网查询页同一个公开接口核对溢价：`https://api.domain.aliyun.com/api/check/domainCheck?domainName=<name>.com&scenario=domainCheck&productId=210701`（查询页本身是 [万网搜索](https://wanwang.aliyun.com/domain/searchresult/?keyword=clearandslow&suffix=.com)）。2026-09-28 首页 [`.com` 卡片](https://wanwang.aliyun.com/domain/) 仍是首年 ¥85、续费 ¥95/年。下面五个入选的接口都是 `canRegistry=true`，`type` 不是 premium，首年 **¥85**、续费 **¥95**。没有登录、没有下单。Namecheap 查询返回 403，Cloudflare 域名搜索有人机验证，溢价只以阿里云这一处为准。

YouTube：`https://www.youtube.com/@YouTube` 是 200，标题 “YouTube - YouTube”；不存在的句柄是 404，标题 “404 Not Found”。404 记为**看起来空闲**，200 且有频道标题记为**已占用**。

`.com` 空着但仍拿掉的：

- `playitslowly`：RDAP 404，阿里云标准价，YouTube 404。但 [Play it Slowly](https://29a.ch/playitslowly)（Jonas Wagner，GPL，约 2009 年起）是同名的慢放音频软件。
- `oneslowline`：YouTube 已有频道 “One Slow Line”。
- `slowandclear`：YouTube 频道 “Slow Clear English”，和英语学习贴在一起。
- `slowsentence`：YouTube 频道标题是韩文「느린문장」（慢句子），句柄就是这个英文。
- `slowspoken`、`pauseandhear`、`againslowly`、`linebyone`：YouTube 句柄已被同名频道占用。
- `onlyaline`：句柄被 “Only Aline0409” 占用，不是这个短语，但 `@onlyaline` 不能用。
- `hearitslowly`、`hearslowly`、`hearaline`：听上去像 here，拼写会错。
- `patientear`：听上去像 air。
- `theslowline`：`.com` 和 YouTube 当天都空着，但 “The Slow Line” 已是 [一支舞蹈](https://www.hopemohr.org/the-slow-line) 和 “Slow Line Art Room” 的名字。

### 7.3 五个入选

中文简繁都相同。冲突栏是 2026-09-28 的网页快查（名字 + trademark / app，以及能打开的商标记录页），**不是** USPTO 正式检索，也不是律师清标。`tmsearch.uspto.gov` 页面能打开，查询接口前面有人机验证，没有拿到结果表。

中文名在 2026-09-28 重配。简繁同一组字。粤语是香港粤拼。快查看的是网页和应用商店里有没有同名学习产品，不是商标局检索。

| 英文（怎么读） | 中文（简 / 繁） | 意思 | `.com`（RDAP） | 阿里云 | YouTube | 快查 |
| --- | --- | --- | --- | --- | --- | --- |
| Clearandslow（clear and slow） | 清慢 / 清慢。粤 cing1 maan6 | 听清楚，而且放慢 | [clearandslow.com](https://rdap.verisign.com/com/v1/domain/clearandslow.com) **404，未注册** | **标准价**，首年 ¥85，续费 ¥95。不是 premium | [@clearandslow](https://www.youtube.com/@clearandslow) **看起来空闲**（404） | 没找到叫「清慢」的学习 App。旁边有 [慢学英语](https://www.crsky.com/soft/1101564.html)（名字不同）和 [朗易思听](https://apps.apple.com/tm/app/id548247084)，所以不用「朗」字开头。英文快查仍无同名产品；[STILL AND SLOW](https://www.trademarkelite.com/trademark/trademark-detail/99272379/STILL-AND-SLOW) 是涂色书 |
| Sentencewise（sentence-wise） | 每句 / 每句。粤 mui5 geoi3 | 每一句都分开听 | [sentencewise.com](https://rdap.verisign.com/com/v1/domain/sentencewise.com) **404** | 标准价，¥85 / ¥95 | [@sentencewise](https://www.youtube.com/@sentencewise) **看起来空闲**（404） | 没找到叫「每句」的 App。已避开同名学习 App「句句」（[介绍页](https://www.crsky.com/soft/268129.html)）和 [一句英语](https://apps.apple.com/cn/app/id1590065267)。英文旁边仍有 Wise Sentence、WordWise、Sentenced |
| Oncealine（once a line） | 一遍 / 一遍。粤 jat1 bin6 | 这一句听一遍 | [oncealine.com](https://rdap.verisign.com/com/v1/domain/oncealine.com) **404** | 标准价，¥85 / ¥95 | [@oncealine](https://www.youtube.com/@oncealine) **看起来空闲**（404） | 没找到叫「一遍」的学习 App。英文名念出来是 once / a / line |
| Pausealine（pause a line） | 停一停 / 停一停。粤 ting4 jat1 ting4 | 先停一下，再听这句 | [pausealine.com](https://rdap.verisign.com/com/v1/domain/pausealine.com) **404** | 标准价，¥85 / ¥95 | [@pausealine](https://www.youtube.com/@pausealine) **看起来空闲**（404） | 没找到叫「停一停」的学习 App。对得上「暂停、对字幕、做三题」 |
| Onebyline（one by line） | 循句 / 循句。粤 ceon4 geoi3 | 一句接一句跟着走 | [onebyline.com](https://rdap.verisign.com/com/v1/domain/onebyline.com) **404** | 标准价，¥85 / ¥95 | [@onebyline](https://www.youtube.com/@onebyline) **看起来空闲**（404） | 没找到叫「循句」的 App。已避开「逐句学」和「句乐部」。英文旁边的 LineByLine 是背课文应用（[linebyline.app](https://www.linebyline.app/about)）；`linebyline.com` 本轮 RDAP 是 200 |

粤语同音只记会听岔的几处：清慢的「慢」和「萬」都是 maan6，连读不是骂人的话；普通话 qīng màn 和「晚清」wǎn qīng 声调、字序都不同。每句的「每」是 mui5，「妹」是 mui6。一遍的「遍」和「便」同音，但「一遍」是现成词。停一停中间有「一」，不会听成名字「婷婷」。循句的「循」和「巡」同音，不是贬义；没用「序」，因为粤语「序」和「罪」都是 zeoi6。

**建议用 Clearandslow，中文叫清慢，域名 `clearandslow.com`。** 英语母语者会读成 clear、and、slow，没有 here/hear、air/ear 这种同音。12 个字母，意思就是把口语放慢听清楚。中文两个字，简繁相同，粤语 cing1 maan6，顺口，意思对着英文。`.com` 未注册，阿里云按标准价，YouTube `@clearandslow` 当天看起来空闲。快查没有叫「清慢」的学习 App。Sentencewise / 每句是最接近「一个真正英文词」的备选，但英文旁边已有 Wise Sentence、WordWise。Oncealine / 一遍和 Pausealine / 停一停更短，写出来要靠中间那个 a 才拆得开。买域名之前再跑一次 RDAP，404 不保留名额。Threads / Instagram 这一轮没有重查，上一轮即使用 `@zuck` 也进登录墙。

---

## 8. 零成本短片：桌面机器人能做完的部分

站主不出镜、不从手机发。一条成片同时给 YouTube Shorts 和 Instagram Reels。长度 **45–60 秒**，竖屏 **1080×1920**，30 fps。片内不烧 github.io 网址，也不烧价格；可点的链接放在说明栏，用第 3.1 节的 UTM，等 Cloudflare 上的 `clearandslow.com`（第 7 节的建议；若改选同表里的另一个名字，就用那个域名）再填。片内中文写「清慢」，英文写 Clearandslow。

### 8.1 画面从哪来

整条片子以**本站自己的界面**为主：课页、中英字幕、三道题、打卡。VOA 课文影片只出 **5–8 秒**，而且只用站内播放器里已经在播的 Let's Learn English 影片。

[VOA Learning English 的内容说明](https://learningenglish.voanews.com/p/6861.html) 允许在署名的前提下使用他们自己的文字、MP3、照片和影片。片中或片尾保留这一行：

```text
非官方自学笔记，不是美国之音。
课文画面与声音来自 VOA Learning English，公共领域。
learningenglish.voanews.com
```

通讯社画面不能用。若播放器里出现 AP、Reuters、AFP 的署名或角标，这段裁掉。不要把整集课文当成短片上传。

### 8.2 录屏

机器人在有图形界面的 Linux 桌面上录。`ffmpeg` 的 `x11grab` 只吃 X11。会话若是纯 Wayland，改用 OBS（PipeWire 窗口采集）或 `wf-recorder -g "0,0 1080x1920"`。下面的命令按 X11 写。

用无边框窗口，避免标题栏把 1080×1920 撑歪：

```bash
chromium --new-window --window-position=0,0 --window-size=1080,1920 \
  --force-device-scale-factor=1 --lang=zh-TW \
  --app="https://1019666077-bit.github.io/wx-extract-mvp/zh-hant/lessons/lle1-01.html"
```

简体片把 `--lang` 和网址换成简体首页路径下的 `lessons/lle1-01.html`。搬家之后换成新域名上的同一课。录之前用 `xwininfo` 量窗口左上角和宽高，下面命令里的 `+0,0` 和 `1080x1920` 改成量到的数字。

系统声音用 PulseAudio 的监听源，不要去录麦克风：

```bash
SINK=$(pactl get-default-sink)
ffmpeg -y \
  -f x11grab -video_size 1080x1920 -framerate 30 -draw_mouse 0 -i :0.0+0,0 \
  -f pulse -i "${SINK}.monitor" \
  -t 20 \
  -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 18 \
  -c:a aac -ar 48000 -ac 2 -b:a 192k \
  capture-lesson.mp4
```

`-t 20` 是课文画面那一小段。界面、题目、打卡各另录一条，再拼。鼠标轨迹关掉（`-draw_mouse 0`）。浏览器缩放到 100%，滚动条用键盘，避免光标入画。

OBS 只在需要看预览时开：来源选「窗口采集」或「显示器采集」，画布设为 1920×1080 的竖向，即宽 1080、高 1920，30 fps，输出编码器 x264，然后用下面同一套导出参数。机器人能脚本化的路径仍是 ffmpeg。

### 8.3 字幕烧进画面

中英各一行。繁体片用繁体中文，简体片用简体。字体用 Noto CJK（Debian/Ubuntu：`fonts-noto-cjk`），一种字体覆盖两种字形，文本本身决定简繁。

`captions.srt`：

```srt
1
00:00:01,000 --> 00:00:04,500
清慢 · 非官方
One sentence, slowly.

2
00:00:05,000 --> 00:00:09,000
先听这一句，再看中文。
Listen once, then read the Chinese line.
```

烧进画面，字放在中下，躲开 Reels 底部按钮（大约底部 320 像素）和顶部用户名（大约顶部 220 像素）：

```bash
ffmpeg -y -i capture-lesson.mp4 \
  -vf "subtitles=captions.srt:fontsdir=/usr/share/fonts:force_style='FontName=Noto Sans CJK TC,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Alignment=2,MarginV=380'" \
  -c:a copy lesson-sub.mp4
```

需要描边和位置更稳时改用 ASS。`captions.ass` 的样式行：

```ass
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ZH,Noto Sans CJK TC,64,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,4,0,2,80,80,420,1
Style: EN,Noto Sans,42,&H00E8F4EF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3,0,2,80,80,340,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.50,ZH,,0,0,0,,清慢 · 非官方
Dialogue: 0,0:00:01.00,0:00:04.50,EN,,0,0,0,,Unofficial. One sentence, slowly.
```

```bash
ffmpeg -y -i capture-lesson.mp4 -vf "ass=captions.ass:fontsdir=/usr/share/fonts" \
  -c:a copy lesson-sub.mp4
```

### 8.4 旁白

默认**不加合成旁白**。声音用课文播放器里那几秒公共领域原声，其余时间用轻音乐。这样不碰到语音服务的条款。

`edge-tts` 不用于要发布的成片。它是第三方客户端，去接 Microsoft Edge 的在线朗读，不是 Azure 语音的正式 API。[edge-tts 讨论](https://github.com/rany2/edge-tts/discussions/261) 把仓库的 GPL 解释成只覆盖这段代码，不授权微软的服务。微软问答里也没有一份公开条款允许把 Edge Read Aloud 经第三方客户端做成可发布的商业旁白（[问答](https://learn.microsoft.com/en-us/answers/questions/5925556/commercial-use-of-edge-read-aloud-voices-via-edge)，回复者写明那不是法律意见）。库的 GPL 不能代替微软的使用条款。

Piper 的中文音色 `zh_CN-huayan-medium` 也不直接用。[模型卡](https://huggingface.co/rhasspy/piper-voices/blob/main/zh/zh_CN/huayan/medium/MODEL_CARD) 写数据集许可证是 **Unknown**。许可证不明的音色不进成片。

若一定要机器中文口播，只用许可证写明可以再分发的本地引擎，并在下载页再核对一次权重文件。质量够用、条款清楚的临时方案是 espeak-ng（代码 [GPL-3.0](https://github.com/espeak-ng/espeak-ng)），声音会很机械，只适合垫一句品牌名，不适合长旁白：

```bash
espeak-ng -v cmn -s 140 -w brand.wav "清慢。放慢听清楚。"
ffmpeg -y -i brand.wav -ar 48000 -ac 2 brand-48k.wav
```

`-v cmn` 是普通话音位，不区分简繁；简繁体现在字幕文本上。把 `brand-48k.wav` 放到成片开头两秒，音量低于课文原声。

### 8.5 音乐、封面、导出

音乐用可写明授权的免费来源，一条片子只用一首，音量压到大约原文的 15%：

- [Kevin MacLeod / Incompetech](https://incompetech.com/music/royalty-free/)：常见授权是 CC BY 4.0，说明栏要写曲名、作者和 `incompetech.com`。每首曲目页面上的许可证再看一次，不要假设全部相同。
- YouTube 音频库：频道建好之后才能下。每首曲目旁边有自己的授权，有的要署名，有的不要。只挑标成可在 YouTube 以外使用的曲目，因为同一条还要发 Reels。

```bash
ffmpeg -y -i voicebed.wav -i music.mp3 -filter_complex \
  "[1:a]volume=0.15[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]" \
  -map "[a]" -c:a aac -b:a 192k -ar 48000 bed.m4a
```

封面给 Reels 选帧，也给以后频道验证后的自定义缩图。不放 VOA 标志，不放课文全画面：

```bash
convert -size 1080x1920 canvas:'#0b6e4f' \
  -font "Noto-Sans-CJK-TC" -fill white -pointsize 96 \
  -gravity center -annotate +0-80 "清慢" \
  -pointsize 42 -annotate +0+40 "放慢听清楚" \
  -pointsize 28 -fill "#d7efe4" -annotate +0+220 "非官方自学笔记" \
  cover.png
```

站点主题色 `#0b6e4f` 来自现有页面的 `theme-color`。`convert` 是 ImageMagick。字体名以 `convert -list font` 里看得到的为准。

拼成一条并导出。Shorts 和 Reels 用同一文件：H.264、`yuv420p`、30 fps、AAC 48 kHz 立体声、`+faststart`，长度不超过 60 秒。

```bash
ffmpeg -y -i lesson-sub.mp4 -i ui-sub.mp4 -i bed.m4a \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30[v]" \
  -map "[v]" -map 2:a -t 55 \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -b:v 8M -maxrate 10M -bufsize 16M \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart \
  clearandslow-lle1-01-hant.mp4
```

说明栏第一行是品牌和「非官方」，接着是免费第 1 课的 UTM 链接，最后是 VOA 署名和音乐署名。标题用 Clearandslow 和「清慢」，不用 VOA 当频道名。

### 8.6 每条片子核对

- 竖屏 1080×1920，45–60 秒，能在桌面播放器里播完，没有黑边把字幕裁掉。
- 站主没有出镜，没有手机界面。
- VOA 画面只有几秒，没有通讯社角标，没有整集。
- 片内中文品牌是「清慢」，英文是 Clearandslow，没有 VOA 字样当名称；片尾仍有公共领域署名。
- 字幕和落地页同一种汉字：台湾、香港用繁体地址，新加坡、马来西亚用简体地址。
- 说明栏链接是新域名（搬家前先不发这支片），并带 `utm_source=youtube` 或 `instagram`、`utm_medium=short` 或 `reel`、`utm_campaign=launch14d`。
- 音乐曲名和作者写在说明栏。
- 没有价格、微信号、开通页、兑换码。
- 同一支片先发 YouTube，再发 Reels；不要在同一天把同一文件贴进五个地方。
