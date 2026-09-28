/**
 * Draft store policies. No effective date. Clauses marked 待幕僚长确认
 * are placeholders, not decided terms.
 */

const CONTACT = "contact@example.com（待幕僚长确认）";

const PAGES = {
  terms: {
    file: "terms.html",
    hansTitle: "服务条款｜非官方慢速英文自学",
    hansDescription:
      "本站服务条款草稿。本站不是美国之音官方网站。收费的是学习工具和课程开放，付款由 Waffo 作为商户代收处理。",
    enTitle: "Terms of service | unofficial study tool",
    enDescription:
      "Draft terms. This site is not an official VOA website. The fee is for the study tool and course access. Waffo is the merchant of record.",
  },
  privacy: {
    file: "privacy.html",
    hansTitle: "隐私政策｜非官方慢速英文自学",
    hansDescription:
      "本站隐私政策草稿。为找回开通，本站使用的买家信息只有订单号和付款邮箱。付款信息由 Waffo 作为商户代收处理。",
    enTitle: "Privacy policy | unofficial study tool",
    enDescription:
      "Draft privacy policy. For restoring access we use only the order id and the payer email. Waffo processes the payment as merchant of record.",
  },
  refund: {
    file: "refund.html",
    hansTitle: "退款政策｜非官方慢速英文自学",
    hansDescription:
      "本站退款政策草稿。退款天数等待确认。退款完成后开通凭证作废。付款由 Waffo 作为商户代收处理。",
    enTitle: "Refund policy | unofficial study tool",
    enDescription:
      "Draft refund policy. The refund window is not decided yet. A completed refund revokes the unlock credential. Waffo is the merchant of record.",
  },
};

function termsBody(lang) {
  if (lang === "en") {
    return `
    <h2>What this site is</h2>
    <p>This site is an unofficial study tool. It is not Voice of America, and VOA does not run or endorse it. Lesson videos and scripts come from VOA Learning English public resources.</p>
    <h2>What the fee pays for</h2>
    <p>The fee is for this study tool and for opening the course. The tool includes check-in, the wrong-answer notebook, and progress, together with access to the lessons that are already published. Level 1 lessons 1–5 stay free, as the catalog says. The current products are one-time purchases: 30 days (US$5.99) and 90 days (US$13.99). Automatic renewal is not offered. If that later changes to a subscription, how renewal, cancellation, and expiry work is （待幕僚长确认）.</p>
    <h2>The unlock credential</h2>
    <p>After payment is confirmed, an unlock credential is stored in this browser (local storage). It is checked in the browser. Clearing site data, or using another browser, removes it from that browser. You can restore it on the pricing page with the order id and the email used at checkout. Restoring does not start the 30 or 90 days over.</p>
    <h2>Payment</h2>
    <p>Payment is processed by Waffo as merchant of record. This site does not collect card numbers. The operator of this site is （待幕僚长确认）. Governing law and where a dispute is handled are （待幕僚长确认）.</p>
    <h2>Contact</h2>
    <p>Contact: ${CONTACT}</p>`;
  }
  return `
    <h2>本站是什么</h2>
    <p>本站是非官方自学工具，不是美国之音（Voice of America），也没有得到美国之音的运营或背书。课文视频和脚本来自 VOA Learning English 的公开资源。</p>
    <h2>收费买的是什么</h2>
    <p>收费的是本站学习工具和课程开放。学习工具包括打卡、错题本和进度，以及已经上线课程的开放。Level 1 第 1–5 课按课表保持免费。当前商品是一次性购买：30 天（US$5.99）和 90 天（US$13.99）。现在不提供自动续费。若以后改成订阅，续费、取消和到期如何处理（待幕僚长确认）。</p>
    <h2>开通凭证</h2>
    <p>付款确认后，开通凭证保存在你这台浏览器里（本地存储），并由浏览器核验。清除本站数据，或换一台浏览器，这台浏览器里的凭证就没有了。可以在开通页用订单号和付款时的邮箱找回。找回不会把 30 天或 90 天重新起算。</p>
    <h2>付款</h2>
    <p>付款由 Waffo 作为商户代收（Merchant of Record）处理。本站不收集卡号。本站经营者名称（待幕僚长确认）。适用法律与争议处理地（待幕僚长确认）。</p>
    <h2>联系</h2>
    <p>联系邮箱：${CONTACT}</p>`;
}

function privacyBody(lang) {
  if (lang === "en") {
    return `
    <h2>What we use</h2>
    <p>To sell access and to restore a lost credential, the buyer information this site uses is only the order id and the payer email. The email is stored here as a one-way checksum, not as the mailbox itself. The plaintext email is collected by the Waffo checkout and is read back from the payment notification.</p>
    <h2>What we do not collect</h2>
    <p>This site does not ask for an account, and it does not collect card numbers, a billing address, or a government id. Check-in, the wrong-answer notebook, and lesson progress stay in this browser. Payment is processed by Waffo as merchant of record. Waffo's own privacy terms apply to the data they collect on the cashier.</p>
    <h2>How long</h2>
    <p>The order record is kept so a refund can revoke access and so the buyer can restore the credential until it expires. How long that record is kept after expiry is （待幕僚长确认）.</p>
    <h2>Contact</h2>
    <p>Privacy contact: ${CONTACT}</p>`;
  }
  return `
    <h2>我们用到的信息</h2>
    <p>为了出售课程开放，以及找回弄丢的开通凭证，本站使用的买家信息只有订单号和付款邮箱。邮箱在本站只保存单向校验值，不保存邮箱明文。明文邮箱由 Waffo 收银台收集，并在付款通知里读回。</p>
    <h2>我们不收集的信息</h2>
    <p>本站不要求注册账号，也不收集卡号、账单地址或证件号码。打卡、错题本和课程进度保存在你这台浏览器里。付款由 Waffo 作为商户代收处理。收银台收集的信息适用 Waffo 自己的隐私条款。</p>
    <h2>保存多久</h2>
    <p>订单记录要留到可以按退款作废开通，也要留到买家在有效期内能够找回凭证。过期之后再保留多久（待幕僚长确认）。</p>
    <h2>联系</h2>
    <p>隐私联系邮箱：${CONTACT}</p>`;
}

