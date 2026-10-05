// Browser tests for Glastonbury Registration Quick Copy.
// Serves the site locally, drives it with Playwright (Chromium) and checks
// data consistency, robustness and the security guarantees in CONTRIBUTING.md.
//   npm test
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// Serve with the same Content-Security-Policy header Netlify sends in production
const CSP = readFileSync(join(ROOT, "netlify.toml"), "utf8").match(/Content-Security-Policy = "([^"]+)"/)[1];
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".txt": "text/plain" };

// ---------- tiny static server ----------
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(ROOT, path === "/" ? "index.html" : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Content-Security-Policy": CSP });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const B = `http://127.0.0.1:${server.address().port}/`;

// ---------- harness ----------
const browser = await chromium.launch();
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${String(e.message || e).split("\n")[0]}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// A context whose app.js exposes internals as window.__t (test-only injection)
async function hookedContext(opts = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.route("**/app.js*", route => route.fulfill({
    contentType: "application/javascript",
    body: readFileSync(join(ROOT, "app.js"), "utf8").replace(
      '  window.addEventListener("hashchange", render);',
      '  window.__t = { encodeShare, decodeShare, shareNames };\n  window.addEventListener("hashchange", render);'),
  }));
  return ctx;
}
async function page(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  p.errors = [];
  p.on("pageerror", e => p.errors.push(String(e)));
  return p;
}
const clip = p => p.evaluate(() => navigator.clipboard.readText());
const CLIP = { permissions: ["clipboard-read", "clipboard-write"] };

// ---------- static checks ----------
console.log("\nStatic checks");
const appSrc = readFileSync(join(ROOT, "app.js"), "utf8");
const html = ["index.html", "demo.html"].map(f => readFileSync(join(ROOT, f), "utf8"));
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");

await test("CSP blocks network requests and remote scripts (header and <meta>)", () => {
  for (const src of [toml, ...html]) {
    assert(/connect-src 'none'/.test(src), "connect-src must be 'none'");
    assert(/script-src 'self'[;"]/.test(src), "script-src must be exactly 'self'");
    assert(/default-src 'none'/.test(src), "default-src must be 'none'");
  }
  assert(/frame-ancestors 'none'/.test(toml), "frame-ancestors must be 'none'");
});
const SOURCE_REPO = "https://github.com/francproductmanager/glastonbury-registration-quick-copy";
await test("No external URLs in the site files (except the link to this repo)", () => {
  for (const [name, src] of [["app.js", appSrc], ["index.html", html[0]], ["demo.html", html[1]]]) {
    const urls = (src.match(/https?:\/\/[^\s"'`)]+/g) || []).filter(u => !u.startsWith("http://www.w3.org/") && u !== SOURCE_REPO);
    assert(!urls.length, `${name} references ${urls.join(", ")}`);
  }
});
await test("No dangerous APIs in app.js", () => {
  const code = appSrc.replace(/\/\/.*$/gm, "");
  for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "importScripts"]) {
    assert(!code.includes(bad), `found ${bad}`);
  }
});

// ---------- share links ----------
console.log("\nShare links");
{
  const ctx = await hookedContext(CLIP); const p = await page(ctx); await p.goto(B);

  await test("5,000 random groups round-trip exactly", async () => {
    const r = await p.evaluate(() => {
      const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
      const firsts = ["Tom", "Em", "José", "Zoë", "Siobhán", "李", "Ελένη", "Mary-Jane", "O'Neil", "🎪Rave", "Łukasz"];
      const lasts = ["Okafor", "Hughes", "Ó Briain", "van der Berg", "Fitzgerald-Hart", ""];
      const pcs = ["SW1A 1AA", "W1A 1AA", "EC1A 1BB", "BS1 4DJ", "1050", "1050-123", "ÖSTER 12", "D02 X285", " se1 7pb "];
      let bad = 0, longest = 0;
      for (let t = 0; t < 5000; t++) {
        const people = Array.from({ length: 1 + rnd(6) }, () => {
          let reg = ""; for (let i = 0, n = 1 + rnd(12); i < n; i++) reg += rnd(10);
          return { name: `${pick(firsts)} ${pick(lasts)}`.trim(), reg, postcode: pick(pcs) };
        });
        const code = __t.encodeShare({ people }); longest = Math.max(longest, code.length);
        const back = __t.decodeShare(code), names = __t.shareNames(people);
        const ok = back && back.people.length === people.length && people.every((x, i) =>
          back.people[i].reg === x.reg && back.people[i].postcode === x.postcode.trim().toUpperCase() &&
          back.people[i].name === (names[i] || "Unnamed"));
        if (!ok) bad++;
      }
      return { bad, longest };
    });
    assert(r.bad === 0, `${r.bad} mismatches`);
    assert(r.longest < 400, `longest code ${r.longest} chars`);
  });

  await test("Duplicate first names get a surname initial; surnames never in the link", async () => {
    const r = await p.evaluate(() => {
      const people = [{ name: "Tom Okafor", reg: "1", postcode: "LS1 5DL" }, { name: "Tom Hughes", reg: "2", postcode: "LS1 5DL" }, { name: "Ann Lee", reg: "3", postcode: "LS1 5DL" }];
      const code = __t.encodeShare({ people });
      return { names: __t.decodeShare(code).people.map(x => x.name), raw: atob(code.replace(/-/g, "+").replace(/_/g, "/")) };
    });
    assert(JSON.stringify(r.names) === '["Tom O.","Tom H.","Ann"]', JSON.stringify(r.names));
    assert(!/Okafor|Hughes|Lee/.test(r.raw), "surname found in link");
  });

  await test("Older link formats still open (v1 binary and legacy JSON)", async () => {
    const r = await p.evaluate(() => [
      __t.decodeShare("AQRBbGV4pjQqWz0ACxcQzQQDU2Ftpn45nFABCxcQzQQCSm-lTeZAuwAWEUQXBUNocmlzp2SwBaIAzBMAgZMBBVByaXlhpkQ9cWAAnBMc2QIDVG9tprovS1QAFRcUTQU"),
      __t.decodeShare("eyJ0IjoiT3VyIGdyb3VwIiwicCI6W1siQW5uIiwiMTIzNDU2Nzg5MCIsIlNXMUEgMUFBIl1dfQ"),
    ]);
    assert(r[0]?.people.length === 6 && r[0].people[0].reg === "1029384756" && r[0].people[0].postcode === "BS1 4DJ", "v1 failed");
    assert(r[1]?.people[0].reg === "1234567890" && r[1].people[0].postcode === "SW1A 1AA", "legacy failed");
  });

  await test("Broken, tampered and oversized links show 'Page not found'", async () => {
    for (const code of ["AQ", "AQVBbGV4", "!!!", "AQ" + "A".repeat(50), "%E0%A4%A", "====", "A".repeat(200000)]) {
      await p.goto(B + "#/s/" + code); await p.waitForTimeout(60);
      assert(await p.textContent("h1") === "Page not found", `code ${code.slice(0, 12)} did not fail cleanly`);
    }
    assert(!p.errors.length, p.errors[0]);
  });
  await ctx.close();
}

// ---------- user flows ----------
console.log("\nUser flows");
await test("Create a page, copy every value, share, open on another device", async () => {
  const ctx = await browser.newContext(CLIP); const p = await page(ctx);
  await p.goto(B); await p.click("text=Create my group");
  await p.fill('input[placeholder="Name"]', "Ann Lee");
  await p.fill('input[placeholder="Registration no."]', "12345 67890");
  await p.fill('input[placeholder="Postcode"]', "sw1a1aa");
  await p.click("text=+ Add person");
  await p.locator('input[placeholder="Name"]').nth(1).fill("Bob Smith");
  await p.locator('input[placeholder="Registration no."]').nth(1).fill("0222222222");
  await p.locator('input[placeholder="Postcode"]').nth(1).fill("w1a1aa");
  await p.click('button:has-text("Create my group")'); await p.waitForSelector("text=Tap any box");
  assert(await p.textContent("h1") === "Glasto group, Ann, Bob", "title");
  const values = [];
  for (const b of await p.locator("button.copy").all()) { await b.click(); values.push(await clip(p)); }
  assert(values.join("|") === "1234567890|SW1A 1AA|0222222222|W1A 1AA", values.join("|"));
  await p.click("text=Copy link"); const link = await clip(p);
  const p2 = await page(await browser.newContext());
  await p2.goto(link); await p2.waitForSelector("text=Tap any box");
  assert(/#\/p\/[a-z0-9]+$/.test(p2.url()), "share link should be replaced by the saved page address");
  assert((await p2.textContent("main")).includes("0222222222"), "data missing on friend's page");
  await p2.goto(link); await p2.waitForSelector("text=Tap any box");
  assert(await p2.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("tdqc:pages:v1"))).length) === 1, "opening twice made a duplicate");
  assert(!p.errors.length && !p2.errors.length, p.errors[0] || p2.errors[0]);
  await ctx.close(); await p2.context().close();
});

await test("Editor rejects registration numbers over 12 digits", async () => {
  const p = await page(await browser.newContext()); await p.goto(B + "#/new");
  await p.fill('input[placeholder="Name"]', "A"); await p.fill('input[placeholder="Registration no."]', "1234567890123"); await p.fill('input[placeholder="Postcode"]', "LS1 5DL");
  await p.click('button:has-text("Create my group")'); await p.waitForTimeout(100);
  assert((await p.textContent("main")).includes("at most 12 digits") && p.url().endsWith("#/new"), "not rejected");
  await p.context().close();
});

await test("A page deleted in one tab isn't re-created by another tab", async () => {
  const ctx = await browser.newContext(); const a = await page(ctx); const c = await page(ctx);
  await a.goto(B); await a.evaluate(() => localStorage.setItem("tdqc:pages:v1", JSON.stringify({ x1: { created: 1, people: [{ name: "Ann", reg: "1", postcode: "LS1 5DL" }] } })));
  await a.goto(B + "#/edit/x1"); await c.goto(B + "#/p/x1");
  c.on("dialog", d => d.accept()); await c.click("text=Delete");
  await a.fill('input[placeholder="Name"]', "Ann edited"); await a.click("text=Save changes"); await a.waitForTimeout(150);
  assert(await a.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("tdqc:pages:v1"))).length) === 0, "deleted page came back");
  await ctx.close();
});

