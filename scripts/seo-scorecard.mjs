// A weekly scorecard for the SEO agents (see site-src/SEO-AUDITOR.md): is the system getting better?
// Reads the writer's pull requests and the reviewers' verdict comments from GitHub (with gh api), the guides'
// published dates, the new guide slots, and the Search Console export in site-src/data/.
//   node scripts/seo-scorecard.mjs              the last 4 weeks, Monday to Sunday (UK), as a Markdown table
//   node scripts/seo-scorecard.mjs --weeks 8    more weeks
//   node scripts/seo-scorecard.mjs --sources    also count dead sources now (runs scripts/check-sources.mjs)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDES } from "../site-src/content.mjs";
import { slots, START } from "./new-guide-slots.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const R = "repos/francproductmanager/glastonbury-registration-quick-copy";
const DAY = 24 * 60 * 60 * 1000;
const gh = (path) => JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", path], { encoding: "utf8", maxBuffer: 64 << 20 })).flat();
const ukDate = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const addDays = (date, n) => ukDate(Date.parse(`${date}T12:00:00Z`) + n * DAY);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

// Each writer pull request: when it opened and merged, and the reviewers' verdicts per commit, oldest first
function writerPulls() {
  return gh(`${R}/pulls?state=all&per_page=100`).filter((p) => p.head.ref.startsWith("seo-agent/")).map((p) => {
    const verdicts = gh(`${R}/issues/${p.number}/comments?per_page=100`)
      .map((c) => ({ at: c.created_at, m: (c.body || "").split("\n")[0].match(/^SEO review ([ab]): (PASS|FAIL) for ([0-9a-f]{7,40})/) }))
      .filter((c) => c.m).map((c) => ({ at: c.at, reviewer: c.m[1], verdict: c.m[2], sha: c.m[3] }));
    const commits = [...new Set(verdicts.map((v) => v.sha))];
    const first = commits[0], on = (sha) => verdicts.filter((v) => v.sha === sha);
    return {
      opened: ukDate(Date.parse(p.created_at)), merged: p.merged_at, closedUnmerged: p.state === "closed" && !p.merged_at,
      minutes: p.merged_at ? Math.round((Date.parse(p.merged_at) - Date.parse(p.created_at)) / 60000) : null,
      reviewed: !!first,
      firstTime: !!first && ["a", "b"].every((r) => on(first).some((v) => v.reviewer === r && v.verdict === "PASS")) && !on(first).some((v) => v.verdict === "FAIL"),
      failedCommits: commits.filter((sha) => on(sha).some((v) => v.verdict === "FAIL")).length,
    };
  });
}

export function scorecard(weeks = 4, { sources = false } = {}) {
  const today = ukDate(Date.now()), dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const thisMonday = addDays(today, -dow), pulls = writerPulls();
  const rows = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const from = addDays(thisMonday, -7 * w), to = addDays(from, 6), inWeek = (d) => d >= from && d <= to;
    const months = [...new Set([from.slice(0, 7), to.slice(0, 7)])];
    const slotCount = months.flatMap(slots).filter((s) => inWeek(s.date)).length;
    const published = GUIDES.filter((g) => !g.draft && g.published && inWeek(g.published));
    const inSlots = published.filter((g) => g.published >= START).length, before = published.length - inSlots;
    const ps = pulls.filter((p) => inWeek(p.opened)), reviewed = ps.filter((p) => p.reviewed);
    const mins = median(ps.filter((p) => p.minutes != null).map((p) => p.minutes));
    rows.push([
      `${from}${w === 0 ? " (so far)" : ""}`,
      [to >= START ? `${inSlots} of ${slotCount}` : "", before ? `${before} before the slots began` : ""].filter(Boolean).join(", ") || "0",
      String(ps.length), String(ps.filter((p) => p.merged).length),
      reviewed.length ? `${reviewed.filter((p) => p.firstTime).length} of ${reviewed.length}` : "none",
      String(ps.reduce((n, p) => n + p.failedCommits, 0)), String(ps.filter((p) => p.closedUnmerged).length),
      mins == null ? "none" : `${mins} min`,
    ]);
  }
  const out = ["| Week from | New guides (of slots) | Writer PRs | Merged | Passed review first time | Fix rounds | Closed unmerged | Median open to merge |",
    "|---|---|---|---|---|---|---|---|", ...rows.map((r) => `| ${r.join(" | ")} |`), ""];
  const meta = join(ROOT, "site-src", "data", "meta.json"), card = join(ROOT, "site-src", "data", "scorecard.csv");
  if (existsSync(meta) && existsSync(card)) {
    const m = JSON.parse(readFileSync(meta, "utf8")), lines = readFileSync(card, "utf8").trim().split("\n");
    const head = lines[0].split(","), col = (name) => head.indexOf(name);
    // Only the leading numeric columns are read, so commas inside later quoted fields don't matter
    const sum = (name) => lines.slice(1).reduce((n, l) => n + (Number(l.split(",")[col(name)]) || 0), 0);
    out.push(`Search, ${m.period.start} to ${m.period.end} (exported ${m.generated}): ${sum("clicks_28d")} clicks, ${sum("impressions_28d")} impressions across the guides.`);
  } else out.push("Search: no Search Console export yet.");
  if (sources) {
    let text;
    try { text = execFileSync("node", [join(ROOT, "scripts", "check-sources.mjs")], { encoding: "utf8" }); } catch (e) { text = e.stdout || ""; }
    out.push(`Sources now: ${text.trim().split("\n").pop()}.`);
  }
  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf("--weeks");
  console.log(scorecard(i >= 0 ? Number(args[i + 1]) || 4 : 4, { sources: args.includes("--sources") }));
}
