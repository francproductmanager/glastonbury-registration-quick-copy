// When the SEO writer may publish a new guide (see site-src/SEO-AGENT.md).
// From WEEKLY_FROM on, the owner wants the site to change once a week, after Sunday's Search Console data
// and audit: at most one new guide a week, written on Monday (or Tuesday, if Monday's writer pull request
// was still open all day). Each week has one slot, on its Monday at 7am UK time.
// Before that, new guides went up 20 times a month at random times drawn from a hash of the month; those
// slots are kept so the history still checks out.
//   node scripts/new-guide-slots.mjs                 "due: ..." if a new guide may be written now, or "not due: ..."
//   node scripts/new-guide-slots.mjs --list [YYYY-MM]  every slot in a month (this month by default)
// A slot can be used on its own day only: one missed (an open pull request, a ticket moment, no backlog item
// ready) is not made up later, so missed slots never turn into a burst of guides.
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const START = "2026-10-30"; // the first day of the monthly schedule
export const PER_MONTH = 20;
export const WEEKLY_FROM = "2026-11-23"; // a Monday: one new guide a week from this week on
export const WEEKLY_DAYS = 2; // Monday and Tuesday
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
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
// The Monday of a date's week (dates as "YYYY-MM-DD")
export const mondayOf = (date) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
const daysIn = (month) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();

// The month's slots, earliest first, as { at: instant in ms, date: "YYYY-MM-DD" (UK), time: "HH:MM" (UK) }
export function slots(month) {
  const mondays = Array.from({ length: daysIn(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)
    .filter((d) => d >= WEEKLY_FROM && mondayOf(d) === d).map((date) => ({ at: ukInstant(date, FIRST_HOUR, 0), date, time: "07:00" }));
  return [...randomSlots(month).filter((s) => s.date < WEEKLY_FROM), ...mondays];
}

function randomSlots(month) {
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

// How many new guides may have a given published date (UK): the slots on that day, or from WEEKLY_FROM
// one on the Monday or Tuesday of each week (the weekly limit is checked separately, per week)
export const slotsOn = (date) => date >= WEEKLY_FROM
  ? (addDays(mondayOf(date), WEEKLY_DAYS) > date ? 1 : 0)
  : slots(date.slice(0, 7)).filter((s) => s.date === date).length;

// Whether a new guide may be written now. Weekly: it's Monday from 7am or Tuesday (UK), and no new guide
// has been published since this Monday. Before WEEKLY_FROM: a slot today has passed, and fewer guides
// were published today.
export function due(guides, now = Date.now()) {
  const today = ukDate(now);
  if (today >= WEEKLY_FROM) {
    const monday = mondayOf(today), opens = ukInstant(monday, FIRST_HOUR, 0), closes = addDays(monday, WEEKLY_DAYS);
    const used = guides.filter((g) => !g.draft && g.published >= monday && g.published <= today).length;
    const open = now >= opens && today < closes;
    const nextMonday = now < opens ? monday : addDays(monday, 7);
    const next = { at: ukInstant(nextMonday, FIRST_HOUR, 0), date: nextMonday, time: "07:00" };
    return { due: open && used === 0, today, passed: open ? 1 : 0, used, next, weekly: true };
  }
  const all = slots(today.slice(0, 7));
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
    if (d.weekly) console.log(d.due ? "due: this week's new guide slot is open and no new guide is published yet this week, so write one"
      : `not due: ${d.used ? "this week's new guide is already published" : "this week's slot isn't open now (Monday from 7am and Tuesday, UK time)"}. Next slot: ${next}`);
    else console.log(d.due ? `due: ${d.passed} slot(s) today have passed and ${d.used} new guide(s) are published today, so write one`
      : `not due: ${d.passed} slot(s) today have passed, ${d.used} new guide(s) published today. Next slot: ${next}`);
  }
}
