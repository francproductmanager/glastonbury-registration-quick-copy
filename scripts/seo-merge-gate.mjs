// The SEO agents' merge gate (see site-src/SEO-AUDITOR.md). Run by .github/workflows/seo-agent-merge.yml
// from main, so no agent can change it. It is the only thing that publishes agent work, and it also merges
// Dependabot's weekly tool updates (see "Dependabot updates" below). It merges only when:
//   the pull request comes from this repo, on an agent branch, by the expected author, and isn't a draft
//   the test check passed on its exact head commit
//   it only changes files that agent may touch
//   writer work: reviewers a and b both passed the reviewed commit (b is the accuracy specialist), as a commit
//     status or a verdict comment, and any commits since are only this gate's own merges of main with nothing
//     else changed
//   if REQUIRE_SIGNED_REVIEWS is "true", each pass carries a signature made with REVIEW_SIGNING_KEY, which only
//     the reviewers' own cloud environment holds: every agent acts on GitHub as the owner, so this is what
//     stops the writer recording a pass for its own work
//   it is up to date with main; if not, the gate merges main in and reruns the tests
// A test run that was stopped before it finished (its time limit hit while a download crawled, or GitHub cancelled
// it) says nothing about the change, so the gate starts it again, up to RERUNS times, instead of leaving it stuck.
// On the sweep it also opens an issue for any agent pull request open longer than STUCK_HOURS, saying why it
// hasn't gone live, and closes that issue once the pull request is merged or closed.
// When all that's missing is tests it started or approved itself, it waits for them (up to WAIT_MINUTES) and
// checks again in the same run, because tests started by a workflow don't send the signal that would wake it.
// It never merges a writer branch opened by GitHub Actions: that is the monthly reviewer canary.
// Dependabot updates: merged like agent work once the tests pass, if every commit is Dependabot's own (or this
// gate's merges of main), the change is a minor or patch version (a major one can break things, so it waits for
// the owner), package.json only changes version numbers and workflow files only change the pinned action. GitHub
// doesn't let a workflow merge changes to workflow files, so those wait for the owner's click, with a comment.
// With SHA set it checks the pull request at that commit; without, it sweeps every open agent pull
// request (hourly, as a backup).
import { execFileSync } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";

