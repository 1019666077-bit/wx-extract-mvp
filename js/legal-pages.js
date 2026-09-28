/**
 * Store policies. No effective date. Remaining 待幕僚长确认 clauses are
 * listed in the terms (governing law, dispute venue) and privacy (how long
 * an order record is kept after the credential expires). The contact mailbox
 * is the contactEmail field in site.config.json.
 */

const OPERATOR_HANS = "东莞市常平创客汇网络技术工作室";
const OPERATOR_EN = `${OPERATOR_HANS}, a sole proprietorship registered in Dongguan, Guangdong, China`;

const PAGES = {
  terms: {
    file: "terms.html",
    hansTitle: "服务条款｜非官方慢速英文自学",
    hansDescription:
      "本站服务条款。一次性付款，不自动续费。收费的是学习工具和课程开放。付款由 Waffo 作为商户代收处理。",
    enTitle: "Terms of service | unofficial study tool",
    enDescription:
      "Terms of service. Purchases are one-time and do not auto-renew. The fee is for the study tool and course access. Waffo is the merchant of record.",
  },
  privacy: {
    file: "privacy.html",
    hansTitle: "隐私政策｜非官方慢速英文自学",
    hansDescription:
      "本站隐私政策。为找回开通，本站使用的买家信息只有订单号和付款邮箱。付款由 Waffo 作为商户代收处理。",
    enTitle: "Privacy policy | unofficial study tool",
    enDescription:
      "Privacy policy. For restoring access we use only the order id and the payer email. Waffo processes the payment as merchant of record.",
  },
  refund: {
    file: "refund.html",
    hansTitle: "退款政策｜非官方慢速英文自学",
    hansDescription:
      "本站退款政策。首次购买 7 天内可申请全额退款，每个邮箱限一次。退款成功后凭证作废，由 Waffo 原路退回。",
    enTitle: "Refund policy | unofficial study tool",
    enDescription:
      "Refund policy. A first purchase can be refunded in full within 7 days, once per email. A completed refund revokes the credential.",
  },
};

function contactPhrase(lang, email) {
  const safe = escapeHtml(email);
  if (lang === "en") {
    return `${safe} (placeholder, 待幕僚长确认; an Outlook alias is opened after the brand name is set)`;
  }
  return `${safe}（占位，待幕僚长确认。品牌名定后改为 Outlook 别名）`;
}

