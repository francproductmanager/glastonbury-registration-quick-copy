# Writer fix run, 11 November 2026 (12:07pm)

Pull request #98 (`seo-agent/2026-11-11-am`), first failed commit 1c35061. Both reviewers failed it on the same point.

## Points

- Reviewer a, point 1, and reviewer b, point A: the key dates refund row gave the £25 charge without the extra £15 for ticket and coach bookings. Right: the info page says "An additional £15 administration charge will be retained from any cancelled ticket + coach travel bookings. (£25 ticket cancellation fee + £15 coach cancellation fee.)" Fixed: the row now reads "less a {{fact:refundFee}} charge per ticket (plus a {{fact:coachCancelFee}} on a ticket and coach booking)". The updates page bullet gives only the deadline, so it still reads correctly.

## Whole pull request rechecked

- Info page downloaded and searched as text today: refund deadline 23:59 BST Friday 7th May 2027, £25 per refunded ticket, £15 on top for ticket and coach bookings, Access Applications final deadline 12th May.
- NME 2027 article: "have sold out in just 42 minutes".
- Nationwide April 2025 release: "high demand and low availability create perfect storm for scammers".
- Wording only changes (summaries, headings) make no new claims.

## Checks

- `check-sources.mjs --slug` on all six changed guides: 0 dead or moved. Blocked, as in earlier runs: three See Tickets pages and Action Fraud; none of the changed claims rests on them.
- Personal data check passes.
- Tests: 92 of 93 pass. The one failure is the home page date line at 360px ("Wednesday 11 November 2026" is too long), which fails on `main` too and needs the owner: agents may not edit `app.js`, styles or tests.
