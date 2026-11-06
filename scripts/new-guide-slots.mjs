// When the SEO writer may publish a new guide (see site-src/SEO-AGENT.md). New guides go up 20 times a month,
// at random times between 7am and 11pm UK time, so the site grows the way a person would add to it, not on
// a fixed timetable. The times are drawn from a hash of the month, so every run and every test agrees on them
// without storing anything, and no agent can move them.
//   node scripts/new-guide-slots.mjs                 "due: ..." if a new guide may be written now, or "not due: ..."
//   node scripts/new-guide-slots.mjs --list [YYYY-MM]  every slot in a month (this month by default)
// A slot can be used on its own day only: one missed (an open pull request, a ticket moment, no backlog item
// ready) is not made up later, so missed slots never turn into a burst of guides.
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const START = "2026-10-30"; // the first day of the monthly schedule
export const PER_MONTH = 20;
const FIRST_HOUR = 7, LAST_HOUR = 23; // UK time: slots from 7.00am to 10.59pm
const SEED = "glastobolt new guide slots";
const TZ = "Europe/London";
const DAY = 24 * 60 * 60 * 1000;

const ukDate = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const ukTime = (t) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(t);
// The instant when it is <date> <hour>:<minute> in the UK
function ukInstant(date, hour, minute) {
  const guess = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const shown = Date.parse(`${ukDate(guess)}T${ukTime(guess)}:00Z`);
  return guess - (shown - guess);
}
const daysIn = (month) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();

// The month's slots, earliest first, as { at: instant in ms, date: "YYYY-MM-DD" (UK), time: "HH:MM" (UK) }
export function slots(month) {
  const total = daysIn(month), first = month === START.slice(0, 7) ? +START.slice(8, 10) : 1;
  if (`${month}-${String(total).padStart(2, "0")}` < START) return [];
  const count = Math.round(PER_MONTH * (total - first + 1) / total);
  let n = 0; // a stream of random numbers from the month's hash
  const random = () => createHash("sha256").update(`${SEED}:${month}:${n++}`).digest().readUInt32BE(0) / 2 ** 32;
  return Array.from({ length: count }, () => {
    const day = first + Math.floor(random() * (total - first + 1));
    const minute = Math.floor(random() * (LAST_HOUR - FIRST_HOUR) * 60);
    const date = `${month}-${String(day).padStart(2, "0")}`, at = ukInstant(date, FIRST_HOUR + Math.floor(minute / 60), minute % 60);
    return { at, date, time: ukTime(at) };
  }).sort((a, b) => a.at - b.at);
}

// How many new guides may have a given published date (UK): the slots on that day
export const slotsOn = (date) => slots(date.slice(0, 7)).filter((s) => s.date === date).length;

// Whether a new guide may be written now: a slot today has passed, and fewer guides were published today
export function due(guides, now = Date.now()) {
  const today = ukDate(now), all = slots(today.slice(0, 7));
  const passed = all.filter((s) => s.date === today && s.at <= now).length;
  const used = guides.filter((g) => !g.draft && g.published === today).length;
  const next = all.find((s) => s.at > now) || slots(ukDate(new Date(now).setUTCDate(28) + 7 * DAY).slice(0, 7))[0];
  return { due: passed > used, today, passed, used, next };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [arg, value] = process.argv.slice(2);
  if (arg === "--list") {
    const month = value || ukDate(Date.now()).slice(0, 7), list = slots(month);
    console.log(`${list.length} slots in ${month}:`);
    for (const s of list) console.log(`  ${s.date} ${s.time}`);
  } else {
    const { GUIDES } = await import("../site-src/content.mjs");
    const d = due(GUIDES), next = d.next ? `${d.next.date} ${d.next.time} UK time` : "none scheduled";
    console.log(d.due ? `due: ${d.passed} slot(s) today have passed and ${d.used} new guide(s) are published today, so write one`
      : `not due: ${d.passed} slot(s) today have passed, ${d.used} new guide(s) published today. Next slot: ${next}`);
  }
}
