#!/usr/bin/env node
// Issue one unlock credential for a past WeChat buyer.
// The Ed25519 private key comes from UNLOCK_PRIVATE_KEY or --key-file.
// This file has no default key. Do not commit a key, a note that contains one, or the printed token.
const fs = require("node:fs");
const path = require("node:path");

const ORDER_ID = /^[A-Za-z0-9_-]{8,64}$/;

function parseArgs(argv) {
  const out = {
    order: "",
    plan: "",
    days: 0,
    note: "",
    keyFile: "",
    origin: "",
    script: "zh-Hans",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag.startsWith("--") || value == null || value.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    i += 1;
    if (flag === "--order") {
      out.order = value;
    } else if (flag === "--plan") {
      out.plan = value;
    } else if (flag === "--days") {
      out.days = Number(value);
    } else if (flag === "--note") {
      out.note = value;
    } else if (flag === "--key-file") {
      out.keyFile = value;
    } else if (flag === "--origin") {
      out.origin = value;
    } else if (flag === "--script") {
      out.script = value;
    } else {
      throw new Error(`unknown argument ${flag}`);
    }
  }
  return out;
}

function loadPrivateKey(args, env) {
  if (args.keyFile) {
    return fs.readFileSync(args.keyFile, "utf8").trim();
  }
  return String((env && env.UNLOCK_PRIVATE_KEY) || "").trim();
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function siteOrigin(root, override) {
  if (override) {
    return String(override).replace(/\/+$/, "");
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
  return String(config.origin || "").replace(/\/+$/, "");
}

async function issueManualCredential({ privateKey, orderId, plan, days, now, origin, note, script }) {
  if (!String(privateKey || "").trim()) {
    throw new Error("UNLOCK_PRIVATE_KEY is not set");
  }
  if (!ORDER_ID.test(orderId || "")) {
    throw new Error("--order must be 8 to 64 letters, digits, _ or -");
  }
  if (plan !== "monthly" && plan !== "quarterly") {
    throw new Error("--plan must be monthly or quarterly");
  }
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("--days must be an integer from 1 to 366, for example 30 or 90");
  }
  const issuedAt = now || new Date();
  const expiresAt = addUtcDays(issuedAt, days);
  const { signCredential } = await import("../js/credential.js");
  const payload = {
    orderId,
    plan,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const token = await signCredential(privateKey, payload);
  const page = script === "zh-Hant" ? "/zh-hant/pricing.html" : "/pricing.html";
  const url = `${String(origin || "").replace(/\/+$/, "")}${page}?credential=${encodeURIComponent(token)}`;
  return { token, url, payload, days, note: note || "" };
}

function formatIssued(issued) {
  return [
    `orderId: ${issued.payload.orderId}`,
    `plan: ${issued.payload.plan}`,
    `days: ${issued.days}`,
    `issuedAt: ${issued.payload.issuedAt}`,
    `expiresAt: ${issued.payload.expiresAt}`,
    `note: ${issued.note}`,
    "note is not inside the credential.",
    "",
    issued.url,
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, "..");
  const issued = await issueManualCredential({
    privateKey: loadPrivateKey(args, process.env),
    orderId: args.order,
    plan: args.plan,
    days: args.days,
    now: new Date(),
    origin: siteOrigin(root, args.origin),
    note: args.note,
    script: args.script,
  });
  process.stdout.write(formatIssued(issued));
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  loadPrivateKey,
  issueManualCredential,
  formatIssued,
};
