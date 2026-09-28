# Waffo 付款后自动发解锁码（方案，未部署）

本文只根据 2026-09-28 能打开的 Waffo 公开文档整理。文档入口是 [https://waffo.com/docs/llms.txt](https://waffo.com/docs/llms.txt)（英文指南索引 121 页）。下面凡是写「公开文档没有写」的，都是这次没有核到的内容，不要当成已经存在的接口。

当前站点改动只做到开通页按钮：`site.config.json` 的 `payment.waffo.monthlyUrl` / `quarterlyUrl` 为空时，按钮禁用并显示「即将开放 / 即將開放」。**这一步不能防止白嫖。** 真正发码必须另有一台能验签的服务器。本文不部署那台服务器。

## 现在为什么能白嫖

`data/codes.json` 必须保持 `{"codes":[]}`。白名单为空时，静态页接受任意格式正确的 `LLE-M-XXXXXX`（30 天）或 `LLE-Q-XXXXXX`（90 天）。格式校验写在 `js/unlock.js`，不是安全系统。猜到格式，或在开发者工具里改 `localStorage` 的 `voa-lle-unlock`，就能打开付费课。

所以：付款成功之后自动发的码，不能再靠「格式看起来对」来放行。签发和核销都要在服务器上完成。静态页最多用公钥验一张签过名的凭证，或者每次向服务器问「这张码还有效吗」。

## 公开文档里核实过的付款能力

公开索引里**没有**「可复用的 Payment Link / 一条固定收款链接卖很多次」这种产品说明。检索到的结账方式是：商户服务器调用创建订单接口，Waffo 返回这一笔的收银台地址，用户去那一页付款。

依据：

- [Checkout integration steps](https://waffo.com/docs/en/developer-docs/integration/checkout/steps.md)：商户 `POST` 创建订单 → 响应里的 `orderAction`（JSON 字符串）→ 按 `actionType` 用 `webUrl` 或 `deeplinkUrl` → 用户在 Waffo 收银台付款 → Waffo `POST` 到 `notifyUrl` → 浏览器再跳回商户。文档写明：**跳转只说明用户回到了你的网站，不代表付款成功。** 以 Webhook 或主动查单为准。
- [Create new order](https://waffo.com/docs/api-reference/order-create/create-new-order.md)：`POST /api/v1/order/create`。必填包括 `paymentRequestId`、`merchantOrderId`、`orderCurrency`、`orderAmount`（字符串）、`orderDescription`（最长 128）、`orderRequestedAt`、`notifyUrl`（最长 1024）、`merchantInfo.merchantId`、`userInfo`、`paymentInfo`。
- 成功跳转 `successRedirectUrl`（最长 1024；不传则留在收银台）、失败 `failedRedirectUrl`（最长 1024）、取消 `cancelRedirectUrl`（最长 512）。[收银台定制](https://waffo.com/docs/en/developer-docs/integration/checkout/customization.md) 写明：这三个地址**只影响用户体验，不代表支付结果**。公开文档**没有**写成功跳转会带可验证签名或订单号。不要假设 query 里有可验的字段。
- `extendInfo`：类型是字符串，说明是 `Reserved. Json format`，最长 **128**。这是文档里最接近「自定义 metadata」的字段，不是一个通用 metadata 对象。128 字符放不下一整段解锁逻辑，只够放很短的 `merchantOrderId` 或方案名。
- `userInfo.userEmail` **必填**（另有 `userId`、`userTerminal`）。没采集到邮箱时，文档允许每个用户一个唯一的 `userId@examples.com`，并写明不要用 `test`、不要很多人共用一个邮箱，否则可能触发风控。上线后应尽量传真实邮箱。
- `userInfo.userReceiptUrl` 的说明是：商户可以再次触发、用来下载用户收据的 URL。这是**商户自己提供的地址**，不是「Waffo 会给买家发收据邮件」的证据。
- `paymentInfo.productName` 的枚举里有 `ONE_TIME_PAYMENT`、`DIRECT_PAYMENT`、`MINI_PROGRAM_PAYMENT`。收银台示例把 `ONE_TIME_PAYMENT` 当作一次性付款；不传具体支付方式时，用户在收银台自己选。
- 定制页的跨币种示例写了 `"orderCurrency": "USD"`。这只说明请求体可以带 USD 这个字符串。**这份公开文档不能证明当前这个共用商户号的合同里已经开通 USD。** 账号还在审核时，要以门户里该商户实际可用币种为准。
- `goodsInfo`：字段说明写 `goodsUrl` 与 `appName` 二选一（合规/风控）。同一段 OpenAPI 的 `required` 却同时列出了 `appName`、`goodsName`、`goodsUrl`。实现前要向 Waffo 确认线上到底强制哪几个，不要只按其中一处写。

### Webhook

依据 [Webhook overview](https://waffo.com/docs/en/developer-docs/webhook/overview.md)、[signature verification](https://waffo.com/docs/en/developer-docs/webhook/signature-verification.md)、[event types](https://waffo.com/docs/en/developer-docs/webhook/event-types.md)、[retries](https://waffo.com/docs/en/developer-docs/webhook/retry.md)：

- 支付结果用 HTTPS POST 打到创单时传入的 `notifyUrl`。请求头 `X-SIGNATURE` 是 Waffo 私钥对**原始 body** 的签名。商户用门户 Integration 菜单里的 **Waffo 公钥**、算法 **SHA256WithRSA** 验签。必须先验签再处理；验签要用原始字符串，不能先 `JSON.parse` 再 `stringify`。
- 成功处理要回 HTTP 200，body 为 `{"message":"success"}`。`failed` 或 `unknown`、非 200、超时、Content-Type 不对，都会重试。
- 重试最多 **8 次（含第一次）**，间隔从立即、30 秒、1 分钟、4 分钟、30 分钟、4 小时，到两次 8 小时。全部失败后不再推，要用查单或对账补。
- 事件类型：`PAYMENT_NOTIFICATION`、`REFUND_NOTIFICATION`、`CHARGEBACK_NOTIFICATION`、`TOKENIZATION_NOTIFICATION`、`SUBSCRIPTION_STATUS_NOTIFICATION`、`SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION`、`SUBSCRIPTION_CHANGE_NOTIFICATION`。`PAYMENT_NOTIFICATION` 的 `result` 与订单查询的 `data` 相同。
- 退款通知打到退款请求里的 `refundNotifyUrl`，否则用门户里的全局地址。拒付打到门户里的 `chargebackNotifyUrl`。配置说明见 [Configure refund and Chargeback notification URLs](https://waffo.com/docs/en/developer-docs/getting-started/notification-url-configuration.md)。
- 商户调用 Waffo API 时要用商户私钥签名。门户步骤见 [Configure the merchant public key](https://waffo.com/docs/en/developer-docs/getting-started/public-key-configuration.md)。沙箱说明在 [Sandbox and testing](https://waffo.com/docs/en/developer-docs/getting-started/sandbox.md)。幂等说明在 [Idempotency](https://waffo.com/docs/en/developer-docs/core-concepts/idempotency.md)（`paymentRequestId` 用来防重复下单）。

### 订阅还是一次性

现有权益是付一次、本地 30 天或 90 天，**不会自动续费**。应对齐一次性订单 `ONE_TIME_PAYMENT`（`POST /api/v1/order/create`），不要用订阅，除非以后明确要按月自动扣款。

订阅是另一套接口（`POST /api/v1/subscription/create`），并有上面三条订阅通知。文档把它描述成周期扣款，不适合「买 30/90 天解锁、到期自己停」的现状。

### 这次没有核实到的内容

- Waffo 是否会主动给买家发支付收据邮件，或代发兑换码邮件。只看到商户字段 `userReceiptUrl`。
- 成功跳转 URL 是否附带可验证签名或订单号。文档明确说跳转不能当支付结果。
- 可复用的静态收款链接产品。公开索引里没有对应页面。
- 这个共用商户号是否已开通 USD、手续费是多少、结算周期。公开文档没有这份合同的费率表。
- `extendInfo` 在支付通知里是否原样回传。文档只把它标成保留字段。

Point Topup 的 Mode A（供应商离线导入点卡码）是另一套「点卡库存」产品，不是本站解锁码的路径，不要拿来发 `LLE-M` / `LLE-Q`。

## 推荐的最轻设计

目标：付了钱的人自动拿到一张解锁凭证；没付钱的人不能靠猜格式解锁。

1. 开通页按钮不再跳到一条所有人共用的网址（现在的 `monthlyUrl` / `quarterlyUrl` 只是审核通过前的占位）。按钮改为请求自己的小函数：`POST /api/checkout`，body 只有 `plan=monthly|quarterly`。
2. 函数用商户私钥调用 `POST /api/v1/order/create`：`productName=ONE_TIME_PAYMENT`，金额 `5.99` 或 `13.99`，币种在合同确认支持 USD 之后再写 `USD`。`notifyUrl` 指向该函数的 `/api/waffo/webhook`。`successRedirectUrl` 只带我们自己的 `merchantOrderId`，页面不得据此解锁。`paymentRequestId` 每次新建且不超过 32 字符。`userEmail` 在用户没填邮箱时按文档用唯一的 `userId@examples.com`，不要共用一个邮箱。
3. 函数把响应里的 `orderAction` 解析出来，按 `actionType` 把用户重定向到 `webUrl` 或 `deeplinkUrl`。
4. Webhook：用 Waffo 公钥验 `X-SIGNATURE`（原始 body、SHA256WithRSA）。验签失败回 `{"message":"failed"}` 且**不发码**。同一 `acquiring` 订单号重复通知必须幂等：已经发过码就直接回 success。只在 `PAYMENT_NOTIFICATION` 且查单/通知结果为支付成功时发码。通知语义以文档为准，实现时对照 Order Inquiry 的状态字段，不要自造状态名。
5. 发码：服务器生成一次性码（仍可用现有 `LLE-M-` / `LLE-Q-` 前缀，方便过渡），写入存储，键是 Waffo 订单号。把码交给用户的方式二选一，都由**我们的服务器**做，不依赖未核实的 Waffo 代发邮件：
   - 用户回到站点后，返回页用 `merchantOrderId` 向服务器查询；服务器确认已付款才返回码。
   - 或者用户在下单前留下邮箱，服务器用单独的发信服务把码寄出。
6. 静态页核销必须改掉「空名单即按格式放行」：
   - **最低要求（挡住猜格式）：** 码是服务器私钥签发的短凭证，页面用内置公钥验证签名、方案和到期日。没有私钥就造不出新码。
   - **才能挡住把码发到群里：** 兑换时再请求服务器，服务器把该码标成已使用。纯静态页做不到单次核销，也撤不回已经写进别人浏览器的 `localStorage`。
7. 时长保持 30 天 / 90 天，与现在 `unlock.js` 一致。退款或拒付通知到达后，服务器作废该码。已经写进浏览器的解锁，要等用户下次打开开通页、页面向服务器复查之后才能收回。这是静态站的限制，不是 Waffo 的限制。

在这套上线之前，运营继续按 [`ops-redeem.md`](ops-redeem.md) 人工发码。人工码一旦改成「必须验签或必须问服务器」，旧的空名单格式码会全部失效，要单独排一次切换，不要和本 PR 的按钮一起做。

## 三个做法

低量按每月几十到几百笔估算。费用是 2026-09 的公开标价量级，签约前打开厂商定价页再核对。Waffo 手续费这次没有公开费率可引，不写数字。

| | A. Cloudflare Workers + KV（建议） | B. Vercel 或 Netlify 函数 | C. 指望 Waffo 自己把码发到邮箱 |
| --- | --- | --- | --- |
| 做什么 | 一个 Worker：创单、验 Webhook、把订单号→兑换码放进 KV。GitHub Pages 继续托管页面。 | 同样两个 HTTP 函数，状态放 Vercel KV / Blob 或 Netlify Blobs。 | 不自己验 Webhook，等 Waffo 发邮件。 |
| 低量月费 | Workers 免费档每天约 10 万次请求；超出后 Workers Paid 大约每月 5 美元起。KV 的免费读写额度在低量付款下通常够用。 | Vercel Hobby 标价为 0，但条款限制商用。正经收款要用 Pro，大约每月 20 美元起。Netlify 免费档含有限的函数调用，商用或超量再上付费档。 | 函数费用可以是 0，但前提不成立（见下）。若仍要自己发信，另计发信服务；低量通常落在其免费档。 |
| 为什么能或不能防白嫖 | 能。验签后才写入 KV，页面不再接受「只符合格式」的码。 | 能，和 A 同一套规则，只是托管不同。 | **不能单靠这一条。** 公开文档没有证明 Waffo 会代发解锁码。`userReceiptUrl` 是商户自己的收据地址。 |
| 退款 | `REFUND_NOTIFICATION` / `CHARGEBACK_NOTIFICATION` 删掉 KV 记录。已写入浏览器的解锁要靠下次在线复查。 | 同 A。 | 没有自己的码库就无法作废。 |

建议选 **A**。它和现有 GitHub Pages 静态站拆开，低量时接近 0 美元，Webhook 的公网 HTTPS 也由 Worker 提供。B 在必须商用合规时更贵，能力等价。C 不要作为方案，除非以后 Waffo 书面确认会按商户模板发邮件，并且邮件里的码仍然由我们的服务器签发（否则谁都能伪造一封邮件）。

## 站长要在 Waffo 配什么

账号仍在审核、还没有付款链接，下面先列清单，不要现在就把空链接换成猜测的 URL。

1. 等商户审核通过。这是和另一个项目共用的商户号，确认该号允许这套课程的收款描述和网址。
2. 在门户确认合同币种是否包含 USD。公开示例可以写 `orderCurrency: "USD"`，不代表这个号已经开通。
3. 生成商户 RSA 密钥，把**公钥**按 [Configure the merchant public key](https://waffo.com/docs/en/developer-docs/getting-started/public-key-configuration.md) 上传。私钥只放在 Worker 的密钥里，不进 Git。
4. 从门户 Integration 复制 **Waffo 公钥**，供 Webhook 验签。
5. 先走 [Sandbox](https://waffo.com/docs/en/developer-docs/getting-started/sandbox.md)，用模拟器打一笔成功、一笔失败、一笔退款。
6. 创单时传入生产 `notifyUrl`（Worker 的 HTTPS 地址）。在门户配置全局退款通知 URL 和 `chargebackNotifyUrl`。
7. 准备三个回跳页：成功、失败、取消。成功页只显示「正在确认付款」，向我们的服务器查询，不读跳转参数来解锁。
8. 收银台语言可传 `zh-Hant-TW` 或 `zh-Hans`（定制页的语言表里有这两项）。不传时 Waffo 会按浏览器语言等规则自己选。

## 退款、到期、前端还要改什么

- **到期：** 继续 30 / 90 天。一次性订单不会自动续费。服务器记录里的 `expiresAt` 与 `unlock.js` 的时长对齐。
- **退款：** 收到验签通过的 `REFUND_NOTIFICATION` 或 `CHARGEBACK_NOTIFICATION` 后作废该码。已解锁的浏览器要等开通页向服务器复查。复查失败则清掉 `voa-lle-unlock`。做不到「对方不打开网页也立刻锁上」。
- **本 PR 的前端：** 两个按钮读配置。空链接 = `<button disabled>`，文案「即将开放 / 即將開放」，没有 `href`。有链接 = 新窗口打开该 https URL。微信 `15232188653` 留在页面下方，作为中国大陆的人工备选。兑换框和 `unlock.js` 的格式规则这次不动。
- **下一阶段前端：** 按钮改为请求 `/api/checkout`，不再使用静态共用链接。返回页不信任 `successRedirectUrl` 的 query。`unlock.js` 改为验公钥签名，或兑换时请求服务器；同时删除「空 `codes.json` 即按格式接受」的分支。这一步会让今天任意 `LLE-M-*` / `LLE-Q-*` 失效，要和运营发码方式一起切换。

`miniprogram/` 不在这条付款线上。小程序如果以后要同一套权益，再单独接，不要在做 Webhook 时顺手改它。
