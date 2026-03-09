#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const mode = process.argv.includes("--staged") ? "staged" : "all";
const repoRoot = process.cwd();

const disallowedExtensions = new Set([".pem", ".crt", ".key", ".p12", ".pfx"]);
const blockedPaths = [/^infra\/haproxy\/certs\/(?!\.gitkeep$).+/];
const skippedGlobs = [/^node_modules\//, /^\.next\//, /^coverage\//, /^build\//, /^dist\//];
const allowlistedFiles = new Set([".env.example"]);
const textExtensions = new Set([
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".md",
  ".txt",
  ".sh",
  ".ps1",
  ".env",
  ".sql",
  ".toml",
  ".prisma",
  ".cfg",
  ".template",
  ".conf",
  ".dockerignore",
  ".gitignore",
]);

const contentRules = [
  {
    message: "private key block",
    pattern: new RegExp("-----BEGIN(?:" + " [A-Z]+" + ")* PRIVATE KEY-----"),
  },
  {
    message: "certificate block",
    pattern: new RegExp(["-----BEGIN", "CERTIFICATE-----"].join(" ")),
  },
  {
    message: "GitHub token pattern",
    pattern: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    message: "Google API key pattern",
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/,
  },
  {
    message: "AWS access key pattern",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    message: "Stripe secret key pattern",
    pattern: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/,
  },
  {
    message: "Slack token pattern",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
];

function git(...args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listFiles() {
  if (mode === "staged") {
    const output = git("diff", "--cached", "--name-only", "--diff-filter=ACMR");
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  }

  const output = git("ls-files");
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function shouldSkip(file) {
  return skippedGlobs.some((pattern) => pattern.test(file));
}

function isTextFile(file) {
  const ext = path.extname(file).toLowerCase();
  return textExtensions.has(ext);
}

function addFinding(findings, file, reason) {
  findings.push(`${file}: ${reason}`);
}

const findings = [];

for (const file of listFiles()) {
  const normalized = file.replace(/\\/g, "/");

  if (shouldSkip(normalized)) {
    continue;
  }

  if (blockedPaths.some((pattern) => pattern.test(normalized))) {
    addFinding(findings, normalized, "generated certificate material must not be tracked");
    continue;
  }

  const baseName = path.basename(normalized);
  if (baseName.startsWith(".env") && !allowlistedFiles.has(baseName)) {
    addFinding(findings, normalized, "tracked .env files are not allowed");
    continue;
  }

  const ext = path.extname(normalized).toLowerCase();
  if (disallowedExtensions.has(ext)) {
    addFinding(findings, normalized, `tracked ${ext} files are not allowed`);
    continue;
  }

  if (!isTextFile(normalized)) {
    continue;
  }

  const absolutePath = path.join(repoRoot, normalized);
  const content = readFileSync(absolutePath, "utf8");
  for (const rule of contentRules) {
    if (rule.pattern.test(content)) {
      addFinding(findings, normalized, rule.message);
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed for ${mode === "staged" ? "staged files" : "tracked files"}.`);
