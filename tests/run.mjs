// Browser tests for Glasto Quick Copy (the tool) and the guides site.
// Serves the tool locally with its production security headers, drives it with
// Playwright (Chromium) and checks every user flow, edge cases and the security
// guarantees in CONTRIBUTING.md.
//   npm test
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join, normalize, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE = join(ROOT, "site");
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
async function context({ hook = false, perms = CLIP, init, reducedMotion } = {}) {
  const ctx = await browser.newContext({ permissions: perms, viewport: { width: 390, height: 844 }, reducedMotion });
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
const sitePages = walk(SITE).filter(f => f.endsWith(".html"));

console.log("\nStatic checks");
await test("Tool CSP is strict in the Netlify header and both pages' <meta>", () => {
  for (const src of [toml, ...toolHtml]) {
    for (const d of ["default-src 'none'", "script-src 'self';", "style-src 'self';", "font-src 'self';", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) assert(src.includes(d), `missing ${d}`);
    assert(!/unsafe-inline|unsafe-eval|https?:\/\/[^\s"']*googlesyndication/.test(src.match(/Content-Security-Policy[^\n]*/)[0]), "CSP loosened");
  }
  assert(/frame-ancestors 'none'/.test(toml), "frame-ancestors must be 'none'");
});
await test("Tool never loads ads or any external script, font or stylesheet", () => {
  for (const [name, src] of [["app.js", appSrc], ["index.html", toolHtml[0]], ["demo.html", toolHtml[1]], ["style.css", readFileSync(join(ROOT, "style.css"), "utf8")]]) {
    assert(!/googlesyndication|adsbygoogle|googletagmanager|google-analytics/.test(src.replace('name="google-adsense-account"', "")), `${name} references ad/analytics code`);
    const urls = (src.match(/https?:\/\/[^\s"'`)]+/g) || []).filter(u => !u.startsWith("http://www.w3.org/") && u !== SOURCE_REPO);
    assert(!urls.length, `${name} references ${urls.join(", ")}`);
  }
});
await test("No dangerous APIs in app.js", () => {
  const code = appSrc.replace(/\/\/.*$/gm, "");
  for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "importScripts", 'setAttribute("style"', "postMessage"]) assert(!code.includes(bad), `found ${bad}`);
});
await test("The tool's address never serves the guides site or its sources", () => {
  for (const p of ["/site/*", "/site-src/*"]) assert(new RegExp(`from = "${p.replace(/[*/]/g, "\\$&")}"[\\s\\S]*?status = 404[\\s\\S]*?force = true`).test(toml), `${p} not blocked`);
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
await test("Fonts are self-hosted and present", () => {
  const css = readFileSync(join(ROOT, "style.css"), "utf8");
  const files = [...css.matchAll(/url\("fonts\/([^"]+)"\)/g)].map(m => m[1]);
  assert(files.length === 7, `expected 7 font faces, got ${files.length}`);
  for (const f of files) assert(existsSync(join(ROOT, "fonts", f)) && existsSync(join(SITE, "fonts", f)), `missing font ${f}`);
});

// ---------- guides site ----------
console.log("\nGuides site (AdSense)");
await test("Generated pages are up to date with site-src", () => {
  const tmp = mkdtempSync(join(tmpdir(), "qc-"));
  cpSync(ROOT, tmp, { recursive: true, filter: s => !s.includes("node_modules") && !s.includes(".git") });
  execFileSync(process.execPath, [join(tmp, "site-src", "build.mjs")], { stdio: "ignore" });
  for (const f of walk(join(tmp, "site"))) {
    const rel = relative(join(tmp, "site"), f);
    assert(existsSync(join(SITE, rel)), `run "node site-src/build.mjs": ${rel} is missing`);
    assert(readFileSync(f).equals(readFileSync(join(SITE, rel))), `run "node site-src/build.mjs": ${rel} is out of date`);
  }
});
await test("ads.txt is exactly Google's AdSense line", () => {
  eq(readFileSync(join(SITE, "ads.txt"), "utf8"), "google.com, pub-2229524942259780, DIRECT, f08c47fec0942fa0\n", "ads.txt");
});
await test("Every page has the AdSense tag, title, description, canonical and footer links", () => {
  assert(sitePages.length >= 16, `only ${sitePages.length} pages`);
  for (const f of sitePages) {
    const h = readFileSync(f, "utf8"), rel = relative(SITE, f);
    assert(h.includes('src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2229524942259780"'), `${rel}: AdSense script`);
    assert(h.includes('name="google-adsense-account" content="ca-pub-2229524942259780"'), `${rel}: AdSense meta`);
    assert(/<title>[^<]{10,}<\/title>/.test(h) && /name="description" content="[^"]{40,}"/.test(h), `${rel}: title/description`);
    assert(h.includes('rel="canonical" href="__SITE_URL__/'), `${rel}: canonical`);
    for (const l of ["/privacy/", "/terms/", "/contact/", "/about/", "/faq/", "/guides/"]) assert(h.includes(`href="${l}"`), `${rel}: footer link ${l}`);
    assert(h.includes("not affiliated with"), `${rel}: disclaimer`);
  }
});
await test("All internal links on the guides site resolve", () => {
  for (const f of sitePages) {
    for (const [, href] of readFileSync(f, "utf8").matchAll(/href="(\/[^"#]*)"/g)) {
      if (href === "/start" || href.startsWith("/fonts/") || href === "/site.css") continue;
      const target = join(SITE, href.endsWith("/") ? href + "index.html" : href);
      assert(existsSync(target), `${relative(SITE, f)} links to missing ${href}`);
    }
  }
});
await test("Privacy policy has the disclosures AdSense requires", () => {
  const h = readFileSync(join(SITE, "privacy", "index.html"), "utf8");
  for (const s of ["Third-party vendors, including Google, use cookies to serve ads based on your prior visits", "Google&#39;s use of advertising cookies", "adssettings.google.com", "aboutads.info", "policies.google.com/technologies/partner-sites", "consent", "Netlify"].map(x => x.replace("&#39;", "'")))
    assert(h.includes(s) || h.includes(s.replace("'", "&#39;")), `missing "${s}"`);
});
await test("Guides have real depth: 8 articles of 300+ words with sources and dates", () => {
  const guides = sitePages.filter(f => /guides\/[^/]+\/index\.html$/.test(relative(SITE, f).replace(/\\/g, "/")));
  assert(guides.length === 8, `${guides.length} guides`);
  for (const f of guides) {
    const text = readFileSync(f, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    assert(words > 300, `${relative(SITE, f)} has only ${words} words`);
    assert(/Last checked \d+ \w+ \d{4}/.test(text), `${relative(SITE, f)}: no date`);
  }
});
await test("deploy.sh fills in addresses and the /start redirect", () => {
  const tmp = mkdtempSync(join(tmpdir(), "site-"));
  cpSync(SITE, tmp, { recursive: true });
  execFileSync("sh", ["deploy.sh"], { cwd: tmp, env: { ...process.env, URL: "https://example.org", APP_URL: "https://app.example.org/" } });
  eq(readFileSync(join(tmp, "_redirects"), "utf8"), "/start https://app.example.org/ 302\n", "_redirects");
  for (const f of walk(tmp)) if (/\.(html|xml|txt)$/.test(f)) assert(!readFileSync(f, "utf8").includes("__SITE_URL__"), `${relative(tmp, f)} still has __SITE_URL__`);
  assert(readFileSync(join(tmp, "index.html"), "utf8").includes('href="https://example.org/"'), "canonical not filled");
});
{
  const site = await serve(SITE);
  await test("Guides pages render without errors (ads blocked in tests)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route("https://pagead2.googlesyndication.com/**", r => r.abort());
    const p = await page(ctx);
    for (const u of ["", "guides/", "guides/how-glastonbury-registration-works/", "faq/", "about/", "contact/", "privacy/", "terms/"]) {
      await p.goto(site.url + u);
      assert((await p.textContent("h1")).length > 3, `${u}: no h1`);
    }
    await p.goto(site.url + "faq/");
    await p.locator(".faq summary").first().click();
    assert(await p.locator(".faq").first().evaluate(d => d.open), "FAQ item didn't open");
    assert(!p.errors.length, p.errors[0]);
    await ctx.close();
  });
  site.server.close();
}

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
    eq((await parse("Dan 2611945718 W1A 1AA\r\nEve 2446487806 LS1 5DL\r\n")).map(x => x.name), ["Dan", "Eve"], "CRLF");
    eq((await parse("my reg number is 2611945718 and postcode e2 8fp")), [{ name: "Person 1", reg: "2611945718", postcode: "E2 8FP" }], "only stopwords -> Person N");
    eq((await parse("JORDAN 202208767 SW12 0JD"))[0].name, "Jordan", "title-cased");
  });
  await test("Caps at 6 people and ignores lines after", async () => {
    const text = Array.from({ length: 9 }, (_, i) => `P${i} 10000000${10 + i} BS1 4DJ`).join("\n");
    eq((await parse(text)).length, 6, "cap");
  });
  await test("Hostile input is just text (no HTML parsing, length-limited)", async () => {
    const r = await parse('<img src=x onerror=alert(1)> 2611945718 SW1A 1AA\n' + "9".repeat(5000));
    eq(r[0].reg, "2611945718", "reg"); assert(r.length === 1, "giant digit run must not become a person");
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
await test("Try it: copy, guided paste, both fields, then a Start prompt", async () => {
  const p = await page(await context()); await p.goto(B);
  const msg = () => p.textContent(".try-msg");
  await p.locator(".mock-field").first().click();
  assert((await msg()).includes("Copy it first"), "tapping a field first should explain");
  await p.locator(".copy.hero").first().click();
  eq(await clip(p), "1029384756", "clipboard");
  assert((await msg()).includes("Great, you just copied the whole number in an instant"), "copied message");
  assert(await p.locator(".mock-field").first().evaluate(e => e.classList.contains("is-target")), "reg field highlighted");
  eq(await p.locator(".mock-field").first().textContent(), "Tap to paste", "not pasted automatically");
  await p.locator(".mock-field").first().click();
  eq(await p.locator(".mock-field").first().textContent(), "1029384756", "pasted on tap");
  await p.locator(".copy.hero").nth(1).click(); eq(await clip(p), "BS1 4DJ", "postcode clipboard");
  await p.locator(".mock-field").nth(1).click();
  assert((await p.textContent(".try-done")).includes("That's the whole trick"), "done message");
  eq(await p.locator(".try-done a").getAttribute("href"), "#/new", "Start link");
  await p.click("text=Reset");
  eq(await p.locator(".mock-field").first().textContent(), "", "reset clears");
  noErrors(p); await p.context().close();
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
  assert(!(await p.textContent("body")).match(/tracking|analytics|\bads\b/i), "no ads/tracking wording on the tool home");
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
  await reg(1).fill(" 26119 45718 "); await pc(1).fill("sw1a1aa"); await name(1).fill("Bea");
  await p.click("text=Create group"); await p.waitForSelector(".v-day");
  eq(Object.values(await pages(p))[0].people.map(x => [x.name, x.reg, x.postcode]), [["Alex", "1029384756", "BS1 4DJ"], ["Bea", "2611945718", "SW1A 1AA"]], "blank rows ignored, normalised");
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
  assert((await p.textContent("main")).includes("connect-src 'none'"), "CSP explained");
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
  await p.locator(".copy.hero").first().click(); await p.locator(".mock-field").first().click();
  eq(await p.locator(".mock-field").first().textContent(), "1029384756", "works");
  await p.context().close();
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
  await p.goto(B + "#/new"); await p.fill("textarea", PAYLOADS.map(x => `${x} 2611945718 SW1A 1AA`).join("\n"));
  await p.waitForTimeout(50); assert(!(await p.evaluate(() => window.__pwned)), "paste executed");
  await ctx.close();
});
await test("No CSP violations on any screen, and nothing leaves the page", async () => {
  const ctx = await context(); const p = await page(ctx); const outbound = [], blocked = new Set();
  p.on("request", r => { if (!r.url().startsWith(B)) outbound.push(r.url()); });
  p.on("requestfailed", r => { if (r.failure()?.errorText === "csp") blocked.add(r.url()); });
  await p.goto(B); await p.locator(".copy.hero").first().click(); await p.locator(".mock-field").first().click();
  await p.goto(B + "#/new"); await p.fill("textarea", "Alex 1029384756 BS1 4DJ\nPriya 1618033988"); await p.click(".v-create > button.btn-primary");
  await p.locator('input[placeholder="e.g. BS1 4DJ"]').nth(1).fill("E1 6AN"); await p.click("text=Create group"); await p.waitForSelector(".v-day");
  await p.locator(".v-day .copy").first().click(); await p.click("text=What's in the link?"); await p.click(".share .btn-primary");
  const link = await clip(p); await p.goto(link); await p.goto(B + "#/data"); await p.goto(B + "#/s/broken"); await p.goto(B + "demo.html");
  const r = await p.evaluate(async () => {
    const out = {};
    try { await fetch("https://example.com/x"); out.fetch = "sent"; } catch { out.fetch = "blocked"; }
    out.img = await new Promise(res => { const i = new Image(); i.onload = () => res("loaded"); i.onerror = () => res("blocked"); i.src = "https://example.com/i.png"; setTimeout(() => res("blocked"), 1500); });
    out.inline = await new Promise(res => { const s = document.createElement("script"); s.textContent = "window.__inl=1"; document.body.append(s); setTimeout(() => res(window.__inl ? "ran" : "blocked"), 100); });
    out.style = await new Promise(res => { const d = document.createElement("div"); d.setAttribute("style", "width:123px"); document.body.append(d); setTimeout(() => res(d.offsetWidth === 123 ? "applied" : "blocked"), 50); });
    out.font = await new Promise(res => { const f = new FontFace("x", "url(https://example.com/f.woff2)"); f.load().then(() => res("loaded"), () => res("blocked")); });
    return out;
  });
  eq(r, { fetch: "blocked", img: "blocked", inline: "blocked", style: "blocked", font: "blocked" }, "probes");
  const leaked = outbound.filter(u => !blocked.has(u) && !u.startsWith("data:"));
  assert(!leaked.length, `requests not blocked: ${leaked.join(", ")}`);
  const ours = p.csp.filter(m => !/example\.com|width:123px|inline script|'self'".*inline/i.test(m));
  assert(!p.errors.length, p.errors[0]);
  await ctx.close();
  const q = await page(await context()); // fresh page: the app itself must cause zero CSP reports
  await q.goto(B); await q.goto(B + "#/new"); await q.goto(B + "#/data"); await q.goto(B + "demo.html");
  for (const b of await q.locator(".v-day .copy").all()) await b.click();
  assert(!q.csp.length, q.csp[0]); await q.context().close();
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
