// How much guides overlap, so the SEO agents improve an existing guide instead of writing a near copy.
// Scores run from 0 (nothing in common) to 1. A proposed topic scores the share of its key words an existing guide's
// target and titles already use (half credit for a word only in its summary); two guides' full texts score the
// cosine similarity of their word weights.
//   node scripts/guide-similarity.mjs "proposed search phrase"   guides closest to a proposed topic
//   node scripts/guide-similarity.mjs --slug <slug>              guides closest to one guide's full text
//   node scripts/guide-similarity.mjs --all                      every pair of guides at or above "check"
import { fileURLToPath } from "node:url";
import { GUIDES } from "../site-src/content.mjs";

// Bands, set from the guides as they stood in October 2026, where the closest pairs were known overlaps
// (the highest full text pair was 0.44, and the balance and deposits guides, which repeat each other, 0.30)
export const BANDS = { topic: { high: 0.75, check: 0.5 }, text: { high: 0.5, check: 0.3 } };

const STOP = new Set(("a an and are as at be been but by can do does for from get got has have how i if in into is it its " +
  "it's me more most my no not of on one or our so than that the their them then there these they this to up us was we " +
  "what when where which who why will with you your glastonbury glasto festival 2027 ticket tickets").split(" "));
const words = (s) => String(s).toLowerCase().replace(/\{\{fact:\w+\}\}/g, " ").replace(/\]\([^)]*\)/g, " ")
  .match(/[a-z0-9']+/g)?.map((w) => w.replace(/'s$/, "").replace(/s$/, "")).filter((w) => w.length > 2 && !STOP.has(w)) || [];

// Every string in a guide's body: paragraphs, headings, list items, table cells, tips
const strings = (x) => typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];
const nameText = (g) => [g.target, g.title, g.seoTitle].filter(Boolean).join(" ");
const topicText = (g) => [nameText(g), g.summary].join(" ");
const fullText = (g) => [topicText(g), ...strings(g.body)].join(" ");

function vectors(docs) {
  const df = new Map();
  const tfs = docs.map((d) => { const tf = new Map(); for (const w of words(d)) tf.set(w, (tf.get(w) || 0) + 1); for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1); return tf; });
  return tfs.map((tf) => { const v = new Map(); for (const [w, n] of tf) v.set(w, (1 + Math.log(n)) * Math.log((docs.length + 1) / ((df.get(w) || 0) + 1))); return v; });
}
const cosine = (a, b) => { let dot = 0, na = 0, nb = 0; for (const [w, x] of a) { na += x * x; dot += x * (b.get(w) || 0); } for (const x of b.values()) nb += x * x; return na && nb ? dot / Math.sqrt(na * nb) : 0; };
const band = (s, kind) => s >= BANDS[kind].high ? "HIGH" : s >= BANDS[kind].check ? "CHECK" : "low";

const live = (guides) => guides.filter((g) => !g.draft);

// Existing guides ranked by how much of a proposed topic (a search phrase or title) they already cover: the share
// of the phrase's words, weighted by how rare each word is across guides, found in a guide's target and titles
// (half for a word only in its summary)
export function closestToTopic(phrase, guides = GUIDES) {
  const gs = live(guides), names = gs.map((g) => new Set(words(nameText(g)))), topics = gs.map((g) => new Set(words(topicText(g))));
  const idf = (w) => Math.log((gs.length + 1) / (topics.filter((t) => t.has(w)).length + 1)) + 1;
  const q = [...new Set(words(phrase))], total = q.reduce((s, w) => s + idf(w), 0);
  const credit = (i, w) => names[i].has(w) ? 1 : topics[i].has(w) ? 0.5 : 0;
  return gs.map((g, i) => ({ slug: g.slug, score: total ? q.reduce((s, w) => s + credit(i, w) * idf(w), 0) / total : 0 }))
    .sort((x, y) => y.score - x.score);
}

// Other guides ranked by how close their full text is to one guide's
export function closestToGuide(slug, guides = GUIDES) {
  const gs = live(guides), vs = vectors(gs.map(fullText)), i = gs.findIndex((g) => g.slug === slug);
  if (i < 0) throw new Error(`no published guide ${slug}`);
  return gs.map((g, j) => ({ slug: g.slug, score: cosine(vs[i], vs[j]) })).filter((x) => x.slug !== slug).sort((x, y) => y.score - x.score);
}

export function allPairs(guides = GUIDES) {
  const gs = live(guides), vs = vectors(gs.map(fullText)), out = [];
  for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) out.push({ a: gs[i].slug, b: gs[j].slug, score: cosine(vs[i], vs[j]) });
  return out.sort((x, y) => y.score - x.score);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [arg, value] = process.argv.slice(2);
  const show = (rows, kind) => rows.forEach((r) => console.log(`${band(r.score, kind).padEnd(5)} ${r.score.toFixed(2)}  ${r.slug ?? `${r.a}  and  ${r.b}`}`));
  if (arg === "--slug") show(closestToGuide(value).slice(0, 5), "text");
  else if (arg === "--all") show(allPairs().filter((p) => p.score >= BANDS.text.check), "text");
  else if (arg) show(closestToTopic(process.argv.slice(2).join(" ")).slice(0, 5), "topic");
  else { console.error('usage: node scripts/guide-similarity.mjs "proposed search phrase" | --slug <slug> | --all'); process.exit(1); }
}
