# 付费墙三步修复 · 执行方案（阶段 1）

**状态**：方案稿，供 Grok 4.6 落地；**本阶段禁止改业务逻辑**（本文档除外）。  
**范围**：审查 ROI 最高三步 + 可选极小改动；**不做** L3 真支付、小程序迁移、服务端核销、课正文加密。

---

## A. 范围与决策

### A1. 停用当前公开 25 条码（`data/codes.json`）

#### 目标

- GitHub 仓库与 GitHub Pages 上**不再存在可用的明文兑换码库存**。
- 开通页仍可加载 `data/codes.json`（避免 `loadCodes` 整页报错），但**公开列表为空**。
- 运营发码走**仓库外**渠道；`scripts/gen-codes.py` 保留，**生成结果禁止 commit**。

#### 策略（执行方照此做，不要二选一摇摆）

| 项 | 决策 |
| --- | --- |
| 是否「清空」 | **是**：`data/codes.json` 改为 `{"codes":[]}`（或等价空数组）。**不要**在公开仓留占位假码、演示码、注释里的真码。 |
| 是否「轮换」进仓 | **否**。新批次**不得**再写入 `data/codes.json` 并 push。轮换只发生在运营私聊/离线表，不在公开 JSON。 |
| 历史 25 条 | 视为**已泄露库存**，全部作废；`docs/ops-redeem.md` 增加一句：2026-09 前提交进仓的码一律作废，勿再发放。 |
| Pages 部署后如何发码 | ① 本地 `python3 scripts/gen-codes.py --monthly N --quarterly M` ② 输出**仅**粘贴到微信私聊或离线发码表 ③ **禁止**把输出 append 进仓库。用户仍在 `pricing.html` 输入码；校验仍走浏览器 `findCode`，但公开 `codes.json` 为空 → **线上无法通过拉取 JSON 自助兑码**。 |
| 已付款未兑用户 | 运营用**新生成、未进仓**的单码私聊补发；文档写清流程，不在仓里留库存。 |

#### 避免再次提交明文库存（必须落地至少 2 层）

1. **文档约束**（改 `docs/ops-redeem.md`）：明确「`data/codes.json` 在公开仓永远保持 `codes: []`；发码只走私聊」。
2. **仓库护栏**（推荐，改动极小）：
   - 新增 `scripts/check-codes-json.sh`（或 Python 几行）：若 `data/codes.json` 里 `codes.length > 0` 则 **exit 1**。
   - 在 `README.md`「Local preview」或「Paywall」小节加一句：合并前本地跑 `bash scripts/check-codes-json.sh`。
   - **可选**（若执行方熟悉 GitHub Actions）：`.github/workflows/check-codes.yml` 仅在 PR 上跑上述脚本；无 workflow 时仅靠脚本 + 审查，不阻塞本方案。
3. **不要**把 `data/codes.json` 加入 `.gitignore`（会破坏 Pages 静态路径 `fetch("data/codes.json")`）；用**空文件 + CI/脚本**代替。

#### 涉及文件

- `data/codes.json` → `{"codes":[]}`
- `docs/ops-redeem.md` → 发码流程、作废说明、禁止 commit 库存
- `README.md` → 与 ops 一致（删除任何暗示「从仓里取码发用户」的表述，若有）
- 可选：`scripts/check-codes-json.sh`

#### 验收（本步）

```bash
# 本地仓
python3 -c "import json; assert len(json.load(open('data/codes.json'))['codes'])==0"
bash scripts/check-codes-json.sh   # 若已加脚本，应 exit 0

# 部署后（执行方或验收方）
curl -sS 'https://1019666077-bit.github.io/wx-extract-mvp/data/codes.json' | python3 -c "import sys,json; assert len(json.load(sys.stdin)['codes'])==0"
```

#### 风险

- **已习惯从仓里复制码的运营**会断流程 → ops 文档写替代步骤。
- **纯静态校验**：用户仍可在本地改 `codes.json` 或改 `localStorage`；本步目标是**止血公开库存漏收**，不是安全加固（与审查 P0-1 一致）。

---

### A2. 月付 / 季卡 `expiresAt` + `isUnlocked` 过期

#### 目标

- 「月付 ¥39」「季卡 ¥99」在**本机解锁状态**上有可验证的到期时间。
- 过期后 `isUnlocked()` 为 false，付费课恢复锁定（与现有 `canOpenLesson` 一致）。
- `pricing.html` / `js/app.js` 展示与文案一致。

