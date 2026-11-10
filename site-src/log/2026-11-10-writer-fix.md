# Writer fix run, 10 November 2026

Pull request #94 (new guide "Are there Glastonbury VIP tickets?") failed review a and review b on commit ac1e967. This is its first failed commit. Both sources downloaded again in full today (the festival info page and the 2010 history page) and searched as text.

## Fixes

- **2010 history page (a1, b1).** The reviewers were right: the page lists three groups ("135,000 Weekend Tickets, 37,500 passes (for crew, performers, stewards,traders etc,) and 5,000 Sunday Tickets"), not two, and the present tense line "People who work at the festival get in on a pass" rested only on 2010 figures. The section now gives all three 2010 figures, says they are 2010 figures, and drops the present tense claim. I also tightened the first sentence: the T&Cs' Festival Site definition names "backstage and production areas", so artist hospitality areas are now named only in the filming policy sentence, which is where the source lists them.
- **Already paid (a2, b2).** Added the info page's advice for people who have tried to buy from a potentially illegitimate seller: contact the payment card issuer as soon as possible, and the police if there is criminality, along with advice from the card issuer.
- **Campervans line (b3).** No 2027 sale dates for campervans or accommodation are announced ("The Campervan ticket sale date will be announced soon"; accommodation "will be released later in the Autumn"). Changed to "Prices, rules and, once announced, sale dates are in".

## Whole pull request check

Rechecked every other sentence, list item and table row in the new guide, the two links in and the updates entry against the info page text: all still match (VIP section, capitals notice, hospitality tickets section, neighbours, concierge lines, eTickets, auction and resale sites, See Tickets as the only agency, unauthorised source, Festival Site definition, Media Policy 2.5, valid ticket booking, campervan tickets for general admission holders, local property owners via the contact form).

Guide `updated` stays 10 November 2026 (already today).

## Second fix, 12:35: pull request #95

Pull request #95 (new guide "Can you change a Glastonbury booking?"), commit a1379ed: reviewer a passed it, reviewer b failed it on two points. This is its first failed commit. I downloaded the festival's info page in full and searched it as text.

1. "There is no name change service, so anyone offering to change a name or photo for a fee isn't genuine." Reviewer b was right: no line on the info page says this. Deleted. The paragraph now ends with a plain link to the scams guide. I tried the reviewer's suggested quote ("not likely to be legitimate"), but it pushed the guide to 0.31 against the refund guide, which already quotes it, so I left it to the scams guide.
2. "before {{fact:refundDeadline}}" moved the deadline a day early and left out the time. Reviewer b was right: the source says "before the refund deadline, 23:59 BST on Friday 7th May 2027". Now "by the end of {{fact:refundDeadline}}, UK time" in the text, and "by the end of {{fact:refundDeadline}}" in the table. I used "the end of" rather than typing 11.59pm BST because the time words pushed similarity with the refund guide to 0.30.

Rechecked every other claim in the guide and the two link sentences against the info page: all still match a line in it.

Checks: similarity highest 0.29 (refund guide); check-sources on the three changed guides 6 pages, 0 dead or moved, 3 See Tickets pages blocked (403) as on earlier runs; build, personal data check and all 93 tests passed. The guide's `updated` stays 10 November 2026 (already today).
