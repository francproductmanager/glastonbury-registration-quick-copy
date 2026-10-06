// Browser tests for Glasto Quick Copy: the tool, the guides and info pages, and the ad slots.
// Serves the tool locally with its production security headers, drives it with
// Playwright (Chromium) and checks every user flow, edge cases and the security
// guarantees in CONTRIBUTING.md.
//   npm test
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { extname, join, normalize, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GENERATED = ["guides", "faq", "about", "contact", "privacy", "terms", "404.html", "sitemap.xml", "robots.txt"];
const SITE_URL = "https://glastobolt.co.uk";
const SOURCE_REPO = "https://github.com/francproductmanager/glastonbury-registration-quick-copy";
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".txt": "text/plain", ".woff2": "font/woff2", ".xml": "application/xml" };
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
const CSP = toml.match(/Content-Security-Policy = "([^"]+)"/)[1];

// ---------- local servers ----------
function serve(dir, { csp, stamp } = {}) {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    if (!csp && !extname(path)) path += "/index.html";
    const file = join(dir, path);
    try {
      let body = await readFile(file);
      if (stamp && file.endsWith(".html")) body = String(body).replace("__COMMIT_REF__", stamp);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", ...(csp ? { "Content-Security-Policy": csp } : {}) });
      res.end(body);
    } catch { res.writeHead(404); res.end("not found"); }
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}
const tool = await serve(ROOT, { csp: CSP });
const B = tool.url;
const STAMP = "0123456789abcdef0123456789abcdef01234567";
const stamped = await serve(ROOT, { csp: CSP, stamp: STAMP });