function refundBody(lang) {
  if (lang === "en") {
    return `
    <h2>When a refund is available</h2>
    <p>A buyer may request a refund within 14 days after payment （待幕僚长确认）. Whether unused days are refunded pro rata is （待幕僚长确认）. Level 1 lessons 1–5 are free and are not a purchase.</p>
    <h2>What a completed refund does</h2>
    <p>Payment is processed by Waffo as merchant of record. When Waffo reports that the refund has succeeded and the funds have been returned, the unlock credential for that order is revoked. A refund that is still in progress, or a refund that fails and moves no money, does not revoke access. This site does not receive a chargeback webhook; a card chargeback is handled from Waffo's email notice, not by an automatic event.</p>
    <h2>How to ask</h2>
    <p>Write to ${CONTACT} with the order id and the payer email. The operator of this site is （待幕僚长确认）.</p>`;
  }
  return `
    <h2>什么时候可以退</h2>
    <p>买家可以在付款后 14 天内申请退款（待幕僚长确认）。未使用天数是否按比例退还（待幕僚长确认）。Level 1 第 1–5 课是免费的，不是一笔购买。</p>
    <h2>退款完成后会怎样</h2>
    <p>付款由 Waffo 作为商户代收处理。Waffo 通知退款已经成功、款项已经退回时，该订单的开通凭证作废。还在处理中的退款，或没有退成、没有发生资金变动的退款，不会取消开通。本站收不到拒付的 webhook；银行卡拒付按 Waffo 的邮件通知处理，没有自动事件。</p>
    <h2>怎么申请</h2>
    <p>请把订单号和付款邮箱寄到 ${CONTACT}。本站经营者名称（待幕僚长确认）。</p>`;
}

function bodyFor(kind, lang) {
  if (kind === "privacy") {
    return privacyBody(lang);
  }
  if (kind === "refund") {
    return refundBody(lang);
  }
  return termsBody(lang);
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

function buildLegalPage(kind, lang, origin, convert) {
  const spec = PAGES[kind];
  const hansLang = lang === "en" ? "en" : lang;
  const title = hansLang === "en" ? spec.enTitle : convert(spec.hansTitle);
  const description = hansLang === "en" ? spec.enDescription : convert(spec.hansDescription);
  const htmlLang = lang === "en" ? "en" : lang === "zh-Hant" ? "zh-Hant" : "zh-CN";
  const prefix = lang === "zh-Hans" ? "" : "../";
  const home = lang === "en" ? "../index.html" : lang === "zh-Hant" ? "index.html" : "index.html";
  const pricing = lang === "en" ? "../pricing.html" : "pricing.html";
  const canonical =
    lang === "en" ? `${origin}/en/${spec.file}` : lang === "zh-Hant" ? `${origin}/zh-hant/${spec.file}` : `${origin}/${spec.file}`;
  const hansUrl = `${origin}/${spec.file}`;
  const hantUrl = `${origin}/zh-hant/${spec.file}`;
  const enUrl = `${origin}/en/${spec.file}`;
  const homeLabel = lang === "en" ? "Lessons" : convert("课表");
  const pricingLabel = lang === "en" ? "Pricing" : convert("开通");
  const heading = title.split("｜")[0].split("|")[0].trim();
  const draft = lang === "en" ? "Draft for the store listing." : convert("开店用的草稿。");
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
      <p class="eyebrow">${escapeHtml(draft)}</p>
      <h1>${escapeHtml(heading)}</h1>
    </header>
    <section class="legal-doc" aria-label="${escapeHtml(heading)}">
${bodyFor(kind, hansLang === "en" ? "en" : "zh-Hans")
  .split("\n")
  .map((line) => (hansLang === "zh-Hant" ? convert(line) : line))
  .join("\n")}
    </section>
    <footer class="footer">
      <p>${lang === "en" ? "This site is an unofficial study tool and is not affiliated with Voice of America." : convert("本站为非官方自学工具，与美国之音（Voice of America）没有隶属关系。")}</p>
      <nav class="legal-links" aria-label="${lang === "en" ? "Policies" : convert("条款")}">
        <a href="${lang === "zh-Hant" ? "" : lang === "en" ? "" : ""}${lang === "en" ? "" : ""}${fileHref(kind, "terms", lang)}">${lang === "en" ? "Terms" : convert("服务条款")}</a>
        <a href="${fileHref(kind, "privacy", lang)}">${lang === "en" ? "Privacy" : convert("隐私政策")}</a>
        <a href="${fileHref(kind, "refund", lang)}">${lang === "en" ? "Refunds" : convert("退款政策")}</a>
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

function fileHref(currentKind, targetKind, lang) {
  const file = PAGES[targetKind].file;
  if (lang === "en") {
    return file;
  }
  return file;
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
  CONTACT,
  buildLegalPage,
};
