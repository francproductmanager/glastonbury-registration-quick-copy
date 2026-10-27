// The SEO agents' merge gate (see site-src/SEO-AUDITOR.md). Run by .github/workflows/seo-agent-merge.yml
// from main, so no agent can change it. It is the only thing that publishes agent work, and only when:
//   the pull request comes from this repo, on an agent branch, by the expected author, and isn't a draft
//   the test check passed on its exact head commit
//   it only changes files that agent may touch
//   writer work: reviewer a passed the reviewed commit (and reviewer b too if it adds a guide), and any
//     commits since are only this gate's own merges of main with nothing else changed
//   it is up to date with main; if not, the gate merges main in, reruns the tests, and decides next time
// It never merges a writer branch opened by GitHub Actions: that is the monthly reviewer canary.
import { execFileSync } from "node:child_process";

const REPO = process.env.REPO, SHA = process.env.SHA, R = `repos/${REPO}`;
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const api = (path, ...args) => JSON.parse(run("gh", ["api", path, ...args]) || "null");
const all = (path) => JSON.parse(run("gh", ["api", "--paginate", "--slurp", path])).flat();
const stop = (why) => { console.log(why); process.exit(0); };

const BOT = "github-actions[bot]";
const GENERATED = "(guides|faq|about|contact|privacy|terms|updates|calendar|downloads)/.+|404\\.html|sitemap\\.xml|robots\\.txt";
const ROLES = {
  "seo-agent/": { author: "agent", reviewed: true, allowed: new RegExp(`^(site-src/content\\.mjs|site-src/log/\\d{4}-\\d\\d-\\d\\d-writer[0-9a-z-]*\\.md|${GENERATED})$`) },
  "seo-audit/": { author: "agent", allowed: /^(site-src\/seo-audit\.md|site-src\/log\/\d{4}-\d\d-\d\d-auditor\.md)$/ },
  "seo-data/": { author: BOT, allowed: /^site-src\/data\/.+$/ },
};

const open = api(`${R}/commits/${SHA}/pulls`).filter((p) => p.state === "open" && p.base.ref === "main");
if (!open.length) stop(`No open pull request into main for ${SHA}`);
const pr = api(`${R}/pulls/${open[0].number}`);
const n = pr.number, branch = pr.head.ref, head = pr.head.sha, author = pr.user.login;
const prefix = Object.keys(ROLES).find((p) => branch.startsWith(p));
if (!prefix) stop(`#${n}: not an agent branch (${branch})`);
const role = ROLES[prefix];
if (pr.head.repo?.full_name !== REPO) stop(`#${n}: from a fork, never merged`);
if ((author === BOT) !== (role.author === BOT)) stop(`#${n}: opened by ${author}, never merged (a canary, or not the expected agent)`);
if (pr.draft) stop(`#${n}: still a draft`);
if (head !== SHA) stop(`#${n}: has moved on to ${head}; waiting for its own checks`);

const checks = api(`${R}/commits/${head}/check-runs?check_name=test`).check_runs.map((c) => c.conclusion);
if (!checks.length || !checks.every((c) => c === "success")) stop(`#${n}: the test check hasn't passed on ${head}`);

const files = all(`${R}/pulls/${n}/files?per_page=100`);
const outside = files.map((f) => f.filename).filter((f) => !role.allowed.test(f));
if (outside.length) {
  console.log(`#${n}: changes files this agent may not touch:\n${outside.join("\n")}`);
  run("gh", ["api", `${R}/issues/${n}/comments`, "-f", "body=Not merged automatically: this changes files outside what the agent may touch. Please review it by hand."]);
  process.exit(0);
}

if (role.reviewed) {
  // The reviewed commit is the newest one that isn't this gate's own "merge main in" commit
  const commits = all(`${R}/pulls/${n}/commits?per_page=100`);
  const gateMerge = (c) => c.parents.length === 2 && c.author?.login === BOT && c.commit.message.startsWith("Merge branch 'main' into ");
  let i = commits.length - 1;
  while (i > 0 && gateMerge(commits[i])) i--;
  const reviewed = commits[i].sha;
  const need = ["seo-review/a"];
  if (files.some((f) => f.status === "added" && /^guides\/[^/]+\/index\.html$/.test(f.filename))) need.push("seo-review/b");
  const states = Object.fromEntries(api(`${R}/commits/${reviewed}/status`).statuses.map((s) => [s.context, s.state]));
  for (const c of need) if (states[c] !== "success") stop(`#${n}: waiting for reviewer pass ${c} on ${reviewed}`);
  if (reviewed !== head) {
    // Only main merged in since the review: the change this pull request makes must be exactly what was reviewed
    const diff = (a, b) => run("git", ["diff", "-U0", "--no-color", a, b]).split("\n").filter((l) => !/^(index |@@)/.test(l)).join("\n");
    const base = run("git", ["merge-base", reviewed, "origin/main"]);
    if (diff(base, reviewed) !== diff("origin/main", head)) stop(`#${n}: changed since review ${reviewed}; needs reviewing again`);
  }
}

// Publish only what was tested against the current main
if (api(`${R}/compare/main...${head}`).behind_by > 0) {
  console.log(`#${n}: behind main; merging main in and rerunning the tests`);
  run("gh", ["api", "-X", "PUT", `${R}/pulls/${n}/update-branch`, "-f", `expected_head_sha=${head}`]);
  for (let t = 0; t < 30 && api(`${R}/pulls/${n}`).head.sha === head; t++) run("sleep", ["4"]);
  // Pushes made by this workflow don't start other workflows, so start the tests directly
  run("gh", ["workflow", "run", "test.yml", "--repo", REPO, "--ref", branch]);
  process.exit(0);
}

run("gh", ["api", "-X", "PUT", `${R}/pulls/${n}/merge`, "-f", "merge_method=squash", "-f", `sha=${head}`]);
run("gh", ["api", "-X", "DELETE", `${R}/git/refs/heads/${branch}`]);
console.log(`#${n}: merged`);
