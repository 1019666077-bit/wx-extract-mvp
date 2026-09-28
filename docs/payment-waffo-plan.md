# Waffo 付款后自动开通（旧稿，已停用）

> 这份是按原生收单网关（api-sandbox.waffo.com）写的旧方案，已经不作实现依据。现在对接的是 Waffo Pancake，步骤在 [waffo-cloudflare-setup.md](waffo-cloudflare-setup.md)。下面的接口名不要再照着做。

代码已经按本文的主方案写在 `worker/`，前端在 `js/unlock.js` 和开通页 / 返回页。**还没有部署，仓库里也没有 Waffo 或 Cloudflare 密钥。** 站长按 [waffo-cloudflare-setup.md](waffo-cloudflare-setup.md) 在浏览器里配完，把 Worker 地址和解锁公钥填进 `site.config.json` 并重新构建之后，按钮才会从「即将开放」变成可点。

本文其余部分只根据 2026-09-28 能打开的 Waffo 公开文档。入口是 [https://waffo.com/docs/llms.txt](https://waffo.com/docs/llms.txt)。写「公开文档没有写」的地方，就是这次没有核到的内容，不要当成已经存在的接口。

`payment.worker.baseUrl` 和 `payment.worker.unlockPublicKey` 现在是空字符串，所以按钮禁用，文案是「即将开放 / 即將開放」，页面不请求 Worker。`pricing-return.html` 因此仍是 `noindex`，并且不进 sitemap。

付款之后不要再让用户做任何事：不要加微信，不要等人工发码，不要自己把码粘进页面。付完就回到站点，确认到账后自动开通。

## 现在为什么能白嫖

`data/codes.json` 必须保持 `{"codes":[]}`。网页版 `js/unlock.js` 已经不再接受 `LLE-M-*` / `LLE-Q-*` 这种只看格式的码，也只认带有效签名且未过期的凭证。没有签名的旧 `localStorage`（包括以前微信付款写进去的状态）打开网页后会失效，这次没有留后门。`miniprogram/` 里的那份 `unlock.js` 没改，小程序仍是旧逻辑。

## 公开文档里核实过的能力

公开索引里**没有**可反复使用的 Payment Link。结账方式是：商户服务器创建订单，Waffo 返回这一笔的收银台地址。

- [Checkout integration steps](https://waffo.com/docs/en/developer-docs/integration/checkout/steps.md)：创建订单 → 解析 `orderAction` → 按 `actionType` 用 `webUrl` 或 `deeplinkUrl` → 用户付款 → Waffo POST 到 `notifyUrl` → 浏览器再跳回。文档写明：**跳转只说明用户回到了网站，不代表付款成功。** 以 Webhook 或主动查单为准。
- [Create new order](https://waffo.com/docs/api-reference/order-create/create-new-order.md)：`POST /api/v1/order/create`。必填包括 `paymentRequestId`、`merchantOrderId`、`orderCurrency`、`orderAmount`、`orderDescription`（最长 128）、`orderRequestedAt`、`notifyUrl`（最长 1024）、`merchantInfo.merchantId`、`userInfo`、`paymentInfo`。
- `successRedirectUrl`（最长 1024）、`failedRedirectUrl`（最长 1024）、`cancelRedirectUrl`（最长 512）。[收银台定制](https://waffo.com/docs/en/developer-docs/integration/checkout/customization.md) 写明这三个地址只影响体验，不代表支付结果。公开文档**没有**写成功跳转带可验证签名或订单号。
- `extendInfo` 是保留用的 JSON 字符串，最长 **128**。不是通用 metadata。
- `userInfo.userEmail` 必填。没有邮箱时，文档允许每个用户一个唯一的 `userId@examples.com`，并写明不要用 `test`、不要很多人共用一个邮箱。
- `userInfo.userReceiptUrl` 是商户自己提供的收据下载地址，**不是**「Waffo 会给买家发邮件」的证据。
- `paymentInfo.productName` 示例使用 `ONE_TIME_PAYMENT`。不传具体支付方式时，用户在收银台自己选。
- 定制页的示例可以写 `"orderCurrency": "USD"`。这不能证明当前这个共用商户号的合同已经开通 USD。
- `goodsInfo` 的字段说明写 `goodsUrl` 与 `appName` 二选一，OpenAPI 的 `required` 却同时列出 `appName`、`goodsName`、`goodsUrl`。上线前向 Waffo 确认实际强制哪几个。

Webhook（[overview](https://waffo.com/docs/en/developer-docs/webhook/overview.md)、[signature](https://waffo.com/docs/en/developer-docs/webhook/signature-verification.md)、[events](https://waffo.com/docs/en/developer-docs/webhook/event-types.md)、[retries](https://waffo.com/docs/en/developer-docs/webhook/retry.md)）：

- HTTPS POST，请求头 `X-SIGNATURE` 是 Waffo 私钥对**原始 body** 的签名。商户用门户里的 Waffo 公钥、**SHA256WithRSA** 验签。先验签再处理。
- 成功要回 HTTP 200 和 `{"message":"success"}`。失败会重试，最多 **8 次（含第一次）**，间隔从立即到 8 小时。
- 和这次有关的事件：`PAYMENT_NOTIFICATION`（`result` 与订单查询的 `data` 相同）、`REFUND_NOTIFICATION`、`CHARGEBACK_NOTIFICATION`。
- 退款通知打到 `refundNotifyUrl` 或门户全局地址。拒付打到门户里的 `chargebackNotifyUrl`。
- 商户调用 API 要用商户私钥签名。公钥上传步骤见 [Configure the merchant public key](https://waffo.com/docs/en/developer-docs/getting-started/public-key-configuration.md)。沙箱见 [Sandbox](https://waffo.com/docs/en/developer-docs/getting-started/sandbox.md)。

现有权益是付一次、30 天或 90 天，不自动续费。用一次性 `ONE_TIME_PAYMENT`，不用 `POST /api/v1/subscription/create`。订阅会按周期扣款，并另有订阅通知。

这次没有核实到：Waffo 代发收据或解锁邮件；成功跳转里的可验证签名；可复用静态收款链接；这个商户号的 USD 开通状态和手续费。Point Topup 的离线点卡不是本站的开通方式。

## 主方案：Cloudflare Worker 验完通知后，返回页自动开通

这是要做的那一个方案。用户侧只有两步：在开通页点 Waffo，在 Waffo 收银台付完。回到 `pricing-return.html` 之后不再点击、不再粘贴、不再联系任何人。

1. 开通页按钮在链接就绪后，不再跳到一条所有人共用的网址。按钮请求 Worker：`POST /api/checkout`，body 只有 `plan=monthly|quarterly`。现在的 `monthlyUrl` / `quarterlyUrl` 只是审核通过前的占位；空着就继续显示「即将开放」。
2. Worker 用商户私钥调用 `POST /api/v1/order/create`：`productName=ONE_TIME_PAYMENT`，金额 `5.99` 或 `13.99`。合同确认支持 USD 之后，`orderCurrency` 才写 `USD`。`notifyUrl` 指向 Worker 的 `/api/waffo/webhook`。`successRedirectUrl` 使用 `payment.waffo.returnUrl`，只附加我们自己的 `merchantOrderId`。`paymentRequestId` 每次新建，不超过 32 字符。没有用户邮箱时按文档使用唯一的 `userId@examples.com`。
3. Worker 解析 `orderAction`，按 `actionType` 把浏览器转到 `webUrl` 或 `deeplinkUrl`。
4. Webhook：用 Waffo 公钥验 `X-SIGNATURE`（原始 body、SHA256WithRSA）。验签失败回 `{"message":"failed"}`，不签发。同一订单重复通知只签发一次。只在 `PAYMENT_NOTIFICATION` 且结果为支付成功时签发。状态字段以 Order Inquiry 文档为准，不自造状态名。
5. 签发物是 Worker 私钥签过的短凭证，放进 KV，键是 `merchantOrderId`。凭证里有方案（30 天或 90 天）和到期时间。没有这把私钥就做不出新凭证。
6. 返回页用查询参数里的 `merchantOrderId` 向 Worker 要凭证。Worker 只在 Webhook 已确认后才返回。页面用内置公钥验签，通过后写入现有的 `voa-lle-unlock`。查询参数本身永远不能开通。跳转先到、通知还没到时，页面继续显示「正在等待付款确认」，过几秒再问一次，直到成功或超时。
7. 退款或拒付通知验签通过后，删掉 KV 里的凭证。用户下次打开开通页或返回页时，向 Worker 复查；复查失败就清掉本机解锁。对方不打开网页时，已经写进浏览器的状态收不回来。这是静态站的限制。

低量（每月几十到几百笔）时，Workers 免费档通常够用（公开标价大约每天 10 万次请求）。超出后 Workers Paid 大约每月 5 美元起。KV 的免费读写在这个量级一般够用。数字会变，签约前再看 Cloudflare 定价页。Waffo 手续费公开文档里没有，不写数字。

防白嫖靠第 4 步和第 6 步：没验过的通知不会签发，返回页不相信跳转。把同一张已付款凭证拷给别人，仍然可以在对方浏览器里开通一次。要挡住转发，兑换时再让 Worker 把该 `merchantOrderId` 标成已使用，第二台设备拿不到凭证。这仍然是同一个 Worker，不需要第二套系统。格式码 `LLE-M-*` / `LLE-Q-*` 必须在同一次上线里从 `unlock.js` 去掉，否则猜格式的洞还在。

### 这次代码已经接上的前端

- 开通页两个按钮在 `payment.worker.baseUrl` 和 `unlockPublicKey` 都为空时是禁用的「即将开放」，没有 `href`，也不发请求。两者都填上并重新构建后，按钮变成 `data-plan="monthly|quarterly"`，点击 `POST /api/checkout`。
- `pricing-return.html` 在 Worker 地址和解锁公钥都有值时轮询 `GET /api/claim?order=`，用 WebCrypto 验签，通过后写入 `voa-lle-unlock`。
- 领取是一次性的：第二次 `claim`（包括同一浏览器）返回 409，不再发凭证。返回页必须在第一次 200 时立刻写入本机。刷新时如果本机这张凭证还能验过，仍显示已开通；如果 409 且本机没有，页面说明已经交付过一次，不能再次发放。
- 开通页和返回页加载时会问 `/api/status`。状态是 `revoked` 就清掉本机解锁。
- Worker 地址和解锁公钥仍为空时，返回页保持 `noindex`、不进 sitemap，也不轮询。

## 备选

只在主方案的托管不合适时再看，规则相同：先验 Webhook，再在返回页自动写入签名凭证。

| | 什么时候用 | 低量费用（2026-09 公开标价，签约前再核对） |
| --- | --- | --- |
| Vercel 或 Netlify 函数 | 已经有那边的账号。状态放 Vercel KV / Blob 或 Netlify Blobs。 | Vercel Hobby 标价为 0，但条款限制商用。收款要用 Pro，大约每月 20 美元起。Netlify 免费档有调用上限，商用或超量再付费。 |
| 让 Waffo 把开通结果发到买家邮箱 | 不要用。公开文档没有证明 Waffo 会代发解锁邮件。`userReceiptUrl` 是商户自己的地址。买家还要去收信，这就不是付完自动开通。 | 不采用，所以不估算。 |

## 站长要在 Waffo 配什么

账号仍在审核。不要把猜出来的网址写进 `site.config.json`。

1. 等商户审核通过。这是和另一个项目共用的商户号，确认它允许这套课程的描述和网址。
2. 在门户确认合同币种是否包含 USD。
3. 生成商户 RSA 密钥，按文档把公钥上传到门户。私钥只放在 Worker 的密钥里，不进 Git。另外生成一把只给解锁凭证用的密钥对，公钥以后嵌进网页。
4. 从门户 Integration 复制 Waffo 公钥，供 Webhook 验签。
5. 先在沙箱打一笔成功、一笔失败、一笔退款。
6. 创单时传入 Worker 的 `notifyUrl`。在门户配置退款通知 URL 和 `chargebackNotifyUrl`。
7. 把生产环境的 `https://…/pricing-return.html` 填进 `payment.waffo.returnUrl`，并作为 `successRedirectUrl`。失败和取消可以回到开通页。成功页不读跳转参数来开通。
8. 收银台语言可传 `zh-Hans` 或 `zh-Hant-TW`。不传时 Waffo 按浏览器语言等规则自己选。

`miniprogram/` 不在这条付款线上。小程序以后要同一套权益再单独接。
