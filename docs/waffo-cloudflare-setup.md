# 用 Waffo Pancake 接上付款（还没部署）

代码在 `worker/`，还没有部署，也没有把任何密钥提交到 Git。下面每一步都可以在浏览器和本机终端里做完。不要把私钥、API Key 贴进网页仓库。

实际开通的是 **Waffo Pancake**（商户后台 [pancake.waffo.ai](https://pancake.waffo.ai)，商户代收 / Merchant of Record），不是 `api-sandbox.waffo.com` 那套原生收单网关。不要自己用 openssl 生成商户 RSA，不要往后台上传 Payin 公钥，也不要再找旧的 Merchant Id。

站点源站仍是 `https://1019666077-bit.github.io/wx-extract-mvp`。Worker 名字仍是 `voa-lle-unlock`。VOA 这家店先不要建：等网站放到 Cloudflare Pages，并且价格页、服务条款、隐私政策、退款政策都在线上之后再建。法律页顶部没有生效日期。联系邮箱只写在 `site.config.json` 的 `contactEmail`，现在仍是占位。

公开文档（以页面为准，不要猜字段名）：

| 做什么 | 文档 |
| --- | --- |
| 建收银台 | [Create Checkout Session](https://docs.waffo.ai/api-reference/endpoints/orders/create-checkout-session.md) |
| 请求怎么签名 | [Authentication](https://docs.waffo.ai/api-reference/authentication.md) |
| Webhook 验签和事件 | [Webhooks](https://docs.waffo.ai/api-reference/webhooks.md)、[Webhook guide](https://docs.waffo.ai/guides/webhooks.md) |
| 域名验证 | [Domain verification](https://docs.waffo.ai/settings/domain-verification.md) |
| 拒付 | [Chargebacks](https://docs.waffo.ai/mor/chargebacks.md) |

## 1. 只生成我们自己的解锁私钥

Pancake 的 API 私钥由后台生成，见第 3 节。这里只生成开通凭证用的 Ed25519。公钥以后写进网页，私钥只放进 Worker 密钥 `UNLOCK_PRIVATE_KEY`。文件留在本机，不要 `git add`。

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

Test 和 Live 可以继续用同一把解锁私钥。换它会使已经发出的凭证全部失效。

## 2. 在 Pancake 后台建店、商品和域名

登录 [pancake.waffo.ai](https://pancake.waffo.ai)。Test 和 Live 完全分开：API & Development 有两个标签页，Webhooks 也是 Test / Live 各一把公钥。先全程停在 **Test**。

### 2.1 建 Store

业务按店区分。VOA 店等网站已经在 Cloudflare Pages、价格页和法律页都能打开之后再创建。

1. 建店之后打开 **Settings → General**。
2. 填这家店的网站地址（以后是 Pages 的域名根，现在不要先填 github.io 当作正式店）。
3. 做域名验证。两条路二选一：DNS TXT，或 HTML meta。用 HTML meta 时，后台会给一串 challenge。

HTML meta 的标签名是文档里的 `waffo-verify`。把它贴进 `site.config.json` 的 `payment.pancake.domainVerify`，然后 `npm run build`。构建会把下面这一行写进简体和繁体首页的 `<head>`（原始 HTML，不是脚本插进去的）：

```html
<meta name="waffo-verify" content="后台给的challenge" />
```

`domainVerify` 是空字符串时，这一行不会出现。challenge 每次验证单独发，过期作废；验完可以再把配置改回空并重新构建。文档：[Domain verification](https://docs.waffo.ai/settings/domain-verification.md)。

### 2.2 建两个一次性商品

商品默认币种是 USD。Test Mode 已经用 USD 付成功过。建一次性商品，不要建成订阅：

| 商品 | 价格 | 本站对应 |
| --- | --- | --- |
| 30 天课程开放 | US$5.99 | 月付 |
| 90 天课程开放 | US$13.99 | 季卡 |

每个商品复制 `PROD_` 开头的 id，写进 `site.config.json`：

```json
"pancake": {
  "monthlyProductId": "PROD_……",
  "quarterlyProductId": "PROD_……",
  "domainVerify": ""
}
```

然后 `npm run build`。构建会把这两个 id 抄进 `worker/wrangler.toml` 的 `PANCAKE_PRODUCT_MONTHLY` 和 `PANCAKE_PRODUCT_QUARTERLY`。不要手改那两行。任一 id 仍是空的，开通按钮保持「即将开放 / 即將開放」，页面不请求 Worker。

价格只在后台商品上定。Worker 创单不传 `priceSnapshot`，前端传来的金额一律忽略。

文档写明：API Key 和 `X-Merchant-Id` 是商户级的，一家商户底下所有店共用同一套密钥；某次调用落到哪家店，由商品 `productId` 属于哪家店决定。后台 Integration 页上展示的 Store Id 只是示例（默认最近一家店），不要把它当成 `X-Merchant-Id`。这和「密钥按店还是按账户」当时没核对完的地方，以这篇 [Authentication](https://docs.waffo.ai/api-reference/authentication.md) 为准。如果 Test 标签页上确实找不到 `MER_` 开头的商户编号，先停下来问，不要编一个，也不要填旧网关的 Merchant Id。

### 2.3 创建 API Key（不要自己生成 RSA）

打开 **API & Development**（路径 `/merchant/dashboard/integration`），停在 **Test** 标签。

1. 点 **Create API Key**。后台生成 RSA 密钥对，公钥由后台自己保存。
2. 起名（例如 `lle-test`），环境选 Test。
3. 立刻下载私钥。页面关掉之后不会再显示。下载到的是 `-----BEGIN RSA PRIVATE KEY-----`（PKCS#1）。Worker 能直接用这种 PEM，也会接受 PKCS#8。不要再跑 `openssl genpkey`，也不要把公钥上传到 Payin。

另外抄下请求头要用的 **X-Merchant-Id**（文档示例是 `MER_` 开头）。它不是旧网关的 Merchant Id，密钥名是 `WAFFO_PANCAKE_MERCHANT_ID`，和已经删掉的 `WAFFO_MERCHANT_ID` 不是同一个东西。

Live 标签以后另建一把，两把不要混用。删掉一把之后，用它签名的请求会 401，而且不能撤销。

### 2.4 登记 Webhook

打开 **Settings → Webhooks**。Test 和 Live 各有一把 Public Key，每边最多 10 个端点。所有店看到的是同一把环境公钥，改端点不会换钥匙。

1. 抄下 **Test** 的 Webhook Public Key（`-----BEGIN PUBLIC KEY-----`）。这是验签用的，密钥名 `WAFFO_WEBHOOK_PUBLIC_KEY`。
2. 加一个 HTTP 端点，环境选 Test。URL 等 Worker 部署之后填：

```text
https://<Worker 主机名>/api/waffo/webhook
```

例如 `https://voa-lle-unlock.<账号子域>.workers.dev/api/waffo/webhook`。

3. 勾选这些事件：

| 事件 | Worker 做什么 |
| --- | --- |
| `order.completed` | 一次性付款成功，才签发开通凭证 |
| `refund.succeeded` | 钱已经退回，作废凭证 |
| `refund.failed` | 钱没动，不作废 |

不要勾 `subscription.*`。若仍然收到，Worker 忽略并返回 HTTP 200，不延长、不作废凭证。订阅以后看数据再定。

退款没有单独的「处理中」事件。工单在审核或处理时不会发 webhook；只有渠道把结果定下来才发。`refund.succeeded` 才作废，`refund.failed` 不作废。文档：[Webhooks](https://docs.waffo.ai/api-reference/webhooks.md) 的 Refund Lifecycle。

本店政策是数字内容购买后立即开通，不予退款，除非适用法律或 Waffo Pancake 的规则强制要求。结账请求必须带上同意标记；Worker 把同意时间和 `TERMS_VERSION` 写进该订单。`refund.succeeded` 仍然作废凭证。Pancake 文档里的退款窗口见 [Refunds](https://docs.waffo.ai/features/refunds.md) 和 [Billing Questions](https://docs.waffo.ai/customers/billing.md)，那是平台规则，不是本店给出的退款期。

拒付没有 webhook。Pancake 发邮件通知，回复寄到 `chargebacks@waffo.ai`。Worker 不会因为一封拒付邮件自动作废。见 [Chargebacks](https://docs.waffo.ai/mor/chargebacks.md)。

验签算法（不要换成旧网关的 `X-SIGNATURE` 签整个 body）：

1. 读请求头 `X-Waffo-Signature`，形如 `t=<毫秒时间戳>,v1=<Base64>`。
2. 用后台这把公钥，对字符串 `` `${t}.${原始body}` `` 做 RSA-SHA256（PKCS#1 v1.5）验签。必须用原始 body，不能先 JSON 再序列化。
3. `t` 允许偏离当前时间最多 45 分钟。重试沿用第一次的 `t`，收成 5 分钟会把合法重试拒掉。
4. 用 payload 里的 `eventId` 去重。
5. 签名不对返回 HTTP 401。处理完返回 HTTP 200，正文 `OK`。不再返回旧网关的 `{"message":"success"}`。

`mode` 为 `"test"` 或 `"prod"`。Worker 变量 `PANCAKE_MODE` 必须和这把公钥、这把 API Key 是同一边。对不上的事件验签通过也不会签发。

## 3. Cloudflare Worker

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages。
2. 本机安装一次 Wrangler 并用浏览器登录：

```bash
cd worker
npx wrangler login
```

3. 创建 KV，名字是 `voa-lle-orders`。绑定名必须是 `ORDERS`：

```bash
npx wrangler kv namespace create voa-lle-orders
npx wrangler kv namespace create voa-lle-orders --preview
```

把正式环境的 id 贴进 `worker/wrangler.toml` 的 `id`，preview 的 id 贴进 `preview_id`。这是命名空间 id，可以提交。

4. 四个密钥。私钥可以整段粘贴 PEM（含 `BEGIN` / `END`），也可以粘贴去掉头尾后的一行 Base64。

```bash
npx wrangler secret put WAFFO_PANCAKE_API_KEY
npx wrangler secret put WAFFO_PANCAKE_MERCHANT_ID
npx wrangler secret put WAFFO_WEBHOOK_PUBLIC_KEY
npx wrangler secret put UNLOCK_PRIVATE_KEY
```

| 密钥名 | 粘贴什么 |
| --- | --- |
| `WAFFO_PANCAKE_API_KEY` | Test 标签下载的 RSA 私钥（`BEGIN RSA PRIVATE KEY`） |
| `WAFFO_PANCAKE_MERCHANT_ID` | 请求头 `X-Merchant-Id` 的 `MER_…` 值 |
| `WAFFO_WEBHOOK_PUBLIC_KEY` | Settings → Webhooks 里 Test 的 Public Key |
| `UNLOCK_PRIVATE_KEY` | 第 1 节的 `unlock_private_key.base64` |

不要再创建 `WAFFO_API_KEY`、`WAFFO_MERCHANT_ID`、`WAFFO_PRIVATE_KEY`、`WAFFO_PUBLIC_KEY`。

`wrangler.toml` 里的普通变量（不是密钥）：

| 变量 | 当前值 | 作用 |
| --- | --- | --- |
| `WAFFO_API_BASE` | `https://api.waffo.ai` | Test 和 Live 同一个主机。换环境不改这个地址 |
| `PANCAKE_MODE` | `test` | 改成 `prod` 才接 Live 的事件 |
| `PANCAKE_PRODUCT_MONTHLY` / `PANCAKE_PRODUCT_QUARTERLY` | 空 | 由 `npm run build` 从 `site.config.json` 写入 |
| `ALLOWED_ORIGIN` | 与 `site.config.json` 的 `origin` 相同 | CORS。不要手改 |

5. 确认密钥和商品 id 都在之后再部署（这一步会把 Worker 放到公网）：

```bash
npx wrangler deploy
```

6. 把解锁公钥和 Worker 地址写进 `site.config.json` 的 `payment.worker`，商品 id 写进 `payment.pancake`，然后：

```bash
npm run build
```

`unlockPublicKey` 是公钥，可以进 Git。`baseUrl` 不要末尾斜杠。Worker 地址、公钥、两个商品 id 有一个仍是空的，按钮保持「即将开放 / 即將開放」。

创单由 Worker 发到 `POST https://api.waffo.ai/v1/actions/checkout/create-session`。签名字符串是：

```text
POST
/v1/actions/checkout/create-session
<unix 秒>
<body 的 SHA-256，再 Base64>
```

请求头是 `X-Merchant-Id`、`X-Timestamp`、`X-Signature`。API Key 认证不要带 `X-Environment`；这把钥匙本身就绑在 Test 或 Live 上。时间戳允许比服务器慢最多 5 分钟、快最多 1 分钟。

Body 只有 `productId`、`currency`（`USD`）、`buyerEmail`、`language`（简体 `zh-Hans`，繁体 `zh-Hant-TW`）、`successUrl`、`orderMerchantExternalId`（我们自己的订单号）。没有 `priceSnapshot`。用 Store Slug 会把 `orderMerchantExternalId` 丢掉，所以这里用 API Key。

`successUrl` 指向 `pricing-return.html?order=<我们的订单号>`。买家付完先停在收银台的成功页，要点 Done 才回到本站，没有自动跳转，也没有取消回跳。放弃或付款失败不会发 webhook，课程保持锁定。

## 4. Test Mode 怎么验收

商品默认币种 USD。用 Test 的 API Key 和 Test 的 Webhook 公钥。收银台是 Pancake 的测试模式，不是旧网关的 sandbox simulator。

成功：

1. 打开开通页（页面需已经带上 Worker 地址、公钥和两个 `PROD_` id）。
2. 填写付款邮箱，点「用 Waffo 支付 US$5.99」。应跳到 Pancake 收银台。请求里的金额必须是后台商品的 US$5.99，不能是页面上改出来的别的数。
3. 用测试卡付成功。应收到 `order.completed`。税额可以让 `chargedAmount` 不等于 5.99，这仍然签发。币种不是 USD 则不签发。
4. 在收银台点 Done，回到 `pricing-return.html?order=m...`。页面写等待确认，然后变成已开通。本机 `localStorage` 的 `voa-lle-unlock` 里应有 `credential`。
5. 打开 Level 1 第 6 课，应能学习。

失败：再开一笔然后关掉收银台，或让付款失败。没有 `order.completed`。返回页停在未开通，课程保持锁定。不要因为回到了网站就当成已付款。

退款：对成功的那笔，在后台把退款做到成功。应收到 `refund.succeeded`，凭证作废。打开：

```text
https://<Worker 主机名>/api/status?order=<我们的订单号>
```

应看到 `"state":"revoked"`，响应里没有 `credential`。再打开开通页，本机解锁会被清掉。只做到处理中、还没收到 `refund.succeeded` 时，凭证还在。另做一笔让渠道返回失败（`refund.failed`），凭证不作废。

重复通知：把同一次 `order.completed` 的原始 body 和原来的 `X-Waffo-Signature` 再 POST 一次。

```bash
curl -sS -D - -o /tmp/webhook-body.txt -X POST "https://<Worker 主机名>/api/waffo/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Waffo-Signature: <同一份 t=...,v1=...>" \
  --data-binary @body.json
```

应返回 HTTP 200 和 `OK`，不会换一张新凭证。签名不对是 HTTP 401。

领取只能一次。返回页第一次拿到凭证就写入本机。隐私窗口再打开同一个 `?order=`，应看到已经交付过、不能再次发放。丢了本机凭证走找回，不要再调 `/api/claim`。

找回用的邮箱优先是事件里的 `data.buyerEmail`（收银台收的买家邮箱）。建单时开通页也会收一次邮箱，用来预填收银台；买家在收银台改过邮箱时，以通知里的 `buyerEmail` 为准。两种都只把规范化（去首尾空白、转成小写）之后的 SHA-256 放进 KV，不存明文。

找回：

1. 在开通页或返回页打开「找回开通」。订单号可以填我们自己的 `m…`，也可以填 Pancake 的 `ORD_…`。邮箱填通知里的买家邮箱。
2. 两边都对上、订单已付款且未作废时，页面写入凭证。到期日仍是付款时那 30 或 90 天，不会重新起算。
3. 订单号错、邮箱错、还没付款、已退款，页面都是同一句：「订单号或邮箱不匹配，或该订单无法找回」。
4. 同一个订单一共只能尝试 5 次。短时间内同一 IP、同一订单还会再被挡住。超过之后：「尝试次数过多，请稍后再试。」用 `ORD_…` 和 `m…` 算同一单，不能靠换一种订单号多试。

```http
POST /api/recover
Content-Type: application/json

{"order":"ORD_……或 m……","email":"buyer@example.com"}
```

对不上是 HTTP 400 `{"error":"recover_failed"}`。次数用完是 HTTP 429 `{"error":"recover_limited"}`。

## 5. 切到 Live

1. Test 验收通过，并且店已经允许正式收款之后，在 API & Development 的 **Live** 标签另建一把 API Key，下载新的私钥。不要复用 Test 的私钥。
2. 在 Settings → Webhooks 的 **Live** 一边抄 Public Key，并把同一个 `/api/waffo/webhook` 登记成 Live 端点，勾选和第 2.4 节相同的事件。
3. 用 `npx wrangler secret put` 覆盖 `WAFFO_PANCAKE_API_KEY`、`WAFFO_PANCAKE_MERCHANT_ID`（若 Live 的商户号不同）、`WAFFO_WEBHOOK_PUBLIC_KEY`。解锁私钥可以不换。
4. 把 `worker/wrangler.toml` 的 `PANCAKE_MODE` 改成 `prod`。`WAFFO_API_BASE` 仍然是 `https://api.waffo.ai`。
5. 再执行 `npx wrangler deploy`。
6. 先做一笔小额真实订单，确认创单、收银台、`order.completed` 验签、返回页开通、`/api/status`、退款作废、找回都正常，再放开正常流量。

这次改代码本身不要部署，也不要合并。

## 6. 一次性购买

只做一次性购买：30 天 US$5.99、90 天 US$13.99。不做自动续费，不设试用期。免费的 Level 1 第 1–5 课就是试用。订阅以后看数据再定。若收到 `subscription.*`，忽略并返回 HTTP 200，不改凭证。

## 7. 把网站放到 Cloudflare Pages

付款上线之前，站点要改放到 Cloudflare Pages。GitHub 的条款不允许把 Pages 主要用来做商业交易。Git 仓库仍然是唯一源。现在不要改 `site.config.json` 的 `origin`，它仍是 `https://1019666077-bit.github.io/wx-extract-mvp`。GitHub Pages 继续从仓库根目录发布，直到本节的验收做完。旧地址的跳转以后再做，见本节最后。

建 Pancake 的店之前，Pages 上要能打开：价格页，以及服务条款、隐私政策、退款政策的简体、繁体、英文（`/terms.html`、`/zh-hant/terms.html`、`/en/terms.html`，隐私和退款同样三条路径）。

### 用 GitHub Action 上传，不用 Cloudflare 的 Git 集成

构建会把 HTML 写回仓库根目录。如果让 Cloudflare 去连这个 Git 仓库并发布当前目录，会把 `worker/`、`miniprogram/`、`docs/` 和 `node_modules/` 一起传上去。所以 Action 先构建，再把站点拷进干净的 `dist/`，然后执行 `wrangler pages deploy`。

GitHub Pages 没有自己的工作流，它仍然发布分支根目录。新文件是 `.github/workflows/cloudflare-pages.yml`。它只在推到 `main`，或在 Actions 里对手动选中的、已经含有这个文件的分支点 Run workflow 时运行。两个密钥有一个是空的，这一步就打印说明并跳过上传，不会把现有的检查跑失败。合并到 `main` 之前，这个工作流不会因为本分支的推送而部署。

Cloudflare 账号与第 3 节的 Worker 是同一个。

### 项目名

Pages 项目名暂定为 `lle-learn`（待品牌名）。预览地址将是 `https://lle-learn.pages.dev`。品牌名确定之前，不要在 Cloudflare 里创建这个项目。确定后如果改名，要同时改 `.github/workflows/cloudflare-pages.yml` 里的 `--project-name`。

不要用 `voa-lle`。项目名会进 `pages.dev` 主机名，`voa-lle.pages.dev` 里含有 VOA。最终品牌还没定，公开地址里不要出现 VOA。Worker 的名字仍是 `voa-lle-unlock`，这一步不要改。

### 每一项设置

等品牌名确定之后，再在仪表盘 Workers & Pages → Create → Pages 里选直接上传（Upload assets），不要选 Connect to Git。项目名先填暂定的 `lle-learn`。第一次也可以不在仪表盘建：下面的部署命令会在这个账号里创建同名项目。生产分支、构建设置都留空，因为不走 Git 集成。品牌名没定之前不要执行创建。

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

`dist/` 不进 Git。里面是站点根：`index.html`、`terms.html`、`privacy.html`、`refund.html`、`en/`、`robots.txt`、`sitemap.xml`、`_headers`、`_redirects`、`css/`、`js/`（不含 `*.test.js`）、`img/`、`lessons/`、`zh-hant/`、`data/`。没有 `worker/`、`miniprogram/`、`docs/`。

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

1. 打开 `/`。简体目录能用，样式来自 `/css/styles.css`。页脚有服务条款、隐私政策、退款政策。
2. 打开 `/zh-hant/`。繁体目录能用。页面里写的是 `../css/styles.css`，实际仍是 `/css/styles.css`。
3. 打开 `/terms.html`、`/zh-hant/privacy.html`、`/en/refund.html`。三份都能打开，顶部没有生效日期。
4. 打开 `/lessons/lle1-01.html` 和 `/zh-hant/lessons/lle1-01.html`。课页样式正常，地址里没有 `/wx-extract-mvp/`。
5. 打开 `/lesson.html?id=lle1-01`，应到 `/lessons/lle1-01.html`。繁体 `/zh-hant/lesson.html?id=lle1-01` 应到 `/zh-hant/lessons/lle1-01.html`。
6. 打开 `/robots.txt` 和 `/sitemap.xml`，确认它们在域名根。
7. 打开 `/pricing.html`。按钮仍是「即将开放」，不请求 Worker。
8. 若正在做域名验证，首页源代码的 `<head>` 里有 `meta name="waffo-verify"`；`domainVerify` 为空时没有这一行。
9. 响应头里有 `X-Content-Type-Options: nosniff`。HTML 是 `Cache-Control: public, max-age=0, must-revalidate`。
10. 再打开原来的 `https://1019666077-bit.github.io/wx-extract-mvp/`，确认 GitHub Pages 还能用。

验收通过之后才改源站。canonical、hreflang、sitemap、Open Graph、JSON-LD 和 Worker 的 CORS 都跟这一个字段：

1. 把 `site.config.json` 的 `origin` 改成 `https://lle-learn.pages.dev`，不要末尾斜杠。以后绑了自定义域名，再改成那个 `https://` 地址，然后重复下面两步。
2. 运行 `npm run build`。它会重写页面，并把 `worker/wrangler.toml` 的 `ALLOWED_ORIGIN` 和两个商品 id 改成和 `site.config.json` 一致。不要手改那几行。
3. 提交并推到 `main`，等 Pages 工作流把新的 `dist/` 传上去。
4. 在 `worker/` 里再执行一次 `npx wrangler deploy`。CORS 要这次部署才换成新源站。

### 以后再把旧的 github.io 地址指过来

这一步现在不要做。GitHub 不能给 `*.github.io` 的项目页配置 HTTP 301。

等 Pages 验收通过，并且 `origin` 已经改成新地址、两边都部署过之后：

- 在 GitHub Pages 上留一个壳。根目录和主要路径用 meta refresh，或一小段脚本：去掉路径里的 `/wx-extract-mvp`，打开新 origin 上的同一路径。页面的 canonical 指向新地址。
- 只改 canonical、不跳转，也能让搜索引擎合并到新地址，但收藏了旧链接的人仍会停在 GitHub Pages。跳转壳是给人用的。
- 不要删仓库。Git 仍然是源。

## 8. 手工补发（旧微信付款用户）

以前用微信付过款、本机又没有签名凭证的人，不能走找回：那时没有 Pancake 订单，也没有付款邮箱。站长核对过付款记录之后，在本机或 CI 里签发一张，每次只做一单，不要写批量脚本。

脚本是 `scripts/issue-credential.js`。私钥从环境变量 `UNLOCK_PRIVATE_KEY`（与 Worker 相同的一行 PKCS8 Base64）或 `--key-file` 读取。脚本里没有默认密钥。不要把私钥、打印出来的凭证提交到 Git。

```bash
export UNLOCK_PRIVATE_KEY="$(cat unlock_private_key.base64)"
node scripts/issue-credential.js \
  --order wechat-20240901 \
  --plan monthly \
  --days 30 \
  --note "旧微信付款，已核对"
```

`--plan` 是 `monthly` 或 `quarterly`。`--days` 是整数，常用 30 或 90，范围 1 到 366。`--order` 是 8 到 64 位的字母、数字、`_` 或 `-`。`--note` 只打印在终端里，不写进凭证。凭证字段仍只有 `orderId`、`plan`、`issuedAt`、`expiresAt`，和 Worker 签发的一样，开通页能验过才写入 `localStorage`。

终端会打印一个链接，形如：

```text
https://1019666077-bit.github.io/wx-extract-mvp/pricing.html?credential=<凭证>
```

把这整个链接发给该用户。用户打开后，页面用 `site.config.json` 里的 `unlockPublicKey` 验签，通过才保存。公钥还是空的时候，链接打不开开通。`--origin` 可以改链接的站点；`--script zh-Hant` 会指向 `/zh-hant/pricing.html`。不设 `UNLOCK_PRIVATE_KEY` 也不给 `--key-file` 时，脚本直接退出，不会签发。
