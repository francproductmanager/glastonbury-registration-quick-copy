// Every changeable fact (dates, prices, ages) lives here once, with where it comes from and when it was
// last checked. The guides refer to one as {{fact:key}} and site-src/build.mjs puts the value in, so a
// change here updates every guide at once. Tests fail if a guide types one of these values out by hand
// instead, or if an agent's change leaves a fact past its recheck date (see site-src/SEO-AGENT.md).
//   value     exactly as it appears in the text
//   source    the page that confirms it (opened and read, not a search snippet)
//   checked   when someone last confirmed it against that page
//   recheckBy after this the fact may be wrong or out of date (a date passed, a new year announced)
// Sums worked out from these (four tickets at £408, a monthly saving) are still written in the guides:
// when a value here changes, the writer updates those too.

const Y2027 = "https://www.glastonburyfestivals.co.uk/news/glastonbury-2027-ticket-information-confirmed/";
const CHECKED = "2026-10-26";

export const FACTS = {
  ticketPrice: { value: "£408", meaning: "2027 general admission ticket, including the £5 booking fee", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
  deposit: { value: "£100", meaning: "2027 deposit per ticket, paid at booking", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
  balance: { value: "£308", meaning: "2027 balance per ticket, paid in the April window", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
  postage: { value: "£11.25", meaning: "2027 postage and packing per general admission order", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
  balanceWindow: { value: "1 to 7 April 2027", meaning: "2027 balance payment window", source: Y2027, checked: CHECKED, recheckBy: "2027-04-07" },
  balanceWindowBetween: { value: "1 and 7 April 2027", meaning: "2027 balance payment window, as in 'between 1 and 7 April 2027'", source: Y2027, checked: CHECKED, recheckBy: "2027-04-07" },
  balanceWindowDays: { value: "Thu 1 to Wed 7 April 2027", meaning: "2027 balance payment window, short form with days", source: Y2027, checked: CHECKED, recheckBy: "2027-04-07" },
  balanceOpens: { value: "Thursday 1 April", meaning: "Opening day of the 2027 balance window (9am UK time)", source: Y2027, checked: CHECKED, recheckBy: "2027-04-07" },
  balanceCloses: { value: "Wednesday 7 April 2027", meaning: "Closing day of the 2027 balance window (11.59pm UK time)", source: Y2027, checked: CHECKED, recheckBy: "2027-04-07" },
  festivalDates: { value: "Wednesday 23 to Sunday 27 June 2027", meaning: "Glastonbury Festival 2027", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
  festivalDatesShort: { value: "Wed 23 to Sun 27 June 2027", meaning: "Glastonbury Festival 2027, short form", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
  ticketAgeCutoff: { value: "23 June 2014", meaning: "Anyone born on or before this date is 13 or over on the first day of the 2027 festival and needs a ticket", source: Y2027, checked: CHECKED, recheckBy: "2027-06-27" },
};

// Ticket moments: when people search most and a wrong fact costs readers the most. From 14 days before
// one starts until 3 days after it ends, the agents work in ticket moment mode (scripts/ticket-moment.mjs):
// facts are rechecked every day and no new guides are written. Add a moment as soon as its dates are
// confirmed, with the source.
export const TICKET_MOMENTS = [
  { name: "2027 balance payment window", start: "2027-04-01", end: "2027-04-07", source: Y2027 },
];