// ---------- harness ----------
const browser = await chromium.launch();
let failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (e) { failed++; console.log(`  \u2717 ${name}\n      ${String(e.message || e).split("\n")[0]}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg || "mismatch"}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const CLIP = ["clipboard-read", "clipboard-write"];

// app.js with its internals exposed as window.__t (test-only)
function hookedSource() {
  return readFileSync(join(ROOT, "app.js"), "utf8").replace(
    '  window.addEventListener("hashchange", render);',
    '  window.__t = { encodeShare, decodeShare, shareNames, parseImport, normPostcode };\n  window.addEventListener("hashchange", render);');
}
// Tests never reach the internet: Google's ad loader and anything else external is aborted
const ADS_HOST = /^https:\/\/pagead2\.googlesyndication\.com\//;
async function offline(ctx) { await ctx.route(u => !/^http:\/\/127\.0\.0\.1[:/]/.test(u.href) && !u.href.startsWith("data:"), r => r.abort()); }
async function context({ hook = false, perms = CLIP, init, reducedMotion } = {}) {
  const ctx = await browser.newContext({ permissions: perms, viewport: { width: 390, height: 844 }, reducedMotion });
  await offline(ctx);
  if (hook) await ctx.route("**/app.js*", r => r.fulfill({ contentType: "application/javascript", body: hookedSource() }));
  if (init) await ctx.addInitScript(init);
  return ctx;
}
async function page(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  p.errors = []; p.csp = [];
  p.on("pageerror", e => p.errors.push(String(e)));
  p.on("console", m => { if (/Content Security Policy/i.test(m.text())) p.csp.push(m.text().slice(0, 160)); });
  return p;
}
const clip = p => p.evaluate(() => navigator.clipboard.readText());
// Copying is asynchronous: wait for the screen to show the result, as a person would
const waitText = (p, sel, text) => p.waitForFunction(([s, t]) => document.querySelector(s)?.textContent === t, [sel, text], { timeout: 5000 }).catch(async () => { throw new Error(`waited for ${sel} = ${JSON.stringify(text)}, got ${JSON.stringify(await p.textContent(sel).catch(() => null))}`); });
const pages = p => p.evaluate(() => JSON.parse(localStorage.getItem("tdqc:pages:v1") || "{}"));
async function seed(p, people, id = "g1") {
  await p.goto(B);
  await p.evaluate(([id, people]) => localStorage.setItem("tdqc:pages:v1", JSON.stringify({ [id]: { created: 1, people } })), [id, people]);
}
const GROUP = [
  { name: "Alex Morgan", reg: "1029384756", postcode: "BS1 4DJ" },
  { name: "Sam Patel", reg: "5647382910", postcode: "BS1 4DJ" },
  { name: "Jo Clarke", reg: "0141592653", postcode: "M4 1HN" },
];
function noErrors(...ps) { for (const p of ps) { assert(!p.errors.length, p.errors[0]); assert(!p.csp.length, p.csp[0]); } }

// ---------- files ----------
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if ([".git", "node_modules", "test-results"].includes(f)) continue;
    const full = join(dir, f);
    statSync(full).isDirectory() ? walk(full, out) : out.push(full);
  }
  return out;
}
const appSrc = readFileSync(join(ROOT, "app.js"), "utf8");
const toolHtml = ["index.html", "demo.html"].map(f => readFileSync(join(ROOT, f), "utf8"));
const sitePages = GENERATED.flatMap(g => { const f = join(ROOT, g); return !existsSync(f) ? [] : statSync(f).isDirectory() ? walk(f) : [f]; }).filter(f => f.endsWith(".html"));
const adsSrc = readFileSync(join(ROOT, "ads.js"), "utf8");

console.log("\nStatic checks");
await test("Security policy allows Google ads but keeps every other protection", () => {
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'", "upgrade-insecure-requests"]) assert(CSP.includes(d), `missing ${d}`);
  for (const d of ["object-src", "base-uri", "form-action", "frame-ancestors"]) assert(!new RegExp(`${d} [^;]*(https:|\\*)`).test(CSP), `${d} loosened`);
  for (const h of toolHtml) assert(!/http-equiv="Content-Security-Policy"/.test(h), "the Netlify header is the only policy; no <meta> copy to drift");
  assert(/Referrer-Policy = "strict-origin-when-cross-origin"/.test(toml), "referrer policy");
});
await test("The tool's code makes no network requests; pages load only Google's ad loader", () => {
  for (const [name, src] of [["app.js", appSrc], ["ads.js", adsSrc], ["style.css", readFileSync(join(ROOT, "style.css"), "utf8")]]) {
    const urls = (src.match(/https?:\/\/[^\s"'`)]+/g) || []).filter(u => !u.startsWith("http://www.w3.org/") && u !== SOURCE_REPO);
    assert(!urls.length, `${name} references ${urls.join(", ")}`);
  }
  const LOADER = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2229524942259780";
  for (const h of [...toolHtml, ...sitePages.map(f => readFileSync(f, "utf8"))]) {
    const srcs = [...h.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
    for (const u of srcs) assert(u === LOADER || /^\/?(ads|app)\.js(\?v=\d+)?$/.test(u), `unexpected script ${u}`);
    assert(srcs.includes(LOADER), "AdSense loader missing");
    assert(!/<link[^>]+href="https?:/.test(h.replace(/<link rel="canonical"[^>]+>/, "")), "external stylesheet or font");
  }
});
await test("No dangerous APIs in app.js or ads.js", () => {
  for (const src of [appSrc, adsSrc]) {
    const code = src.replace(/\/\/.*$/gm, "");
    for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "importScripts", 'setAttribute("style"', "postMessage", "localStorage", "sessionStorage"].filter(b => src === appSrc ? !/Storage$/.test(b) : true)) assert(!code.includes(bad), `found ${bad}`);
  }
});
await test("Sources and tooling are never served", () => {
  for (const p of ["/site-src/*", "/scripts/*", "/tests/*"]) assert(new RegExp(`from = "${p.replace(/[*/]/g, "\\$&")}"[\\s\\S]*?status = 404[\\s\\S]*?force = true`).test(toml), `${p} not blocked`);
  assert(!existsSync(join(ROOT, "site")), "the old separate guides site folder is gone");
});
await test("scripts/verify-live.sh passes against an honest deploy and catches a tampered one", async () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();
  // Run the script asynchronously: the local servers live in this process and must keep answering
  const run = (url) => new Promise(r => execFile("bash", ["scripts/verify-live.sh"], { cwd: ROOT, env: { ...process.env, SITE: url.replace(/\/$/, ""), TRIES: "1" }, timeout: 60000 }, (err) => r(err ? (err.code || 1) : 0)));
  const honest = await serve(ROOT, { csp: CSP, stamp: head });
  eq(await run(honest.url), 0, "honest deploy should pass");
  honest.server.close();
  const tmp = mkdtempSync(join(tmpdir(), "tamper-"));
  cpSync(ROOT, tmp, { recursive: true, filter: s => !s.includes("node_modules") && !s.includes(".git") });
  writeFileSync(join(tmp, "fonts", "ibm-plex-mono-latin-600-normal.woff2"), "tampered");
  const bad = await serve(tmp, { csp: CSP, stamp: head });
  assert((await run(bad.url)) !== 0, "a tampered font must fail the check");
  bad.server.close();
});
await test("Deploy-time stamp only touches the commit placeholder", () => {
  const cmd = toml.match(/command = "(.*)"/)[1];
  assert(/^sed -i \\"s\/__COMMIT_REF__\//.test(cmd), `unexpected build command: ${cmd}`);
  for (const h of toolHtml) assert(h.split("__COMMIT_REF__").length === 2, "each page needs exactly one placeholder");
});
await test("No middle dots, em dashes or en dashes anywhere we write", () => {
  const bad = [];
  for (const f of walk(ROOT)) {
    const rel = relative(ROOT, f);
    if (/\.(woff2|png|ico)$/.test(f) || /LICENSE-|package-lock\.json$/.test(rel)) continue;
    const text = readFileSync(f, "utf8");
    const m = text.match(/[\u00b7\u2013\u2014]/);
    if (m) bad.push(`${rel} (${JSON.stringify(m[0])})`);
  }
  assert(!bad.length, bad.join(", "));
});
await test("No real registration numbers or postcodes: only approved made-up values", async () => {
  const { findPersonalData } = await import(join(ROOT, "scripts", "check-personal-data.mjs"));
  const bad = [];
  for (const f of execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean)) {
    if (/package-lock\.json$|LICENSE|\.(woff2|png|ico)$/.test(f) || !existsSync(join(ROOT, f))) continue;
    for (const x of findPersonalData(readFileSync(join(ROOT, f), "utf8"))) bad.push(`${f}: ${x}`);
  }
  assert(!bad.length, bad.join("; "));
  // the check itself catches what it should, in every format people type
  // (built from pieces so these unapproved examples never appear whole in this file)
  const n = ["4815", "162", "342"], pc = [["N7", "9AB"], ["SW9", "8JX"], ["EH1", "2NG"]];
  for (const t of [n.join(""), n.join(" "), n.join("-"), n.join("") + "00", `Postcode: ${pc[0].join(" ")}`, pc[0].join("").toLowerCase(), pc[1].join(" "), pc[2].join(" ")]) assert(findPersonalData(t).length, `missed ${t}`);
  for (const t of ["1029384756", "BS1 4DJ", "sw1a1aa", "2026-10-06", "#e3f6eb", "ca-pub-2229524942259780", "1234567", 'href="data:image/svg+xml,%3Csvg viewBox=%220 0 100 100%22%3E"']) eq(findPersonalData(t), [], t);
});
await test("Fonts are self-hosted and present", () => {
  const css = readFileSync(join(ROOT, "style.css"), "utf8");
  const files = [...css.matchAll(/url\("fonts\/([^"]+)"\)/g)].map(m => m[1]);
  assert(files.length === 7, `expected 7 font faces, got ${files.length}`);
  for (const f of files) assert(existsSync(join(ROOT, "fonts", f)), `missing font ${f}`);
});

// ---------- guides and info pages ----------
console.log("\nGuides and info pages (AdSense)");
await test("Generated pages are up to date with site-src, and the tool's index.html is untouched", () => {
  const tmp = mkdtempSync(join(tmpdir(), "qc-"));
  cpSync(ROOT, tmp, { recursive: true, filter: s => !s.includes("node_modules") && !s.includes(".git") });
  execFileSync(process.execPath, [join(tmp, "site-src", "build.mjs")], { stdio: "ignore" });
  for (const g of GENERATED) {
    const base = join(tmp, g);
    assert(existsSync(base), `build did not produce ${g}`);
    for (const f of statSync(base).isDirectory() ? walk(base) : [base]) {
      const rel = relative(tmp, f);
      assert(existsSync(join(ROOT, rel)), `run "node site-src/build.mjs": ${rel} is missing`);
      assert(readFileSync(f).equals(readFileSync(join(ROOT, rel))), `run "node site-src/build.mjs": ${rel} is out of date`);
    }
  }
  for (const f of ["index.html", "demo.html", "app.js"]) assert(readFileSync(join(tmp, f)).equals(readFileSync(join(ROOT, f))), `build changed ${f}`);
});
await test("security.txt is valid and not about to expire", async () => {
  const t = readFileSync(join(ROOT, ".well-known", "security.txt"), "utf8");
  assert(t.includes(`Contact: ${SOURCE_REPO}/security/advisories/new`), "contact");
  assert(t.includes(`Canonical: ${SITE_URL}/.well-known/security.txt`), "canonical");
  const expires = new Date(t.match(/^Expires: (.+)$/m)[1]);
  assert(expires - Date.now() > 30 * 864e5, `security.txt expires ${expires.toISOString().slice(0, 10)}: move the Expires date on a year`);
  assert(expires - Date.now() < 366 * 864e5, "Expires should be at most a year away");
  const p = await page(await context()); const r = await p.goto(B + ".well-known/security.txt");
  eq(r.status(), 200, "served"); await p.context().close();
});
await test("ads.txt is exactly Google's AdSense line", () => {
  eq(readFileSync(join(ROOT, "ads.txt"), "utf8"), "google.com, pub-2229524942259780, DIRECT, f08c47fec0942fa0\n", "ads.txt");
});
await test("Every page has the AdSense tag, title, description, canonical and footer links", () => {
  assert(sitePages.length >= 15, `only ${sitePages.length} pages`);
  for (const f of sitePages) {
    const h = readFileSync(f, "utf8"), rel = relative(ROOT, f);
    assert(h.includes('src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2229524942259780"'), `${rel}: AdSense script`);
    assert(h.includes('name="google-adsense-account" content="ca-pub-2229524942259780"'), `${rel}: AdSense meta`);
    assert(/<title>[^<]{10,}<\/title>/.test(h) && /name="description" content="[^"]{40,}"/.test(h), `${rel}: title/description`);
    assert(h.includes(`rel="canonical" href="${SITE_URL}/`), `${rel}: canonical`);
    for (const l of ["/privacy/", "/terms/", "/contact/", "/about/", "/faq/", "/guides/"]) assert(h.includes(`href="${l}"`), `${rel}: footer link ${l}`);
    assert(h.includes("not affiliated with"), `${rel}: disclaimer`);
  }
  for (const h of toolHtml) assert(h.includes('name="google-adsense-account" content="ca-pub-2229524942259780"'), "tool AdSense meta");
});
await test("All internal links resolve (guides, info pages and the tool's links)", () => {
  const hrefs = [...sitePages.flatMap(f => [...readFileSync(f, "utf8").matchAll(/href="(\/[^"#]*)/g)].map(m => [relative(ROOT, f), m[1]])),
    ...[...appSrc.matchAll(/"(\/(?:guides|faq|about|privacy|terms|contact)\/[^"]*)"/g)].map(m => ["app.js", m[1]])];
  assert(hrefs.length > 100, "too few links found");
  for (const [from, href] of hrefs) {
    if (href.startsWith("/fonts/") || href === "/guides.css") continue;
    const target = join(ROOT, href.endsWith("/") ? href + "index.html" : href);
    assert(existsSync(target), `${from} links to missing ${href}`);
  }
});
await test("Sitemap and robots.txt use the real address and list every page", () => {
  const sm = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert(locs.includes(SITE_URL + "/") && locs.length === 1 + sitePages.filter(f => !f.endsWith("404.html")).length, `sitemap has ${locs.length} entries`);
  assert(locs.every(u => u.startsWith(SITE_URL + "/")), "sitemap address");
  assert(readFileSync(join(ROOT, "robots.txt"), "utf8").includes(`Sitemap: ${SITE_URL}/sitemap.xml`), "robots.txt sitemap");
});
await test("Privacy policy has the disclosures AdSense requires, and is honest about the tool", () => {
  const h = readFileSync(join(ROOT, "privacy", "index.html"), "utf8").replace(/&#39;/g, "'");
  for (const s of ["Third-party vendors, including Google, use cookies to serve ads based on your prior visits", "Google's use of advertising cookies", "adssettings.google.com", "aboutads.info", "policies.google.com/technologies/partner-sites", "consent", "Netlify", "including the tool's pages, shows Google ads"])
    assert(h.includes(s), `missing "${s}"`);
  const all = sitePages.map(f => readFileSync(f, "utf8")).join("\n") + appSrc;
  for (const stale of ["never appear on the tool", "blocks it from connecting", "separate web address", "connect-src 'none'"]) assert(!all.includes(stale), `stale promise: "${stale}"`);
});
await test("Guides have real depth: 8 articles of 300+ words with sources and dates", () => {
  const guides = sitePages.filter(f => /guides\/[^/]+\/index\.html$/.test(relative(ROOT, f).replace(/\\/g, "/")));
  assert(guides.length === 8, `${guides.length} guides`);
  for (const f of guides) {
    const text = readFileSync(f, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    assert(words > 300, `${relative(ROOT, f)} has only ${words} words`);
    assert(/Last checked \d+ \w+ \d{4}/.test(text), `${relative(ROOT, f)}: no date`);
  }
});
await test("Ad slots sit where we chose: 3 per guide, none on privacy, terms, contact or 404", () => {
  const slots = f => [...readFileSync(join(ROOT, f), "utf8").matchAll(/data-slot="([a-z-]+)"/g)].map(m => m[1]);
  for (const f of sitePages.filter(f => /guides\/[^/]+\/index\.html$/.test(relative(ROOT, f).replace(/\\/g, "/")))) eq(slots(relative(ROOT, f)), ["guide-top", "guide-mid", "guide-end"], relative(ROOT, f));
  eq(slots("guides/index.html"), ["guides-end"], "guides list");
  eq(slots("faq/index.html"), ["faq-mid", "faq-end"], "faq");
  eq(slots("about/index.html"), ["about-end"], "about");
  for (const f of ["privacy/index.html", "terms/index.html", "contact/index.html", "404.html"]) eq(slots(f), [], f);
  const known = [...adsSrc.matchAll(/^\s+"([a-z-]+)": "",/gm)].map(m => m[1]);
  const used = new Set([...sitePages.flatMap(f => slots(relative(ROOT, f))), ...[...appSrc.matchAll(/ad\("([a-z-]+)"\)/g)].map(m => m[1])]);
  eq([...used].sort(), [...known].sort(), "every slot in ads.js is used, and every used slot is in ads.js");
});
await test("Guides pages render without errors (ads blocked in tests)", async () => {
  const p = await page(await context());
  for (const u of ["guides/", "guides/how-glastonbury-registration-works/", "faq/", "about/", "contact/", "privacy/", "terms/", "404.html"]) {
    await p.goto(B + u);
    assert((await p.textContent("h1")).length > 3, `${u}: no h1`);
    eq(await p.locator(".ad-slot:visible").count(), 0, `${u}: empty slots stay hidden`);
  }
  await p.goto(B + "faq/");
  await p.locator(".faq summary").first().click();
  assert(await p.locator(".faq").first().evaluate(d => d.open), "FAQ item didn't open");
  noErrors(p); await p.context().close();
});

// ---------- import parser ----------
console.log("\nImport parser");
{
  const ctx = await context({ hook: true }); const p = await page(ctx); await p.goto(B);
  const parse = (text) => p.evaluate(t => __t.parseImport(t), text);
  await test("Design sample: 4 people, Priya flagged for a missing postcode", async () => {
    const r = await parse("Alex: 1029384756 BS1 4DJ\nsam here! reg 5647 382 910, bs14dj\nJo - 3141592653 / M4 1HN\nPriya 1618033988\ncan't wait!!");
    eq(r, [
      { name: "Alex", reg: "1029384756", postcode: "BS1 4DJ" },
      { name: "Sam", reg: "5647382910", postcode: "BS1 4DJ" },
      { name: "Jo", reg: "3141592653", postcode: "M4 1HN" },
      { name: "Priya", reg: "1618033988", postcode: "" },
    ], "parsed");
  });
  await test("Edge cases: chit-chat, too short/long numbers, leading zeros, dashes, CRLF, accents, stopwords", async () => {
    eq(await parse("see you there!\nwho's booking?\n"), [], "chit-chat");
    eq((await parse("Bob 1234567\nCat 1234567890123")).length, 0, "7 and 13 digits ignored");
    eq(await parse("Zoë 0123-456-789 sw1a1aa"), [{ name: "Zoë", reg: "0123456789", postcode: "SW1A 1AA" }], "accent, dashes, zero, postcode");
    eq((await parse("Dan 2718281828 W1A 1AA\r\nEve 1414213562 LS1 5DL\r\n")).map(x => x.name), ["Dan", "Eve"], "CRLF");
    eq((await parse("my reg number is 2718281828 and postcode e2 8fp")), [{ name: "Person 1", reg: "2718281828", postcode: "E2 8FP" }], "only stopwords -> Person N");
    eq((await parse("JORDAN 173205080 SW1A 2AA"))[0].name, "Jordan", "title-cased");
  });
  await test("WhatsApp messages with name, reg number and postcode on separate lines (iPhone copy)", async () => {
    // Made-up people, in the exact shape of a copied WhatsApp chat
    const chat = [
      "[03/10, 18:07] Alex: Alex Morgan ", "1029384756", "BS1 4DJ",
      "[03/10, 18:07] Alex: Sam Patel ", "5647382910", "BS1 4DJ",
      "[03/10, 18:09] Jo: Name: Ms Jo Clarke", "Registration Number: 3141592653", "Postcode: M4 1HN",
      "[03/10, 18:10] Jo: Name: Mr Dev Shah", "Registration Number: 1618033988", "Postcode: m41hn",
      "[03/10, 19:22] Priya Rao: Priya Rao", "2718281828", "CF10 1AA",
      "[03/10, 19:22] Priya Rao: Tom O'Neill", "1414213562", "CF10 1AA",
    ].join("\n");
    eq(await parse(chat), [
      { name: "Alex Morgan", reg: "1029384756", postcode: "BS1 4DJ" },
      { name: "Sam Patel", reg: "5647382910", postcode: "BS1 4DJ" },
      { name: "Jo Clarke", reg: "3141592653", postcode: "M4 1HN" },
      { name: "Dev Shah", reg: "1618033988", postcode: "M4 1HN" },
      { name: "Priya Rao", reg: "2718281828", postcode: "CF10 1AA" },
      { name: "Tom O'Neill", reg: "1414213562", postcode: "CF10 1AA" },
    ], "six people, every postcode found");
  });
  await test("Multi-line: Android export, chit-chat in between, missing postcodes, postcode first, hidden characters", async () => {
    eq(await parse("03/10/2026, 18:07 - Alex: Alex Morgan\n03/10/2026, 18:07 - Alex: 1029384756\n03/10/2026, 18:08 - Alex: BS1 4DJ"),
      [{ name: "Alex Morgan", reg: "1029384756", postcode: "BS1 4DJ" }], "Android export");
    eq(await parse("hi all! here are ours\nAlex Morgan\n1029384756\nthanks!\nBS1 4DJ\ncan't wait!!\nSam Patel\n5647382910\nsee you there"),
      [{ name: "Alex Morgan", reg: "1029384756", postcode: "BS1 4DJ" }, { name: "Sam Patel", reg: "5647382910", postcode: "" }], "chit-chat ignored, Sam flagged");
    eq(await parse("Jo Clarke\nM4 1HN\n3141592653\nDev Shah\nM4 1HN\n1618033988"),
      [{ name: "Jo Clarke", reg: "3141592653", postcode: "M4 1HN" }, { name: "Dev Shah", reg: "1618033988", postcode: "M4 1HN" }], "postcode before reg");
    eq(await parse("\u200e[03/10, 18:07] Alex: \u200eALEX MORGAN\n\u200e1029 384 756\nbs14dj"),
      [{ name: "Alex Morgan", reg: "1029384756", postcode: "BS1 4DJ" }], "invisible marks, spaced reg, shouty name");
    eq(await parse("1029384756\nBS1 4DJ\n5647382910"),
      [{ name: "Person 1", reg: "1029384756", postcode: "BS1 4DJ" }, { name: "Person 2", reg: "5647382910", postcode: "" }], "numbers only");
    eq(await parse("Alex Morgan\nSam Patel\nBS1 4DJ\nwho's booking?"), [], "names without reg numbers are not people");
    eq(await parse("Alex Morgan 1029384756\nSam Patel 5647382910 BS1 4DJ"),
      [{ name: "Alex Morgan", reg: "1029384756", postcode: "" }, { name: "Sam Patel", reg: "5647382910", postcode: "BS1 4DJ" }], "postcode stays with its own line's person");
  });
  await test("Caps at 6 people and ignores lines after", async () => {
    const text = Array.from({ length: 9 }, (_, i) => `P${i} 10000000${10 + i} BS1 4DJ`).join("\n");
    eq((await parse(text)).length, 6, "cap");
  });
  await test("Hostile input is just text (no HTML parsing, length-limited)", async () => {
    const r = await parse('<img src=x onerror=alert(1)> 2718281828 SW1A 1AA\n' + "9".repeat(5000));
    eq(r[0].reg, "2718281828", "reg"); assert(r.length === 1, "giant digit run must not become a person");
  });
  await ctx.close();
}

// ---------- share links ----------
console.log("\nShare links");
{
  const ctx = await context({ hook: true }); const p = await page(ctx); await p.goto(B);
  await test("5,000 random groups round-trip exactly", async () => {
    const r = await p.evaluate(() => {
      const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
      const firsts = ["Tom", "Em", "José", "Zoë", "Siobhán", "李", "Ελένη", "Mary-Jane", "O'Neil", "\u{1F3AA}Rave", "Łukasz"];
      const lasts = ["Okafor", "Hughes", "Ó Briain", "van der Berg", "Fitzgerald-Hart", ""];
      const pcs = ["SW1A 1AA", "W1A 1AA", "EC1A 1BB", "BS1 4DJ", "M60 1AA", "CF99 1NA", "1050", "1050-123", "ÖSTER 12", "D02 X285", " se1 7pb "];
      let bad = 0, longest = 0;
      for (let t = 0; t < 5000; t++) {
        const people = Array.from({ length: 1 + rnd(6) }, () => {
          let reg = ""; for (let i = 0, n = 1 + rnd(12); i < n; i++) reg += rnd(10);
          return { name: `${pick(firsts)} ${pick(lasts)}`.trim(), reg, postcode: pick(pcs) };
        });
        const code = __t.encodeShare({ people }); longest = Math.max(longest, code.length);
        const back = __t.decodeShare(code), names = __t.shareNames(people);
        const ok = back && back.people.length === people.length && people.every((x, i) =>
          back.people[i].reg === x.reg && back.people[i].postcode === x.postcode.trim().toUpperCase() && back.people[i].name === (names[i] || "Unnamed"));
        if (!ok) bad++;
      }
      return { bad, longest };
    });
    assert(r.bad === 0, `${r.bad} mismatches`); assert(r.longest < 400, `longest ${r.longest}`);
  });
  await test("Duplicate first names get an initial; surnames never in the link", async () => {
    const r = await p.evaluate(() => {
      const people = [{ name: "Tom Okafor", reg: "1", postcode: "LS1 5DL" }, { name: "tom Hughes", reg: "2", postcode: "LS1 5DL" }, { name: "Ann Lee", reg: "3", postcode: "LS1 5DL" }];
      const code = __t.encodeShare({ people });
      return { names: __t.decodeShare(code).people.map(x => x.name), raw: atob(code.replace(/-/g, "+").replace(/_/g, "/")) };
    });
    eq(r.names, ["Tom O.", "tom H.", "Ann"], "names"); assert(!/Okafor|Hughes|Lee/.test(r.raw), "surname in link");
  });
  await test("Older link formats still open (v1 binary and legacy JSON)", async () => {
    const r = await p.evaluate(() => [
      __t.decodeShare("AQRBbGV4pjQqWz0ACxcQzQQDU2Ftpn45nFABCxcQzQQCSm-lTeZAuwAWEUQXBUNocmlzp2SwBaIAzBMAgZMBBVByaXlhpkQ9cWAAnBMc2QIDVG9tprovS1QAFRcUTQU"),
      __t.decodeShare("eyJ0IjoiT3VyIGdyb3VwIiwicCI6W1siQW5uIiwiMTIzNDU2Nzg5MCIsIlNXMUEgMUFBIl1dfQ"),
    ]);
    assert(r[0]?.people.length === 6 && r[0].people[0].postcode === "BS1 4DJ", "v1"); assert(r[1]?.people[0].postcode === "SW1A 1AA", "legacy");
  });
  await ctx.close();
}

// ---------- home: try it ----------
console.log("\nHome");
await test("Try it: copy, then a real paste into each practice box, then done", async () => {
  const p = await page(await context()); await p.goto(B);
  const msg = () => p.textContent(".try-msg");
  const reg = p.locator(".mock-field").first(), pc = p.locator(".mock-field").nth(1);
  await reg.focus();
  assert((await msg()).includes("Copy it first"), "focusing a box first should explain");
  await p.locator(".copy.hero").first().click();
  eq(await clip(p), "1029384756", "clipboard");
  assert((await msg()).includes("Now paste it into the Registration no. box below") && (await msg()).includes("Ctrl+V"), "tells you how to paste");
  assert(await reg.evaluate(e => e.classList.contains("is-target")), "reg box highlighted");
  eq(await reg.inputValue(), "", "not pasted automatically");
  eq(await reg.getAttribute("placeholder"), "Paste here", "says paste here");
  await reg.click(); await reg.fill("12345"); await reg.fill("1234567890");
  assert((await msg()).includes("doesn't match"), "wrong number explained");
  await reg.fill(""); await reg.focus(); await p.keyboard.press("ControlOrMeta+V");
  await waitText(p, ".try-msg", "Pasted. Now tap the postcode above to copy it.");
  eq(await reg.inputValue(), "1029384756", "pasted for real");
  assert(await reg.evaluate(e => e.readOnly), "locked once right");
  await p.locator(".copy.hero").nth(1).click(); eq(await clip(p), "BS1 4DJ", "postcode clipboard");
  await pc.focus(); await p.keyboard.press("ControlOrMeta+V");
  await p.waitForSelector(".try-done p");
  assert((await p.textContent(".try-done")).includes("That's the whole trick"), "done message");
  eq(await p.locator(".try-done a").count(), 0, "no extra Start button: the main button sits just below");
  await p.click("text=Reset");
  eq(await reg.inputValue(), "", "reset clears"); eq(await pc.inputValue(), "", "reset clears postcode");
  noErrors(p); await p.context().close();
});
await test("Try it on a phone: says press and hold, then Paste", async () => {
  const ctx = await browser.newContext({ permissions: CLIP, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await offline(ctx); const p = await page(ctx); await p.goto(B);
  await p.locator(".copy.hero").first().tap();
  await p.waitForFunction(() => document.querySelector(".try-msg").textContent.startsWith("Copied"));
  const m = await p.textContent(".try-msg"); assert(m.includes("press and hold inside it, then tap Paste"), "touch instructions: " + m);
  await ctx.close();
});
await test("Home: one main action, how it works, questions, footer with commit and data link", async () => {
  const p = await page(await context()); await p.goto(stamped.url);
  eq(await p.locator(".v-home > a.btn-primary").textContent(), "Make your group's page", "CTA");
  eq(await p.locator(".steps li").count(), 3, "steps");
  eq(await p.locator(".v-home > .section .faq").count(), 4, "faq");
  await p.locator(".faq summary").first().click(); assert(await p.locator(".faq").first().evaluate(d => d.open), "faq opens");
  const links = await p.locator("footer a").evaluateAll(as => as.map(a => [a.textContent, a.getAttribute("href")]));
  assert(links.some(([t, h]) => h === "#/data"), "data link");
  assert(links.some(([t, h]) => t === "0123456" && h === `${SOURCE_REPO}/commit/${STAMP}`), "commit link");
  for (const l of ["/guides/", "/faq/", "/about/", "/privacy/", "/terms/", "/contact/"]) assert(links.some(([t, h]) => h === l), `footer link ${l}`);
  assert(await p.locator(".guides-links a[href^='/guides/']").count() >= 4, "guide links on home");
  noErrors(p); await p.context().close();
});
await test("Home lists saved groups newest first and updates when another tab changes storage", async () => {
  const ctx = await context(); const p = await page(ctx); await p.goto(B);
  await p.evaluate(() => localStorage.setItem("tdqc:pages:v1", JSON.stringify({ a1: { created: 1, people: [{ name: "Old", reg: "1", postcode: "E1 6AN" }] }, b2: { created: 2, people: [{ name: "New", reg: "2", postcode: "E1 6AN" }] } })));
  await p.reload();
  eq(await p.locator(".saved .names").allTextContents(), ["New", "Old"], "order");
  const q = await page(ctx); await q.goto(B);
  await q.evaluate(() => localStorage.setItem("tdqc:pages:v1", JSON.stringify({})));
  await p.waitForTimeout(200);
  eq(await p.locator(".saved").count(), 0, "other tab's change shown");
  await ctx.close();
});

// ---------- create ----------
console.log("\nCreate and edit");
await test("Paste with a missing postcode routes to the form with that row in error, then saves", async () => {
  const p = await page(await context()); await p.goto(B + "#/new");
  const btn = p.locator(".v-create > button.btn-primary");
  assert(await btn.isDisabled(), "disabled when empty"); eq(await p.textContent(".res-head span"), "No reg numbers found yet", "empty head");
  await p.fill("textarea", "Alex: 1029384756 BS1 4DJ\nPriya 1618033988");
  eq(await p.textContent(".res-head span"), "Found 2 people", "found"); eq(await btn.textContent(), "Create group (2 people)", "button label");
  eq(await p.locator(".status").allTextContents(), ["Ready", "Add postcode"], "statuses");
  await btn.click();
  await p.waitForSelector(".ecard.has-error");
  eq(await p.locator(".err:not(:empty)").allTextContents(), ["Add a postcode."], "error");
  eq(await pages(p), {}, "nothing saved yet");
  await p.locator('input[placeholder="e.g. BS1 4DJ"]').nth(1).fill("se17pb");
  await p.click("text=Create group"); await p.waitForSelector(".v-day");
  const saved = Object.values(await pages(p))[0].people;
  eq(saved, [{ name: "Alex", reg: "1029384756", postcode: "BS1 4DJ" }, { name: "Priya", reg: "1618033988", postcode: "SE1 7PB" }], "saved and normalised");
  noErrors(p); await p.context().close();
});
await test("Paste with everyone complete saves straight to the group page", async () => {
  const p = await page(await context()); await p.goto(B + "#/new");
  await p.fill("textarea", "Alex 1029384756 BS1 4DJ"); await p.click("text=Create group (1 person)");
  await p.waitForSelector(".v-day"); eq(await p.textContent("h1"), "Alex", "title");
  await p.context().close();
});
await test("Add by hand keeps parsed people; validation messages; blank rows ignored; 6 max; remove", async () => {
  const p = await page(await context()); await p.goto(B + "#/new");
  await p.fill("textarea", "Alex 1029384756 BS1 4DJ"); await p.click("text=+ Add someone by hand");
  await p.waitForSelector(".v-edit"); eq(await p.inputValue('input[placeholder="Digits only"]'), "1029384756", "prefilled");
  for (let i = 0; i < 5; i++) await p.click(".add-person");
  assert(await p.locator(".add-person").isDisabled(), "disabled at 6"); eq(await p.textContent(".add-person"), "6 people max per booking", "max label");
  const name = i => p.locator('input[placeholder="First name is enough"]').nth(i), reg = i => p.locator('input[placeholder="Digits only"]').nth(i), pc = i => p.locator('input[placeholder="e.g. BS1 4DJ"]').nth(i);
  await name(1).fill("NoReg"); await pc(1).fill("E1 6AN");
  await name(2).fill("TooLong"); await reg(2).fill("1234567890123"); await pc(2).fill("E1 6AN");
  await name(3).fill("Nothing");
  await p.click("text=Create group");
  eq(await p.locator(".err").allTextContents(), ["", "Add a reg number (digits only).", "Reg numbers are at most 12 digits.", "Add a reg number (digits only). Add a postcode.", "", ""], "messages");
  eq(await reg(1).evaluate(e => e.classList.contains("bad")), true, "reg border");
  eq(await pc(1).evaluate(e => e.classList.contains("bad")), false, "only failing input marked");
  for (const i of [3, 2, 1]) await p.locator(".ecard .textbtn").nth(i).click();
  assert(!(await p.locator(".add-person").isDisabled()), "re-enabled");
  await reg(1).fill(" 27182 81828 "); await pc(1).fill("sw1a1aa"); await name(1).fill("Bea");
  await p.click("text=Create group"); await p.waitForSelector(".v-day");
  eq(Object.values(await pages(p))[0].people.map(x => [x.name, x.reg, x.postcode]), [["Alex", "1029384756", "BS1 4DJ"], ["Bea", "2718281828", "SW1A 1AA"]], "blank rows ignored, normalised");
  noErrors(p); await p.context().close();
});
await test("Edit an existing group and save changes", async () => {
  const p = await page(await context()); await seed(p, GROUP);
  await p.goto(B + "#/edit/g1"); eq(await p.textContent("h1"), "Edit group", "title");
  await p.locator('input[placeholder="First name is enough"]').first().fill("Alexa");
  await p.click("text=Save changes"); await p.waitForSelector(".v-day");
  eq((await pages(p)).g1.people[0].name, "Alexa", "saved");
  await p.context().close();
});
await test("A group deleted in another tab isn't re-created by a stale editor", async () => {
  const ctx = await context(); const a = await page(ctx); const c = await page(ctx);
  await seed(a, GROUP); await a.goto(B + "#/edit/g1"); await c.goto(B + "#/p/g1");
  c.on("dialog", d => d.accept()); await c.click(".bottom-row .danger");
  await a.locator('input[placeholder="First name is enough"]').first().fill("X"); await a.click("text=Save changes"); await a.waitForTimeout(200);
  eq(await pages(a), {}, "stays deleted");
  await ctx.close();
});

// ---------- ticket day ----------
console.log("\nTicket day");
await test("Up next, progress, per-person status, clipboard, all done, clear ticks", async () => {
  const p = await page(await context()); await seed(p, GROUP); await p.goto(B + "#/p/g1");
  const boxes = p.locator(".v-day .copy");
  eq(await p.textContent("h1"), "Alex, Sam, Jo", "title");
  eq(await boxes.evaluateAll(bs => bs.map(b => b.className.includes("is-next"))), [true, false, false, false, false, false], "first is up next");
  eq(await p.textContent(".stat .v"), "0 of 6 copied", "progress");
  await boxes.nth(1).click(); eq(await clip(p), "BS1 4DJ", "clipboard");
  eq(await boxes.nth(0).evaluate(b => b.className.includes("is-next")), true, "still up next (reading order)");
  await boxes.nth(0).click(); eq(await clip(p), "1029384756", "clipboard 2");
  eq(await p.locator(".pstatus").first().textContent(), "Done \u2713", "person done");
  eq(await boxes.nth(2).evaluate(b => b.className.includes("is-next")), true, "next moves on");
  eq(await boxes.nth(0).getAttribute("aria-label"), "Copy reg number 1029384756, copied", "aria-label");
  await boxes.nth(4).click(); eq(await clip(p), "0141592653", "leading zero kept");
  eq(await p.locator(".pstatus").nth(2).textContent(), "1 of 2", "half");
  for (const i of [2, 3, 5]) await boxes.nth(i).click();
  await waitText(p, ".stat .v", "All done \u2713");
  assert(await p.locator(".finish").isHidden(), "the demo's finish card never shows on a real group");
  await p.click("text=Clear ticks");
  eq(await p.textContent(".stat .v"), "0 of 6 copied", "cleared");
  noErrors(p); await p.context().close();
});
await test("Copied boxes survive a reload in the same session, but not a new session", async () => {
  const ctx = await context(); const p = await page(ctx); await seed(p, GROUP); await p.goto(B + "#/p/g1");
  await p.locator(".v-day .copy").first().click(); await waitText(p, ".stat .v", "1 of 6 copied"); await p.reload();
  eq(await p.textContent(".stat .v"), "1 of 6 copied", "kept after reload");
  const q = await page(await context()); await seed(q, GROUP); await q.goto(B + "#/p/g1");
  eq(await q.textContent(".stat .v"), "0 of 6 copied", "fresh session");
  await ctx.close(); await q.context().close();
});
await test("Copy failure shows the failed state and a hint", async () => {
  const p = await page(await context({ perms: [], init: () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("no")) } });
    document.execCommand = () => false;
  } }));
  await seed(p, GROUP); await p.goto(B + "#/p/g1");
  const b = p.locator(".v-day .copy").first(); await b.click();
  assert(await b.evaluate(e => e.classList.contains("is-fail")), "fail class"); assert((await b.textContent()).includes("hold to select"), "hint");
  assert((await p.textContent("#toast")).includes("Couldn't copy"), "toast");
  eq(await p.textContent(".stat .v"), "0 of 6 copied", "not counted");
  await p.context().close();
});
await test("Keep screen on: hidden when unsupported", async () => {
  const p = await page(await context({ init: () => { delete Navigator.prototype.wakeLock; } }));
  await seed(p, GROUP); await p.goto(B + "#/p/g1");
  eq(await p.locator('[role="switch"]').count(), 0, "no switch"); assert(await p.locator(".stats.single").count() === 1, "progress spans both columns");
  await p.context().close();
});
await test("Keep screen on: toggles, re-requests after the tab returns, releases on leaving", async () => {
  const p = await page(await context({ init: () => {
    window.__wl = { req: 0, rel: 0 };
    Object.defineProperty(Navigator.prototype, "wakeLock", { configurable: true, get: () => ({ request: async () => { __wl.req++; return { released: false, release() { this.released = true; __wl.rel++; return Promise.resolve(); } }; } }) });
  } }));
  await seed(p, GROUP); await p.goto(B + "#/p/g1");
  const sw = p.locator('[role="switch"]');
  eq(await sw.getAttribute("aria-checked"), "false", "starts off");
  await sw.click(); eq(await sw.getAttribute("aria-checked"), "true", "on"); eq(await p.evaluate(() => __wl.req), 1, "requested");
  await p.evaluate(() => { document.querySelector('[role="switch"]'); });
  await sw.click(); eq(await sw.getAttribute("aria-checked"), "false", "off"); eq(await p.evaluate(() => __wl.rel), 1, "released");
  await sw.click(); await p.goto(B + "#/");
  eq(await p.evaluate(() => __wl.rel), 2, "released when leaving the page");
  await p.context().close();
});
await test("Keep screen on: a refused request shows a message and stays off", async () => {
  const p = await page(await context({ init: () => {
    Object.defineProperty(Navigator.prototype, "wakeLock", { configurable: true, get: () => ({ request: () => Promise.reject(new Error("denied")) }) });
  } }));
  await seed(p, GROUP); await p.goto(B + "#/p/g1");
  await p.click('[role="switch"]');
  eq(await p.getAttribute('[role="switch"]', "aria-checked"), "false", "off"); assert((await p.textContent("#toast")).includes("Couldn't keep the screen on"), "toast");
  await p.context().close();
});
await test("Share: copy link, what's in the link matches the decoded link", async () => {
  const p = await page(await context({ init: () => { delete Navigator.prototype.share; } }));
  await seed(p, [{ name: "Tom Okafor", reg: "1029384756", postcode: "BS1 4DJ" }, { name: "Tom Hughes", reg: "5647382910", postcode: "M4 1HN" }]);
  await p.goto(B + "#/p/g1");
  await p.click("text=Copy link"); await waitText(p, ".share .btn-primary", "Link copied \u2713");
  const link = await clip(p); assert(link.startsWith(B + "#/s/"), "link");
  await p.click("text=What's in the link?");
  eq(await p.locator(".lrow").evaluateAll(rs => rs.map(r => r.textContent)), ["Tom O.1029384756BS1 4DJ", "Tom H.5647382910M4 1HN"], "rows");
  noErrors(p); await p.context().close();
});
await test("Share: uses the phone's share sheet when available", async () => {
  const p = await page(await context({ init: () => { window.__shared = null; Navigator.prototype.share = async (d) => { window.__shared = d; }; } }));
  await seed(p, GROUP); await p.goto(B + "#/p/g1");
  await p.click("text=Share link");
  const d = await p.evaluate(() => window.__shared); assert(d && d.url.includes("#/s/"), "shared url");
  await p.context().close();
});
await test("Delete a group (with confirm) and the cancel path", async () => {
  const p = await page(await context()); await seed(p, GROUP); await p.goto(B + "#/p/g1");
  p.once("dialog", d => d.dismiss()); await p.click(".bottom-row .danger"); eq(Object.keys(await pages(p)), ["g1"], "kept on cancel");
  p.once("dialog", d => d.accept()); await p.click(".bottom-row .danger"); await p.waitForSelector(".v-home");
  eq(await pages(p), {}, "deleted");
  await p.context().close();
});

// ---------- share link opened ----------
console.log("\nShare links opened");
await test("Opening a link shows a preview and saves nothing until you choose", async () => {
  const p = await page(await context({ hook: true })); await p.goto(B);
  const code = await p.evaluate(g => __t.encodeShare({ people: g }), GROUP);
  const q = await page(await context()); await q.goto(B + "#/s/" + code);
  eq(await q.textContent("h1"), "Your group's ready", "preview");
  eq(await q.locator(".irow").count(), 3, "rows"); eq(await pages(q), {}, "not saved yet");
  await q.click("text=Not now"); await q.waitForSelector(".v-home"); eq(await pages(q), {}, "Not now saves nothing");
  assert(!q.url().includes("#/s/"), "code left the address bar");
  await q.goto(B + "#/s/" + code); await q.click("text=Save to this phone"); await q.waitForSelector(".v-day");
  const id = Object.keys(await pages(q))[0]; assert(q.url().endsWith("#/p/" + id), "redirected to the saved page");
  await q.goto(B + "#/s/" + code); await q.waitForSelector(".v-day");
  eq(Object.keys(await pages(q)).length, 1, "already saved: straight to the page, no duplicate");
  noErrors(p, q); await p.context().close(); await q.context().close();
});
await test("Broken, tampered and oversized links say the link doesn't open", async () => {
  const p = await page(await context());
  for (const code of ["AQ", "AQVBbGV4", "!!!", "AQ" + "A".repeat(50), "%E0%A4%A", "====", "A".repeat(200000)]) {
    await p.goto(B + "#/s/" + code); await p.waitForTimeout(40);
    eq(await p.textContent("h1"), "This link doesn't open", code.slice(0, 10));
  }
  noErrors(p); await p.context().close();
});

// ---------- data page, demo, robustness ----------
console.log("\nData, demo and robustness");
await test("Data page: explains storage, shows the version, deletes everything with confirm", async () => {
  const p = await page(await context()); await p.goto(stamped.url);
  await p.evaluate(g => localStorage.setItem("tdqc:pages:v1", JSON.stringify({ g1: { created: 1, people: g } })), GROUP);
  await p.goto(stamped.url + "#/data");
  const text = await p.textContent("main");
  assert(text.includes("Its code makes no network requests") && text.includes("Google's ad code runs on these pages"), "honest about the tool and the ads");
  assert((await p.textContent(".check")).includes("0123456"), "version");
  p.once("dialog", d => d.accept()); await p.click("text=Delete everything on this phone");
  eq(await pages(p), {}, "deleted"); eq(await p.locator("text=Delete everything on this phone").count(), 0, "button hidden when empty");
  await p.context().close();
});
await test("Demo: banner, nothing saved, finish card with a Start prompt, share link opens the real app", async () => {
  const p = await page(await context()); await p.goto(B + "demo.html");
  assert((await p.textContent(".demo-banner")).includes("Nothing is saved"), "banner");
  for (const b of await p.locator(".v-day .copy").all()) await b.click();
  await waitText(p, ".stat .v", "All done \u2713");
  assert(await p.locator(".finish").isVisible(), "finish card");
  eq(await p.locator(".finish a").getAttribute("href"), "./#/new", "start link");
  eq(await p.evaluate(() => localStorage.getItem("tdqc:pages:v1")), null, "nothing saved");
  await p.click("text=Copy link"); const link = await clip(p); assert(!link.includes("demo.html"), "link points at the app");
  noErrors(p); await p.context().close();
});
await test("Missing groups and special addresses show 'not on this phone'", async () => {
  const p = await page(await context());
  for (const r of ["p/nope", "p/__proto__", "edit/__proto__", "p/constructor", "edit/hasOwnProperty"]) {
    await p.goto(B + "#/" + r); await p.waitForTimeout(40); eq(await p.textContent("h1"), "This group isn't on this phone", r);
  }
  noErrors(p); await p.context().close();
});
await test("Corrupted storage never crashes any screen", async () => {
  for (const raw of ["{not json", "null", "123", "[1,2]", '{"a":{"created":1}}', '{"a":{"people":"x"}}', '{"a":{"people":[{"name":5,"reg":12345,"postcode":null}]}}', '{"__proto__":{"people":[]}}']) {
    const p = await page(await context()); await p.goto(B);
    await p.evaluate(r => localStorage.setItem("tdqc:pages:v1", r), raw);
    await p.evaluate(() => sessionStorage.setItem("tdqc:used:a", "{bad"));
    for (const route of ["", "#/p/a", "#/edit/a", "#/data", "#/new"]) { await p.goto(B + route); await p.waitForTimeout(30); }
    assert(!p.errors.length, `${raw}: ${p.errors[0]}`);
    await p.context().close();
  }
});
await test("Reduced motion: everything still works", async () => {
  const p = await page(await context({ reducedMotion: "reduce" })); await p.goto(B);
  await p.locator(".copy.hero").first().click(); await p.waitForFunction(() => document.querySelector(".try-msg").textContent.startsWith("Copied"));
  await p.locator(".mock-field").first().fill("1029384756");
  eq(await p.textContent(".try-msg"), "Pasted. Now tap the postcode above to copy it.", "works");
  await p.context().close();
});

// ---------- ad slots ----------
console.log("\nAd slots");
// ads.js with made-up ad unit IDs, as if the owner had created them in AdSense
const fakeAds = () => adsSrc.replace(/^(\s+"[a-z-]+": )"",/gm, (_, k) => `${k}"1234567890",`);
async function adsContext() {
  const ctx = await context();
  await ctx.route("**/ads.js*", r => r.fulfill({ contentType: "application/javascript", body: fakeAds() }));
  await ctx.addInitScript(() => { window.__pushes = 0; window.adsbygoogle = { push: () => { window.__pushes++; } }; });
  return ctx;
}
await test("Slots without an ad unit ID show nothing", async () => {
  const p = await page(await context()); await seed(p, GROUP);
  for (const r of ["", "#/new", "#/add", "#/p/g1", "#/data"]) {
    await p.goto(B + r); await p.waitForTimeout(30);
    eq(await p.locator("ins.adsbygoogle").count(), 0, `${r}: no ad`);
    eq(await p.locator(".ad-slot:visible").count(), 0, `${r}: slot hidden`);
  }
  noErrors(p); await p.context().close();
});
await test("Filled slots get a labelled AdSense unit, once, on every screen", async () => {
  const p = await page(await adsContext()); await seed(p, GROUP);
  const expect = { "": ["home-mid", "home-end"], "#/new": ["create-end"], "#/add": ["editor-end"], "#/edit/g1": ["editor-end"], "#/p/g1": ["group-end"], "#/data": ["data-end"] };
  for (const [r, names] of Object.entries(expect)) {
    await p.goto(B); await p.goto(B + r); await p.waitForTimeout(40);
    const got = await p.locator(".ad-slot[data-filled]").evaluateAll(els => els.map(e => [e.dataset.slot, e.querySelector(".ad-label")?.textContent, e.querySelector("ins.adsbygoogle")?.dataset.adClient, e.querySelector("ins.adsbygoogle")?.dataset.adSlot, e.querySelectorAll("ins").length]));
    eq(got, names.map(n => [n, "Advertisement", "ca-pub-2229524942259780", "1234567890", 1]), r || "home");
  }
  // in-app navigation (no reload) fills the new screen's slots too
  await p.goto(B); await p.click("text=Make your group's page"); await p.waitForSelector(".v-create");
  eq(await p.locator(".ad-slot[data-filled]").count(), 1, "filled after navigation");
  assert(await p.evaluate(() => window.__pushes) >= 1, "AdSense asked to fill");
  await p.goto(B + "faq/"); await p.waitForTimeout(40);
  eq(await p.locator(".ad-slot[data-filled]").count(), 2, "faq slots filled");
  noErrors(p); await p.context().close();
});
await test("Ticket day: the only ad is at the very bottom, never among the copy boxes", async () => {
  const p = await page(await adsContext()); await seed(p, GROUP); await p.goto(B + "#/p/g1"); await p.waitForTimeout(40);
  eq(await p.locator(".v-day .ad-slot").count(), 1, "one slot");
  eq(await p.locator(".cards .ad-slot, .person .ad-slot").count(), 0, "not inside the copy cards");
  eq(await p.locator(".v-day > :last-child").getAttribute("data-slot"), "group-end", "last on the page");
  const [adTop, lastCopyBottom, shareBottom] = await p.evaluate(() => [
    document.querySelector(".v-day .ad-slot").getBoundingClientRect().top,
    Math.max(...[...document.querySelectorAll(".v-day .copy")].map(b => b.getBoundingClientRect().bottom)),
    document.querySelector(".share").getBoundingClientRect().bottom]);
  assert(adTop > shareBottom && adTop - lastCopyBottom > 200, `ad too close to the copy boxes (${Math.round(adTop - lastCopyBottom)}px)`);
  noErrors(p); await p.context().close();
});

// ---------- security ----------
console.log("\nSecurity");
const PAYLOADS = ['<img src=x onerror="window.__pwned=1">', "<script>window.__pwned=1</script>", '"><svg onload=window.__pwned=1>', "javascript:window.__pwned=1"];
await test("Malicious names and postcodes in saved groups never execute (every screen)", async () => {
  const p = await page(await context()); await p.goto(B);
  const store = Object.fromEntries(PAYLOADS.map((x, i) => [`k${i}`, { created: i, people: [{ name: x, reg: "123", postcode: x.slice(0, 12) }] }]));
  await p.evaluate(s => localStorage.setItem("tdqc:pages:v1", JSON.stringify(s)), store);
  for (const r of ["", "#/data", ...Object.keys(store).flatMap(k => [`#/p/${k}`, `#/edit/${k}`])]) {
    await p.goto(B + r); await p.waitForTimeout(30);
    if (r.startsWith("#/p/")) await p.click("text=What's in the link?");
    assert(!(await p.evaluate(() => window.__pwned)), `executed on ${r || "home"}`);
  }
  await p.context().close();
});
await test("Malicious share links and pasted chat text never execute", async () => {
  const ctx = await context({ hook: true }); const p = await page(ctx); await p.goto(B);
  const codes = await p.evaluate(pl => pl.map(x => __t.encodeShare({ people: [{ name: x.replace(/ /g, ""), reg: "1", postcode: "LS1 5DL" }] })), PAYLOADS);
  codes.push(Buffer.from(JSON.stringify({ t: PAYLOADS[0], p: [[PAYLOADS[0], "1", PAYLOADS[2]]] })).toString("base64url"));
  for (const code of codes) { await p.goto(B + "#/s/" + code); await p.waitForTimeout(50); assert(!(await p.evaluate(() => window.__pwned)), "link executed"); }
  await p.goto(B + "#/new"); await p.fill("textarea", PAYLOADS.map(x => `${x} 2718281828 SW1A 1AA`).join("\n"));
  await p.waitForTimeout(50); assert(!(await p.evaluate(() => window.__pwned)), "paste executed");
  await ctx.close();
});
await test("No CSP violations on any screen; the only outside request is Google's ad loader", async () => {
  const ctx = await context(); const p = await page(ctx); const outbound = [];
  p.on("request", r => { if (!r.url().startsWith(B) && !r.url().startsWith("data:")) outbound.push(r.url()); });
  await p.goto(B); await p.locator(".copy.hero").first().click(); await p.locator(".mock-field").first().fill("1029384756");
  await p.goto(B + "#/new"); await p.fill("textarea", "Alex 1029384756 BS1 4DJ\nPriya 1618033988"); await p.click(".v-create > button.btn-primary");
  await p.locator('input[placeholder="e.g. BS1 4DJ"]').nth(1).fill("E1 6AN"); await p.click("text=Create group"); await p.waitForSelector(".v-day");
  await p.locator(".v-day .copy").first().click(); await p.click("text=What's in the link?"); await p.click(".share .btn-primary");
  const link = await clip(p); await p.goto(link); await p.goto(B + "#/data"); await p.goto(B + "#/s/broken"); await p.goto(B + "demo.html"); await p.goto(B + "faq/");
  const strange = outbound.filter(u => !ADS_HOST.test(u));
  assert(!strange.length, `unexpected requests: ${strange.join(", ")}`);
  assert(outbound.length > 0, "the AdSense loader should be requested");
  // the policy still blocks what doesn't affect ads
  const r = await p.evaluate(async () => {
    const out = {};
    out.object = await new Promise(res => { const o = document.createElement("object"); o.data = "/ads.txt"; o.onload = () => res("loaded"); o.onerror = () => res("blocked"); document.body.append(o); setTimeout(() => res("blocked"), 500); });
    out.base = (() => { const b = document.createElement("base"); b.href = "https://example.com/"; document.head.append(b); const a = document.createElement("a"); a.href = "x"; const v = a.href.startsWith("https://example.com/") ? "applied" : "blocked"; b.remove(); return v; })();
    return out;
  });
  eq(r, { object: "blocked", base: "blocked" }, "probes");
  assert(!p.errors.length, p.errors[0]);
  await ctx.close();
  const q = await page(await context()); // fresh page: the app itself must cause zero CSP reports
  await q.goto(B); await q.goto(B + "#/new"); await q.goto(B + "#/data"); await q.goto(B + "demo.html");
  for (const b of await q.locator(".v-day .copy").all()) await b.click();
  assert(!q.csp.filter(m => !/object|base/i.test(m)).length, q.csp[0]); await q.context().close();
});
await test("Every button and link has an accessible name", async () => {
  const p = await page(await context()); await seed(p, GROUP);
  for (const r of ["", "#/new", "#/p/g1", "#/edit/g1", "#/data"]) {
    await p.goto(B + r); await p.waitForTimeout(30);
    const unnamed = await p.evaluate(() => [...document.querySelectorAll("button, a")].filter(e => !(e.getAttribute("aria-label") || e.textContent).trim()).map(e => e.outerHTML.slice(0, 80)));
    assert(!unnamed.length, `${r}: ${unnamed[0]}`);
  }
  await p.context().close();
});

await browser.close();
tool.server.close(); stamped.server.close();
console.log(failed ? `\n${failed} failed, ${passed} passed\n` : `\nAll ${passed} tests passed\n`);
process.exit(failed ? 1 : 0);
