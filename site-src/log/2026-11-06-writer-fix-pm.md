# Writer fix run, 6 November 2026 (evening)

Pull request #88 (new guide "Glastonbury ticket prices by year") failed review a and review b on commit 980ec32. This is its first failed commit. I downloaded again and searched in full the history index and all 39 year pages, the 2023 balance reminder, both Glasto Fest Feed 2024 pages (through the browser: curl got error 520), the 2025 sale FAQ, the 2027 ticket announcement and the info page.

## What I changed

- Booking fee (a1, b1): the reviewers were right, no history page contains "booking". The third column is now headed "Notes", and the 2023, 2024 and 2025 notes name the source of the fee (Glasto Fest Feed's 2024 sale report for 2023 and 2024, the festival's 2025 sale FAQ for 2025). The booking fee note now says no history page mentions a fee and credits each figure to its source.
- "Biggest rise since 1992" (a2): deleted. Kept "about 20%".
- 2007 price (a3): removed the split string and its comment. The row now says "See the 2007 page". The 2007 price is the same amount as the 2027 Sunday ticket fact, and a test rejects any guide that types a fact's value. That needs the owner (below).
- "Every" price (b2): now "almost every" in the summary, the updates entry and the link sentence in the sale history guide.
- Coach cancellations (b3): added that ticket and coach bookings lost £40 in all in 2023 and 2024, and that for 2027 a {{fact:coachCancelFee}} is kept on top of the {{fact:refundFee}}.
- Resale price (b4): now said for 2024 only.
- "Always" paid on top (b5): now "Some things are paid for on top".
- Also filled in the programme prices the reviewers noticed were missing: 1985 90p, 1986 £1, 1992 £4, 1993 £4.

## Checked

Every claim in the guide, its two link sentences and the updates entry, against the downloaded text. No changes to facts.mjs.

## Needs the owner

The facts test rejects a guide that types any fact's value, so a historical price that happens to equal a current fact (2007 and the 2027 Sunday ticket) can't be shown. Recommend letting tables of past years' prices type such values, or exempting this guide's history table.
