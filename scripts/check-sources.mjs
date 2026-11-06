// Finds dead sources: every web page the guides cite (their sources list and the links in their text) and every
// fact's source, opened the way a reader's browser would. Uses curl, so it works through the cloud proxy.
//   node scripts/check-sources.mjs                   everything cited by a published guide or a fact
//   node scripts/check-sources.mjs --slug <slug>...  only what these guides cite (the guides a pull request changes)
// Each page comes back as one of:
//   OK       loads, at the address cited
//   DEAD     not found (404 or 410)
//   MOVED    loads, but only after sending the reader somewhere else: often the site's home page, or a
//            different article (the address now shows something else, so it can't back the guide)
//   BLOCKED  the site refuses scripts (any other 4xx, which some sites give curl but not a browser), errors (5xx)
//            or doesn't answer: can't tell, open it yourself
// Exits 1 if anything is DEAD or MOVED, so a run can't miss it.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { GUIDES } from "../site-src/content.mjs";
import { FACTS } from "../site-src/facts.mjs";

const run = promisify(execFile);
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const strings = (x) => typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];
const linksIn = (s) => [...s.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);

// Every outside address, with who cites it: "<slug> (source)", "<slug> (link)" or "fact <key>"
export function citations(slugs) {
  const out = new Map(), add = (url, who) => { if (!out.has(url)) out.set(url, new Set()); out.get(url).add(who); };
  for (const g of GUIDES) {
    if (slugs ? !slugs.includes(g.slug) : g.draft) continue;
    for (const [, url] of g.sources || []) if (/^https?:/.test(url)) add(url, `${g.slug} (source)`);
    for (const url of strings(g.body).flatMap(linksIn)) add(url, `${g.slug} (link)`);
  }
  if (!slugs) for (const [key, f] of Object.entries(FACTS)) if (/^https?:/.test(f.source || "")) add(f.source, `fact ${key}`);
  return out;
}

// Same page if only the protocol, a www., the default port, a trailing slash or a #part differ
const same = (a, b) => {
  const n = (u) => { const x = new URL(u); return x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search; };
  return n(a) === n(b);
};

export async function check(url) {
  try {
    const { stdout } = await run("curl", ["-sS", "-o", "/dev/null", "-L", "--max-redirs", "10", "--max-time", "30", "-A", UA, "-w", "%{http_code} %{url_effective}", url]);
    const [code, final] = stdout.trim().split(" "), status = Number(code);
    if (status === 404 || status === 410) return { verdict: "DEAD", why: `answered ${code}${same(url, final) ? "" : ` at ${final}`}` };
    if (status >= 400 || !status) return { verdict: "BLOCKED", why: `answered ${code}` };
    if (!same(url, final)) return { verdict: "MOVED", why: new URL(final).pathname === "/" ? `sends readers to the home page, ${final}` : `sends readers to ${final}` };
    return { verdict: "OK", why: `answered ${code}` };
  } catch (e) {
    return { verdict: "BLOCKED", why: `no answer (${String(e.stderr || e.message).trim().split("\n").pop()})` };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), slugs = args[0] === "--slug" ? args.slice(1) : null;
  if (args.length && (!slugs || !slugs.length)) { console.error("usage: node scripts/check-sources.mjs [--slug <slug>...]"); process.exit(2); }
  for (const s of slugs || []) if (!GUIDES.some((g) => g.slug === s)) { console.error(`no guide ${s}`); process.exit(2); }
  const cited = [...citations(slugs)], results = new Array(cited.length);
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < cited.length) { const i = next++; results[i] = await check(cited[i][0]); } }));
  const order = ["DEAD", "MOVED", "BLOCKED", "OK"];
  const rows = cited.map(([url, who], i) => ({ url, who: [...who].join(", "), ...results[i] })).sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
  for (const r of rows) console.log(`${r.verdict.padEnd(7)} ${r.url}\n        ${r.why}\n        cited by ${r.who}`);
  const bad = rows.filter((r) => r.verdict === "DEAD" || r.verdict === "MOVED").length;
  const blocked = rows.filter((r) => r.verdict === "BLOCKED").length;
  console.log(`\n${rows.length} pages: ${bad} dead or moved, ${blocked} blocked (open those yourself), ${rows.length - bad - blocked} fine`);
  process.exit(bad ? 1 : 0);
}
