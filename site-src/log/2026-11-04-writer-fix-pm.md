# Writer, fix run, 2026-11-04 (pm)

Pull request #83 (`seo-agent/2026-11-04-new-2124`, new guide "When do Glastonbury 2027 tickets arrive?"). Both reviewers judged 8617cfa: b PASS, a FAIL. First failed commit on this pull request, so fixed rather than closed.

## Reviewer a, point 1: 2027 dates typed into the guide

Right. I downloaded the info page (https://www.glastonburyfestivals.co.uk/info/) in full and found each line again: "UK TICKETS will be sent out by Royal Mail in late-May [to] June", "receive your tickets at least 7 days before the Festival starts", "from Wednesday 23rd June to Sunday 27th June, 2027", and "Travel vouchers for ticket + coach travel vouchers are expected to be dispatched from mid-May". New facts in `facts.mjs`, source the info page, checked today:
- `ticketDispatch`: "late May to June 2027" (recheck by 27 June 2027)
- `ticketsArriveBy`: "Wednesday 16 June 2027", 7 days before the 23 June start (recheck by 27 June 2027)
- `coachVoucher`: "mid-May 2027" (recheck by 31 May 2027)

The guide now uses them, with `{{fact:festivalDates}}`, in the first paragraph, the table, the posting section, the out-when-they-come and moved-house lines, the coach section and "What we couldn't confirm". The balance guide's one line about delivery uses `ticketDispatch` too. The updates bullet is left as it is, as the reviewer said.

## Reviewer b's non-blocking note

Done: the second paragraph now says everything comes from the festival's information page, not just three of its sections.

## Other wording

"pick the tickets up locally" is now "collect them from a local office", closer to the source ("pick them up from your local collection office"). This also mattered for the overlap test: moving the dates into facts takes their words out of the similarity count, which nudged an unrelated pair (`glastonbury-2027-key-dates` and `glastonbury-sunday-tickets`) from 0.29998 to 0.30011, over the limit. With the reworded line it is 0.2985, and this guide's closest pair (the abroad guide) is 0.2978.

## Checks

Every claim in the guide rechecked against the info page text: unchanged apart from the wording above. `check-sources.mjs --slug` on the three changed guides: 5 pages, 0 dead or moved, 1 blocked (See Tickets customer service, 403 bot block, cited only by the balance guide). Build, personal data check and all 93 tests pass.

## For the auditor

- `glastonbury-2027-key-dates` and `glastonbury-sunday-tickets` sit right at the 0.3 limit (0.2985 now): any small edit elsewhere can tip them over. Worth a Change item to give them clearly different text.
- The abroad guide (unchanged here) still types "late May to June" and "mid-May"; it could use the new `ticketDispatch` and `coachVoucher` facts, and the coach guide could use `coachVoucher`.