const REPO = process.env.REPO, R = `repos/${REPO}`;
// Runs started by a Dependabot test run get no secrets, so the key is only required where a review is checked
const SIGNED = process.env.REQUIRE_SIGNED_REVIEWS === "true", KEY = process.env.REVIEW_SIGNING_KEY || "";
// A reviewer signs "<context>:<commit sha>:<state>" and puts sig=<hex> in the status description
const signedBy = (s, sha) => {
  if (!KEY) throw new Error("REQUIRE_SIGNED_REVIEWS is on but the REVIEW_SIGNING_KEY secret is missing");
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
// A stop that only needs the tests on the pull request's head to finish
class Wait extends Stop {}
const wait = (why) => { throw new Wait(why); };
const WAIT_MINUTES = 12;
const FIX_LABEL = "seo-fix-needed";
const RERUNS = 2;
const STOPPED = ["cancelled", "timed_out"];
const STUCK_HOURS = 12;
const STUCK_TITLE = "Pull request stuck: #"; // none was open under the old title, "SEO agent pull request stuck: #"

const BOT = "github-actions[bot]";
const DEPENDABOT = "dependabot[bot]";
const GENERATED = "(guides|faq|about|contact|privacy|terms|updates|calendar|downloads)/.+|404\\.html|sitemap\\.xml|robots\\.txt";
const ROLES = {
  "seo-agent/": { author: "agent", reviewed: true, allowed: new RegExp(`^(site-src/(content|facts)\\.mjs|site-src/link-domains\\.txt|site-src/log/\\d{4}-\\d\\d-\\d\\d-writer[0-9a-z-]*\\.md|${GENERATED})$`) },
  "seo-audit/": { author: "agent", allowed: /^(site-src\/seo-audit\.md|site-src\/log\/\d{4}-\d\d-\d\d-(auditor|regression)\.md)$/ },
  "seo-data/": { author: BOT, allowed: /^site-src\/data\/.+$/ },
  "dependabot/": { author: DEPENDABOT, allowed: /^(package\.json|package-lock\.json|\.github\/workflows\/[\w-]+\.yml)$/ },
};

// Leaves a comment starting "Not merged automatically" on a pull request, once
function sayOnce(n, text) {
  const said = api(`${R}/issues/${n}/comments?per_page=100`).some((c) => c.user.login === BOT && c.body.startsWith("Not merged automatically"));
  if (!said) run("gh", ["api", `${R}/issues/${n}/comments`, "-f", `body=Not merged automatically: ${text}`]);
}
// GitHub refuses a workflow's push or merge that changes workflow files
const workflowRefused = (e) => /workflow/i.test(`${e.stdout}${e.stderr}`);
const HAND = "it changes a GitHub workflow file, and GitHub doesn't let the merge gate merge those. The tests passed, so it's safe to click Merge (or close it if you don't want this update).";

// Dependabot's own checks: who made the commits, how big the version jump is, and what changed
function checkDependabot(pr, files) {
  const n = pr.number;
  for (const c of all(`${R}/pulls/${n}/commits?per_page=100`)) {
    const gateMerge = c.parents.length === 2 && c.author?.login === BOT && c.commit.message.startsWith("Merge branch 'main' into ");
    if (!gateMerge && !(c.author?.login === DEPENDABOT && c.commit.verification?.verified)) stop(`commit ${c.sha} isn't Dependabot's own; never merged`);
  }
  const m = pr.title.match(/^Bump (\S+) from v?(\d+)\.(\d+)\S* to v?(\d+)\.(\d+)\S*$/);
  if (!m) stop("not a single version update; never merged automatically");
  const [, name, fromMajor, fromMinor, toMajor, toMinor] = m;
  // Before 1.0, a minor version can break things just like a major one
  if (fromMajor !== toMajor || (fromMajor === "0" && fromMinor !== toMinor)) {
    sayOnce(n, `${name} moves to a new major version, which can break things. Please check the tests passed and merge it by hand, or close it.`);
    stop(`a major version update of ${name}; waits for the owner`);
  }
  const changed = (f) => (f.patch || "").split("\n").filter((l) => /^[+-]/.test(l));
  for (const f of files) {
    if (f.filename === "package-lock.json") continue;
    // Only "name": "version" lines (package.json) or pinned "uses:" lines (workflows), each swapped one for one
    const line = f.filename === "package.json" ? /^[+-]\s*"([^"]+)":\s*"[\w.^~-]+",?\s*$/ : /^[+-]\s*(?:- )?uses:\s*([\w./-]+)@[0-9a-f]{40}(?:\s*#\s*v?[\w.-]+)?\s*$/;
    const lines = changed(f), keys = (sign) => lines.filter((l) => l[0] === sign).map((l) => l.match(line)?.[1]);
    const removed = keys("-"), added = keys("+");
    if (!lines.length || lines.some((l) => !line.test(l)) || removed.join() !== added.join()) stop(`${f.filename} changes more than a version number; never merged automatically`);
  }
}

