// The SEO agents' merge gate (see site-src/SEO-AUDITOR.md). Run by .github/workflows/seo-agent-merge.yml
// from main, so no agent can change it. It is the only thing that publishes agent work, and only when:
//   the pull request comes from this repo, on an agent branch, by the expected author, and isn't a draft
//   the test check passed on its exact head commit
//   it only changes files that agent may touch
//   writer work: reviewer a passed the reviewed commit (and reviewer b too if it adds a guide), as a commit
//     status or a verdict comment, and any commits since are only this gate's own merges of main with nothing
//     else changed
//   if REQUIRE_SIGNED_REVIEWS is "true", each pass carries a signature made with REVIEW_SIGNING_KEY, which only
//     the reviewers' own cloud environment holds: every agent acts on GitHub as the owner, so this is what
//     stops the writer recording a pass for its own work
//   it is up to date with main; if not, the gate merges main in, reruns the tests, and decides next time
// It never merges a writer branch opened by GitHub Actions: that is the monthly reviewer canary.
// With SHA set it checks the pull request at that commit; without, it sweeps every open agent pull
// request (hourly), because tests started by a workflow don't send the signal that would wake it.
import { execFileSync } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";

const REPO = process.env.REPO, R = `repos/${REPO}`;
const SIGNED = process.env.REQUIRE_SIGNED_REVIEWS === "true", KEY = process.env.REVIEW_SIGNING_KEY || "";
if (SIGNED && !KEY) throw new Error("REQUIRE_SIGNED_REVIEWS is on but the REVIEW_SIGNING_KEY secret is missing");
// A reviewer signs "<context>:<commit sha>:<state>" and puts sig=<hex> in the status description
const signedBy = (s, sha) => {
  const sig = (s.description || "").match(/sig=([0-9a-f]{64})/)?.[1];
  if (!sig) return false;
  const want = createHmac("sha256", KEY).update(`${s.context}:${sha}:${s.state}`).digest();
  return timingSafeEqual(Buffer.from(sig, "hex"), want);
};
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const api = (path, ...args) => JSON.parse(run("gh", ["api", path, ...args]) || "null");
const all = (path) => JSON.parse(run("gh", ["api", "--paginate", "--slurp", path])).flat();
class Stop extends Error {}
const stop = (why) => { throw new Stop(why); };

const BOT = "github-actions[bot]";
const GENERATED = "(guides|faq|about|contact|privacy|terms|updates|calendar|downloads)/.+|404\\.html|sitemap\\.xml|robots\\.txt";
const ROLES = {
  "seo-agent/": { author: "agent", reviewed: true, allowed: new RegExp(`^(site-src/(content|facts)\\.mjs|site-src/log/\\d{4}-\\d\\d-\\d\\d-writer[0-9a-z-]*\\.md|${GENERATED})$`) },
  "seo-audit/": { author: "agent", allowed: /^(site-src\/seo-audit\.md|site-src\/log\/\d{4}-\d\d-\d\d-(auditor|regression)\.md)$/ },
  "seo-data/": { author: BOT, allowed: /^site-src\/data\/.+$/ },
};