function termsBody(lang, email) {
  const contact = contactPhrase(lang, email);
  if (lang === "en") {
    return `
    <h2>What this site is</h2>
    <p>This site is an unofficial study tool. It is not Voice of America, and VOA does not run or endorse it. Lesson videos and scripts come from VOA Learning English public resources.</p>
    <h2>What the fee pays for</h2>
    <p>The fee is for this study tool and for opening the course. The tool includes check-in, the wrong-answer notebook, and progress, together with access to the lessons that are already published. The only products are one-time purchases: 30 days for US$5.99 and 90 days for US$13.99. Payment is one-time and does not auto-renew. There is no trial period. The free Level 1 lessons 1–5 are the trial.</p>
    <h2>The unlock credential</h2>
    <p>After payment is confirmed, an unlock credential is stored in this browser (local storage). It is checked in the browser. Clearing site data, or using another browser, removes it from that browser. You can restore it on the pricing page with the order id and the email used at checkout. Restoring does not start the 30 or 90 days over.</p>
    <h2>Payment and the operator</h2>
    <p>Payment is processed by Waffo as merchant of record. This site does not collect card numbers. The operator is ${escapeHtml(OPERATOR_EN)}.</p>
    <h2>Limits on what we promise</h2>
    <p>To the maximum extent permitted by applicable law, this site is provided as is and as available.</p>
    <p>To the maximum extent permitted by applicable law, we do not guarantee a learning outcome, and we do not guarantee that the service will be uninterrupted.</p>
    <p>To the maximum extent permitted by applicable law, we are not responsible for third-party content, including whether a VOA video remains available to play.</p>
    <p>To the maximum extent permitted by applicable law, our total liability to you arising out of this site is limited to the amount you actually paid for the order in question.</p>
    <p>These limits do not exclude liability for willful misconduct or gross negligence, and they do not exclude liability that applicable law does not allow to be excluded.</p>
    <h2>Governing law and disputes</h2>
    <p>Governing law （待幕僚长确认）. Where a dispute is handled （待幕僚长确认）.</p>
    <h2>Severability</h2>
    <p>If one clause is held invalid or unenforceable, the remaining clauses stay in effect.</p>
    <h2>Contact</h2>
    <p>Contact: ${contact}</p>`;
  }
  return `
    <h2>本站是什么</h2>
    <p>本站是非官方自学工具，不是美国之音（Voice of America），也没有得到美国之音的运营或背书。课文视频和脚本来自 VOA Learning English 的公开资源。</p>
    <h2>收费买的是什么</h2>
    <p>收费的是本站学习工具和课程开放。学习工具包括打卡、错题本和进度，以及已经上线课程的开放。只做一次性购买：30 天 US$5.99、90 天 US$13.99。一次性付款，不自动续费。不设试用期。免费的 Level 1 第 1–5 课就是试用。</p>
    <h2>开通凭证</h2>
    <p>付款确认后，开通凭证保存在你这台浏览器里（本地存储），并由浏览器核验。清除本站数据，或换一台浏览器，这台浏览器里的凭证就没有了。可以在开通页用订单号和付款时的邮箱找回。找回不会把 30 天或 90 天重新起算。</p>
    <h2>付款与经营者</h2>
    <p>付款由 Waffo 作为商户代收（Merchant of Record）处理。本站不收集卡号。本站经营者是${escapeHtml(OPERATOR_HANS)}。</p>
    <h2>我们不作的保证</h2>
    <p>在适用法律允许的最大范围内，本站按原样、按现有状况提供（as is / as available）。</p>
    <p>在适用法律允许的最大范围内，不保证学习效果，也不保证服务不中断。</p>
    <p>在适用法律允许的最大范围内，不对第三方内容负责，包括 VOA 视频是否仍可播放。</p>
    <p>在适用法律允许的最大范围内，我们因本站向你承担的赔偿总额，不超过你就相关订单实际支付的金额。</p>
    <p>上述限制不排除因故意或重大过失造成的责任，也不排除法律不允许排除的责任。</p>
    <h2>适用法律与争议</h2>
    <p>适用法律（待幕僚长确认）。争议解决（待幕僚长确认）。</p>
    <h2>可分割</h2>
    <p>若某一条被认定无效或不可执行，其余条款仍然有效。</p>
    <h2>联系</h2>
    <p>联系邮箱：${contact}</p>`;
}

function privacyBody(lang, email) {
  const contact = contactPhrase(lang, email);
  if (lang === "en") {
    return `
    <h2>Who runs this site</h2>
    <p>This site is an unofficial study tool. It is not Voice of America. The operator is ${escapeHtml(OPERATOR_EN)}.</p>
    <h2>What we use</h2>
    <p>To sell access and to restore a lost credential, the buyer information this site uses is only the order id and the payer email. The email is stored here as a one-way checksum, not as the mailbox itself. The plaintext email is collected by the Waffo checkout and is read back from the payment notification.</p>
    <h2>What we do not collect</h2>
    <p>This site does not ask for an account, and it does not collect card numbers, a billing address, or a government id. Check-in, the wrong-answer notebook, and lesson progress stay in this browser. The unlock credential is stored in this browser. Payment is processed by Waffo as merchant of record. Waffo's own privacy terms apply to the data they collect on the cashier.</p>
    <h2>How long</h2>
    <p>The order record is kept so a refund can revoke access and so the buyer can restore the credential until it expires. Restoring does not start the 30 or 90 days over. How long that record is kept after expiry is （待幕僚长确认）.</p>
    <h2>Contact</h2>
    <p>Privacy contact: ${contact}</p>`;
  }
  return `
    <h2>谁在运营</h2>
    <p>本站是非官方自学工具，不是美国之音。经营者是${escapeHtml(OPERATOR_HANS)}。</p>
    <h2>我们用到的信息</h2>
    <p>为了出售课程开放，以及找回弄丢的开通凭证，本站使用的买家信息只有订单号和付款邮箱。邮箱在本站只保存单向校验值，不保存邮箱明文。明文邮箱由 Waffo 收银台收集，并在付款通知里读回。</p>
    <h2>我们不收集的信息</h2>
    <p>本站不要求注册账号，也不收集卡号、账单地址或证件号码。打卡、错题本和课程进度保存在你这台浏览器里。开通凭证也保存在这台浏览器里。付款由 Waffo 作为商户代收处理。收银台收集的信息适用 Waffo 自己的隐私条款。</p>
    <h2>保存多久</h2>
    <p>订单记录要留到可以按退款作废开通，也要留到买家在有效期内能够找回凭证。找回不会把 30 天或 90 天重新起算。过期之后再保留多久（待幕僚长确认）。</p>
    <h2>联系</h2>
    <p>隐私联系邮箱：${contact}</p>`;
}

