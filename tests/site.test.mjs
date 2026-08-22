import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  {
    path: "index.html",
    title: "Network Doctor — Understand Your Connection",
    canonical: "https://mrliang-github.github.io/network-doctor-site/",
  },
  {
    path: "privacy/index.html",
    title: "Privacy Policy — Network Doctor",
    canonical: "https://mrliang-github.github.io/network-doctor-site/privacy/",
  },
  {
    path: "support/index.html",
    title: "Support — Network Doctor",
    canonical: "https://mrliang-github.github.io/network-doctor-site/support/",
  },
];

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function localReferences(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:https?:|mailto:|#)/.test(value));
}

test("contains every required GitHub Pages asset", () => {
  const required = [
    ".nojekyll",
    "index.html",
    "privacy/index.html",
    "support/index.html",
    "assets/styles.css",
    "assets/app-icon.png",
  ];

  for (const relativePath of required) {
    assert.equal(existsSync(join(root, relativePath)), true, `${relativePath} must exist`);
  }
  assert.ok(statSync(join(root, "assets/app-icon.png")).size > 10_000, "app icon must be a real image");
});

test("publishes complete metadata and semantic structure", () => {
  for (const page of pages) {
    const html = read(page.path);
    assert.match(html, /<html lang="en">/);
    assert.match(html, new RegExp(`<title>${page.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</title>`));
    assert.match(html, /<meta name="description" content="[^"]{50,180}">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${page.canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`));
    assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/);
    assert.match(html, /<main id="main"/);
    assert.match(html, /<h1[^>]*>.+<\/h1>/s);
    assert.match(html, /<footer/);
  }
});

test("privacy page matches the app data boundary", () => {
  const html = read("privacy/index.html");
  for (const phrase of [
    "stored locally on your device",
    "IP address and standard connection metadata",
    "abuse prevention",
    "No account is required",
    "does not include advertising",
    "does not sell personal data",
    "Delete all history",
    "mrliang8816@gmail.com",
  ]) {
    assert.ok(html.includes(phrase), `privacy page must include: ${phrase}`);
  }
});

test("support page provides actionable help and contact", () => {
  const html = read("support/index.html");
  for (const phrase of [
    "Quick Check",
    "loaded latency",
    "includes every feature",
    "no subscription, in-app purchase",
    "Product unavailable",
    "Delete all history",
    "Do not include passwords, private keys, or unredacted network reports",
  ]) {
    assert.ok(html.includes(phrase), `support page must include: ${phrase}`);
  }
  assert.match(html, /href="mailto:mrliang8816@gmail\.com\?subject=Network%20Doctor%20Support"/);
});

test("keeps the public site isolated from API and secret material", () => {
  const publicText = pages.map((page) => read(page.path)).join("\n") + read("assets/styles.css");
  for (const forbidden of [
    "workers.dev",
    "network-doctor-api",
    "APP_STORE_CONNECT",
    "CLOUDFLARE_API_TOKEN",
    "REVENUECAT_SECRET_KEY",
    "BEGIN PRIVATE KEY",
    "TODO",
    "TBD",
    "[Support Email]",
  ]) {
    assert.equal(publicText.includes(forbidden), false, `public site must not include ${forbidden}`);
  }
  assert.doesNotMatch(publicText, /<script\b/i);
});

test("all local links and images resolve inside the site root", () => {
  for (const page of pages) {
    const html = read(page.path);
    const baseDirectory = dirname(join(root, page.path));
    for (const reference of localReferences(html)) {
      const withoutQuery = reference.split(/[?#]/, 1)[0];
      const target = normalize(join(baseDirectory, withoutQuery));
      assert.equal(target.startsWith(root), true, `${page.path}: ${reference} must stay inside site root`);
      const resolvedTarget = reference.endsWith("/") ? join(target, "index.html") : target;
      assert.equal(existsSync(resolvedTarget), true, `${page.path}: ${reference} must resolve`);
    }
  }
});