function gate(pr) {
  const n = pr.number, branch = pr.head.ref, head = pr.head.sha, author = pr.user.login;
  const prefix = Object.keys(ROLES).find((p) => branch.startsWith(p));
  if (!prefix) stop(`not an agent branch (${branch})`);
  const role = ROLES[prefix];
  if (pr.head.repo?.full_name !== REPO) stop("from a fork, never merged");
  if ((author === BOT) !== (role.author === BOT)) stop(`opened by ${author}, never merged (a canary, or not the expected agent)`);
  if (pr.draft) stop("still a draft");
  // GitHub holds test runs on pull requests GitHub Actions opened (the search data) for approval, and a
  // held run blocks the merge even after the gate's own test run passes: approve them, then decide next time
  if (author === BOT) {
    const held = api(`${R}/actions/runs?head_sha=${head}&status=action_required`).workflow_runs;
    for (const r of held) run("gh", ["api", "-X", "POST", `${R}/actions/runs/${r.id}/approve`]);
    if (held.length) stop(`approved ${held.length} held test run(s); merging once they pass`);
  }

  const checks = api(`${R}/commits/${head}/check-runs?check_name=test`).check_runs.map((c) => c.conclusion);
  if (!checks.length || !checks.every((c) => c === "success")) stop(`the test check hasn't passed on ${head}`);

  const files = all(`${R}/pulls/${n}/files?per_page=100`);
  const outside = files.map((f) => f.filename).filter((f) => !role.allowed.test(f));
  if (outside.length) {
    const said = api(`${R}/issues/${n}/comments?per_page=100`).some((c) => c.user.login === BOT && c.body.startsWith("Not merged automatically"));
    if (!said) run("gh", ["api", `${R}/issues/${n}/comments`, "-f", "body=Not merged automatically: this changes files outside what the agent may touch. Please review it by hand."]);
    stop(`changes files this agent may not touch:\n${outside.join("\n")}`);
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
    // A verdict is a commit status or, because Claude's cloud proxy refuses status writes, a comment from the
    // owner's account (every agent acts as the owner) starting "SEO review <a or b>: PASS for <sha>" (or FAIL).
    // Newest first; with signed reviews required, unsigned or forged verdicts don't count
    const owner = REPO.split("/")[0];
    const verdicts = all(`${R}/commits/${reviewed}/statuses?per_page=100`).map((s) => ({ ...s, at: s.created_at }));
    for (const c of all(`${R}/issues/${n}/comments?per_page=100`)) {
      const m = c.body.match(/^SEO review ([ab]): (PASS|FAIL) for ([0-9a-f]{40})\b/);
      if (!m || m[3] !== reviewed || c.user.login !== owner) continue;
      verdicts.push({ context: `seo-review/${m[1]}`, state: m[2] === "PASS" ? "success" : "failure", description: c.body, at: c.created_at });
    }
    verdicts.sort((x, y) => y.at.localeCompare(x.at));
    const latest = {};
    for (const s of verdicts) {
      if (SIGNED && !signedBy(s, reviewed)) continue;
      latest[s.context] ??= s.state;
    }
    for (const c of need) if (latest[c] !== "success") stop(`waiting for ${SIGNED ? "a signed " : ""}reviewer pass ${c} on ${reviewed}`);
    if (reviewed !== head) {
      // Only main merged in since the review: the change this pull request makes must be exactly what was reviewed
      const diff = (a, b) => run("git", ["diff", "-U0", "--no-color", a, b]).split("\n").filter((l) => !/^(index |@@)/.test(l)).join("\n");
      const base = run("git", ["merge-base", reviewed, "origin/main"]);
      if (diff(base, reviewed) !== diff("origin/main", head)) stop(`changed since review ${reviewed}; needs reviewing again`);
    }
  }

  // Publish only what was tested against the current main
  if (api(`${R}/compare/main...${head}`).behind_by > 0) {
    run("gh", ["api", "-X", "PUT", `${R}/pulls/${n}/update-branch`, "-f", `expected_head_sha=${head}`]);
    for (let t = 0; t < 30 && api(`${R}/pulls/${n}`).head.sha === head; t++) run("sleep", ["4"]);
    // Pushes made by this workflow don't start other workflows, so start the tests directly
    run("gh", ["workflow", "run", "test.yml", "--repo", REPO, "--ref", branch]);
    stop("was behind main: merged main in and started the tests again");
  }

  run("gh", ["api", "-X", "PUT", `${R}/pulls/${n}/merge`, "-f", "merge_method=squash", "-f", `sha=${head}`]);
  run("gh", ["api", "-X", "DELETE", `${R}/git/refs/heads/${branch}`]);
  return "merged";
}

let prs;
if (process.env.SHA) {
  prs = api(`${R}/commits/${process.env.SHA}/pulls`).filter((p) => p.state === "open" && p.base.ref === "main").slice(0, 1).map((p) => api(`${R}/pulls/${p.number}`));
  if (prs.length && prs[0].head.sha !== process.env.SHA) { console.log(`#${prs[0].number}: has moved on to ${prs[0].head.sha}; waiting for its own checks`); prs = []; }
} else {
  prs = all(`${R}/pulls?state=open&base=main&per_page=100`).filter((p) => Object.keys(ROLES).some((k) => p.head.ref.startsWith(k)));
}
if (!prs.length) console.log("No agent pull request to check");
for (const pr of prs) {
  try { console.log(`#${pr.number}: ${gate(pr)}`); }
  catch (e) { if (e instanceof Stop) console.log(`#${pr.number}: ${e.message}`); else throw e; }
}