function refundBody(lang, email) {
  const contact = contactPhrase(lang, email);
  if (lang === "en") {
    return `
    <h2>When a refund is available</h2>
    <p>A first purchase may be refunded in full within 7 days after payment, once per payer email. After 7 days, or on a later purchase, there is no refund. Mandatory consumer rights under local law are not affected. Level 1 lessons 1–5 are free and are not a purchase.</p>
    <h2>How the money is returned</h2>
    <p>Waffo, as merchant of record, returns an approved refund to the original payment method. When Waffo reports that the refund has succeeded and the funds have been returned, the unlock credential for that order is revoked. A refund that is still in progress, or a refund that fails and moves no money, does not revoke access. This site does not receive a chargeback webhook; a card chargeback is handled from Waffo's email notice, not by an automatic event.</p>
    <h2>How to ask</h2>
    <p>Email ${contact} and include the order id. You can also submit a refund request in the Pancake buyer portal at <a href="https://pancake.waffo.ai/consumer/portal/login">https://pancake.waffo.ai/consumer/portal/login</a>. The portal emails a sign-in link to the purchase address (from auth@waffo.ai). Waffo's refund documentation says buyers may request a refund through that portal, and the merchant reviews the request: <a href="https://docs.waffo.ai/features/refunds.md">https://docs.waffo.ai/features/refunds.md</a>. We approve or decline under this policy. The operator is ${escapeHtml(OPERATOR_EN)}.</p>`;
  }
  return `
    <h2>什么时候可以退</h2>
    <p>首次购买可在付款后 7 天内申请全额退款，每个付款邮箱限一次。超过 7 天，或再次购买（续买），不予退款。当地法律强制规定的消费者权利不受影响。Level 1 第 1–5 课是免费的，不是一笔购买。</p>
    <h2>钱怎么退回</h2>
    <p>退款由 Waffo（商户代收方）原路退回。Waffo 通知退款已经成功、款项已经退回时，该订单的开通凭证作废。还在处理中的退款，或没有退成、没有发生资金变动的退款，不会取消开通。本站收不到拒付的 webhook；银行卡拒付按 Waffo 的邮件通知处理，没有自动事件。</p>
    <h2>怎么申请</h2>
    <p>发邮件到 ${contact}，并附上订单号。也可以在 Pancake 买家门户提交退款申请：<a href="https://pancake.waffo.ai/consumer/portal/login">https://pancake.waffo.ai/consumer/portal/login</a>。门户会把登录链接寄到付款邮箱（发件人为 auth@waffo.ai）。Waffo 的退款文档写明，买家可通过该门户提交申请，由商户在后台审核：<a href="https://docs.waffo.ai/features/refunds.md">https://docs.waffo.ai/features/refunds.md</a>。我们按本政策决定是否批准。经营者是${escapeHtml(OPERATOR_HANS)}。</p>`;
}

function bodyFor(kind, lang, email) {
  if (kind === "privacy") {
    return privacyBody(lang, email);
  }
  if (kind === "refund") {
    return refundBody(lang, email);
  }
  return termsBody(lang, email);
}

function languageNav(kind, lang) {
  const file = PAGES[kind].file;
  if (lang === "en") {
    return `<nav class="script-switch" aria-label="Language"><a href="../${file}" hreflang="zh-Hans" lang="zh-Hans">简</a><a href="../zh-hant/${file}" hreflang="zh-Hant" lang="zh-Hant">繁</a><a href="${file}" hreflang="en" lang="en" aria-current="true">EN</a></nav>`;
  }
  const hans = lang === "zh-Hant" ? `../${file}` : file;
  const hant = lang === "zh-Hant" ? file : `zh-hant/${file}`;
  const en = lang === "zh-Hant" ? `../en/${file}` : `en/${file}`;
  const hansCurrent = lang === "zh-Hans" ? ' aria-current="true"' : "";
  const hantCurrent = lang === "zh-Hant" ? ' aria-current="true"' : "";
  return `<nav class="script-switch" aria-label="简繁"><a href="${hans}" hreflang="zh-Hans" lang="zh-Hans" data-script="zh-Hans"${hansCurrent}>简</a><a href="${hant}" hreflang="zh-Hant" lang="zh-Hant" data-script="zh-Hant"${hantCurrent}>繁</a><a href="${en}" hreflang="en" lang="en">EN</a></nav>`;
}

