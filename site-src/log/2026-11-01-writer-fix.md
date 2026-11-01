# Writer fix run, 1 November 2026 (12:07pm)

Pull request #73 (seo-agent/2026-11-01-am), commit 1afb624: reviewer a passed it, reviewer b failed it on five points. First failed commit on this pull request, so it is fixed, not closed.

I downloaded and searched in full the info page, the 2025 sale FAQ, the 2027 ticket news page and the NME 2027 sell out report. I agreed with all five points.

1. Queue guide, "While you wait": dropped "Use your normal connection", which no source says. The bullet now gives the 2025 sale FAQ's own advice: "you must stick to one tab/device per IP address and please do not refresh your page once you are in the queue", with its reason.
2. Scams guide: the refund sentence now gives the charge and the deadline from the info page ("A £25 administration charge will be retained from all refunded tickets", extra for ticket + coach bookings, "23:59 BST on Friday 7th May 2027"), using {{fact:refundFee}} and {{fact:refundDeadline}}.
3. Glossary, balance payment window: now uses {{fact:balanceWindow}} instead of a typed date.
4. Coach guide: added OFFICIAL.info ("6pm BST on Thursday 1st October 2026"; general sale "9am (BST) on Sunday 4th October 2026") and NEWS.nme2027 ("selling out in under 30 minutes on Thursday (October 1)") to its sources.
5. Ticket tips guide: "many times the number of tickets" became "far higher than the number of tickets", matching the info page ("expected to significantly outweigh the number of tickets available"). The same unsourced phrase was in the queue guide's and first time guide's opening, both already changed in this pull request, so I fixed those too.

Updates page: the queue bullet now describes the new advice, and one new bullet for the scams guide's refund pointer.

Whole pull request rechecked claim by claim against reviewer b's table: every other added or changed claim matches its source line. check-sources on all 10 changed guides: 22 pages, 0 dead or moved, 4 blocked (the two See Tickets pages, Action Fraud, ITV). Both reviewers opened those in a browser and found them blocked, not gone; nothing changed here rests on them, so I left them.

Build, personal data check and the full test suite (93 tests) pass.

For the auditor: the writer should not type "many times" for demand again without a source giving both numbers. The local and Sunday sale facts have recheckBy 2026-11-01 and need updating on the 3.45pm run.
