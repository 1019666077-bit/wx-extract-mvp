# 在浏览器里接上 Waffo 沙箱和 Cloudflare Worker

代码在仓库的 `worker/`，还没有部署，也没有把任何密钥提交到 Git。下面每一步都可以在浏览器和本机终端里做完。不要把私钥、API Key 贴进网页仓库。

站点源站是 `https://1019666077-bit.github.io/wx-extract-mvp`。Worker 名字是 `voa-lle-unlock`。

## 1. 生成两把密钥

在本机空目录里执行。这些文件留在本机，不要 `git add`。

商户 RSA（上传给 Waffo 的是公钥；私钥进 Worker 密钥）。命令与 [Configure the merchant public key](https://waffo.com/docs/en/developer-docs/getting-started/public-key-configuration.md) 一致：

```bash
openssl genpkey -algorithm RSA \
  -pkeyopt rsa_keygen_bits:2048 \
  -out merchant_private_key.pem

openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
  -in merchant_private_key.pem \
  | grep -v '^-----' \
  | tr -d '\n' > merchant_private_key.base64

openssl rsa -in merchant_private_key.pem -pubout \
  | grep -v '^-----' \
  | tr -d '\n' > merchant_public_key.base64
```

`merchant_public_key.base64` 是一行 X.509/SPKI Base64，没有 `-----BEGIN`。公开文档要求这串公钥的长度是 392。

解锁凭证用另一把 Ed25519。公钥以后写进网页，私钥只放进 Worker：

```bash
openssl genpkey -algorithm ED25519 -out unlock_private_key.pem

openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
  -in unlock_private_key.pem \
  | grep -v '^-----' \
  | tr -d '\n' > unlock_private_key.base64

openssl pkey -in unlock_private_key.pem -pubout \
  | grep -v '^-----' \
  | tr -d '\n' > unlock_public_key.base64
```

沙箱和正式环境必须各用一套商户 RSA 和 API Key。解锁这把 Ed25519 可以先继续用同一把；换它会使已经发出的凭证全部失效。

## 2. Waffo 沙箱门户要抄出来的值

用审核邮件里的 Merchant Portal 登录地址。公开文档没有给出一个可以猜的门户域名，不要自己编。

打开 Integration（开发或管理员角色）：

| 抄到哪里 | 门户里的东西 | Worker 里的名字 |
| --- | --- | --- |
| 一行文本 | API Key | 密钥 `WAFFO_API_KEY` |
| 一行文本 | Merchant Id | 密钥 `WAFFO_MERCHANT_ID` |
| 一行 Base64，不要 PEM 头尾 | Waffo public key（Waffo 的公钥，不是你刚生成的商户公钥） | 密钥 `WAFFO_PUBLIC_KEY` |

API 根地址不要从门户猜。公开文档写的是：

| 环境 | 值 |
| --- | --- |
| 沙箱 | `https://api-sandbox.waffo.com` |
| 正式 | `https://api.waffo.com` |

沙箱已经写在 `worker/wrangler.toml` 的 `WAFFO_API_BASE`，不用再设成密钥。

上传到门户的是 `merchant_public_key.base64` 的全部内容（Merchant Sign Configuration，API Operation Type 选 Payin）。门户如果给出一段 `WAFFO_VERIFY_...` 验证串，用下面的命令签名后再贴回去。把引号里的字符串换成门户上的整段，不要加空格或换行：

```bash
echo -n "WAFFO_VERIFY_XXXXXXXXXX" | \
  openssl dgst -sha256 -sign merchant_private_key.pem | \
  base64 | tr -d '\n'
```

`merchant_private_key.base64` 的全部内容放进密钥 `WAFFO_PRIVATE_KEY`。不要把这个文件上传到门户。

付款通知不用在门户填全局地址：每一笔订单的 `notifyUrl` 由 Worker 设成自己的 `/api/waffo/webhook`。退款和拒付要在门户 Settings → Integration 里各填一次（公开文档里的名字是 `refundNotifyUrl` 和 `chargebackNotifyUrl`）。Worker 部署完成、仪表盘给出地址之后，两处都填：

```text
https://<你的 workers.dev 主机名>/api/waffo/webhook
```

例如主机名是 `voa-lle-unlock.<账号子域>.workers.dev` 时，整段就是：

```text
https://voa-lle-unlock.<账号子域>.workers.dev/api/waffo/webhook
```

创单时 Worker 会自己带上跳转地址，一般不必在门户再填一套。如果门户另有全局成功 / 失败 / 取消地址，填下面三个（繁体用户的跳转由创单参数决定，门户全局项用简体页即可）：

```text
https://1019666077-bit.github.io/wx-extract-mvp/pricing-return.html
https://1019666077-bit.github.io/wx-extract-mvp/pricing.html
https://1019666077-bit.github.io/wx-extract-mvp/pricing.html
```

成功页只是回到本站。开通不看跳转参数，只看验过签名的付款通知。

在门户确认这份商户合同允许 `USD`。代码按课程标价发送 `orderCurrency=USD`、`orderAmount=5.99` 或 `13.99`。合同里没有 USD 时，沙箱创单会失败，先不要改价。

## 3. Cloudflare

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages。
2. 本机安装一次 Wrangler 并用浏览器登录（会打开 Cloudflare 的授权页）：

```bash
cd worker
npx wrangler login
```

3. 创建 KV，名字是 `voa-lle-orders`。绑定名必须是 `ORDERS`（已经写在 `wrangler.toml`，不要改这个绑定名）：

```bash
npx wrangler kv namespace create voa-lle-orders
npx wrangler kv namespace create voa-lle-orders --preview
```

两条命令各打印一个 `id`。把正式环境的 id 贴进 `worker/wrangler.toml` 里 `id = "replace_me"` 的引号中，把 preview 的 id 贴进 `preview_id`。这是命名空间 id，不是密钥，可以提交。

4. 五个密钥。每条命令执行后，终端会等你粘贴。粘贴的是一行，不要带 PEM 头尾，不要带换行。

```bash
npx wrangler secret put WAFFO_API_KEY
npx wrangler secret put WAFFO_MERCHANT_ID
npx wrangler secret put WAFFO_PRIVATE_KEY
npx wrangler secret put WAFFO_PUBLIC_KEY
npx wrangler secret put UNLOCK_PRIVATE_KEY
```

| 密钥名 | 粘贴什么 |
| --- | --- |
| `WAFFO_API_KEY` | 门户里的 API Key |
| `WAFFO_MERCHANT_ID` | 门户里的 Merchant Id |
| `WAFFO_PRIVATE_KEY` | `merchant_private_key.base64` 整行 |
| `WAFFO_PUBLIC_KEY` | 门户里的 Waffo 公钥（一行 Base64） |
| `UNLOCK_PRIVATE_KEY` | `unlock_private_key.base64` 整行 |

`wrangler.toml` 里已有的普通变量（不是密钥）：

| 变量 | 当前值 | 作用 |
| --- | --- | --- |
| `WAFFO_API_BASE` | `https://api-sandbox.waffo.com` | 改成 `https://api.waffo.com` 就是正式环境 |
| `ALLOWED_ORIGIN` | 与 `site.config.json` 的 `origin` 相同，由 `npm run build` 写入 | 浏览器 CORS 只允许这个源站。不要手改这一行 |

5. 部署（这一步会让 Worker 出现在公网，确认密钥都已放好再执行）：

```bash
npx wrangler deploy
```

仪表盘里 Worker 的名字是 `voa-lle-unlock`。复制它给出的 `https://....workers.dev` 地址。

6. 把解锁公钥和 Worker 地址写进仓库的 `site.config.json`，然后重新构建页面并推上去，GitHub Pages 才会让按钮可点：

```json
"worker": {
  "baseUrl": "https://voa-lle-unlock.<账号子域>.workers.dev",
  "unlockPublicKey": "<unlock_public_key.base64 的整行>"
}
```

```bash
npm run build
```

`unlockPublicKey` 是公钥，可以进 Git。`baseUrl` 不要末尾斜杠。两个值有一个仍是空字符串时，按钮保持「即将开放 / 即將開放」，页面不会请求 Worker。站点改放到 Cloudflare Pages 之后，同一次 `npm run build` 也会更新那边；先按第 6 节验收，再改 `origin`。

## 4. 沙箱怎么试

沙箱收银台是模拟器，没有真实扣款。公开说明见 [Sandbox simulator](https://waffo.com/docs/en/developer-docs/tools-and-references/developer-tools/sandbox-simulator.md)。

成功：

1. 打开 `https://1019666077-bit.github.io/wx-extract-mvp/pricing.html`（页面需已经带上 Worker 地址）。
2. 点「用 Waffo 支付 US$5.99」。应跳到沙箱收银台，地址来自创单结果里的 `webUrl` 或 `deeplinkUrl`。
3. 在模拟器上点 **Payment succeeded**。订单应变为 `PAY_SUCCESS`，Waffo 向 `notifyUrl` 发 `PAYMENT_NOTIFICATION`。
4. 浏览器回到 `pricing-return.html?order=m...`。页面会写「正在等待付款确认」，然后变成已开通。本机 `localStorage` 的 `voa-lle-unlock` 里应有 `credential`。
5. 打开一节 Level 1 第 6 课，应能学习。

失败：再下一笔，在模拟器上点 **Payment failed**。订单是 `ORDER_CLOSE`。返回页等到超时或关闭，课程保持锁定。不要根据跳回了网站就当成已付款。

退款：对刚才成功的那笔，在门户发起退款，或按沙箱能用的退款操作完成一笔全额或分额退款。退款通知必须打到第 2 节那个 `/api/waffo/webhook`。然后打开：

```text
https://<Worker 主机名>/api/status?order=<merchantOrderId>
```

应看到 `"state":"revoked"`，响应里没有 `credential`。再打开开通页，本机解锁会被清掉。`REFUND_IN_PROGRESS` 和 `ORDER_REFUND_FAILED` 不会撤销。

拒付：同一条 webhook 地址。`chargebackStatus` 为 `ACTION_REQUIRED`、`UNDER_REVIEW`、`SECOND_CYCLE_RESPONSE_REQUIRED`、`ESCALATE_TO_2ND_CYCLE`、`CASE_LOST`、`ACCEPTED`、`EXPIRED` 时撤销。`CASE_WON`、`CANCELED`、`SETTLED` 不撤销，也不会把已经撤销的凭证恢复。

重复通知：付款成功后，把同一次 webhook 的原始 body 和 `X-SIGNATURE` 再 POST 一次。

```bash
curl -sS -X POST "https://<Worker 主机名>/api/waffo/webhook" \
  -H "Content-Type: application/json" \
  -H "X-SIGNATURE: <同一份签名>" \
  --data-binary @body.json
```

应返回 `{"message":"success"}`，并且不会换一张新凭证。

领取只能一次。返回页第一次拿到凭证就会写入本机。同一浏览器再刷新：如果本机这张凭证还能验过，仍显示已开通，不会再向 Worker 要第二份。用隐私窗口打开同一个 `?order=` 地址，应看到「这张开通已经交付过一次，不能再次发放」。没有补发入口。

签名不对的通知返回 `{"message":"failed"}`，不签发。

## 5. 切到正式环境

1. 沙箱验收通过，并且 Waffo 已开通正式账号之后，再生成一套新的商户 RSA（不要复用沙箱那一对）。按第 1 节的 openssl 命令重做，把新公钥上传到正式门户，等状态变成 Active。
2. 从正式门户复制新的 API Key、Merchant Id、Waffo 公钥。
3. 用 `npx wrangler secret put` 覆盖 `WAFFO_API_KEY`、`WAFFO_MERCHANT_ID`、`WAFFO_PRIVATE_KEY`、`WAFFO_PUBLIC_KEY`。解锁私钥可以不换。
4. 把 `worker/wrangler.toml` 里的 `WAFFO_API_BASE` 改成：

```toml
WAFFO_API_BASE = "https://api.waffo.com"
```

5. 再执行 `npx wrangler deploy`。
6. 先做一笔小额真实订单，确认创单、收银台、`PAYMENT_NOTIFICATION` 验签、返回页开通、`/api/status` 都正常，再放开正常流量。

正式环境的退款和拒付通知 URL 同样是 `https://<Worker 主机名>/api/waffo/webhook`。

## 6. 把网站放到 Cloudflare Pages

付款上线之前，站点要改放到 Cloudflare Pages。GitHub 的条款不允许把 Pages 主要用来做商业交易。Git 仓库仍然是唯一源。现在不要改 `site.config.json` 的 `origin`，它仍是 `https://1019666077-bit.github.io/wx-extract-mvp`。GitHub Pages 继续从仓库根目录发布，直到本节的验收做完。旧地址的跳转以后再做，见本节最后。

### 用 GitHub Action 上传，不用 Cloudflare 的 Git 集成

构建会把 HTML 写回仓库根目录。如果让 Cloudflare 去连这个 Git 仓库并发布当前目录，会把 `worker/`、`miniprogram/`、`docs/` 和 `node_modules/` 一起传上去。所以 Action 先构建，再把站点拷进干净的 `dist/`，然后执行 `wrangler pages deploy`。

GitHub Pages 没有自己的工作流，它仍然发布分支根目录。新文件是 `.github/workflows/cloudflare-pages.yml`。它只在推到 `main`，或在 Actions 里对手动选中的、已经含有这个文件的分支点 Run workflow 时运行。两个密钥有一个是空的，这一步就打印说明并跳过上传，不会把现有的检查跑失败。合并到 `main` 之前，这个工作流不会因为本分支的推送而部署。

Cloudflare 账号与第 3 节的 Worker 是同一个。

### 项目名

Pages 项目名是 `lle-learn`。预览地址将是 `https://lle-learn.pages.dev`。

不要用 `voa-lle`。项目名会进 `pages.dev` 主机名，`voa-lle.pages.dev` 里含有 VOA。最终品牌还没定，公开地址里不要出现 VOA。Worker 的名字仍是 `voa-lle-unlock`，这一步不要改。

### 每一项设置

在仪表盘 Workers & Pages → Create → Pages 里，选直接上传（Upload assets），不要选 Connect to Git。项目名填 `lle-learn`。第一次也可以不在仪表盘建：下面的部署命令会在这个账号里创建同名项目。生产分支、构建设置都留空，因为不走 Git 集成。

构建发生在 GitHub Action，按这个顺序：

| 步骤 | 值 |
| --- | --- |
| Node | 22 |
| 安装 | `npm ci` |
| 构建命令 | `node scripts/build-pages.js` |
| 整理输出 | `node scripts/stage-pages.js` |
| 输出目录 | `dist` |
| 部署命令 | `npx wrangler pages deploy dist --project-name=lle-learn --commit-dirty=true` |

仪表盘里的 Build command 填 none（留空）。不要把构建命令填进 Cloudflare，否则会和 Action 各建一次。

`dist/` 不进 Git。里面是站点根：`index.html`、`robots.txt`、`sitemap.xml`、`_headers`、`_redirects`、`css/`、`js/`（不含 `*.test.js`）、`img/`、`lessons/`、`zh-hant/`、`data/`。没有 `worker/`、`miniprogram/`、`docs/`。

在 Cloudflare Pages 上，站点在域名根，不在 `/wx-extract-mvp/` 下面。所以 `https://lle-learn.pages.dev/robots.txt` 和 `/sitemap.xml` 就是搜索引擎要读的那两份。`/zh-hant/` 仍是繁体前缀。课页用相对路径（`../css/styles.css`、`../../css/styles.css`），在域名根和现在的项目路径上都会落到 `/css/styles.css`。运行时代码不写死 `/wx-extract-mvp/`。

`_headers` 和 `_redirects` 只对 Cloudflare Pages 生效。GitHub Pages 忽略这两个文件。`lesson.html` 里的脚本仍然负责 GitHub 上的旧链接。

`_headers`：所有响应带 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: SAMEORIGIN`、`Permissions-Policy: camera=(), microphone=(), geolocation=()`，以及只限制嵌入和 object 的 `Content-Security-Policy`（`frame-ancestors 'self'; base-uri 'self'; object-src 'none'`）。没有收紧 `script-src`，否则 `lesson.html` 里的跳转脚本和以后对 Worker 的请求会被挡住。HTML 使用 `Cache-Control: public, max-age=0, must-revalidate`。`/css/`、`/img/` 七天，`/js/`、`/data/` 一小时；这些规则先用 `! Cache-Control` 去掉上面的 HTML 缓存，避免两个 `Cache-Control` 被拼成一行。

`_redirects`：

```text
/lesson.html?id=:id /lessons/:id.html 301
/zh-hant/lesson.html?id=:id /zh-hant/lessons/:id.html 301
```

### GitHub 密钥

仓库 Settings → Secrets and variables → Actions，新建两个：

| 密钥 | 填什么 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 只给这个账号的 API Token，权限是 Account → Cloudflare Pages → Edit |
| `CLOUDFLARE_ACCOUNT_ID` | 仪表盘右侧栏或 Workers 概览里的 Account ID |

Token：右上角头像 → My Profile → API Tokens → Create Token → Create Custom Token。Permission 选 Account、Cloudflare Pages、Edit。Account Resources 只选放 Worker 的那个账号。不要选所有账号。如果 Action 报还要读账号信息，再加一条 Account → Account Settings → Read，然后换上新 Token。

两个都填上之后，推到 `main`（或在 Actions 里手动跑 Cloudflare Pages）才会上传。在此之前工作流会成功结束，但不会部署。

### 改 origin 之前先验收

不要先改 `origin`。等 `https://lle-learn.pages.dev` 出现之后检查：

1. 打开 `/`。简体目录能用，样式来自 `/css/styles.css`。
2. 打开 `/zh-hant/`。繁体目录能用。页面里写的是 `../css/styles.css`，实际仍是 `/css/styles.css`。
3. 打开 `/lessons/lle1-01.html` 和 `/zh-hant/lessons/lle1-01.html`。课页样式正常，地址里没有 `/wx-extract-mvp/`。
4. 打开 `/lesson.html?id=lle1-01`，应到 `/lessons/lle1-01.html`。繁体 `/zh-hant/lesson.html?id=lle1-01` 应到 `/zh-hant/lessons/lle1-01.html`。Cloudflare 走上面的 301；301 没有生效时，页面自己的脚本仍会跳。
5. 打开 `/robots.txt` 和 `/sitemap.xml`，确认它们在域名根，不在 `/wx-extract-mvp/` 下面。
6. 打开 `/pricing.html`。按钮仍是「即将开放」，不请求 Worker。
7. 响应头里有 `X-Content-Type-Options: nosniff`。HTML 是 `Cache-Control: public, max-age=0, must-revalidate`。
8. 再打开原来的 `https://1019666077-bit.github.io/wx-extract-mvp/`，确认 GitHub Pages 还能用。

验收通过之后才改源站。canonical、hreflang、sitemap、Open Graph、JSON-LD 和 Worker 的 CORS 都跟这一个字段：

1. 把 `site.config.json` 的 `origin` 改成 `https://lle-learn.pages.dev`，不要末尾斜杠。以后绑了自定义域名，再改成那个 `https://` 地址，然后重复下面两步。
2. 运行 `npm run build`。它会重写页面，并把 `worker/wrangler.toml` 的 `ALLOWED_ORIGIN` 改成同一个值。不要手改那一行。
3. 提交并推到 `main`，等 Pages 工作流把新的 `dist/` 传上去。
4. 在 `worker/` 里再执行一次 `npx wrangler deploy`。CORS 要这次部署才换成新源站。部署之前，Worker 仍只允许旧的 GitHub Pages 地址。

### 以后再把旧的 github.io 地址指过来

这一步现在不要做。GitHub 不能给 `*.github.io` 的项目页配置 HTTP 301。

等 Pages 验收通过，并且 `origin` 已经改成新地址、两边都部署过之后：

- 在 GitHub Pages 上留一个壳。根目录和主要路径用 meta refresh，或一小段脚本：去掉路径里的 `/wx-extract-mvp`，打开新 origin 上的同一路径。页面的 canonical 指向新地址。
- 只改 canonical、不跳转，也能让搜索引擎合并到新地址，但收藏了旧链接的人仍会停在 GitHub Pages。跳转壳是给人用的。
- 不要删仓库。Git 仍然是源。