function buildLegalPage(kind, lang, origin, convert, contactEmail) {
  const spec = PAGES[kind];
  const hansLang = lang === "en" ? "en" : lang;
  const title = hansLang === "en" ? spec.enTitle : convert(spec.hansTitle);
  const description = hansLang === "en" ? spec.enDescription : convert(spec.hansDescription);
  const htmlLang = lang === "en" ? "en" : lang === "zh-Hant" ? "zh-Hant" : "zh-CN";
  const prefix = lang === "zh-Hans" ? "" : "../";
  const home = lang === "en" ? "../index.html" : "index.html";
  const pricing = lang === "en" ? "../pricing.html" : "pricing.html";
  const canonical =
    lang === "en" ? `${origin}/en/${spec.file}` : lang === "zh-Hant" ? `${origin}/zh-hant/${spec.file}` : `${origin}/${spec.file}`;
  const hansUrl = `${origin}/${spec.file}`;
  const hantUrl = `${origin}/zh-hant/${spec.file}`;
  const enUrl = `${origin}/en/${spec.file}`;
  const homeLabel = lang === "en" ? "Lessons" : convert("课表");
  const pricingLabel = lang === "en" ? "Pricing" : convert("开通");
  const heading = title.split("｜")[0].split("|")[0].trim();
  const eyebrow = lang === "en" ? "Unofficial study tool" : convert("非官方自学工具");
  const sourceLang = hansLang === "en" ? "en" : "zh-Hans";
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <link rel="alternate" hreflang="zh-Hans" href="${escapeHtml(hansUrl)}" />
  <link rel="alternate" hreflang="zh-Hant" href="${escapeHtml(hantUrl)}" />
  <link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}" />
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(hansUrl)}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#0b6e4f" />
  <link rel="stylesheet" href="${prefix}css/styles.css" />
</head>
<body data-page="legal">
  <div class="page">
    <nav class="site-nav" aria-label="${lang === "en" ? "Site" : convert("站点")}">
      <a href="${home}">${escapeHtml(homeLabel)}</a>
      <a href="${pricing}">${escapeHtml(pricingLabel)}</a>
      ${languageNav(kind, lang)}
    </nav>
    <header class="header">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(heading)}</h1>
    </header>
    <section class="legal-doc" aria-label="${escapeHtml(heading)}">
${bodyFor(kind, sourceLang, contactEmail)
  .split("\n")
  .map((line) => (hansLang === "zh-Hant" ? convert(line) : line))
  .join("\n")}
    </section>
    <footer class="footer">
      <p>${lang === "en" ? "This site is an unofficial study tool and is not affiliated with Voice of America." : convert("本站为非官方自学工具，与美国之音（Voice of America）没有隶属关系。")}</p>
      <nav class="legal-links" aria-label="${lang === "en" ? "Policies" : convert("条款")}">
        <a href="${fileHref("terms")}">${lang === "en" ? "Terms" : convert("服务条款")}</a>
        <a href="${fileHref("privacy")}">${lang === "en" ? "Privacy" : convert("隐私政策")}</a>
        <a href="${fileHref("refund")}">${lang === "en" ? "Refunds" : convert("退款政策")}</a>
      </nav>
    </footer>
  </div>
  <script type="module" src="${prefix}js/study.js"></script>
  <script type="module" src="${prefix}js/unlock.js"></script>
  <script src="${prefix}js/payment-config.js" defer></script>
  <script src="${prefix}js/i18n.js" defer></script>
  <script src="${prefix}js/app.js" defer></script>
</body>
</html>
`;
}

function fileHref(targetKind) {
  return PAGES[targetKind].file;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = {
  PAGES,
  OPERATOR_HANS,
  buildLegalPage,
};