await test("Demo page loads example data and nothing is saved", async () => {
  const p = await page(await browser.newContext()); await p.goto(B + "demo.html"); await p.waitForSelector("text=Tap any box");
  assert((await p.textContent("h1")).startsWith("Glasto group, Alex"), "demo title");
  assert(await p.evaluate(() => localStorage.getItem("tdqc:pages:v1")) === null, "demo wrote to storage");
  await p.context().close();
});

await test("Home page: two main actions and the privacy section", async () => {
  const p = await page(await browser.newContext()); await p.goto(B);
  const actions = await p.locator(".actions a").allTextContents();
  assert(JSON.stringify(actions) === '["Create my group","See the demo"]', JSON.stringify(actions));
  const text = await p.textContent(".trust");
  for (const s of ["Stays on your device", "Can't send your data anywhere", "Open source and checked", "MIT licence", "No cloud storage"]) assert(text.includes(s), `missing "${s}"`);
  const hrefs = await p.locator(".trust a").evaluateAll(as => as.map(a => a.href));
  assert(hrefs.every(h => h.startsWith(SOURCE_REPO)), `trust links must point at this repo: ${hrefs}`);
  assert(!p.errors.length, p.errors[0]);
  await p.context().close();
});
await test("Footer links to the source code and shows the deployed commit", async () => {
  // Unstamped (local copy): link to the repo, no version
  const p = await page(await browser.newContext()); await p.goto(B);
  const links = await p.locator("footer a").evaluateAll(as => as.map(a => [a.textContent, a.href]));
  assert(links.some(([t, h]) => t === "view the code on GitHub" && h === SOURCE_REPO), JSON.stringify(links));
  assert(!(await p.textContent("footer")).includes("running version"), "unstamped page should not show a version");
  await p.context().close();
  // Stamped the way Netlify does it at deploy time
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const ctx = await browser.newContext();
  await ctx.route("**/", async route => route.fulfill({ contentType: "text/html", body: readFileSync(join(ROOT, "index.html"), "utf8").replace("__COMMIT_REF__", sha) }));
  const q = await page(ctx); await q.goto(B);
  const v = await q.locator("footer a.mono").evaluate(a => [a.textContent, a.href]);
  assert(v[0] === "0123456" && v[1] === `${SOURCE_REPO}/commit/${sha}`, JSON.stringify(v));
  await ctx.close();
});
await test("The deploy-time stamp only touches the commit placeholder", () => {
  const cmd = toml.match(/command = "(.*)"/)[1];
  assert(/^sed -i \\"s\/__COMMIT_REF__\//.test(cmd), `unexpected build command: ${cmd}`);
  for (const h of html) assert(h.split("__COMMIT_REF__").length === 2, "each page needs exactly one placeholder");
});

// ---------- robustness ----------
console.log("\nRobustness");
await test("Corrupted local storage never crashes the page", async () => {
  for (const raw of ["{not json", "null", "123", "[1,2]", '{"a":{"created":1}}', '{"a":{"people":"x"}}', '{"a":{"people":[{"name":5,"reg":12345,"postcode":null}]}}', '{"__proto__":{"people":[]}}']) {
    const p = await page(await browser.newContext()); await p.goto(B);
    await p.evaluate(r => localStorage.setItem("tdqc:pages:v1", r), raw);
    for (const route of ["", "#/p/a", "#/edit/a"]) { await p.goto(B + route); await p.waitForTimeout(40); }
    assert(!p.errors.length, `${raw}: ${p.errors[0]}`);
    await p.context().close();
  }
});
await test("Special addresses like #/p/__proto__ show 'Page not found'", async () => {
  const p = await page(await browser.newContext());
  for (const r of ["p/__proto__", "edit/__proto__", "p/constructor", "p/toString", "edit/hasOwnProperty"]) {
    await p.goto(B + "#/" + r); await p.waitForTimeout(40);
    assert(await p.textContent("h1") === "Page not found", r);
  }
  assert(!p.errors.length, p.errors[0]);
  await p.context().close();
});

// ---------- security ----------
console.log("\nSecurity");
const PAYLOADS = ['<img src=x onerror="window.__pwned=1">', "<script>window.__pwned=1</script>", '"><svg onload=window.__pwned=1>', "javascript:window.__pwned=1"];
await test("Malicious names and postcodes in saved pages never execute", async () => {
  const p = await page(await browser.newContext()); await p.goto(B);
  const store = Object.fromEntries(PAYLOADS.map((x, i) => [`k${i}`, { created: i, people: [{ name: x, reg: "123", postcode: x.slice(0, 12) }] }]));
  await p.evaluate(s => localStorage.setItem("tdqc:pages:v1", JSON.stringify(s)), store);
  for (const r of ["", ...Object.keys(store).flatMap(k => [`#/p/${k}`, `#/edit/${k}`])]) {
    await p.goto(B + r); await p.waitForTimeout(40);
    assert(!(await p.evaluate(() => window.__pwned)), `executed on ${r || "home"}`);
  }
  await p.context().close();
});
await test("Malicious share links never execute", async () => {
  const ctx = await hookedContext(); const p = await page(ctx); await p.goto(B);
  const codes = await p.evaluate(pl => pl.map(x => __t.encodeShare({ people: [{ name: x.replace(/ /g, ""), reg: "1", postcode: "LS1 5DL" }] })), PAYLOADS);
  codes.push(Buffer.from(JSON.stringify({ t: PAYLOADS[0], p: [[PAYLOADS[0], "1", PAYLOADS[2]]] })).toString("base64url"));
  for (const code of codes) {
    const q = await page(await hookedContext()); await q.goto(B + "#/s/" + code); await q.waitForTimeout(100);
    assert(!(await q.evaluate(() => window.__pwned)), "executed");
    await q.context().close();
  }
  await ctx.close();
});
await test("The page cannot send data anywhere (fetch, beacon, image, scripts)", async () => {
  const p = await page(await browser.newContext()); const outbound = [];
  // Chromium lists CSP-blocked requests too; every outbound one must fail with reason "csp"
  const blocked = new Set();
  p.on("request", r => { if (!r.url().startsWith(B)) outbound.push(r.url()); });
  p.on("requestfailed", r => { if (r.failure()?.errorText === "csp") blocked.add(r.url()); });
  await p.goto(B);
  const r = await p.evaluate(async () => {
    const out = {};
    try { await fetch("https://example.com/x"); out.fetch = "sent"; } catch { out.fetch = "blocked"; }
    navigator.sendBeacon("https://example.com/b", "d");
    out.img = await new Promise(res => { const i = new Image(); i.onload = () => res("loaded"); i.onerror = () => res("blocked"); i.src = "https://example.com/i.png"; setTimeout(() => res("blocked"), 1500); });
    out.inline = await new Promise(res => { const s = document.createElement("script"); s.textContent = "window.__inl=1"; document.body.append(s); setTimeout(() => res(window.__inl ? "ran" : "blocked"), 100); });
    return out;
  });
  await p.waitForTimeout(500);
  assert(r.fetch === "blocked" && r.img === "blocked" && r.inline === "blocked", JSON.stringify(r));
  const leaked = outbound.filter(u => !blocked.has(u));
  assert(!leaked.length, `requests not blocked by CSP: ${leaked.join(", ")}`);
  await p.context().close();
});

await browser.close();
server.close();
console.log(failed ? `\n${failed} test(s) failed\n` : "\nAll tests passed\n");
process.exit(failed ? 1 : 0);
