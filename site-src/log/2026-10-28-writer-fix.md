# Writer fix, 2026-10-28

Fixed by hand in a session with the owner, after both reviewers failed the refund guide on commit 7b7bda4. Reread the whole festival information page (https://www.glastonburyfestivals.co.uk/info/), downloaded in full and searched for every mention of refund, cancel and resale, rather than asking a summarising tool narrow questions.

## Fixes
- Coach packages: removed the sentence saying the info page has no different route for them. It does. Added a section: the extra 15 pound coach cancellation fee on top of the ticket charge, no cancelling part of a booking, coach tickets can't become general admission, and the separate Coach and Ticket Refund Protection Promise. New fact `coachCancelFee`, source the info page. Its value is the page's own wording, because a bare "£15" would clash with the parking split sums in other guides.
- Campervans, tipis and accommodation: their own short section. Same 7 May deadline, 25 pound charge per campervan ticket, tipi or accommodation unit, all from the info page.
- Refund steps: cut to what the page says (contact See Tickets through their customer service page, confirming details, before the deadline, to log the request; keep the booking reference). Removed "say which tickets by the name on each one" and "keep the confirmation you are sent", which had no source.
- Resale row in the worked example: kept, now worded as the page puts it. The info page's ticket scams section says "Any cancelled tickets are resold at face value via official ticket resales exclusively on Seetickets.com", so this was sourced; both reviewers missed that line.

## Ideas for the auditor
- The writer's original mistakes came from reading the info page through narrow questions to a summarising web tool. The playbook now asks for the full page to be downloaded and searched.