function gate(pr) {
  const n = pr.number, branch = pr.head.ref, head = pr.head.sha, author = pr.user.login;
  const prefix = Object.keys(ROLES).find((p) => branch.startsWith(p));
  if (!prefix) stop(`not an agent branch (${branch})`);
  const role = ROLES[prefix];
  if (pr.head.repo?.full_name !== REPO) stop("from a fork, never merged");
  if ((author === BOT) !== (role.author === BOT)) stop(`opened by ${author}, never merged (a canary, or not the expected agent)`);
  if ((author === DEPENDABOT) !== (role.author === DEPENDABOT)) stop(`opened by ${author} on ${branch}, never merged`);
  if (pr.draft) stop("still a draft");
  // GitHub holds test runs for approval on pull requests GitHub Actions opened (the search data), and on any
  // pull request once this gate has pushed a merge of main into it. A held run blocks the merge even after the
  // gate's own test run passes: approve them, then decide next time
  const held = api(`${R}/actions/runs?head_sha=${head}&status=action_required`).workflow_runs;
  for (const r of held) run("gh", ["api", "-X", "POST", `${R}/actions/runs/${r.id}/approve`]);
  if (held.length) wait(`approved ${held.length} held test run(s); merging once they pass`);

  const checks = api(`${R}/commits/${head}/check-runs?check_name=test`).check_runs;
  if (!checks.length || checks.some((c) => c.status !== "completed")) wait(`the tests are still running on ${head}`);
  if (!checks.every((c) => c.conclusion === "success")) {
    const stopped = checks.filter((c) => STOPPED.includes(c.conclusion));
    const ids = [...new Set(stopped.map((c) => c.details_url?.match(/\/actions\/runs\/(\d+)/)?.[1]))];
    if (stopped.length && checks.every((c) => c.conclusion === "success" || STOPPED.includes(c.conclusion)) && ids.every(Boolean)) {
      const runs = ids.map((id) => api(`${R}/actions/runs/${id}`));
      if (runs.every((r) => r.run_attempt <= RERUNS)) {
        for (const r of runs) run("gh", ["api", "-X", "POST", `${R}/actions/runs/${r.id}/rerun`]);
        wait(`the tests were stopped before finishing on ${head}; started them again`);
      }
      stop(`the tests were stopped before finishing on ${head}, ${RERUNS + 1} times; they need a look`);
    }
    stop(`the test check hasn't passed on ${head}`);
  }

  const files = all(`${R}/pulls/${n}/files?per_page=100`);
  const outside = files.map((f) => f.filename).filter((f) => !role.allowed.test(f));
  if (outside.length) {
    sayOnce(n, "this changes files outside what the agent may touch. Please review it by hand.");
    stop(`changes files this agent may not touch:\n${outside.join("\n")}`);
  }
  if (role.author === DEPENDABOT) checkDependabot(pr, files);

  if (role.reviewed) {
    // The reviewed commit is the newest one that isn't this gate's own "merge main in" commit
    const commits = all(`${R}/pulls/${n}/commits?per_page=100`);
    const gateMerge = (c) => c.parents.length === 2 && c.author?.login === BOT && c.commit.message.startsWith("Merge branch 'main' into ");
    let i = commits.length - 1;
    while (i > 0 && gateMerge(commits[i])) i--;
    const reviewed = commits[i].sha;
    const need = ["seo-review/a", "seo-review/b"];
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
    // Once both reviewers have judged the reviewed commit and either failed it, label the pull request: adding
    // the label starts the writer's fix run (a GitHub trigger on the routine). A new commit takes it off again
    const failed = need.every((c) => latest[c]) && need.some((c) => latest[c] === "failure");
    const labelled = (pr.labels || []).some((l) => l.name === FIX_LABEL);
    if (failed && !labelled) run("gh", ["api", "-X", "POST", `${R}/issues/${n}/labels`, "-f", `labels[]=${FIX_LABEL}`]);
    if (!failed && labelled) run("gh", ["api", "-X", "DELETE", `${R}/issues/${n}/labels/${FIX_LABEL}`]);
    if (failed) stop(`reviewers failed ${reviewed}; labelled ${FIX_LABEL} for the writer's fix run`);
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
    try { run("gh", ["api", "-X", "PUT", `${R}/pulls/${n}/update-branch`, "-f", `expected_head_sha=${head}`]); }
    catch (e) { if (workflowRefused(e)) { sayOnce(n, HAND); stop("changes a workflow file; waits for the owner's click"); } throw e; }
    for (let t = 0; t < 30 && api(`${R}/pulls/${n}`).head.sha === head; t++) run("sleep", ["4"]);
    // Pushes made by this workflow don't start other workflows, so start the tests directly
    run("gh", ["workflow", "run", "test.yml", "--repo", REPO, "--ref", branch]);
    wait("was behind main: merged main in and started the tests again");
  }

  try { run("gh", ["api", "-X", "PUT", `${R}/pulls/${n}/merge`, "-f", "merge_method=squash", "-f", `sha=${head}`]); }
  catch (e) {
    if (/status check/i.test(`${e.stdout}${e.stderr}`)) wait("GitHub is still waiting for the test check");
    if (workflowRefused(e)) { sayOnce(n, HAND); stop("changes a workflow file; waits for the owner's click"); }
    throw e;
  }
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
// No test run on a commit is queued or running (a held run counts as finished: checking again approves it)
const testsSettled = (sha) => api(`${R}/actions/runs?head_sha=${sha}&per_page=50`).workflow_runs
  .filter((r) => r.name === "Tests").every((r) => r.status === "completed");
const deadline = Date.now() + WAIT_MINUTES * 60_000;
const sweep = !process.env.SHA;
const stuckIssues = sweep ? all(`${R}/issues?state=open&creator=github-actions%5Bbot%5D&per_page=100`)
  .filter((i) => !i.pull_request && i.title.startsWith(STUCK_TITLE)) : [];
// On the sweep: an agent pull request open for more than STUCK_HOURS gets one issue, so a stuck one doesn't sit
// unnoticed (the writer starts nothing new while its pull request is open). The monthly canary is left out
function noteIfStuck(pr, why) {
  const hours = Math.floor((Date.now() - Date.parse(pr.created_at)) / 36e5);
  if (pr.state !== "open" || hours < STUCK_HOURS || (pr.user.login === BOT && pr.head.ref.startsWith("seo-agent/"))) return;
  if (stuckIssues.some((i) => i.title === `${STUCK_TITLE}${pr.number}`)) return;
  const body = pr.head.ref.startsWith("dependabot/") ? [
    `#${pr.number} (a Dependabot update: ${pr.title}) has been open for ${hours} hours without going live. The merge gate's last check said: ${why}`,
    "",
    "If the pull request has a comment saying it needs you, open it, check the tests passed and click Merge, or close it if you don't want the update. This issue closes itself within a few hours of the pull request being merged or closed.",
  ].join("\n") : [
    `#${pr.number} (\`${pr.head.ref}\`) has been open for ${hours} hours without going live. The merge gate's last check said: ${why}`,
    "",
    "What usually helps:",
    "- Tests stopped or failed: open the pull request, go to its Checks tab and click Re-run jobs.",
    "- Waiting for a reviewer pass: check the reviewer routines ran, at https://claude.ai/code/routines.",
    "- Reviewers failed it: the writer's fix run should pick it up; if it hasn't, check that routine ran.",
    "",
    "While a writer pull request is open the writer starts no new work. This issue closes itself within a few hours of the pull request being merged or closed.",
  ].join("\n");
  run("gh", ["api", `${R}/issues`, "-f", `title=${STUCK_TITLE}${pr.number}`, "-f", `body=${body}`]);
}
for (let pr of prs) {
  let why = "";
  for (;;) {
    try { console.log(`#${pr.number}: ${gate(pr)}`); pr = { ...pr, state: "merged" }; break; }
    catch (e) {
      if (!(e instanceof Stop)) throw e;
      console.log(`#${pr.number}: ${e.message}`);
      why = e.message;
      if (!(e instanceof Wait)) break;
      // Give new or approved runs time to appear, then wait for every test run on the head to finish
      run("sleep", ["20"]);
      while (Date.now() < deadline && !testsSettled(api(`${R}/pulls/${pr.number}`).head.sha)) run("sleep", ["15"]);
      if (Date.now() >= deadline) { console.log(`#${pr.number}: still waiting after ${WAIT_MINUTES} minutes; the next run checks again`); break; }
      run("git", ["fetch", "--quiet", "origin"]);
      pr = api(`${R}/pulls/${pr.number}`);
      if (pr.state !== "open") break;
    }
  }
  if (sweep) noteIfStuck(pr, why);
}
// Close stuck issues whose pull request has since been merged or closed
for (const i of stuckIssues) {
  const n = Number(i.title.slice(STUCK_TITLE.length));
  if (api(`${R}/pulls/${n}`).state === "open") continue;
  run("gh", ["api", "-X", "POST", `${R}/issues/${i.number}/comments`, "-f", `body=#${n} is no longer open, so this is done.`]);
  run("gh", ["api", "-X", "PATCH", `${R}/issues/${i.number}`, "-f", "state=closed", "-f", "state_reason=completed"]);
}
