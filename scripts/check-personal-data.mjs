#!/usr/bin/env node
// Stops real registration numbers and postcodes getting into the repo.
//
// A script can't tell a real number from a made-up one, so this works the other way round:
// every reg-number-like or postcode-like value must be on the APPROVED lists below. Anything
// else fails. To use a new made-up value in a test, add it here on purpose, in the same PR,
// so a reviewer sees it. Never add a real person's details.
//
//   node scripts/check-personal-data.mjs             every tracked file, plus the changes and
//                                                    commit messages not yet on main
//   node scripts/check-personal-data.mjs --range A..B  as above, for the commits in A..B (CI passes the PR's range)
//   node scripts/check-personal-data.mjs --staged    only what's staged (used by the git hook)
//   node scripts/check-personal-data.mjs --stdin     text piped in (CI uses it for PR titles and descriptions)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Made-up registration numbers, mostly digits of famous constants (pi, e, root 2, the golden ratio)
export const APPROVED_NUMBERS = new Set([
  "1029384756", "5647382910", "3141592653", "0141592653", "1618033988", "2718281828", "1414213562",
  "173205080", "0123456789", "1234567890", "10000000", "0222222222",
  "31536000", // one year in seconds (a cache header), not a reg number
]);
// Postcodes of famous public buildings, standard examples, and invalid ones. Never anyone's home.
export const APPROVED_POSTCODES = new Set([
  "SW1A1AA", "SW1A2AA", "W1A1AA", "EC1A1BB", "M601AA", "CF991NA", "CF101AA", "SE17PB",
  "BS14DJ", "M41HN", "NM41HN", "LS15DL", "E28FP", "E16AN",
]);

const SKIP = /(^|\/)(package-lock\.json|LICENSE[^/]*)$|\.(woff2|png|jpe?g|gif|ico|pdf)$/;
const REG = /(?<![0-9A-Za-z])\d(?:[ -]?\d){7,11}(?![0-9A-Za-z])/g;
const POSTCODE = /(?<![0-9A-Za-z])([A-Za-z]{1,2}\d[A-Za-z\d]?) ?(\d[A-Za-z]{2})(?![0-9A-Za-z])/g;

// Returns the values in `text` that look like reg numbers or postcodes and aren't approved
export function findPersonalData(text) {
  const clean = String(text)
    .replace(/data:[^"')]+/g, " ")              // inline images (the favicon's viewBox digits)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")   // ISO dates
    .replace(/#[0-9a-fA-F]{3,8}\b/g, " ");      // colours
  const found = new Set();
  for (const m of clean.matchAll(REG)) {
    const d = m[0].replace(/\D/g, "");
    if (d.length >= 8 && d.length <= 12 && !APPROVED_NUMBERS.has(d)) found.add(`number ending ${d.slice(-3)} (${d.length} digits)`);
  }
  for (const m of clean.matchAll(POSTCODE)) {
    const pc = (m[1] + m[2]).toUpperCase();
    if (!APPROVED_POSTCODES.has(pc)) found.add(`postcode starting ${pc.slice(0, 2)}`);
  }
  return [...found];
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

function main() {
  const mode = process.argv[2] || "";
  const problems = [];
  const check = (where, text) => { for (const f of findPersonalData(text)) problems.push(`${where}: ${f}`); };
  if (mode === "--stdin") {
    check("text", readFileSync(0, "utf8"));
  } else if (mode === "--staged") {
    for (const f of git("diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n").filter(Boolean)) {
      if (!SKIP.test(f)) check(f, git("show", `:${f}`));
    }
  } else {
    for (const f of git("ls-files").split("\n").filter(Boolean)) {
      if (!SKIP.test(f)) check(f, readFileSync(f, "utf8"));
    }
    // What these commits add (removed lines don't matter) and their messages
    let range = mode === "--range" ? process.argv[3] : "";
    if (!range) { try { git("rev-parse", "--verify", "-q", "origin/main"); range = "origin/main..HEAD"; } catch {} }
    if (range) {
      const log = git("log", range, "-p", "--format=%x00%h%n%B", "--", ".", ":(exclude)package-lock.json", ":(exclude)*.woff2");
      for (const block of log.split("\0").filter(Boolean)) {
        const sha = block.slice(0, block.indexOf("\n"));
        const added = block.slice(sha.length + 1).split("\n").filter(l => !/^(-|diff --git |index |@@ |\+\+\+ |new file mode |deleted file mode )/.test(l)).join("\n");
        check(`commit ${sha}`, added);
      }
    } else console.log("(no origin/main to compare with: only files checked)");
  }
  if (problems.length) {
    // Deliberately doesn't print the full value, so the check never repeats it into logs
    console.error("Possible real registration numbers or postcodes found:\n  " + [...new Set(problems)].join("\n  "));
    console.error("\nUse made-up data. If a value really is made up, add it to the APPROVED lists in scripts/check-personal-data.mjs.");
    process.exit(1);
  }
  console.log("✓ No unapproved registration numbers or postcodes");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