#### 时长规则（写死，避免执行方自行解释）

| plan | `expiresAt` 计算（从 `redeem()` 调用时刻 `nowFn()` 起算） |
| --- | --- |
| `monthly` | **+30 自然日**（`Date` 加 30×24h 或 `setUTCDate(getUTCDate()+30)`，与现有 `nowFn` ISO 存储一致即可） |
| `quarterly` | **+90 自然日** |
| 其它 / 缺失 plan | **+30 自然日**（保守默认，或 `redeem` 抛错——推荐默认 30 天并在测试里覆盖） |

存储形状（在现有字段上扩展，勿破坏旧数据读取）：

```json
{
  "active": true,
  "code": "LLE-M-XXXXXX",
  "plan": "monthly",
  "unlockedAt": "2026-09-21T12:00:00.000Z",
  "expiresAt": "2026-10-21T12:00:00.000Z"
}
```

#### `js/unlock.js` 逻辑（文件级要求）

1. **`redeem(codeEntry)`**  
   - 根据 `codeEntry.plan` 写入 `expiresAt`（ISO 字符串）。  
   - 仍 `writeUnlock({ active: true, ... })`。

2. **`readUnlock()`**  
   - 解析后若 `active !== true` → `null`。  
   - 若存在 `expiresAt` 且 `nowFn() > new Date(expiresAt)` → 视为无效：可选 **自动 `clearUnlock()`** 或返回 `null`（推荐：返回 `null` 且 `isUnlocked` false；**可选**同步 `removeItem` 清脏数据，测试需固定一种行为并写进断言）。

3. **`isUnlocked()`**  
   - `readUnlock()` 非 null 且未过期 → true。

4. **向后兼容**  
   - 旧数据仅有 `unlockedAt`、无 `expiresAt`：**视为已过期**或 **视为需重新兑码**（推荐：**无 `expiresAt` 视为过期**，逼用户重新私聊发码；在 ops 里写一句「上线到期功能后旧 unlock 需重新兑码」）。若产品要温和，可写「无 expiresAt 则 unlockedAt+30d」——**本方案采用：无 `expiresAt` → 过期**，与清空公开码一起推动重新发码。

#### `js/app.js` / `pricing.html` 对齐

- `renderPricingState()`：已解锁时展示  
  `已解锁 · 月付 ¥39 · 到期 YYYY-MM-DD`（到期日用 **Asia/Shanghai** 格式化，与 `study.js` 一致；**禁止**再用 `unlockedAt.slice(0,10)` 当到期日）。  
- 未解锁 / 已过期：  
  `当前未解锁或已过期。仅 Level 1 第 1–5 课可免费试学。`  
- `pricing.html`：  
  - `plan-card` 下 `plan-note`：月付改为「开通后 30 天有效」；季卡「开通后 90 天有效」（与实现一致）。  
  - 不在 HTML 里写「永久」「买断」类词。

#### 单测（`js/unlock.test.js`）

新增/调整用例（均用 `createUnlock({ storage, now })` 固定时间）：

| 用例 | 断言要点 |
| --- | --- |
| monthly 写入 expiresAt | `redeem` 后 JSON 含 `expiresAt`，且约为 `unlockedAt + 30d` |
| quarterly +90d | plan `quarterly` → +90d |
| 未过期 isUnlocked true | `now` 在 expires 前 |
| 过期 isUnlocked false | `now` 在 expires 后；`canOpenLesson(lle1-06)` false |
| 无 expiresAt 旧状态 | 按方案：视为过期 |
| clearUnlock 不变 | 现有测试保持通过 |

**不要**在测试里引用 `data/codes.json` 真码；继续用 `VOA-DEMO-*` 夹具。

#### 涉及文件

- `js/unlock.js`（主逻辑）
- `js/app.js`（`renderPricingState` 展示到期日；如需小函数 `formatUnlockExpiry(state)` 可放在 `app.js` 或 `unlock.js` 导出，**保持改动面小**）
- `pricing.html`（方案说明 30/90 天）
- `js/unlock.test.js`
- `README.md` localStorage 表：补充 `expiresAt` 字段说明
- `docs/ops-redeem.md`：月/季=30/90 天本机有效；过期需重新私聊发码

#### 验收

