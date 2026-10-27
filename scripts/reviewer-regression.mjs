// The SEO reviewers' regression set (see site-src/SEO-REVIEWER.md): known changes, some fine and some with
// a planted problem, that a reviewer must keep judging correctly. Add a case for every reviewer miss,
// canary miss or error found after publishing. Run monthly by the regression routine:
//   node scripts/reviewer-regression.mjs list               the case ids
//   node scripts/reviewer-regression.mjs apply <id>         makes that case's change in the working tree
//   node scripts/reviewer-regression.mjs score <file.json>  compares {"case-01": "pass" | "fail", ...} with the
//                                                           expected verdicts, which the reviewer never opens
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "tests", "reviewer-cases");
export const cases = () => JSON.parse(readFileSync(join(DIR, "cases.json"), "utf8"));
const [cmd, arg] = process.argv.slice(2);

if (cmd === "list") console.log(cases().map((c) => c.id).join("\n"));
else if (cmd === "apply") {
  const c = cases().find((x) => x.id === arg);
  if (!c) throw new Error(`no case ${arg}`);
  const file = join(ROOT, c.file), src = readFileSync(file, "utf8");
  if (!src.includes(c.find)) throw new Error(`${c.id} no longer applies: its text isn't in ${c.file}`);
  writeFileSync(file, src.replace(c.find, c.replace));
  console.log(`Applied ${c.id}. The writer's log for this change says: ${c.log}`);
} else if (cmd === "score") {
  const expected = JSON.parse(readFileSync(join(DIR, "expected.json"), "utf8"));
  const given = JSON.parse(readFileSync(arg, "utf8"));
  const rows = Object.entries(expected).map(([id, e]) => ({ id, expected: e.verdict, given: String(given[id] || "missing").toLowerCase(), why: e.why }));
  const wrong = rows.filter((r) => r.given !== r.expected);
  const bad = rows.filter((r) => r.expected === "fail"), caught = bad.filter((r) => r.given === "fail").length;
  const good = rows.filter((r) => r.expected === "pass"), passed = good.filter((r) => r.given === "pass").length;
  console.log(`Caught ${caught} of ${bad.length} problem changes; passed ${passed} of ${good.length} fine changes.`);
  for (const r of wrong) console.log(`WRONG ${r.id}: said ${r.given}, should be ${r.expected} (${r.why})`);
  if (!wrong.length) console.log("Every case judged correctly.");
} else console.log("usage: list | apply <id> | score <verdicts.json>");
