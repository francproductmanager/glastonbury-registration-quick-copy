// Weekly Search Console export for the SEO agents (see site-src/SEO-AUDITOR.md).
// Run by .github/workflows/search-data-export.yml. Plain code: the agents never hold Google credentials.
//   GSC_SA_KEY   the service account's JSON key (a GitHub secret)
//   GSC_SITE     the Search Console property, e.g. sc-domain:glastobolt.co.uk
// Writes site-src/data/scorecard.csv (one row per guide, with flags the auditor acts on),
// unmatched-queries.csv, meta.json and archive/<date>.csv (Search Console only keeps 16 months).
import { createSign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDES, SITE } from "../site-src/content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site-src", "data");
const KEY = JSON.parse(process.env.GSC_SA_KEY);
const PROPERTY = process.env.GSC_SITE || "sc-domain:glastobolt.co.uk";
const MIN_IMPRESSIONS = 100; // below this, numbers swing too much to judge

const b64 = (s) => Buffer.from(s).toString("base64url");
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: KEY.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify(claim))}`;
  const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(KEY.private_key, "base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  if (!r.ok) throw new Error(`Google sign in failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}
const auth = await token();

// Every row for the given dimensions and dates, following pages of 25,000
async function query(dimensions, startDate, endDate) {
  const rows = [];
  for (let startRow = 0; ; startRow += 25000) {
    const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`, {
      method: "POST", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions, dataState: "final", rowLimit: 25000, startRow }),
    });
    if (!r.ok) throw new Error(`Search Console query failed: ${r.status} ${await r.text()}`);
    const page = (await r.json()).rows || [];
    rows.push(...page.map((x) => ({ ...Object.fromEntries(dimensions.map((d, i) => [d, x.keys[i]])), clicks: x.clicks, impressions: x.impressions, ctr: x.ctr, position: x.position })));
    if (page.length < 25000) return rows;
  }
}

// The last 28 days of final data (Search Console runs about 3 days behind), and the 28 days before
const day = (offset) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
const [end, start, prevEnd, prevStart] = [day(3), day(30), day(31), day(58)];
const [pages, prevPages, pageQueries, queries] = await Promise.all([
  query(["page"], start, end), query(["page"], prevStart, prevEnd), query(["page", "query"], start, end), query(["query"], start, end),
]);

const norm = (u) => u.replace(/^https?:\/\/(www\.)?/, "https://").replace(/[?#].*$/, "");
const byUrl = (rows) => Object.fromEntries(rows.map((r) => [norm(r.page), r]));
const now = byUrl(pages), prev = byUrl(prevPages);
const firstPublished = (slug) => {
  try { return execFileSync("git", ["log", "--diff-filter=A", "--format=%as", "--", `guides/${slug}/index.html`], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop() || ""; } catch { return ""; }
};
const ageDays = (d) => (d ? Math.round((Date.now() - Date.parse(d)) / 864e5) : "");

// Typical click rate for each position band, to spot guides clicked much less than their position suggests
const band = (p) => (p <= 3 ? "1-3" : p <= 7 ? "4-7" : p <= 10 ? "8-10" : p <= 20 ? "11-20" : "21+");
const bandCtr = {};
for (const r of pages) { const b = (bandCtr[band(r.position)] ||= { c: 0, i: 0 }); b.c += r.clicks; b.i += r.impressions; }

const guides = GUIDES.filter((g) => !g.draft).map((g) => {
  const url = `${SITE.url}/guides/${g.slug}/`, r = now[norm(url)] || { clicks: 0, impressions: 0, ctr: 0, position: 0 }, p = prev[norm(url)] || { clicks: 0 };
  const top = pageQueries.filter((q) => norm(q.page) === norm(url)).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  const published = firstPublished(g.slug);
  return { g, url, r, p, top, published, age: ageDays(published) };
});

const topQueryOwners = {};
for (const x of guides) { const q = x.top.find((t) => t.impressions >= 10); if (q) (topQueryOwners[q.query] ||= []).push(x.g.slug); }

const rows = guides.map(({ g, url, r, p, top, published, age }) => {
  const flags = [];
  if (r.impressions >= MIN_IMPRESSIONS) {
    const b = bandCtr[band(r.position)];
    if (b && b.i && r.ctr < 0.5 * (b.c / b.i)) flags.push("LOW_CTR");
    if (r.position >= 8 && r.position <= 20) flags.push("STRIKING_DISTANCE");
    if (p.clicks >= 10 && r.clicks <= 0.7 * p.clicks) flags.push("DECLINING");
  }
  const q = top.find((t) => t.impressions >= 10);
  if (q && topQueryOwners[q.query].length > 1) flags.push("CANNIBAL");
  if (age !== "" && age >= 42 && age <= 56 && r.impressions < 50) flags.push("NO_TRACTION");
  return {
    url, target_phrase: g.target || "", impressions_28d: r.impressions, clicks_28d: r.clicks, ctr_28d: r.ctr.toFixed(4), position_28d: r.position.toFixed(1),
    clicks_prev_28d: p.clicks, clicks_change_pct: p.clicks ? Math.round(((r.clicks - p.clicks) / p.clicks) * 100) : "",
    top_queries: top.slice(0, 3).map((t) => t.query).join(" | "), tool_clicks_28d: "", published, last_checked: g.isoDate || "", age_days: age, flags: flags.join(" "),
  };
});

// Searches that bring people to the site but that no guide answers well (no guide within the top 20)
const guideUrls = new Set(guides.map((x) => norm(x.url)));
const unmatched = queries.filter((q) => q.impressions >= 20 && !pageQueries.some((pq) => pq.query === q.query && guideUrls.has(norm(pq.page)) && pq.position <= 20))
  .sort((a, b) => b.impressions - a.impressions)
  .map((q) => ({ query: q.query, impressions_28d: q.impressions, clicks_28d: q.clicks, position_28d: q.position.toFixed(1), flags: "GAP" }));

const csv = (list) => {
  if (!list.length) return "";
  const cols = Object.keys(list[0]), cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...list.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
};
mkdirSync(join(OUT, "archive"), { recursive: true });
writeFileSync(join(OUT, "scorecard.csv"), csv(rows));
writeFileSync(join(OUT, "unmatched-queries.csv"), csv(unmatched) || "query,impressions_28d,clicks_28d,position_28d,flags\n");
writeFileSync(join(OUT, "archive", `${day(0)}.csv`), csv(pageQueries.map((q) => ({ ...q, ctr: q.ctr.toFixed(4), position: q.position.toFixed(1) }))) || "page,query,clicks,impressions,ctr,position\n");
writeFileSync(join(OUT, "meta.json"), JSON.stringify({ generated: day(0), period: { start, end }, previous: { start: prevStart, end: prevEnd }, property: PROPERTY, min_impressions_for_flags: MIN_IMPRESSIONS }, null, 2) + "\n");
console.log(`Scorecard for ${rows.length} guides, ${unmatched.length} unmatched searches, ${start} to ${end}`);