```bash
node --test js/study.test.js js/unlock.test.js
# 期望：全绿，且 unlock 测试数 > 原 6 个
```

手动（验收方可选）：

1. 本地 `python3 -m http.server`，用**私聊单码**（本地临时写入 `codes.json` 仅本地测，**不 commit**）兑 monthly。  
2. DevTools 把 `voa-lle-unlock` 的 `expiresAt` 改为昨天 → 刷新 pricing / lle1-06 应再锁。

---

### A3. 开通页权益 vs 打卡 / 错题本（对齐方式）

#### 决策（执行方必须采用本推荐，勿改锁打卡）

**推荐：改文案，不增加打卡/错题门闩。**

| 理由 | 说明 |
| --- | --- |
| 实现与事实 | `initProgress` / `initWrongbook` / 首页 `renderCheckinCalendar` **从未**检查 `isUnlocked()`；README 已写未解锁可用。 |
| 产品 | 试学 1–5 课即可打卡、攒错题，利于转化；锁打卡会伤害免费试学体验。 |
| ROI | 只改 HTML + `catalogNoteText` / 付费墙段落，不动学习主路径。 |
| 合规 | 与 `docs/ops-redeem.md`「卖打卡、错题」运营表述冲突时，**以本方案为准**：对外统一为「打卡、错题本**免费**；付费解锁的是**全部课程目录与课页**」。并同步改 ops 第 12–13 行卖点列表。 |

#### 具体文案替换（统一句式，避免「开通才保留」）

**统一表述**：  
「打卡日历与错题本**免费使用**（无需开通）。开通后解锁 Level 1 第 6 课起及全部 Level 2 已上线课程。」

需改位置（逐文件搜索旧句替换）：

| 文件 | 位置 |
| --- | --- |
| `pricing.html` | `subtitle`、`perk-list` 三条（第 2、3 条拆开：打卡/错题免费；第 1 条仅「解锁课程」） |
| `index.html` | `.catalog-note` 静态段（与 JS 动态段一致） |
| `js/app.js` | `catalogNoteText()` 未解锁/已解锁两句；`renderLessonPaywall()` 内 `<p>` |
| `docs/ops-redeem.md` | 「卖什么」列表 |
| `README.md` | Paywall 小节一句（若有「保留打卡」） |

**禁止**：在 `initProgress` / `initWrongbook` / `gradeQuiz` 加 `if (!isUnlocked()) return`（本方案 Won't do 锁门闩）。

#### 验收

- 未解锁状态下：`progress.html`、`wrongbook.html`、首页日历仍可用（与现行为同）。  
- `pricing.html` 全文无「开通后才保留打卡/错题本」类表述。  
- `grep -r "保留打卡" .` 仅允许出现在「免费使用」或历史 changelog 之外为 0（执行方自检）。

---

## B. 可选小修（改动面极小可并入同一 PR，否则 Won't do）

| 项 | 建议 | 并入条件 |
| --- | --- | --- |
| 课页 unofficial eyebrow | `lesson.html` L20：`Unofficial VOA study helper`（与 index 一致） | **并入**（1 行） |
| `writeProgress` try/catch | `js/app.js` `writeProgress` 与 `study.js` `writeJson` 包 try/catch，失败时 `console.warn` 或静默，避免交卷抛错 | **并入**（各 ~5 行） |
| GitHub description「极夜回收线」 | 改为如 `VOA Let's Learn English 非官方静态自学页` + Homepage = Pages URL | **不写入业务 PR**（需 GitHub UI / `gh repo edit`）；验收方在 PR 描述里提醒 PO 手改 |
| 关闭/更新草稿 PR #2 | **关闭** PR #2（main 已有 Pages URL；合并会回退 README） | **不代码**；PR 评论或 PO 在 GitHub 点 Close |

**本 PR Won't do（明确不写进执行范围）**

- 锁打卡/错题、`app.js` 单测、全量视频 HEAD CI、L1 `_hq` 统一、小程序、后端核销、加密 `lessons.json`、`.gitignore` 掉 `codes.json`。

---

## C. 文件级改动清单（执行方 checklist）

