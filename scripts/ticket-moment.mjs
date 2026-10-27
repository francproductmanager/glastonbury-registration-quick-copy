// Ticket moment mode for the SEO agents (see site-src/SEO-AGENT.md). Searches and the cost of a wrong fact
// peak around Glastonbury's ticket moments (site-src/facts.mjs), so from 14 days before one starts until 3
// days after it ends, facts are rechecked every day and no new guides are written.
//   node scripts/ticket-moment.mjs   prints "active: <moment> (<start> to <end>)" or "quiet"
import { TICKET_MOMENTS } from "../site-src/facts.mjs";

const DAY = 864e5;
export function activeMoment(now = new Date()) {
  return TICKET_MOMENTS.find((m) => now >= Date.parse(m.start) - 14 * DAY && now <= Date.parse(m.end) + 4 * DAY) || null;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ticket-moment.mjs")) {
  const m = activeMoment();
  console.log(m ? `active: ${m.name} (${m.start} to ${m.end})` : "quiet");
}
