# Writer, fix run, 2026-11-24 (12:07 UK time backup, started by the seo-fix-needed label)

PR #123 (`seo-agent/2026-11-24-new-1223`, new guide `glastonbury-on-your-own`): both reviewers failed commit 0535712. First failed commit on this pull request, so it is fixed, not closed.

Sources downloaded in full again today and searched as text: the festival's info page and Time Out's 2027 queue report.

## Reviewer a

1. Greenpeace and National Express tips credited to the festival: right. The trains, Free Press "interesting stuff", Green Fields and "buddy up" lines are now credited to Greenpeace's tips on the festival's information page; the coach being full of festival-goers to National Express. The long walk now uses the festival's own packing advice ("you'll inevitably have to carry your stuff a fair distance to where you camp"), and making friends with neighbours uses the festival's crime advice ("make friends with your neighbours. Look out for each other's property"). The spare coach ticket tip sits in the coach section without a named author, so it is now "one tip for coach travellers on the festival's information page".
2. Train bullet misquote: right. Now "help you find your way once you reach the site".
3. "at any hour": right. Now says Worthy Welfare and the Samaritans are there 24 hours a day.
4. Time Out claim: right. Now "in the 2027 coach sale", plus the festival's own line that in both the coach and general sales (6pm or 9am) everyone on the page when the sale begins gets a random place.
5. Photo ID for coach travellers: right. Added that the ticket is handed out once the coach has left the pick-up point and that photo ID must be shown to receive it.

## Reviewer b

1. Same as a's point 1, fixed as above.
Advisories, all tidied: the 13 to 15 year old exit and re-entry wristband exception added; the first paragraph now says a general admission ticket is posted; Samaritans location left as the dedicated section gives it.

## Whole pull request rechecked

Every sentence in the guide, the two link-in sentences and the updates bullet matched again to a line in the info page or Time Out. Nothing else needed changing. `check-sources.mjs --slug` on the three changed guides: 0 dead, moved or blocked. Similarity: highest 0.25. Build, personal data check and all 96 tests pass. No page asked for anything.

# Second fix, 2026-11-24 (12:40 UK time, started by the seo-fix-needed label)

Reviewer b passed commit ab366f9; reviewer a failed it on one point. This is the second failed commit on PR #123, so it is fixed, not closed. The festival's info page downloaded in full again today and searched as text.

## Reviewer a

1. "What we couldn't confirm" wrongly said the info page has nothing for people on their own: right. Its "Crime Reduction and Personal Safety" section says "Keep with friends or people you trust ... You present a far less vulnerable target as a group than you would on your own", "Avoid dark areas and take advantage of the extra lighting along main thoroughfares and in the car parks" and "If using the cash machines after dark, go with a friend". Added a short "Staying safe on your own" section before "If you need help", credited to the festival. "What we couldn't confirm" is cut to the meetups point only; I searched the whole page for meet, meetup, alone, solo and on your own, and the only "meet" lines are about other things (accessibility schemes, pitch requests, "You'll meet all kinds of people").

## Whole pull request rechecked

Every other sentence is unchanged since ab366f9, which both reviewers passed claim by claim. The new sentences each match a line quoted above. `check-sources.mjs --slug` on the three changed guides: 0 dead, moved or blocked. Similarity: highest 0.26 (where to camp). No page asked for anything.

Lesson for the auditor: a "the source doesn't say" sentence should be checked with a search for the reader's own words (here "on your own"), not only synonyms.