| 文件 | 动作 |
| --- | --- |
| `data/codes.json` | `codes: []` |
| `docs/ops-redeem.md` | 作废旧码、禁止 commit 库存、30/90 天、发码私聊流程、卖点与 A3 对齐 |
| `docs/FIX_PAYWALL_PLAN.md` | 本文件（已存在）；可在 PR 中注明「已按方案执行」 |
| `js/unlock.js` | `expiresAt`、过期判断、无 expiresAt 策略 |
| `js/unlock.test.js` | 新增过期/计划时长用例 |
| `js/app.js` | `renderPricingState` 到期展示；`catalogNoteText` / `renderLessonPaywall` 文案；可选 `writeProgress` try/catch |
| `js/study.js` | 可选 `writeJson` try/catch |
| `pricing.html` | 30/90 天说明 + A3 权益文案 |
| `index.html` | `catalog-note` 静态文案 |
| `lesson.html` | unofficial eyebrow（可选） |
| `README.md` | unlock 字段、codes 空数组、检查脚本说明 |
| `scripts/check-codes-json.sh` | 可选：非空 codes 失败 |
| `.github/workflows/check-codes.yml` | 可选 |

**建议单 PR、单分支**（如 `cursor/fix-paywall-roi-a984`），避免与课内容 PR 混杂。

### 验收命令（验收方 Composer 阶段 3 必跑）

```bash
# 1. 单测
node --test js/study.test.js js/unlock.test.js

# 2. codes 为空
python3 -c "import json; assert len(json.load(open('data/codes.json'))['codes'])==0"
test -f scripts/check-codes-json.sh && bash scripts/check-codes-json.sh

# 3. 文案自检（示例）
rg "保留打卡与错题本" --glob '*.{html,js,md}' && exit 1 || true
rg "开通后仍保留|免费使用" pricing.html index.html js/app.js docs/ops-redeem.md

# 4. 部署后（若已 merge Pages）
curl -sS 'https://1019666077-bit.github.io/wx-extract-mvp/data/codes.json' | python3 -c "import sys,json; assert len(json.load(sys.stdin)['codes'])==0"
```

### PR 标题 / 摘要草稿

**标题**：`fix: 清空公开兑换码、解锁到期与开通文案对齐`

**摘要**：

- 将 `data/codes.json` 置空并更新运营文档：公开仓不再存放可用码；发码仅私聊 + `gen-codes.py` 本地生成。
- `unlock.js` 为月付/季卡写入 `expiresAt`（30/90 天），过期后 `isUnlocked` 失效；开通页展示到期日（上海时区）。
- 统一文案：打卡/错题本免费；付费仅解锁课程。同步 `pricing.html`、`index.html`、`app.js`、`ops-redeem.md`。
- 可选：课页 unofficial 眉标、`writeProgress`/`writeJson` try/catch、`check-codes-json.sh`。
- 测试：`node --test js/study.test.js js/unlock.test.js` 全通过。

**不声称**：修复付费墙安全、支持中国大陆访问、真支付。

### 风险与回滚

| 风险 | 缓解 | 回滚 |
| --- | --- | --- |
| 线上无法再自助兑公开码 | 预期；私聊发本地生成的码 | 不回滚空 codes（除非紧急误删文档）；回滚 commit 会恢复泄露库存，**禁止** |
| 旧 `localStorage` 无 `expiresAt` 立刻失效 | ops 通知补码 | revert `unlock.js` 过期逻辑（仅紧急情况） |
| 已付款用户找不到码 | ops 用 gen-codes 私聊新发 | — |
| `check-codes` CI 误拦合法 PR | 仅拦 `codes.length>0` | 删 workflow / 脚本 |

---

## D. 本阶段不要实现

- 任何**新的可用兑换码**写入 git 或 Pages 上的 `data/codes.json`。
- 服务端核销、微信/Stripe 支付、登录账号、小程序代码。
- 对 `data/lessons.json` 做访问控制或拆分加密。
- 锁定 `progress.html` / `wrongbook.html`（除非 PO 推翻 A3 并另开方案）。
- 关闭 PR #2 / 改 GitHub description（可 PR 备注由人操作，不阻塞合并）。
- L3、全量 82 课视频探测 CI、重构 `app.js` 模块化。

---

**执行顺序建议（Grok）**：  
1 → `data/codes.json` + ops/README + check 脚本  
2 → `unlock.js` + tests + app/pricing 到期展示  
3 → 文案 A3 全站 grep 收尾  
4 → 可选 eyebrow + try/catch  
5 → 跑验收命令 → 开 PR。

---

PLAN READY
