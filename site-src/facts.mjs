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
const CHECKED = "2026-10-28";
const INFO = "https://www.glastonburyfestivals.co.uk/info/";
const SUNDAY_TERMS = "https://www.glastonburyfestivals.co.uk/wp-content/uploads/2026/10/GF-Sunday-Ticket-TCs-2027-FINAL-CL-.pdf";

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
  refundDeadline: { value: "7 May 2027", meaning: "Last moment (11.59pm BST) to get a refund on a 2027 general admission ticket or car park pass; non-refundable after it", source: INFO, checked: CHECKED, recheckBy: "2027-05-07" },
  refundFee: { value: "£25", meaning: "Administration charge kept from each refunded 2027 ticket", source: INFO, checked: CHECKED, recheckBy: "2027-05-07" },
  coachCancelFee: { value: "£15 coach cancellation fee", meaning: "Extra administration charge kept, on top of the ticket charge, from any cancelled 2027 ticket + coach travel booking", source: INFO, checked: CHECKED, recheckBy: "2027-05-07" },
  carParkPass: { value: "£60, plus £3 postage where bought separately", meaning: "2027 general admission car park pass, sold with the balance; the same price for accessible or Blue Badge parking", source: INFO, checked: CHECKED, recheckBy: "2027-04-07" },
  accessDeadline: { value: "12 May", meaning: "Final deadline for 2027 Access Applications, as listed on the info page", source: INFO, checked: CHECKED, recheckBy: "2027-05-12" },
  accessCampsiteDeadline: { value: "30 April 2027", meaning: "Date by which festival-goers must have completed the Access Application Form to stay in the Spring Ground accessible campsite at the 2027 festival, as the camping section of the info page gives it (its accessibility section gives a later final deadline for Access Applications, accessDeadline)", source: INFO, checked: "2026-11-15", recheckBy: "2027-04-30" },
  localSaleDate: { value: "Sunday 1 November 2026", meaning: "Day of the 2027 local resident full weekend and Sunday ticket sale, on glastonbury.seetickets.com", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  localSaleInner: { value: "9am on Sunday 1 November 2026", meaning: "Local full weekend tickets on sale to the inner zone only", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  localSaleOuter: { value: "10am on Sunday 1 November 2026", meaning: "Local full weekend tickets on sale to the inner and outer zones", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  sundaySale: { value: "11am on Sunday 1 November 2026", meaning: "Sunday tickets on sale to Mendip and Central Somerset residents", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  sundayPrice: { value: "£145", meaning: "2027 Sunday ticket per person, including the bus to and from the site, plus postage and packing per order", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  sundayChildBus: { value: "£25", meaning: "2027 pre-booked Sunday bus ticket for a child aged 6 to 12 (the child is admitted free)", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  sundayProtection: { value: "£4.10", meaning: "Optional TicketPlan Booking Refund Protection per 2027 Sunday ticket", source: INFO, checked: "2026-11-05", recheckBy: "2027-05-07" },
  sundayPickups: { value: "9am and 11am", meaning: "2027 Sunday ticket bus morning pick-up times from each town", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  sundayReturns: { value: "10pm and 12.30am", meaning: "2027 Sunday ticket return bus times from the festival (22:00 and 00:30)", source: INFO, checked: "2026-11-05", recheckBy: "2027-06-27" },
  ticketDispatch: { value: "late May to June 2027", meaning: "When UK general admission tickets for 2027 are sent out by Royal Mail, signed for", source: INFO, checked: "2026-11-04", recheckBy: "2027-06-27" },
  ticketsArriveBy: { value: "Wednesday 16 June 2027", meaning: "7 days before the 2027 festival starts on 23 June: the festival expects tickets to have arrived by then, and to contact See Tickets if not", source: INFO, checked: "2026-11-04", recheckBy: "2027-06-27" },
  coachVoucher: { value: "mid-May 2027", meaning: "When 2027 ticket and coach travel vouchers are expected to be sent, as e-tickets", source: INFO, checked: "2026-11-04", recheckBy: "2027-05-31" },
  worthyViewParking: { value: "£70", meaning: "2027 Worthy View car parking ticket, booked with the accommodation (a general car park pass can't be used there)", source: INFO, checked: "2026-11-09", recheckBy: "2027-06-27" },
  accomCancelDeadline: { value: "7 May 2027", meaning: "Last day to cancel a 2027 Worthy View or Sticklinch accommodation booking for a refund (the info page says \"up until May 7th\"); non-refundable after it", source: INFO, checked: "2026-11-09", recheckBy: "2027-05-07" },
  accomCancelFee: { value: "£25", meaning: "Administration fee per unit kept from a cancelled 2027 Worthy View or Sticklinch accommodation booking", source: INFO, checked: "2026-11-09", recheckBy: "2027-05-07" },
  festivalFirstDay: { value: "23 June 2027", meaning: "First day of the 2027 festival (a Wednesday), the day that counts for the age 13 ticket rule: the 2027 ticket news says everyone aged 13 or over on 23rd June 2027 must be registered", source: Y2027, checked: "2026-11-16", recheckBy: "2027-06-27" },
  greenpeaceOnSite: { value: "Tuesday 22 to Monday 28 June 2027", meaning: "When Greenpeace's Glastonbury 2027 volunteers must be available on site (its page: \"from Tuesday 22nd June until Monday 28th June 2027\")", source: "https://www.greenpeace.org.uk/volunteering/volunteering-at-festivals/glastonbury/", checked: "2026-11-16", recheckBy: "2027-06-28" },
  coachAccessDeadline: { value: "30 April 2027", meaning: "Deadline, in the ticket + coach booking terms for the 2027 festival on the info page, to email coachtravel@seetickets.com and accessibility@glastofest.co.uk if you need wheelchair access or storage on your coach (the terms say \"no later than 30th April\"). A different deadline from accessCampsiteDeadline, which happens to fall on the same day", source: INFO, checked: "2026-11-16", recheckBy: "2027-04-30" },
  jobsPay: { value: "£14.50 to £19 an hour", meaning: "Range of hourly pay on the seven fixed-term 2027 job sheets linked from the Jobs section of the info page on 18 November 2026 (lowest: Accessibility Team Assistant, Hospitality Sales Assistant, The Hatch; highest: Tent Lead)", source: INFO, checked: "2026-11-18", recheckBy: "2026-12-08" },
  jobsContracts: { value: "1 February and 16 July 2027", meaning: "Earliest start and latest end of the contracts on those seven 2027 job sheets (Accessibility Team Assistant and Hospitality Sales Assistant start 1 February; Procurement Assistant and Tent Lead end 16 July)", source: INFO, checked: "2026-11-18", recheckBy: "2026-12-08" },
  jobsApplyBy: { value: "20 November to 8 December 2026", meaning: "Earliest and latest closing dates on those seven 2027 job sheets (Hospitality Sales Assistant 20 November, Tent Lead 8 December)", source: INFO, checked: "2026-11-18", recheckBy: "2026-12-08" },
  sundayEntry: { value: "8am on Sunday 27 June 2027", meaning: "Earliest entry on a 2027 Sunday ticket", source: SUNDAY_TERMS, checked: "2026-11-05", recheckBy: "2027-06-27" },
};

// Ticket moments: when people search most and a wrong fact costs readers the most. From 14 days before
// one starts until 3 days after it ends, the agents work in ticket moment mode (scripts/ticket-moment.mjs):
// facts are rechecked every day and no new guides are written. Add a moment as soon as its dates are
// confirmed, with the source. Only sales and deadlines open to everyone count (see SEO-AUDITOR.md).
export const TICKET_MOMENTS = [
  { name: "2027 balance payment window", start: "2027-04-01", end: "2027-04-07", source: Y2027 },
];
