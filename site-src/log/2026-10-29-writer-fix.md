# Writer, fix run, 2026-10-29

Pull request #65 (`seo-agent/2026-10-29-am`), commit 58be4d2: reviewer a FAIL (one point), reviewer b PASS. First failed commit on this pull request.

## Point 1 (reviewer a): dead sources in refreshed guides
Reviewer right. Checked with curl today: /information/tickets/ and the 2027 sale FAQ PDF both redirect to the festival home page.
- Key dates: dropped `OFFICIAL.tickets`. Its claims are on the info page (already listed) and the 2027 ticket information page.
- Next sale: dropped `OFFICIAL.tickets` and `OFFICIAL.sale2027`, added `NEWS.timeout2027queue`. The "What to expect" table's main sale column now rests on the info page ("up to 6 tickets per transaction", deposit of 100 pounds, balance in the first week of April 2027, coach sale 1 October and general sale 4 October 2026) and Time Out ("enter their Glastonbury registration number before entering the queue", "a unique queue ID, linked to their registration").
- Registration: dropped `OFFICIAL.tickets` and `OFFICIAL.sale2027`. The closing date and reopening wording are on the info page ("Registration closed at 5pm BST on Friday 25th September, and will not reopen until after the October ticket sales"; "Registration will reopen later in the Autumn"), as are the 48 hour photo check and the rule that a photo can't be changed with a booking linked.

## Found in my own check (not raised by the reviewers)
- Deposits guide: `NEWS.radiox2025balance` now redirects to a different Radio X article about the 2027 sale, which no longer says anything about the 2025 unpaid balance refund. I removed the sentence it supported (2025: 50 pounds back from 75, about seven working days, contact See Tickets if the card changed) and the source. The 2027 rule stays (info page). The "2025 deposit was 75 pounds" line now cites the 2025 sale FAQ ("a £75 deposit"), and "up to four people per booking in 2025" for the resale cites the 2025 resale FAQ ("up to 4 tickets per transaction"). Both added to the guide's sources.
- Other ways and Sunday guides: no dead sources (`OFFICIAL.info`, `OFFICIAL.sunday2027`, Time Out and charity pages all load).
- See Tickets and Glasto Fest Feed pages return 403 to curl (bot blocking, not a redirect); left as they are.

## Reviewer b note (not a fail)
Sunday guide uses `{{fact:postage}}`. Left for a later run: the morning run found a reviewer regression case depends on that fact's meaning line, so a separate Sunday postage fact is an idea for the auditor.

## Idea for the auditor
`radiox2025balance` is still cited by the balance payment guide (`got-a-glastonbury-ticket-what-next`), outside this pull request; it now redirects. Worth a backlog item with item 4.
